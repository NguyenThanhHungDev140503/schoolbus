import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Service to throttle location update emissions to prevent overwhelming clients
 * with too frequent updates. Ensures each bus emits at most one update per
 * configured interval (default: 2000ms).
 */
@Injectable()
export class LocationThrottleService {
  private readonly logger = new Logger(LocationThrottleService.name);
  private readonly minIntervalMs: number;
  private readonly lastEmitTimestamps = new Map<number, number>();
  private throttleCount = 0;

  constructor(private readonly configService: ConfigService) {
    // Read interval from env, default to 2000ms (2 seconds)
    const envInterval = this.configService.get<string>(
      'LOCATION_EMIT_MIN_INTERVAL_MS',
    );
    this.minIntervalMs = envInterval ? parseInt(envInterval, 10) : 2000;

    if (this.minIntervalMs <= 0) {
      this.logger.warn(
        `Invalid LOCATION_EMIT_MIN_INTERVAL_MS=${envInterval}, using default 2000ms`,
      );
      this.minIntervalMs = 2000;
    }

    this.logger.log(
      `LocationThrottleService initialized with minInterval=${this.minIntervalMs}ms`,
    );
  }

  /**
   * Check if a location update should be emitted for the given bus.
   * Returns true if enough time has passed since the last emission for this bus,
   * false if the update should be throttled.
   *
   * @param busId - The bus ID to check
   * @param timestamp - The timestamp of the current location update
   * @returns true if emission should proceed, false if throttled
   */
  shouldEmit(busId: number, timestamp: Date): boolean {
    const now = timestamp.getTime();
    const lastEmitAt = this.lastEmitTimestamps.get(busId);

    // First emission for this bus, always allow
    if (lastEmitAt === undefined) {
      this.lastEmitTimestamps.set(busId, now);
      return true;
    }

    const timeSinceLastEmit = now - lastEmitAt;

    // Enough time has passed, allow emission
    if (timeSinceLastEmit >= this.minIntervalMs) {
      this.lastEmitTimestamps.set(busId, now);
      return true;
    }

    // Throttled: not enough time has passed
    this.throttleCount++;
    if (this.throttleCount % 100 === 0) {
      // Log every 100th throttle to avoid spam
      this.logger.debug(
        `Throttled ${this.throttleCount} location updates (busId=${busId}, timeSinceLastEmit=${timeSinceLastEmit}ms < ${this.minIntervalMs}ms)`,
      );
    }
    return false;
  }

  /**
   * Get the current throttle count (for monitoring/debugging).
   */
  getThrottleCount(): number {
    return this.throttleCount;
  }

  /**
   * Clear throttle state for a specific bus (useful for testing or cleanup).
   */
  clearBus(busId: number): void {
    this.lastEmitTimestamps.delete(busId);
  }

  /**
   * Clear all throttle state (useful for testing or cleanup).
   */
  clearAll(): void {
    this.lastEmitTimestamps.clear();
    this.throttleCount = 0;
  }
}
