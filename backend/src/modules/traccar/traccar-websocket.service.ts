import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Buffer } from 'buffer';
import WebSocket, { RawData } from 'ws';

import { PrismaService } from '../../core/prisma/prisma.service';
import { LocationSource } from '@prisma/client';
import { LocationEventGateway } from '../location-event/gateways/location-event.gateway';
import { LocationThrottleService } from '../location-event/location-throttle.service';
import { LocationUpdateDto } from '../location-event/dto/location-update.dto';

// Integration state keys
const INTEGRATION_KEY_WS_LAST_MESSAGE = 'traccar:ws:lastMessage';

// Minimum interval between stored positions per bus to avoid spamming DB (in milliseconds)
const MIN_POSITION_INTERVAL_MS = 5000;

// Default reconnect configuration
const INITIAL_RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_DELAY_MS = 60000;

// Heartbeat configuration
const HEARTBEAT_INTERVAL_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 45000;

interface TraccarWebSocketPosition {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed?: number;
  course?: number;
  serverTime?: string;
  fixTime?: string;
  deviceTime?: string;
  valid?: boolean;
}

interface TraccarWebSocketMessage {
  positions?: TraccarWebSocketPosition[];
  // We ignore devices and events for now, but keep them for future extension
  // devices?: unknown[];
  // events?: unknown[];
}

