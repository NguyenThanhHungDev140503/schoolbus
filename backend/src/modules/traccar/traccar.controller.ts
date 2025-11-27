import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../core/decorators/roles.decorator';
import { TraccarService } from './traccar.service';
import { TraccarDeviceDto } from './dto/traccar-device.dto';
import { TraccarPositionDto } from './dto/traccar-position.dto';
import { QueryPositionDto } from './dto/query-position.dto';
import { CreateDeviceDto } from './dto/create-device.dto';

@ApiTags('traccar')
@ApiBearerAuth()
@Controller('traccar')
@Roles(UserRole.admin)
export class TraccarController {
  constructor(private readonly traccarService: TraccarService) { }

  @Get('devices')
  @ApiOperation({ summary: 'Get all devices from Traccar' })
  @ApiResponse({
    status: 200,
    description: 'List of Traccar devices',
    type: [TraccarDeviceDto],
  })
  async getDevices(): Promise<TraccarDeviceDto[]> {
    return this.traccarService.getDevices();
  }

  @Get('positions')
  @ApiOperation({ summary: 'Get positions from Traccar' })
  @ApiResponse({
    status: 200,
    description: 'List of Traccar positions',
    type: [TraccarPositionDto],
  })
  async getPositions(
    @Query() query: QueryPositionDto,
  ): Promise<TraccarPositionDto[]> {
    return this.traccarService.getPositions({
      deviceId: query.deviceId,
      from: query.from,
      to: query.to,
      id: query.id,
    });
  }

  @Post('devices')
  @ApiOperation({ summary: 'Create a new device in Traccar' })
  @ApiResponse({
    status: 201,
    description: 'Device created successfully',
    type: TraccarDeviceDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (e.g., duplicate uniqueId)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async createDevice(
    @Body() createDeviceDto: CreateDeviceDto,
  ): Promise<TraccarDeviceDto> {
    return this.traccarService.createDevice(createDeviceDto);
  }
}
