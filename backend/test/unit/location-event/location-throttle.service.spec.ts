import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LocationThrottleService } from 'src/modules/location-event/location-throttle.service';

describe('LocationThrottleService', () => {
  let service: LocationThrottleService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationThrottleService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LocationThrottleService>(LocationThrottleService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    service.clearAll();
  });

  describe('shouldEmit', () => {
    it('should allow first emission for a bus', () => {
      const busId = 1;
      const timestamp = new Date();

      const result = service.shouldEmit(busId, timestamp);

      expect(result).toBe(true);
    });

    it('should allow emission if enough time has passed', () => {
      const busId = 1;
      const firstTimestamp = new Date('2024-01-01T00:00:00Z');
      const secondTimestamp = new Date('2024-01-01T00:00:03Z'); // 3 seconds later

      // First emission
      expect(service.shouldEmit(busId, firstTimestamp)).toBe(true);

      // Second emission after 3 seconds (more than default 2s)
      expect(service.shouldEmit(busId, secondTimestamp)).toBe(true);
    });

    it('should throttle emission if not enough time has passed', () => {
      const busId = 1;
      const firstTimestamp = new Date('2024-01-01T00:00:00Z');
      const secondTimestamp = new Date('2024-01-01T00:00:01Z'); // 1 second later (< 2s)

      // First emission
      expect(service.shouldEmit(busId, firstTimestamp)).toBe(true);

      // Second emission too soon
      expect(service.shouldEmit(busId, secondTimestamp)).toBe(false);
    });

    it('should use custom interval from env', async () => {
      (configService.get as jest.Mock).mockReturnValue('5000'); // 5 seconds

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LocationThrottleService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue('5000'),
            },
          },
        ],
      }).compile();

      const customService = module.get<LocationThrottleService>(
        LocationThrottleService,
      );

      const busId = 1;
      const firstTimestamp = new Date('2024-01-01T00:00:00Z');
      const secondTimestamp = new Date('2024-01-01T00:00:03Z'); // 3 seconds later

      // First emission
      expect(customService.shouldEmit(busId, firstTimestamp)).toBe(true);

      // Second emission after 3 seconds (< 5s custom interval)
      expect(customService.shouldEmit(busId, secondTimestamp)).toBe(false);

      // Third emission after 5+ seconds
      const thirdTimestamp = new Date('2024-01-01T00:00:06Z');
      expect(customService.shouldEmit(busId, thirdTimestamp)).toBe(true);
    });

    it('should use default interval if env value is invalid', async () => {
      (configService.get as jest.Mock).mockReturnValue('invalid');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LocationThrottleService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue('invalid'),
            },
          },
        ],
      }).compile();

      const defaultService = module.get<LocationThrottleService>(
        LocationThrottleService,
      );

      const busId = 1;
      const firstTimestamp = new Date('2024-01-01T00:00:00Z');
      const secondTimestamp = new Date('2024-01-01T00:00:01Z');

      // First emission
      expect(defaultService.shouldEmit(busId, firstTimestamp)).toBe(true);

      // Should use default 2000ms, so 1 second is still throttled
      expect(defaultService.shouldEmit(busId, secondTimestamp)).toBe(false);
    });

    it('should handle multiple buses independently', () => {
      const bus1Id = 1;
      const bus2Id = 2;
      const timestamp = new Date('2024-01-01T00:00:00Z');

      // Both buses can emit at the same time (first emission)
      expect(service.shouldEmit(bus1Id, timestamp)).toBe(true);
      expect(service.shouldEmit(bus2Id, timestamp)).toBe(true);

      // Both buses should be throttled if emitting again too soon
      const nextTimestamp = new Date('2024-01-01T00:00:01Z');
      expect(service.shouldEmit(bus1Id, nextTimestamp)).toBe(false);
      expect(service.shouldEmit(bus2Id, nextTimestamp)).toBe(false);
    });
  });

  describe('getThrottleCount', () => {
    it('should return throttle count', () => {
      const busId = 1;
      const firstTimestamp = new Date('2024-01-01T00:00:00Z');
      const secondTimestamp = new Date('2024-01-01T00:00:01Z');

      service.shouldEmit(busId, firstTimestamp);
      expect(service.getThrottleCount()).toBe(0);

      service.shouldEmit(busId, secondTimestamp); // Throttled
      expect(service.getThrottleCount()).toBe(1);

      service.shouldEmit(busId, secondTimestamp); // Throttled again
      expect(service.getThrottleCount()).toBe(2);
    });
  });

  describe('clearBus', () => {
    it('should clear throttle state for a specific bus', () => {
      const busId = 1;
      const timestamp = new Date('2024-01-01T00:00:00Z');

      // First emission
      service.shouldEmit(busId, timestamp);
      expect(service.shouldEmit(busId, timestamp)).toBe(false); // Throttled

      // Clear bus state
      service.clearBus(busId);

      // Should allow emission again
      expect(service.shouldEmit(busId, timestamp)).toBe(true);
    });
  });

  describe('clearAll', () => {
    it('should clear all throttle state', () => {
      const bus1Id = 1;
      const bus2Id = 2;
      const timestamp = new Date('2024-01-01T00:00:00Z');

      service.shouldEmit(bus1Id, timestamp);
      service.shouldEmit(bus2Id, timestamp);
      service.shouldEmit(bus1Id, timestamp); // Throttled

      expect(service.getThrottleCount()).toBe(1);

      service.clearAll();

      expect(service.getThrottleCount()).toBe(0);
      expect(service.shouldEmit(bus1Id, timestamp)).toBe(true);
      expect(service.shouldEmit(bus2Id, timestamp)).toBe(true);
    });
  });
});
