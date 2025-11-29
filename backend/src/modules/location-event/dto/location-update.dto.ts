import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class LocationUpdateDto {
  @ApiProperty({ description: 'Bus ID' })
  @IsInt()
  busId: number;

  @ApiPropertyOptional({ description: 'Trip ID (nullable)' })
  @IsOptional()
  @IsInt()
  tripId?: number | null;

  @ApiProperty({ description: 'Latitude' })
  @IsNumber()
  @Type(() => Number)
  latitude: number;

  @ApiProperty({ description: 'Longitude' })
  @IsNumber()
  @Type(() => Number)
  longitude: number;

  @ApiPropertyOptional({ description: 'Speed in km/h' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  speedKph?: number | null;

  @ApiPropertyOptional({ description: 'Heading in degrees' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  heading?: number | null;

  @ApiProperty({ description: 'Timestamp' })
  @IsDateString()
  timestamp: string;
}
