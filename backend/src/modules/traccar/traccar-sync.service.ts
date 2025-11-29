import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LocationSource } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { TraccarService } from './traccar.service';

const INTEGRATION_KEY_LAST_SYNC = 'traccar:lastSync';
const INTEGRATION_KEY_DEVICES_LAST_SYNC = 'traccar:devices:lastSync';

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
            `No bus mapping found for Traccar deviceId=${position.deviceId}. Position skipped. Consider running device sync or manually mapping this device to a bus.`,
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

  /**
   * Cron job to sync devices from Traccar and update Bus mappings.
   * Runs every 10 minutes to keep traccarDeviceId mappings up to date.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncDevices(): Promise<void> {
    const now = new Date();

    try {
      this.logger.log('Starting device sync from Traccar...');
      const devices = await this.traccarService.getDevices();

      if (!devices.length) {
        this.logger.warn('No devices found in Traccar');
        await this.setLastDeviceSyncTime(now, {
          devicesCount: 0,
          mappingsUpdated: 0,
          unmappedDevices: 0,
          orphanedMappings: 0,
        });
        return;
      }

      this.logger.log(`Received ${devices.length} device(s) from Traccar`);

      // Track statistics
      let mappingsUpdated = 0;
      let unmappedDevices = 0;
      const deviceIds = new Set<number>();

      // Process each device from Traccar
      for (const device of devices) {
        deviceIds.add(device.id);

        // Find bus with this traccarDeviceId
        const bus = await this.prisma.bus.findFirst({
          where: {
            traccarDeviceId: device.id,
          },
        });

        if (bus) {
          // Device is already mapped, just log (could update device name/status if needed in future)
          this.logger.debug(
            `Device ${device.id} (${device.name}) is mapped to bus ${bus.id} (${bus.licensePlate})`,
          );
          mappingsUpdated++;
        } else {
          // Device not mapped - log for admin attention
          this.logger.warn(
            `Device ${device.id} (${device.name || device.uniqueId}) is not mapped to any bus. Admin should map it manually.`,
          );
          unmappedDevices++;
        }
      }

      // Find buses with traccarDeviceId that no longer exist in Traccar (orphaned mappings)
      const allBusesWithMapping = await this.prisma.bus.findMany({
        where: {
          traccarDeviceId: {
            not: null,
          },
        },
        select: {
          id: true,
          licensePlate: true,
          traccarDeviceId: true,
        },
      });

      let orphanedMappings = 0;
      for (const bus of allBusesWithMapping) {
        if (bus.traccarDeviceId && !deviceIds.has(bus.traccarDeviceId)) {
          // Device was deleted from Traccar, clear the mapping
          this.logger.warn(
            `Bus ${bus.id} (${bus.licensePlate}) has traccarDeviceId=${bus.traccarDeviceId} that no longer exists in Traccar. Clearing mapping.`,
          );
          await this.prisma.bus.update({
            where: { id: bus.id },
            data: { traccarDeviceId: null },
          });
          orphanedMappings++;
        }
      }

      // Save sync state with metadata
      await this.setLastDeviceSyncTime(now, {
        devicesCount: devices.length,
        mappingsUpdated,
        unmappedDevices,
        orphanedMappings,
      });

      this.logger.log(
        `Device sync completed: ${devices.length} devices, ${mappingsUpdated} mapped, ${unmappedDevices} unmapped, ${orphanedMappings} orphaned mappings cleared`,
      );
    } catch (error) {
      // Fail gracefully - don't block other sync jobs
      this.logger.error('Failed to sync devices from Traccar', error);
    }
  }

  private async getLastDeviceSyncTime(): Promise<Date | null> {
    const state = await this.prisma.integrationState.findUnique({
      where: { key: INTEGRATION_KEY_DEVICES_LAST_SYNC },
    });

    if (!state?.value || typeof state.value !== 'object') {
      return null;
    }

    const iso = (state.value as { lastSync?: string }).lastSync;
    return iso ? new Date(iso) : null;
  }

  private async setLastDeviceSyncTime(
    time: Date,
    metadata?: {
      devicesCount?: number;
      mappingsUpdated?: number;
      unmappedDevices?: number;
      orphanedMappings?: number;
    },
  ): Promise<void> {
    await this.prisma.integrationState.upsert({
      where: { key: INTEGRATION_KEY_DEVICES_LAST_SYNC },
      update: {
        value: {
          lastSync: time.toISOString(),
          ...metadata,
        },
      },
      create: {
        key: INTEGRATION_KEY_DEVICES_LAST_SYNC,
        value: {
          lastSync: time.toISOString(),
          ...metadata,
        },
      },
    });
  }
}
