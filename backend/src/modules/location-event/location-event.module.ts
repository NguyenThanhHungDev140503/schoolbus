import { Module } from '@nestjs/common';
import { LocationEventController } from './location-event.controller';
import { LocationEventRepository } from './location-event.repository';
import { LocationEventService } from './location-event.service';
import { LocationEventGateway } from './gateways/location-event.gateway';
import { LocationThrottleService } from './location-throttle.service';

@Module({
  controllers: [LocationEventController],
  providers: [
    LocationEventService,
    LocationEventRepository,
    LocationEventGateway,
    LocationThrottleService,
  ],
  exports: [
    LocationEventService,
    LocationEventGateway,
    LocationThrottleService,
  ],
})
export class LocationEventModule { }
