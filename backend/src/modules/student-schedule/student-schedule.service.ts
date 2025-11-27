import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateStudentScheduleDto } from './dto/create-student-schedule.dto';
import { PageableStudentScheduleResponseDto } from './dto/pageable-student-schedule-response.dto';
import { PaginatedQueryStudentScheduleDto } from './dto/paginated-query-student-schedule.dto';
import { QueryStudentScheduleDto } from './dto/query-student-schedule.dto';
import { StudentScheduleResponseDto } from './dto/student-schedule-response.dto';
import { UpdateStudentScheduleDto } from './dto/update-student-schedule.dto';
import { StudentScheduleRepository } from './student-schedule.repository';

@Injectable()
export class StudentScheduleService {
  constructor(
    private readonly studentScheduleRepository: StudentScheduleRepository,
  ) {}

  async create(
    createStudentScheduleDto: CreateStudentScheduleDto,
  ): Promise<StudentScheduleResponseDto> {
    const studentSchedule = await this.studentScheduleRepository.create({
      student: {
        connect: {
          id: createStudentScheduleDto.studentId,
        },
      },
      schedule: {
        connect: {
          id: createStudentScheduleDto.scheduleId,
        },
      },
      pickupStop: createStudentScheduleDto.pickupStopId
        ? {
            connect: {
              id: createStudentScheduleDto.pickupStopId,
            },
          }
        : undefined,
      dropoffStop: createStudentScheduleDto.dropoffStopId
        ? {
            connect: {
              id: createStudentScheduleDto.dropoffStopId,
            },
          }
        : undefined,
    });
    return StudentScheduleResponseDto.fromStudentSchedule(studentSchedule);
  }

  async findAll(
    query: QueryStudentScheduleDto,
  ): Promise<StudentScheduleResponseDto[]> {
    const filter = this.buildFilter(query);
    const studentSchedules =
      await this.studentScheduleRepository.findByFilter(filter);
    return studentSchedules.map((schedule) =>
      StudentScheduleResponseDto.fromStudentSchedule(schedule),
    );
  }

  async findAllWithPagination(
    query: PaginatedQueryStudentScheduleDto,
  ): Promise<PageableStudentScheduleResponseDto> {
    const { page, limit, sortBy, sortOrder, ...filterData } = query;
    const filter = this.buildFilter(filterData);
    const pagination = { page, limit, sortBy, sortOrder };

    const result =
      await this.studentScheduleRepository.findByFilterWithPagination(
        filter,
        pagination,
      );

    return {
      ...result,
      data: result.data.map((schedule) =>
        StudentScheduleResponseDto.fromStudentSchedule(schedule),
      ),
    };
  }

  async findOne(id: number): Promise<StudentScheduleResponseDto> {
    const studentSchedule = await this.studentScheduleRepository.findById(id);
    if (!studentSchedule) {
      throw new NotFoundException(`StudentSchedule with ID ${id} not found`);
    }
    return StudentScheduleResponseDto.fromStudentSchedule(studentSchedule);
  }

  async update(
    id: number,
    updateStudentScheduleDto: UpdateStudentScheduleDto,
  ): Promise<StudentScheduleResponseDto> {
    const studentSchedule = await this.studentScheduleRepository.findById(id);
    if (!studentSchedule) {
      throw new NotFoundException(`StudentSchedule with ID ${id} not found`);
    }

    const updatedStudentSchedule = await this.studentScheduleRepository.update(
      id,
      {
        student: updateStudentScheduleDto.studentId
          ? {
              connect: {
                id: updateStudentScheduleDto.studentId,
              },
            }
          : undefined,
        schedule: updateStudentScheduleDto.scheduleId
          ? {
              connect: {
                id: updateStudentScheduleDto.scheduleId,
              },
            }
          : undefined,
        pickupStop: updateStudentScheduleDto.pickupStopId
          ? {
              connect: {
                id: updateStudentScheduleDto.pickupStopId,
              },
            }
          : updateStudentScheduleDto.pickupStopId === null
            ? { disconnect: true }
            : undefined,
        dropoffStop: updateStudentScheduleDto.dropoffStopId
          ? {
              connect: {
                id: updateStudentScheduleDto.dropoffStopId,
              },
            }
          : updateStudentScheduleDto.dropoffStopId === null
            ? { disconnect: true }
            : undefined,
      },
    );
    return StudentScheduleResponseDto.fromStudentSchedule(
      updatedStudentSchedule,
    );
  }

  async remove(id: number): Promise<void> {
    const studentSchedule = await this.studentScheduleRepository.findById(id);
    if (!studentSchedule) {
      throw new NotFoundException(`StudentSchedule with ID ${id} not found`);
    }
    await this.studentScheduleRepository.delete(id);
  }

  private buildFilter(query: QueryStudentScheduleDto) {
    const filter: Record<string, unknown> = {};

    if (query.studentId) {
      filter.studentId = query.studentId;
    }

    if (query.scheduleId) {
      filter.scheduleId = query.scheduleId;
    }

    if (query.pickupStopId) {
      filter.pickupStopId = query.pickupStopId;
    }

    if (query.dropoffStopId) {
      filter.dropoffStopId = query.dropoffStopId;
    }

    if (query.studentName) {
      filter.student = {
        fullName: { contains: query.studentName, mode: 'insensitive' },
      };
    }

    if (query.scheduleDayOfWeek) {
      filter.schedule = {
        dayOfWeek: query.scheduleDayOfWeek,
      };
    }

    // if (query.scheduleTripType) {
    //   filter.schedule = {
    //     ...filter.schedule,
    //     tripType: query.scheduleTripType,
    //   };
    // }

    return filter;
  }
}
