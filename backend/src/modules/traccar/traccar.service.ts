import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';

interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  [key: string]: unknown;
}

interface TraccarPosition {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed?: number;
  course?: number;
  serverTime?: string;
  fixTime?: string;
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
    id?: number;
  }): Promise<TraccarPosition[]> {
    try {
      const baseConfig = this.buildRequestConfig();
      const config: AxiosRequestConfig = {
        ...baseConfig,
        params,
      };
      const response$ = this.httpService.get<TraccarPosition[]>(
        '/api/positions',
        config,
      );
      const response = await firstValueFrom(response$);
      return response.data ?? [];
    } catch (error) {
      this.logger.error('Failed to fetch positions from Traccar', error);
      throw error instanceof Error ? error : new Error(String(error));
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
}
