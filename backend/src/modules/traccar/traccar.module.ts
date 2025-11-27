import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { TraccarService } from './traccar.service';
import { TraccarSyncService } from './traccar-sync.service';
import { TraccarController } from './traccar.controller';

@Module({
  imports: [HttpModule, PrismaModule],
  controllers: [TraccarController],
  providers: [TraccarService, TraccarSyncService],
  exports: [TraccarService],
})
export class TraccarModule { }
