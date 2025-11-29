import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDeviceDto {
  @ApiProperty({
    example: 'Test Device 1',
    description: 'Device name',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: 'TEST001',
    description: 'Unique device identifier (must be unique across all devices)',
  })
  @IsNotEmpty()
  @IsString()
  uniqueId: string;

  @ApiProperty({
    example: 'Test',
    description: 'Device model (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  model?: string;
}
