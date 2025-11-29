import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';

const buildDefaultTimeRange = () => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  return {
    from: oneHourAgo.toISOString(),
    to: now.toISOString(),
  };
};

const SWAGGER_DEFAULT_TIME_RANGE = buildDefaultTimeRange();

export class QueryPositionDto {
  @ApiProperty({ example: 1, required: false, description: 'Filter by device ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deviceId?: number;

  @ApiProperty({
    required: false,
    description: 'Start time (ISO 8601)',
    example: SWAGGER_DEFAULT_TIME_RANGE.from,
  })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiProperty({
    required: false,
    description: 'End time (ISO 8601)',
    example: SWAGGER_DEFAULT_TIME_RANGE.to,
  })
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

