import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';

interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status?: string;
  disabled?: boolean;
  lastUpdate?: string | null;
  positionId?: number | null;
  groupId?: number | null;
  phone?: string | null;
  model?: string | null;
  contact?: string | null;
  category?: string | null;
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
}

interface TraccarPosition {
  id: number;
  deviceId: number;
  protocol?: string;
  deviceTime?: string;
  fixTime?: string;
  serverTime?: string;
  outdated?: boolean;
  valid?: boolean;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number; // in knots (1 knot = 1.852 km/h)
  course?: number;
  address?: string;
  accuracy?: number;
  network?: Record<string, unknown>;
  geofenceIds?: number[];
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
}

@Injectable()
export class TraccarService {
  private readonly logger = new Logger(TraccarService.name);
  private readonly baseUrl: string;
  private readonly username: string | undefined;
  private readonly password: string | undefined;
  private readonly token: string | undefined;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('TRACCAR_BASE_URL') ??
      'https://demo.traccar.org';
    this.username = this.configService.get<string>('TRACCAR_USERNAME');
    this.password = this.configService.get<string>('TRACCAR_PASSWORD');
    // Trim token to remove any whitespace/newlines
    const rawToken = this.configService.get<string>('TRACCAR_TOKEN');
    this.token = rawToken?.trim();

