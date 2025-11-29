import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SubscribeLocationDto } from '../dto/subscribe-location.dto';
import { UnsubscribeLocationDto } from '../dto/unsubscribe-location.dto';
import { LocationUpdateDto } from '../dto/location-update.dto';

interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  [key: string]: unknown;
}

type AuthenticatedSocket = Socket & {
  user?: JwtPayload;
};

@Injectable()
@WebSocketGateway({
  namespace: '/location-events',
  cors: {
    origin: '*', // TODO: Configure proper CORS for production
    credentials: true,
  },
})
export class LocationEventGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LocationEventGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Handle WebSocket connection with JWT authentication
   */
  handleConnection(client: Socket) {
    try {
      // Extract token from query params or authorization header
      const token =
        client.handshake.query.token?.toString() ||
        this.extractTokenFromHeaders(client);

      if (!token) {
        this.logger.warn(
          `Client ${client.id} attempted to connect without token`,
        );
        client.disconnect();
        return;
      }

      // Verify JWT token
      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) {
        this.logger.error('JWT_SECRET is not configured');
        client.disconnect();
        return;
      }

      try {
        const payload: JwtPayload = this.jwtService.verify<JwtPayload>(token, {
          secret,
        });
        // Attach user info to socket for later use
        (client as AuthenticatedSocket).user = payload;
        this.logger.log(
          `Client ${client.id} connected (userId: ${payload.sub}, email: ${payload.email})`,
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : JSON.stringify(error);
        this.logger.warn(
          `Client ${client.id} provided invalid token: ${message}`,
        );
        client.disconnect();
        return;
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(
        `Error during connection handling for client ${client.id}: ${message}`,
      );
      client.disconnect();
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnect(client: Socket) {
    const user = (client as AuthenticatedSocket).user;
    if (user) {
      this.logger.log(`Client ${client.id} disconnected (userId: ${user.sub})`);
    } else {
      this.logger.log(`Client ${client.id} disconnected (unauthenticated)`);
    }
  }

  /**
   * Extract JWT token from Authorization header (Bearer token)
   */
  private extractTokenFromHeaders(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }

    return null;
  }

  /**
   * Subscribe to location updates for a specific bus or trip
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: SubscribeLocationDto,
    @ConnectedSocket() client: Socket,
  ) {
    const user = (client as AuthenticatedSocket).user;
    if (!user) {
      this.logger.warn(`Client ${client.id} attempted subscribe without auth`);
      return { error: 'Unauthorized' };
    }

    try {
      if (!data.busId && !data.tripId) {
        this.logger.warn(
          `Client ${client.id} attempted subscribe without busId or tripId`,
        );
        return { error: 'Either busId or tripId is required' };
      }

      if (data.busId && data.tripId) {
        this.logger.warn(
          `Client ${client.id} attempted subscribe with both busId and tripId`,
        );
        return { error: 'Cannot subscribe to both busId and tripId' };
      }

      if (data.busId) {
        const room = `bus:${data.busId}`;
        client.join(room);
        this.logger.log(
          `Client ${client.id} (userId: ${user.sub}) subscribed to room: ${room}`,
        );
        return {
          success: true,
          room,
          message: `Subscribed to bus ${data.busId}`,
        };
      }

      if (data.tripId) {
        const room = `trip:${data.tripId}`;
        client.join(room);
        this.logger.log(
          `Client ${client.id} (userId: ${user.sub}) subscribed to room: ${room}`,
        );
        return {
          success: true,
          room,
          message: `Subscribed to trip ${data.tripId}`,
        };
      }
    } catch (error) {
      this.logger.error(
        `Error during subscribe for client ${client.id}: ${error.message}`,
      );
      return { error: 'Failed to subscribe' };
    }
  }

  /**
   * Unsubscribe from location updates for a specific bus or trip
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: UnsubscribeLocationDto,
    @ConnectedSocket() client: Socket,
  ) {
    const user = (client as AuthenticatedSocket).user;
    if (!user) {
      this.logger.warn(
        `Client ${client.id} attempted unsubscribe without auth`,
      );
      return { error: 'Unauthorized' };
    }

    try {
      if (!data.busId && !data.tripId) {
        this.logger.warn(
          `Client ${client.id} attempted unsubscribe without busId or tripId`,
        );
        return { error: 'Either busId or tripId is required' };
      }

      if (data.busId && data.tripId) {
        this.logger.warn(
          `Client ${client.id} attempted unsubscribe with both busId and tripId`,
        );
        return { error: 'Cannot unsubscribe from both busId and tripId' };
      }

      if (data.busId) {
        const room = `bus:${data.busId}`;
        client.leave(room);
        this.logger.log(
          `Client ${client.id} (userId: ${user.sub}) unsubscribed from room: ${room}`,
        );
        return {
          success: true,
          room,
          message: `Unsubscribed from bus ${data.busId}`,
        };
      }

      if (data.tripId) {
        const room = `trip:${data.tripId}`;
        client.leave(room);
        this.logger.log(
          `Client ${client.id} (userId: ${user.sub}) unsubscribed from room: ${room}`,
        );
        return {
          success: true,
          room,
          message: `Unsubscribed from trip ${data.tripId}`,
        };
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(
        `Error during unsubscribe for client ${client.id}: ${message}`,
      );
      return { error: 'Failed to unsubscribe' };
    }
  }

  /**
   * Emit location update to subscribed clients
   * This method is called by other services (e.g., TraccarSyncService) to broadcast updates
   */
  emitLocationUpdate(
    busId: number,
    tripId: number | null,
    locationData: LocationUpdateDto,
  ): void {
    try {
      // Emit to bus room
      const busRoom = `bus:${busId}`;
      const busRoomClients = this.server.sockets.adapter.rooms.get(busRoom);
      if (busRoomClients && busRoomClients.size > 0) {
        this.server.to(busRoom).emit('location:update', locationData);
        this.logger.debug(
          `Emitted location update to room ${busRoom} (${busRoomClients.size} clients)`,
        );
      }

      // Emit to trip room if tripId is provided
      if (tripId !== null && tripId !== undefined) {
        const tripRoom = `trip:${tripId}`;
        const tripRoomClients = this.server.sockets.adapter.rooms.get(tripRoom);
        if (tripRoomClients && tripRoomClients.size > 0) {
          this.server.to(tripRoom).emit('location:update', locationData);
          this.logger.debug(
            `Emitted location update to room ${tripRoom} (${tripRoomClients.size} clients)`,
          );
        }
      }
    } catch (error: unknown) {
      // Log error but don't throw to avoid crashing the caller service
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(
        `Failed to emit location update for busId=${busId}, tripId=${tripId}: ${message}`,
      );
    }
  }
}
