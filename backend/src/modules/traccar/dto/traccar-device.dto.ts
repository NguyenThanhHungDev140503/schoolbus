import { ApiProperty } from '@nestjs/swagger';

export class TraccarDeviceDto {
  @ApiProperty({ example: 1, description: 'Traccar device ID' })
  id: number;

  @ApiProperty({ example: 'Bus-001', description: 'Device name' })
  name: string;

  @ApiProperty({ example: 'IMEI123456', description: 'Unique device identifier' })
  uniqueId: string;
}

