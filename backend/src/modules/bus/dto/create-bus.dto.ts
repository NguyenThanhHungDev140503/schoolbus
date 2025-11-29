import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateBusDto {
  @ApiProperty()
  @IsString()
  licensePlate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  currentLat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  currentLng?: number;

  @ApiPropertyOptional({
    description: 'Traccar Device ID for GPS integration',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  traccarDeviceId?: number;
}
