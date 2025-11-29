import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TraccarWebSocketService } from 'src/modules/traccar/traccar-websocket.service';
import { LocationEventGateway } from 'src/modules/location-event/gateways/location-event.gateway';
import { LocationThrottleService } from 'src/modules/location-event/location-throttle.service';
import { LocationSource } from '@prisma/client';

describe('TraccarWebSocketService - Realtime Integration', () => {
  let service: TraccarWebSocketService;
  let prismaService: PrismaService;
  let locationEventGateway: LocationEventGateway;
  let locationThrottleService: LocationThrottleService;

  const mockBus = {
    id: 1,
    licensePlate: 'ABC-123',
    traccarDeviceId: 100,
    currentLat: null,
    currentLng: null,
    lastUpdated: null,
  };

  const mockPosition = {
    id: 1,
    deviceId: 100,
    latitude: 10.123456,
    longitude: 106.654321,
    speed: 30, // knots
    course: 90,
    serverTime: '2024-01-01T00:00:00Z',
    valid: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TraccarWebSocketService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'TRACCAR_WS_ENABLED') return 'true';
              if (key === 'TRACCAR_BASE_URL') return 'https://demo.traccar.org';
              if (key === 'TRACCAR_TOKEN') return 'test-token';
              return undefined;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            bus: {
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            locationEvent: {
              create: jest.fn(),
            },
            integrationState: {
              upsert: jest.fn(),
            },
          },
        },
        {
          provide: LocationEventGateway,
          useValue: {
            emitLocationUpdate: jest.fn(),
          },
        },
        {
          provide: LocationThrottleService,
          useValue: {
            shouldEmit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TraccarWebSocketService>(TraccarWebSocketService);
    prismaService = module.get<PrismaService>(PrismaService);
    locationEventGateway =
      module.get<LocationEventGateway>(LocationEventGateway);
    locationThrottleService = module.get<LocationThrottleService>(
      LocationThrottleService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleWebSocketMessage - Realtime emit integration', () => {
    it('should create LocationEvent and update Bus when receiving valid position', async () => {
      // Arrange
      (prismaService.bus.findFirst as jest.Mock).mockResolvedValue(mockBus);
      (prismaService.locationEvent.create as jest.Mock).mockResolvedValue({
        id: 1,
        busId: mockBus.id,
        timestamp: new Date(mockPosition.serverTime),
        latitude: mockPosition.latitude,
        longitude: mockPosition.longitude,
        speedKph: mockPosition.speed * 1.852,
        heading: mockPosition.course,
        source: LocationSource.gateway,
      });
      (prismaService.bus.update as jest.Mock).mockResolvedValue({
        ...mockBus,
        currentLat: mockPosition.latitude,
        currentLng: mockPosition.longitude,
        lastUpdated: new Date(mockPosition.serverTime),
      });
      (locationThrottleService.shouldEmit as jest.Mock).mockReturnValue(true);

      const messageData = JSON.stringify({
        positions: [mockPosition],
      });

      // Act
      await (service as any).handleWebSocketMessage(Buffer.from(messageData));

      // Assert
      expect(prismaService.bus.findFirst).toHaveBeenCalledWith({
        where: { traccarDeviceId: mockPosition.deviceId },
      });
      expect(prismaService.locationEvent.create).toHaveBeenCalledWith({
        data: {
          busId: mockBus.id,
          timestamp: expect.any(Date),
          latitude: mockPosition.latitude,
          longitude: mockPosition.longitude,
          speedKph: mockPosition.speed * 1.852, // Converted from knots
          heading: mockPosition.course,
          source: LocationSource.gateway,
        },
      });
      expect(prismaService.bus.update).toHaveBeenCalledWith({
        where: { id: mockBus.id },
        data: {
          currentLat: mockPosition.latitude,
          currentLng: mockPosition.longitude,
          lastUpdated: expect.any(Date),
        },
      });
    });

    it('should emit location update when throttle service allows', async () => {
      // Arrange
      (prismaService.bus.findFirst as jest.Mock).mockResolvedValue(mockBus);
      (prismaService.locationEvent.create as jest.Mock).mockResolvedValue({
        id: 1,
        busId: mockBus.id,
        timestamp: new Date(mockPosition.serverTime),
      });
      (prismaService.bus.update as jest.Mock).mockResolvedValue(mockBus);
      (locationThrottleService.shouldEmit as jest.Mock).mockReturnValue(true);

      const messageData = JSON.stringify({
        positions: [mockPosition],
      });

      // Act
      await (service as any).handleWebSocketMessage(Buffer.from(messageData));

      // Assert
      expect(locationThrottleService.shouldEmit).toHaveBeenCalledWith(
        mockBus.id,
        expect.any(Date),
      );
      expect(locationEventGateway.emitLocationUpdate).toHaveBeenCalledWith(
        mockBus.id,
        null, // tripId is null for now
        expect.objectContaining({
          busId: mockBus.id,
          tripId: null,
          latitude: mockPosition.latitude,
          longitude: mockPosition.longitude,
          speedKph: mockPosition.speed * 1.852,
          heading: mockPosition.course,
          timestamp: expect.any(String),
        }),
      );
    });

    it('should NOT emit location update when throttle service blocks', async () => {
      // Arrange
      (prismaService.bus.findFirst as jest.Mock).mockResolvedValue(mockBus);
      (prismaService.locationEvent.create as jest.Mock).mockResolvedValue({
        id: 1,
        busId: mockBus.id,
      });
      (prismaService.bus.update as jest.Mock).mockResolvedValue(mockBus);
      (locationThrottleService.shouldEmit as jest.Mock).mockReturnValue(false);

      const messageData = JSON.stringify({
        positions: [mockPosition],
      });

      // Act
      await (service as any).handleWebSocketMessage(Buffer.from(messageData));

      // Assert
      expect(locationThrottleService.shouldEmit).toHaveBeenCalled();
      expect(locationEventGateway.emitLocationUpdate).not.toHaveBeenCalled();
    });

    it('should NOT crash when gateway emit fails', async () => {
      // Arrange
      (prismaService.bus.findFirst as jest.Mock).mockResolvedValue(mockBus);
      (prismaService.locationEvent.create as jest.Mock).mockResolvedValue({
        id: 1,
        busId: mockBus.id,
      });
      (prismaService.bus.update as jest.Mock).mockResolvedValue(mockBus);
      (locationThrottleService.shouldEmit as jest.Mock).mockReturnValue(true);
      (locationEventGateway.emitLocationUpdate as jest.Mock).mockImplementation(
        () => {
          throw new Error('Gateway connection failed');
        },
      );

      const messageData = JSON.stringify({
        positions: [mockPosition],
      });

      // Act & Assert - should not throw
      await expect(
        (service as any).handleWebSocketMessage(Buffer.from(messageData)),
      ).resolves.not.toThrow();

      // LocationEvent and Bus should still be created/updated
      expect(prismaService.locationEvent.create).toHaveBeenCalled();
      expect(prismaService.bus.update).toHaveBeenCalled();
    });

    it('should skip invalid positions', async () => {
      // Arrange
      const invalidPosition = {
        ...mockPosition,
        valid: false,
      };

      const messageData = JSON.stringify({
        positions: [invalidPosition],
      });

      // Act
      await (service as any).handleWebSocketMessage(Buffer.from(messageData));

      // Assert
      expect(prismaService.bus.findFirst).not.toHaveBeenCalled();
      expect(prismaService.locationEvent.create).not.toHaveBeenCalled();
      expect(locationEventGateway.emitLocationUpdate).not.toHaveBeenCalled();
    });

    it('should skip positions when bus mapping not found', async () => {
      // Arrange
      (prismaService.bus.findFirst as jest.Mock).mockResolvedValue(null);

      const messageData = JSON.stringify({
        positions: [mockPosition],
      });

      // Act
      await (service as any).handleWebSocketMessage(Buffer.from(messageData));

      // Assert
      expect(prismaService.locationEvent.create).not.toHaveBeenCalled();
      expect(locationEventGateway.emitLocationUpdate).not.toHaveBeenCalled();
    });
  });
});
