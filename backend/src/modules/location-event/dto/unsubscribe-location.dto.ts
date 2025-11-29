import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, ValidateIf } from 'class-validator';

export class UnsubscribeLocationDto {
  @ApiPropertyOptional({ description: 'Bus ID to unsubscribe from' })
  @IsOptional()
  @IsInt()
  @ValidateIf((o: UnsubscribeLocationDto) => !o.tripId)
  busId?: number;

  @ApiPropertyOptional({ description: 'Trip ID to unsubscribe from' })
  @IsOptional()
  @IsInt()
  @ValidateIf((o: UnsubscribeLocationDto) => !o.busId)
  tripId?: number;
}