    // Log authentication method (without exposing sensitive data)
    if (this.token) {
      this.logger.log(
        `Traccar authentication: Token-based (length: ${this.token.length})`,
      );
    } else if (this.username && this.password) {
      this.logger.log(
        `Traccar authentication: Basic Auth (username: ${this.username})`,
      );
    } else {
      this.logger.warn(
        'Traccar authentication: No credentials found. API calls may fail.',
      );
    }
  }

  /**
   * Build Axios request config with authentication for Traccar.
   */
  private buildRequestConfig(): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
      baseURL: this.baseUrl,
      headers: {},
    };

    // Prefer token-based auth if provided
    if (this.token) {
      const existingHeaders = (config.headers as Record<string, string>) || {};
      config.headers = {
        ...existingHeaders,
        Authorization: `Bearer ${this.token}`,
      };
      return config;
    }

    // Fallback to basic auth for demo server or self-hosted instances
    if (this.username && this.password) {
      config.auth = {
        username: this.username,
        password: this.password,
      };
    }

    return config;
  }

  async getDevices(): Promise<TraccarDevice[]> {
    try {
      const config: AxiosRequestConfig = this.buildRequestConfig();
      this.logger.debug(`Fetching devices from ${this.baseUrl}/api/devices`);
      const response$ = this.httpService.get<TraccarDevice[]>(
        '/api/devices',
        config,
      );
      const response = await firstValueFrom(response$);
      const devices = response.data ?? [];
      this.logger.log(
        `Successfully fetched ${devices.length} devices from Traccar`,
      );
      return devices;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          this.logger.error(
            `Failed to fetch devices: ${error.response.status} ${error.response.statusText}`,
          );
          this.logger.error(`Response: ${JSON.stringify(error.response.data)}`);
        } else {
          this.logger.error('Failed to fetch devices: No response from server');
        }
      } else {
        this.logger.error('Failed to fetch devices from Traccar', error);
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async getPositions(params: {
    deviceId?: number;
    from?: string;
    to?: string;
    id?: number | number[]; // Support multiple IDs as per API docs: id=31&id=42
  }): Promise<TraccarPosition[]> {
    try {
      const baseConfig = this.buildRequestConfig();

      // Build query params, handling array for id parameter
      const queryParams: Record<string, unknown> = {};
      if (params.deviceId !== undefined) {
        queryParams.deviceId = params.deviceId;
      }
      if (params.from) {
        queryParams.from = params.from;
      }
      if (params.to) {
        queryParams.to = params.to;
      }
      if (params.id !== undefined) {
        // Support both single ID and array of IDs
        // Axios will serialize array as id=31&id=42
        queryParams.id = Array.isArray(params.id) ? params.id : [params.id];
      }

      // If only deviceId is provided without time range, set default range to last 7 days
      // This ensures we get positions even if device was recently online
      if (params.deviceId !== undefined && !params.from && !params.to) {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fromISO = sevenDaysAgo.toISOString();
        const toISO = now.toISOString();
        queryParams.from = fromISO;
        queryParams.to = toISO;
        this.logger.debug(
          `No time range provided for deviceId=${params.deviceId}, using default range: ${fromISO} to ${toISO}`,
        );
      }

      const config: AxiosRequestConfig = {
        ...baseConfig,
        params: queryParams,
        // Custom serializer to handle array params correctly: id=31&id=42
        paramsSerializer: (params) => {
          const parts: string[] = [];
          for (const [key, value] of Object.entries(params)) {
            if (Array.isArray(value)) {
              value.forEach((v) =>
                parts.push(`${key}=${encodeURIComponent(String(v))}`),
              );
            } else if (value !== undefined && value !== null) {
              parts.push(`${key}=${encodeURIComponent(String(value))}`);
            }
          }
          return parts.join('&');
        },
      };

      this.logger.debug(
        `Fetching positions from ${this.baseUrl}/api/positions with params: ${JSON.stringify(queryParams)}`,
      );

      const response$ = this.httpService.get<TraccarPosition[]>(
        '/api/positions',
        config,
      );
      const response = await firstValueFrom(response$);
      const positions = response.data ?? [];

      this.logger.log(
        `Successfully fetched ${positions.length} position(s) from Traccar${params.deviceId ? ` for deviceId=${params.deviceId}` : ''}`,
      );

      if (positions.length === 0 && params.deviceId !== undefined) {
        this.logger.warn(
          `No positions found for deviceId=${params.deviceId}. Device may be offline, have no recent positions, or lack access permissions.`,
        );
      }

      return positions;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          const status = error.response.status ?? HttpStatus.BAD_GATEWAY;
          const rawPayload: unknown = error.response.data;
          let payload: string | Record<string, unknown>;
          if (rawPayload === undefined || rawPayload === null) {
            payload = 'Traccar request failed';
          } else if (typeof rawPayload === 'string') {
            payload = rawPayload;
          } else if (
            typeof rawPayload === 'object' &&
            !Array.isArray(rawPayload) &&
            rawPayload !== null
          ) {
            payload = rawPayload as Record<string, unknown>;
          } else {
            payload = JSON.stringify(rawPayload);
          }

          if (
            typeof payload === 'string' &&
            payload.includes('Device access denied')
          ) {
            this.logger.warn(
              'Traccar access denied – hãy kiểm tra quyền device trên Traccar',
            );
          } else {
            this.logger.error(
              `Failed to fetch positions: ${status} ${error.response.statusText}`,
            );
          }

          throw new HttpException(payload, status);
        }

        this.logger.error(
          'Failed to fetch positions: No response from Traccar',
        );
        throw new HttpException(
          'No response from Traccar server',
          HttpStatus.BAD_GATEWAY,
        );
      }

      this.logger.error('Failed to fetch positions from Traccar', error);
      throw new HttpException(
        'Failed to fetch positions from Traccar',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createDevice(deviceData: {
    name: string;
    uniqueId: string;
    model?: string;
  }): Promise<TraccarDevice> {
    try {
      const config: AxiosRequestConfig = this.buildRequestConfig();
      this.logger.debug(
        `Creating device: ${deviceData.name} (${deviceData.uniqueId})`,
      );

      const requestBody = {
        name: deviceData.name,
        uniqueId: deviceData.uniqueId,
        model: deviceData.model || 'Test',
        disabled: false,
      };

      const response$ = this.httpService.post<TraccarDevice>(
        '/api/devices',
        requestBody,
        {
          ...config,
          headers: {
            ...config.headers,
            'Content-Type': 'application/json',
          },
        },
      );

      const response = await firstValueFrom(response$);
      this.logger.log(
        `Successfully created device: ${response.data.name} (ID: ${response.data.id})`,
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          this.logger.error(
            `Failed to create device: ${error.response.status} ${error.response.statusText}`,
          );
          this.logger.error(`Response: ${JSON.stringify(error.response.data)}`);
        } else {
          this.logger.error('Failed to create device: No response from server');
        }
      } else {
        this.logger.error('Failed to create device in Traccar', error);
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Get the latest position for a specific device.
   * This is a convenience method that fetches positions and returns the most recent one.
   */
  async getLatestPosition(deviceId: number): Promise<TraccarPosition | null> {
    try {
      this.logger.debug(`Fetching latest position for deviceId=${deviceId}`);

      // Get positions from last 24 hours to ensure we get recent data
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const positions = await this.getPositions({
        deviceId,
        from: oneDayAgo.toISOString(),
        to: now.toISOString(),
      });

      if (positions.length === 0) {
        this.logger.warn(
          `No positions found for deviceId=${deviceId} in the last 24 hours`,
        );
        return null;
      }

      // Sort by serverTime, fixTime, or deviceTime (most recent first)
      const sorted = positions.sort((a, b) => {
        const timeA =
          (a.serverTime && new Date(a.serverTime).getTime()) ||
          (a.fixTime && new Date(a.fixTime).getTime()) ||
          (a.deviceTime && new Date(a.deviceTime).getTime()) ||
          0;
        const timeB =
          (b.serverTime && new Date(b.serverTime).getTime()) ||
          (b.fixTime && new Date(b.fixTime).getTime()) ||
          (b.deviceTime && new Date(b.deviceTime).getTime()) ||
          0;
        return timeB - timeA; // Descending order (newest first)
      });

      const latest = sorted[0];
      this.logger.log(
        `Found latest position for deviceId=${deviceId}: lat=${latest.latitude}, lng=${latest.longitude}, time=${latest.serverTime || latest.fixTime || latest.deviceTime}`,
      );

      return latest;
    } catch (error) {
      this.logger.error(
        `Failed to get latest position for deviceId=${deviceId}`,
        error,
      );
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}
