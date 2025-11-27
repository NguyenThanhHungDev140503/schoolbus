import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryPositionDto {
  @ApiProperty({ example: 1, required: false, description: 'Filter by device ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deviceId?: number;

  @ApiProperty({ example: '2024-01-01T00:00:00Z', required: false, description: 'Start time (ISO 8601)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiProperty({ example: '2024-01-01T23:59:59Z', required: false, description: 'End time (ISO 8601)' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiProperty({ 
    example: 1, 
    required: false, 
    description: 'Filter by position ID(s). Can pass multiple like id=31&id=42' 
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number | number[];
}

