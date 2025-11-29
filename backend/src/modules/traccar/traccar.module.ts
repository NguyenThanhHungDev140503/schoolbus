import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { PrismaModule } from '../../core/prisma/prisma.module';
import { TraccarController } from './traccar.controller';
import { TraccarSyncService } from './traccar-sync.service';
import { TraccarService } from './traccar.service';
import { TraccarWebSocketService } from './traccar-websocket.service';

@Module({
  imports: [HttpModule, PrismaModule],
  controllers: [TraccarController],
  providers: [TraccarService, TraccarSyncService, TraccarWebSocketService],
  exports: [TraccarService],
})
export class TraccarModule {}
