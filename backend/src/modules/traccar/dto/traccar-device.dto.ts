import { ApiProperty } from '@nestjs/swagger';

export class TraccarDeviceDto {
  @ApiProperty({ example: 1, description: 'Traccar device ID' })
  id: number;

  @ApiProperty({ example: 'Bus-001', description: 'Device name' })
  name: string;

  @ApiProperty({ example: 'IMEI123456', description: 'Unique device identifier' })
  uniqueId: string;

  @ApiProperty({ example: 'online', required: false, description: 'Device status' })
  status?: string;

  @ApiProperty({ example: false, required: false, description: 'Whether device is disabled' })
  disabled?: boolean;

  @ApiProperty({ example: '2024-01-01T12:00:00Z', required: false, description: 'Last update timestamp' })
  lastUpdate?: string | null;

  @ApiProperty({ example: 123, required: false, description: 'Last position ID' })
  positionId?: number | null;

  @ApiProperty({ example: 1, required: false, description: 'Group ID' })
  groupId?: number | null;

  @ApiProperty({ example: '+84123456789', required: false, description: 'Phone number' })
  phone?: string | null;

  @ApiProperty({ example: 'GT06', required: false, description: 'Device model' })
  model?: string | null;

  @ApiProperty({ example: 'John Doe', required: false, description: 'Contact person' })
  contact?: string | null;

  @ApiProperty({ example: 'Bus', required: false, description: 'Device category' })
  category?: string | null;

  @ApiProperty({ example: {}, required: false, description: 'Additional attributes' })
  attributes?: Record<string, unknown>;
}

