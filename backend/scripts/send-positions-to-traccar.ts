import 'dotenv/config';
import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { LocationSource, PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const envPath = path.join(__dirname, '../.env.development');
dotenv.config({ path: envPath });

const prisma = new PrismaClient();

interface BusPosition {
  id: number;
  licensePlate: string;
  traccarDeviceId: number | null;
  currentLat: number | string | null;
  currentLng: number | string | null;
  lastUpdated: Date | null;
}

type SimulationDirection = 'A_TO_B' | 'B_TO_A';

interface SimulationPoint {
  lat: number;
  lng: number;
}

interface SimulationState {
  current: SimulationPoint;
  target: SimulationPoint;
  direction: SimulationDirection;
}

interface SimulatedPosition {
  latitude: number;
  longitude: number;
  bearing: number;
  speedKph: number;
  timestamp: Date;
}

const POINT_A: SimulationPoint = { lat: 10.7769, lng: 106.7009 }; // Quận 1
const POINT_B: SimulationPoint = { lat: 10.73, lng: 106.72 }; // Quận 7 (~10km)
const SIMULATION_SPEED_KPH = 45; // km/h
const INTERVAL_MINUTES = 3;
const DISTANCE_PER_INTERVAL_KM = (SIMULATION_SPEED_KPH * INTERVAL_MINUTES) / 60; // 2.25km
const TARGET_THRESHOLD_KM = 0.1; // 100m
const EARTH_RADIUS_KM = 6371;

const simulationStates = new Map<number, SimulationState>();
const deviceIdToUniqueIdCache = new Map<number, string>();

const traccarBaseUrl =
  process.env.TRACCAR_BASE_URL || 'http://demo.traccar.org';
const traccarApiBaseUrl = traccarBaseUrl.replace(/\/$/, '');
const traccarToken = process.env.TRACCAR_TOKEN?.trim();
const traccarUsername = process.env.TRACCAR_USERNAME;
const traccarPassword = process.env.TRACCAR_PASSWORD;

const toRadians = (value: number): number => (value * Math.PI) / 180;
const toDegrees = (value: number): number => (value * 180) / Math.PI;

function calculateDistanceKm(a: SimulationPoint, b: SimulationPoint): number {
  const latDelta = toRadians(b.lat - a.lat);
  const lngDelta = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const haversine =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.sin(lngDelta / 2) *
    Math.sin(lngDelta / 2) *
    Math.cos(lat1) *
    Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return EARTH_RADIUS_KM * c;
}

function calculateBearingDegrees(
  from: SimulationPoint,
  to: SimulationPoint,
): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLng = toRadians(to.lng - from.lng);

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  const bearing = toDegrees(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

function moveTowards(
  current: SimulationPoint,
  target: SimulationPoint,
  distanceKm: number,
): { point: SimulationPoint; reachedTarget: boolean } {
  const totalDistance = calculateDistanceKm(current, target);

  if (totalDistance === 0) {
    return { point: target, reachedTarget: true };
  }

  const ratio = Math.min(distanceKm / totalDistance, 1);
  const nextPoint: SimulationPoint = {
    lat: current.lat + (target.lat - current.lat) * ratio,
    lng: current.lng + (target.lng - current.lng) * ratio,
  };

  const remainingDistance = calculateDistanceKm(nextPoint, target);
  const reachedTarget = ratio >= 1 || remainingDistance <= TARGET_THRESHOLD_KM;

  return { point: nextPoint, reachedTarget };
}

function deriveStartingPoint(bus: BusPosition): SimulationPoint {
  const lat = Number(bus.currentLat);
  const lng = Number(bus.currentLng);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  return { ...POINT_A };
}

function getDirectionForPoint(point: SimulationPoint): SimulationDirection {
  const distanceToA = calculateDistanceKm(point, POINT_A);
  const distanceToB = calculateDistanceKm(point, POINT_B);
  return distanceToA <= distanceToB ? 'A_TO_B' : 'B_TO_A';
}

function getTargetForDirection(direction: SimulationDirection): SimulationPoint {
  return direction === 'A_TO_B' ? POINT_B : POINT_A;
}

function flipDirection(direction: SimulationDirection): SimulationDirection {
  return direction === 'A_TO_B' ? 'B_TO_A' : 'A_TO_B';
}

function getOrCreateSimulationState(bus: BusPosition): SimulationState {
  const existing = simulationStates.get(bus.id);
  if (existing) {
    return existing;
  }

  const start = deriveStartingPoint(bus);
  const direction = getDirectionForPoint(start);
  const target = getTargetForDirection(direction);

  const state: SimulationState = {
    current: start,
    target,
    direction,
  };

  simulationStates.set(bus.id, state);
  return state;
}

function ensureValidTarget(state: SimulationState): SimulationState {
  const distanceToTarget = calculateDistanceKm(state.current, state.target);
  if (distanceToTarget > TARGET_THRESHOLD_KM) {
    return state;
  }

  const nextDirection = flipDirection(state.direction);
  return {
    current: state.current,
    direction: nextDirection,
    target: getTargetForDirection(nextDirection),
  };
}

function getNextSimulatedPosition(bus: BusPosition): SimulatedPosition {
  let state = getOrCreateSimulationState(bus);
  state = ensureValidTarget(state);

  const startPoint = state.current;
  const bearing = calculateBearingDegrees(startPoint, state.target);
  const { point: nextPoint, reachedTarget } = moveTowards(
    startPoint,
    state.target,
    DISTANCE_PER_INTERVAL_KM,
  );

  let nextState: SimulationState = {
    current: nextPoint,
    target: state.target,
    direction: state.direction,
  };

  if (reachedTarget) {
    const nextDirection = flipDirection(state.direction);
    nextState = {
      current: nextPoint,
      direction: nextDirection,
      target: getTargetForDirection(nextDirection),
    };
  }

  simulationStates.set(bus.id, nextState);

  return {
    latitude: nextPoint.lat,
    longitude: nextPoint.lng,
    bearing,
    speedKph: SIMULATION_SPEED_KPH,
    timestamp: new Date(),
  };
}

async function persistSimulatedPosition(
  bus: BusPosition,
  simulated: SimulatedPosition,
): Promise<void> {
  await prisma.$transaction([
    prisma.bus.update({
      where: { id: bus.id },
      data: {
        currentLat: simulated.latitude,
        currentLng: simulated.longitude,
        lastUpdated: simulated.timestamp,
      },
    }),
    prisma.locationEvent.create({
      data: {
        busId: bus.id,
        latitude: simulated.latitude,
        longitude: simulated.longitude,
        speedKph: simulated.speedKph,
        heading: simulated.bearing,
        timestamp: simulated.timestamp,
        source: LocationSource.gateway,
      },
    }),
  ]);
}

async function getTraccarDeviceUniqueId(
  deviceId: number,
): Promise<string | null> {
  if (deviceIdToUniqueIdCache.has(deviceId)) {
    return deviceIdToUniqueIdCache.get(deviceId) ?? null;
  }

  const config: AxiosRequestConfig = {
    timeout: 10000,
    headers: {},
  };

  if (traccarToken) {
    config.headers = {
      ...(config.headers as Record<string, string>),
      Authorization: `Bearer ${traccarToken}`,
    };
  } else if (traccarUsername && traccarPassword) {
    config.auth = {
      username: traccarUsername,
      password: traccarPassword,
    };
  } else {
    console.warn(
      '⚠️  Unable to fetch Traccar device uniqueId because TRACCAR_TOKEN or username/password is not configured.',
    );
    return null;
  }

  try {
    const response = await axios.get<{ uniqueId?: string }>(
      `${traccarApiBaseUrl}/api/devices/${deviceId}`,
      config,
    );
    const uniqueId = response.data?.uniqueId;
    if (uniqueId) {
      deviceIdToUniqueIdCache.set(deviceId, uniqueId);
      console.log(
        `🔐 Cached Traccar uniqueId "${uniqueId}" for deviceId=${deviceId}`,
      );
      return uniqueId;
    }
    console.warn(
      `⚠️  Traccar device ${deviceId} response did not include uniqueId. Response: ${JSON.stringify(
        response.data,
      )}`,
    );
    return null;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(
          `❌ Failed to fetch Traccar device ${deviceId}: ${error.response.status} ${error.response.statusText}`,
        );
      } else {
        console.error(
          `❌ Failed to fetch Traccar device ${deviceId}: No response from server`,
        );
      }
    } else {
      console.error(
        `❌ Failed to fetch Traccar device ${deviceId}: ${String(error)}`,
      );
    }
    return null;
  }
}

