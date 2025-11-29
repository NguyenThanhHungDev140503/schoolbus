import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BusRepository } from './bus.repository';
import { BusResponseDto } from './dto/bus-response.dto';
import { CreateBusDto } from './dto/create-bus.dto';
import { PageableBusResponseDto } from './dto/pageable-bus-response.dto';
import { PaginatedQueryBusDto } from './dto/paginated-query-bus.dto';
import { QueryBusDto } from './dto/query-bus.dto';
import { UpdateBusDto } from './dto/update-bus.dto';

@Injectable()
export class BusService {
  constructor(private readonly busRepository: BusRepository) { }

  async create(createBusDto: CreateBusDto): Promise<BusResponseDto> {
    const bus = await this.busRepository.create({
      licensePlate: createBusDto.licensePlate,
      capacity: createBusDto.capacity,
      currentLat: createBusDto.currentLat,
      currentLng: createBusDto.currentLng,
      traccarDeviceId: createBusDto.traccarDeviceId,
    });
    return BusResponseDto.fromBus(bus);
  }

  async findAll(query: QueryBusDto): Promise<BusResponseDto[]> {
    const filter = this.buildFilter(query);
    const buses = await this.busRepository.findByFilter(filter);
    return buses.map(BusResponseDto.fromBus);
  }

  async findAllWithPagination(
    query: PaginatedQueryBusDto,
  ): Promise<PageableBusResponseDto> {
    const { page, limit, sortBy, sortOrder, ...filterData } = query;
    const filter = this.buildFilter(filterData);
    const pagination = { page, limit, sortBy, sortOrder };

    const result = await this.busRepository.findByFilterWithPagination(
      filter,
      pagination,
    );

    return {
      ...result,
      data: result.data.map(BusResponseDto.fromBus),
    };
  }

  async findOne(id: number): Promise<BusResponseDto> {
    const bus = await this.busRepository.findById(id);
    if (!bus) {
      throw new NotFoundException(`Bus with ID ${id} not found`);
    }
    return BusResponseDto.fromBus(bus);
  }

  async update(
    id: number,
    updateBusDto: UpdateBusDto,
  ): Promise<BusResponseDto> {
    const bus = await this.busRepository.findById(id);
    if (!bus) {
      throw new NotFoundException(`Bus with ID ${id} not found`);
    }

    const updatedBus = await this.busRepository.update(id, {
      licensePlate: updateBusDto.licensePlate,
      capacity: updateBusDto.capacity,
      currentLat: updateBusDto.currentLat,
      currentLng: updateBusDto.currentLng,
      traccarDeviceId: updateBusDto.traccarDeviceId,
    });
    return BusResponseDto.fromBus(updatedBus);
  }

  async remove(id: number): Promise<void> {
    const bus = await this.busRepository.findById(id);
    if (!bus) {
      throw new NotFoundException(`Bus with ID ${id} not found`);
    }
    await this.busRepository.delete(id);
  }

  private buildFilter(query: QueryBusDto): Prisma.BusWhereInput {
    const filter: Prisma.BusWhereInput = {};

    if (query.licensePlate) {
      filter.licensePlate = {
        contains: query.licensePlate,
        mode: 'insensitive',
      };
    }

    if (query.capacity) {
      filter.capacity = query.capacity;
    }

    if (query.capacityMin || query.capacityMax) {
      filter.capacity = {};
      if (query.capacityMin) filter.capacity.gte = query.capacityMin;
      if (query.capacityMax) filter.capacity.lte = query.capacityMax;
    }

    return filter;
  }
}
