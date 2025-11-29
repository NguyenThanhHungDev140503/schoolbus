import { ApiProperty } from '@nestjs/swagger';

export class TraccarPositionDto {
  @ApiProperty({ example: 1, description: 'Position ID' })
  id: number;

  @ApiProperty({ example: 1, description: 'Device ID' })
  deviceId: number;

  @ApiProperty({
    example: 'osmand',
    required: false,
    description: 'Protocol name',
  })
  protocol?: string;

  @ApiProperty({
    example: '2024-01-01T12:00:00Z',
    required: false,
    description: 'Device timestamp',
  })
  deviceTime?: string;

  @ApiProperty({
    example: '2024-01-01T12:00:00Z',
    required: false,
    description: 'GPS fix timestamp',
  })
  fixTime?: string;

  @ApiProperty({
    example: '2024-01-01T12:00:00Z',
    required: false,
    description: 'Server timestamp',
  })
  serverTime?: string;

  @ApiProperty({
    example: false,
    required: false,
    description: 'Whether position is outdated',
  })
  outdated?: boolean;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Whether position is valid',
  })
  valid?: boolean;

  @ApiProperty({ example: 10.762622, description: 'Latitude' })
  latitude: number;

  @ApiProperty({ example: 106.660172, description: 'Longitude' })
  longitude: number;

  @ApiProperty({
    example: 50.5,
    required: false,
    description: 'Altitude in meters',
  })
  altitude?: number;

  @ApiProperty({
    example: 24.5,
    required: false,
    description: 'Speed in knots (1 knot = 1.852 km/h)',
  })
  speed?: number;

  @ApiProperty({
    example: 180,
    required: false,
    description: 'Course/heading in degrees',
  })
  course?: number;

  @ApiProperty({
    example: '123 Main St, City',
    required: false,
    description: 'Address',
  })
  address?: string;

  @ApiProperty({
    example: 10.5,
    required: false,
    description: 'Accuracy in meters',
  })
  accuracy?: number;

  @ApiProperty({
    example: {},
    required: false,
    description: 'Network information',
  })
  network?: Record<string, unknown>;

  @ApiProperty({
    example: [1, 2],
    required: false,
    description: 'Geofence IDs',
  })
  geofenceIds?: number[];

  @ApiProperty({
    example: {},
    required: false,
    description: 'Additional attributes',
  })
  attributes?: Record<string, unknown>;
}