async function getUniqueIdForBus(
  bus: BusPosition,
): Promise<string | null> {
  if (bus.traccarDeviceId == null) {
    console.warn(
      `⚠️  Bus ${bus.licensePlate} (ID: ${bus.id}) does not have traccarDeviceId. Skipping.`,
    );
    return null;
  }

  const uniqueId = await getTraccarDeviceUniqueId(bus.traccarDeviceId);
  if (!uniqueId) {
    console.warn(
      `⚠️  Unable to resolve uniqueId for bus ${bus.licensePlate} (deviceId=${bus.traccarDeviceId}).`,
    );
    return null;
  }

  return uniqueId;
}

/**
 * Send position data for a single bus to Traccar server.
 * Uses HTTP GET request format: ?id=DEVICE_ID&lat=LAT&lon=LON&speed=SPEED&bearing=BEARING&timestamp=TIMESTAMP
 */
async function sendBusPosition(
  bus: BusPosition,
  uniqueId: string,
): Promise<SimulatedPosition> {
  if (!bus.traccarDeviceId) {
    throw new Error(`Bus ${bus.licensePlate} does not have traccarDeviceId`);
  }

  const simulatedPosition = getNextSimulatedPosition(bus);
  const timestampISO = simulatedPosition.timestamp
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z'); // Format: 2025-01-15T10:30:45Z
  const speedKnots =
    Math.round((simulatedPosition.speedKph / 1.852) * 10) / 10; // Round to 1 decimal

  // Get Traccar server URL and port from config
  const port = process.env.TRACCAR_POSITION_PORT
    ? Number(process.env.TRACCAR_POSITION_PORT)
    : 5055;

  let positionBaseUrl = traccarBaseUrl;
  if (port === 5055 && positionBaseUrl.startsWith('https://')) {
    positionBaseUrl = positionBaseUrl.replace('https://', 'http://');
  }
  const cleanBaseUrl = positionBaseUrl.replace(/\/$/, ''); // Remove trailing slash

  // Build query parameters
  const params = new URLSearchParams({
    id: uniqueId,
    lat: simulatedPosition.latitude.toFixed(6), // 6 decimal places for GPS precision
    lon: simulatedPosition.longitude.toFixed(6),
    speed: String(speedKnots),
    bearing: String(Math.round(simulatedPosition.bearing)),
    timestamp: timestampISO,
  });

  const url = `${cleanBaseUrl}:${port}/?${params.toString()}`;

  try {
    console.log(
      `[${new Date().toISOString()}] Sending position for bus ${bus.licensePlate} (Unique ID: ${uniqueId})`,
    );

    const response = await axios.get(url, {
      timeout: 10000, // 10 seconds timeout
      validateStatus: (status) => status < 500, // Accept 2xx, 3xx, 4xx as valid
    });

    if (response.status >= 200 && response.status < 300) {
      console.log(
        `✅ Successfully sent position for bus ${bus.licensePlate} (Unique ID: ${uniqueId})`,
      );
    } else {
      console.warn(
        `⚠️  Traccar returned status ${response.status} for bus ${bus.licensePlate} (Unique ID: ${uniqueId})`,
      );
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(
          `❌ Failed to send position for bus ${bus.licensePlate}: ${error.response.status} ${error.response.statusText}`,
        );
      } else if (error.request) {
        console.error(
          `❌ No response from Traccar server when sending position for bus ${bus.licensePlate}`,
        );
      } else {
        console.error(
          `❌ Error sending position for bus ${bus.licensePlate}: ${error.message}`,
        );
      }
    } else {
      console.error(`❌ Unexpected error for bus ${bus.licensePlate}:`, error);
    }
    throw error;
  }

  return simulatedPosition;
}

