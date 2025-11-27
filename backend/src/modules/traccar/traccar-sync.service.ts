import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LocationSource } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { TraccarService } from './traccar.service';

const INTEGRATION_KEY_LAST_SYNC = 'traccar:lastSync';

@Injectable()
export class TraccarSyncService {
  private readonly logger = new Logger(TraccarSyncService.name);

  constructor(
    private readonly traccarService: TraccarService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Cron job to sync positions from Traccar into LocationEvent table.
   * Runs every minute in demo/development environment.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async syncPositions(): Promise<void> {
    const now = new Date();
    const lastSync = await this.getLastSyncTime();

    try {
      const positions = await this.traccarService.getPositions({
        from: lastSync?.toISOString(),
        to: now.toISOString(),
      });

      if (!positions.length) {
        this.logger.debug('No new positions from Traccar');
        await this.setLastSyncTime(now);
        return;
      }

      this.logger.log(`Received ${positions.length} positions from Traccar`);

      for (const position of positions) {
        const bus = await this.prisma.bus.findFirst({
          where: {
            traccarDeviceId: position.deviceId,
          },
        });

        if (!bus) {
          this.logger.warn(
            `No bus mapping found for Traccar deviceId=${position.deviceId}`,
          );
          continue;
        }

        // Validate position data - only process valid positions
        if (position.valid === false) {
          this.logger.debug(
            `Skipping invalid position for deviceId=${position.deviceId}`,
          );
          continue;
        }

        const timestamp =
          (position.serverTime && new Date(position.serverTime)) ||
          (position.fixTime && new Date(position.fixTime)) ||
          (position.deviceTime && new Date(position.deviceTime)) ||
          now;

        // Convert speed from knots to km/h (Traccar API returns speed in knots)
        // 1 knot = 1.852 km/h
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

        // Optionally update current bus coordinates for quick access
        await this.prisma.bus.update({
          where: { id: bus.id },
          data: {
            currentLat: position.latitude,
            currentLng: position.longitude,
            lastUpdated: timestamp,
          },
        });
      }

      await this.setLastSyncTime(now);
    } catch (error) {
      // Do not update lastSync on failure so that missing window can be filled later
      this.logger.error('Failed to sync positions from Traccar', error);
    }
  }

  private async getLastSyncTime(): Promise<Date | null> {
    const state = await this.prisma.integrationState.findUnique({
      where: { key: INTEGRATION_KEY_LAST_SYNC },
    });

    if (!state?.value || typeof state.value !== 'object') {
      return null;
    }

    const iso = (state.value as { lastSync?: string }).lastSync;
    return iso ? new Date(iso) : null;
  }

  private async setLastSyncTime(time: Date): Promise<void> {
    await this.prisma.integrationState.upsert({
      where: { key: INTEGRATION_KEY_LAST_SYNC },
      update: {
        value: {
          lastSync: time.toISOString(),
        },
      },
      create: {
        key: INTEGRATION_KEY_LAST_SYNC,
        value: {
          lastSync: time.toISOString(),
        },
      },
    });
  }
}