@Injectable()
export class TraccarWebSocketService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TraccarWebSocketService.name);

  private ws?: WebSocket;
  private reconnectTimeout?: NodeJS.Timeout;
  private reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  private isShuttingDown = false;
  private isConnecting = false;
  private heartbeatInterval?: NodeJS.Timeout;
  private lastHeartbeatAck = 0;

  // In–memory map to throttle how often we persist positions per bus
  private lastBusTimestamps = new Map<number, number>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly locationEventGateway: LocationEventGateway,
    private readonly locationThrottleService: LocationThrottleService,
  ) {}

  async onModuleInit(): Promise<void> {
    const enabledEnv = this.configService.get<string>('TRACCAR_WS_ENABLED');
    const enabled = enabledEnv === undefined || enabledEnv === 'true';

    if (!enabled) {
      this.logger.log(
        'Traccar WebSocket integration is disabled via TRACCAR_WS_ENABLED',
      );
      return;
    }

    await this.connectWithSession();
  }

  onModuleDestroy(): void {
    this.isShuttingDown = true;

    this.clearReconnectTimer();
    this.stopHeartbeat();

    if (this.ws) {
      this.logger.log('Closing Traccar WebSocket connection');
      this.ws.close();
      this.ws = undefined;
    }
  }

  /**
   * Create or refresh Traccar session and open WebSocket connection.
   */
  private async connectWithSession(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    if (this.isConnecting) {
      this.logger.debug(
        'Traccar WebSocket connection attempt already in progress',
      );
      return;
    }

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      this.logger.debug('Traccar WebSocket connection already active');
      return;
    }

    this.isConnecting = true;

    try {
      const baseUrl =
        this.configService.get<string>('TRACCAR_BASE_URL') ??
        'https://demo.traccar.org';
      const token = this.configService.get<string>('TRACCAR_TOKEN')?.trim();

      if (!token) {
        this.logger.warn(
          'TRACCAR_TOKEN is not configured – WebSocket will not be started',
        );
        return;
      }

      // Establish HTTP session to obtain JSESSIONID cookie
      const sessionCookie = await this.createSessionCookie(baseUrl, token);
      if (!sessionCookie) {
        this.logger.warn(
          'Failed to obtain Traccar session cookie – skipping WebSocket connection',
        );
        return;
      }

      this.openWebSocket(baseUrl, sessionCookie);
    } catch (error) {
      this.logger.error(
        'Unexpected error while initializing Traccar WebSocket connection',
        error as Error,
      );
      this.scheduleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Call /api/session?token=USER_TOKEN to obtain session cookie for WebSocket auth.
   * See: https://www.traccar.org/traccar-api/
   */
  private async createSessionCookie(
    baseUrl: string,
    token: string,
  ): Promise<string | null> {
    const url = new URL('/api/session', baseUrl).toString();

    try {
      this.logger.debug('Requesting Traccar session cookie for WebSocket');

      const response = await axios.get(url, {
        params: { token },
        // We only need headers for cookies; body is not used
        validateStatus: () => true,
      });

      if (response.status !== 200) {
        this.logger.error(
          `Failed to create Traccar session: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const setCookieHeader = response.headers['set-cookie'];
      if (!setCookieHeader || !Array.isArray(setCookieHeader)) {
        this.logger.error(
          'Traccar session response did not include any Set-Cookie header',
        );
        return null;
      }

      // Traccar uses JSESSIONID; we join all cookies just in case
      const cookies = setCookieHeader
        .map((c) => c.split(';')[0])
        .filter(Boolean)
        .join('; ');

      if (!cookies) {
        this.logger.error('Parsed Traccar session cookie string is empty');
        return null;
      }

      this.logger.log('Successfully obtained Traccar session cookie');
      return cookies;
    } catch (error) {
      this.logger.error(
        'Error while requesting Traccar session cookie for WebSocket',
        error as Error,
      );
      return null;
    }
  }

  /**
   * Open WebSocket connection to /api/socket using provided cookie.
   */
  private openWebSocket(baseUrl: string, cookieHeader: string): void {
    try {
      if (
        this.ws &&
        (this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING)
      ) {
        this.logger.debug(
          'Skipping new WebSocket connection because an active socket already exists',
        );
        return;
      }

      const wsUrl = this.buildWebSocketUrl(baseUrl);
      this.logger.log(`Connecting to Traccar WebSocket at ${wsUrl}`);

      this.ws = new WebSocket(wsUrl, {
        headers: {
          Cookie: cookieHeader,
        },
      });

      this.ws.on('open', () => {
        this.logger.log('Traccar WebSocket connection established');
        // Reset reconnect delay after successful connection
        this.reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
        this.lastHeartbeatAck = Date.now();
        this.startHeartbeat();
      });

      this.ws.on('message', (data: RawData) => {
        this.lastHeartbeatAck = Date.now();
        this.handleWebSocketMessage(data).catch((error) => {
          this.logger.error(
            'Error while processing Traccar WebSocket message',
            error as Error,
          );
        });
      });

      this.ws.on('error', (error: Error) => {
        this.logger.error('Traccar WebSocket error', error);
        this.forceReconnect('Socket error');
      });

      this.ws.on('pong', () => {
        this.lastHeartbeatAck = Date.now();
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        this.logger.warn(
          `Traccar WebSocket closed: code=${code}, reason=${reason.toString()}`,
        );
        this.stopHeartbeat();
        this.ws = undefined;

        if (!this.isShuttingDown) {
          this.scheduleReconnect();
        }
      });
    } catch (error) {
      this.logger.error(
        'Failed to open Traccar WebSocket connection',
        error as Error,
      );
      this.scheduleReconnect();
    }
  }

  private buildWebSocketUrl(baseUrl: string): string {
    // Convert http/https to ws/wss
    const url = new URL('/api/socket', baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.toString();
  }

  /**
   * Schedule reconnect with exponential backoff.
   */
  private scheduleReconnect(): void {
    if (this.isShuttingDown) {
      return;
    }

    if (this.reconnectTimeout || this.isConnecting) {
      // Already scheduled
      return;
    }

    const delay = this.reconnectDelayMs;
    this.logger.log(`Scheduling Traccar WebSocket reconnect in ${delay}ms`);

    this.reconnectTimeout = setTimeout(() => {
      this.clearReconnectTimer();
      // Exponential backoff (up to max)
      this.reconnectDelayMs = Math.min(
        this.reconnectDelayMs * 2,
        MAX_RECONNECT_DELAY_MS,
      );
      void this.connectWithSession();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.lastHeartbeatAck = Date.now();

    this.heartbeatInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }

      const now = Date.now();
      if (now - this.lastHeartbeatAck > HEARTBEAT_TIMEOUT_MS) {
        this.forceReconnect('Heartbeat timeout');
        return;
      }

      try {
        this.ws.ping();
      } catch (error) {
        this.logger.error('Failed to send WebSocket ping', error as Error);
        this.forceReconnect('Heartbeat ping failed');
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  private forceReconnect(reason: string): void {
    if (this.isShuttingDown) {
      return;
    }

    this.logger.warn(`Forcing Traccar WebSocket reconnect: ${reason}`);

    this.stopHeartbeat();

    if (this.ws) {
      try {
        this.ws.terminate();
      } catch {
        // ignore
      }
      this.ws = undefined;
    }

    this.scheduleReconnect();
  }

  private decodeRawData(raw: RawData): string {
    if (typeof raw === 'string') {
      return raw;
    }

    if (Array.isArray(raw)) {
      return Buffer.concat(raw).toString('utf8');
    }

    if (raw instanceof ArrayBuffer) {
      return Buffer.from(raw).toString('utf8');
    }

    return (raw as Buffer).toString('utf8');
  }

  /**
   * Handle incoming WebSocket message with positions.
   */
  private async handleWebSocketMessage(data: RawData): Promise<void> {
    let parsed: TraccarWebSocketMessage;

    try {
      const text = this.decodeRawData(data);
      parsed = JSON.parse(text) as TraccarWebSocketMessage;
    } catch (error) {
      this.logger.error(
        'Failed to parse Traccar WebSocket JSON message',
        error as Error,
      );
      return;
    }

    const positions = parsed.positions ?? [];
    if (!positions.length) {
      // Nothing to do for this message
      return;
    }

    let latestTimestamp: Date | null = null;

    for (const position of positions) {
      // Skip invalid positions
      if (position.valid === false) {
        this.logger.debug(
          `Skipping invalid WebSocket position for deviceId=${position.deviceId}`,
        );
        continue;
      }

      const bus = await this.prisma.bus.findFirst({
        where: {
          traccarDeviceId: position.deviceId,
        },
      });

      if (!bus) {
        this.logger.warn(
          `No bus mapping found for Traccar deviceId=${position.deviceId} (WebSocket). Position skipped.`,
        );
        continue;
      }

      const timestamp =
        (position.serverTime && new Date(position.serverTime)) ||
        (position.fixTime && new Date(position.fixTime)) ||
        (position.deviceTime && new Date(position.deviceTime)) ||
        new Date();

      // Debounce per bus: skip if we processed a very recent position
      const lastTs = this.lastBusTimestamps.get(bus.id) ?? 0;
      if (timestamp.getTime() - lastTs < MIN_POSITION_INTERVAL_MS) {
        this.logger.debug(
          `Skipping frequent position for busId=${bus.id}; lastTs=${new Date(
            lastTs,
          ).toISOString()}, currentTs=${timestamp.toISOString()}`,
        );
        continue;
      }

      this.lastBusTimestamps.set(bus.id, timestamp.getTime());

      // Convert speed from knots to km/h (same logic as cron sync)
      const speedKph =
        position.speed !== undefined && position.speed !== null
          ? position.speed * 1.852
          : undefined;

      await this.prisma.locationEvent.create({
        data: {
          busId: bus.id,
          timestamp,
          latitude: position.latitude,
          longitude: position.longitude,
          speedKph,
          heading: position.course ?? undefined,
          source: LocationSource.gateway,
        },
      });

      await this.prisma.bus.update({
        where: { id: bus.id },
        data: {
          currentLat: position.latitude,
          currentLng: position.longitude,
          lastUpdated: timestamp,
        },
      });

      // Emit realtime location update to subscribed clients via WebSocket gateway
      // Use throttling to prevent overwhelming clients with too frequent updates
      try {
        if (this.locationThrottleService.shouldEmit(bus.id, timestamp)) {
          // Build LocationUpdateDto payload
          const locationUpdate: LocationUpdateDto = {
            busId: bus.id,
            tripId: null, // TODO: Map to active trip if available
            latitude: position.latitude,
            longitude: position.longitude,
            speedKph: speedKph ?? null,
            heading: position.course ?? null,
            timestamp: timestamp.toISOString(),
          };

          // Emit to WebSocket gateway (will broadcast to subscribed clients)
          this.locationEventGateway.emitLocationUpdate(
            bus.id,
            null, // tripId is null for now
            locationUpdate,
          );
        }
      } catch (error) {
        // Log warning but don't throw to avoid crashing WebSocket processing
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to emit location update for busId=${bus.id}: ${message}`,
        );
      }

      if (!latestTimestamp || timestamp > latestTimestamp) {
        latestTimestamp = timestamp;
      }
    }

    if (latestTimestamp) {
      await this.updateLastWebSocketMessageTime(latestTimestamp);
    }
  }

  /**
   * Persist last WebSocket message time into IntegrationState for cron backfill logic.
   */
  private async updateLastWebSocketMessageTime(time: Date): Promise<void> {
    try {
      await this.prisma.integrationState.upsert({
        where: { key: INTEGRATION_KEY_WS_LAST_MESSAGE },
        update: {
          value: {
            lastMessageTime: time.toISOString(),
          },
        },
        create: {
          key: INTEGRATION_KEY_WS_LAST_MESSAGE,
          value: {
            lastMessageTime: time.toISOString(),
          },
        },
      });
    } catch (error) {
      this.logger.error(
        'Failed to update last WebSocket message time in IntegrationState',
        error as Error,
      );
    }
  }
}
