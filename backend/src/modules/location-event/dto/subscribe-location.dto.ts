import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, ValidateIf } from 'class-validator';

export class SubscribeLocationDto {
  @ApiPropertyOptional({ description: 'Bus ID to subscribe to' })
  @IsOptional()
  @IsInt()
  @ValidateIf((o: SubscribeLocationDto) => !o.tripId)
  busId?: number;

  @ApiPropertyOptional({ description: 'Trip ID to subscribe to' })
  @IsOptional()
  @IsInt()
  @ValidateIf((o: SubscribeLocationDto) => !o.busId)
  tripId?: number;
}