/**
 * Send positions for all buses with Traccar device mapping to Traccar server.
 */
async function sendPositionsToTraccar(): Promise<void> {
  try {
    // Get all buses that have traccarDeviceId
    const buses = await prisma.bus.findMany({
      where: {
        traccarDeviceId: {
          not: null,
        },
      },
      select: {
        id: true,
        licensePlate: true,
        traccarDeviceId: true,
        currentLat: true,
        currentLng: true,
        lastUpdated: true,
      },
    });

    if (buses.length === 0) {
      console.log(`[${new Date().toISOString()}] No buses with Traccar device mapping and location data found`);
      return;
    }

    console.log(
      `[${new Date().toISOString()}] Sending positions for ${buses.length} bus(es) to Traccar...`,
    );

    // Send position for each bus
    const results = await Promise.allSettled(
      buses.map(async (bus) => {
        const uniqueId = await getUniqueIdForBus(bus as BusPosition);
        if (!uniqueId) {
          throw new Error('Missing Traccar uniqueId mapping');
        }
        const simulated = await sendBusPosition(bus as BusPosition, uniqueId);
        await persistSimulatedPosition(bus as BusPosition, simulated);
        return simulated;
      }),
    );

    // Log results
    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    if (successful > 0) {
      console.log(`✅ Successfully sent ${successful} position(s) to Traccar`);
    }

    if (failed > 0) {
      console.warn(`⚠️  Failed to send ${failed} position(s) to Traccar`);
      // Log individual failures
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`❌ Failed for bus ${buses[index].licensePlate} (ID: ${buses[index].id}): ${result.reason}`);
        }
      });
    }
  } catch (error) {
    console.error(`❌ Error in sendPositionsToTraccar:`, error);
  }
}

