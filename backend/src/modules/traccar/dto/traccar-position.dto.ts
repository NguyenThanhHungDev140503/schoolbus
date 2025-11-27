import { ApiProperty } from '@nestjs/swagger';

export class TraccarPositionDto {
  @ApiProperty({ example: 1, description: 'Position ID' })
  id: number;

  @ApiProperty({ example: 1, description: 'Device ID' })
  deviceId: number;

  @ApiProperty({ example: 10.762622, description: 'Latitude' })
  latitude: number;

  @ApiProperty({ example: 106.660172, description: 'Longitude' })
  longitude: number;

  @ApiProperty({ example: 45.5, required: false, description: 'Speed in km/h' })
  speed?: number;

  @ApiProperty({ example: 180, required: false, description: 'Course/heading in degrees' })
  course?: number;

  @ApiProperty({ example: '2024-01-01T12:00:00Z', required: false, description: 'Server timestamp' })
  serverTime?: string;

  @ApiProperty({ example: '2024-01-01T12:00:00Z', required: false, description: 'GPS fix timestamp' })
  fixTime?: string;
}