/**
 * Start the position sender service.
 * Runs every 3 minutes (180000 milliseconds).
 */
export function startPositionSender(): void {
  const isEnabled = process.env.TRACCAR_POSITION_SENDER_ENABLED !== 'false';

  if (!isEnabled) {
    console.log('⚠️  Traccar Position Sender is disabled via TRACCAR_POSITION_SENDER_ENABLED=false');
    return;
  }

  let positionBaseUrl = traccarBaseUrl;
  const port = process.env.TRACCAR_POSITION_PORT || '5055';
  if (Number(port) === 5055 && positionBaseUrl.startsWith('https://')) {
    positionBaseUrl = positionBaseUrl.replace('https://', 'http://');
  }

  console.log('🚀 Traccar Position Sender started');
  console.log(`   Target: ${positionBaseUrl}:${port}`);
  console.log(`   Interval: Every 3 minutes`);
  console.log(`   Running first batch immediately...\n`);

  // Run immediately on start
  void sendPositionsToTraccar();

  // Then run every 3 minutes
  setInterval(() => {
    void sendPositionsToTraccar();
  }, 180000); // 3 minutes = 180000 milliseconds
}

// If this script is run directly (not imported), start the service
if (require.main === module) {
  startPositionSender();

  // Keep the process alive
  process.on('SIGINT', async () => {
    console.log('\n🛑 Stopping Traccar Position Sender...');
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Stopping Traccar Position Sender...');
    await prisma.$disconnect();
    process.exit(0);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
  });
}

