import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { STATUS_CODES } from 'http';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    const developerMessage = exception.message;
    let userMessage = 'An unexpected error occurred';

    switch (exception.code) {
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        userMessage = 'Related record not found';
        break;
      case 'P2002':
        status = HttpStatus.CONFLICT;
        userMessage = 'Duplicate value violates unique constraint';
        break;
      // Add more cases as needed
    }

    const defaultHttpMessage = STATUS_CODES[status] ?? 'Unknown Error';

    return response.status(status).json({
      statusCode: status,
      message: defaultHttpMessage, // consistent default message
      userMessage, // custom user-facing message
      developerMessage, // detailed error for dev
      prismaCode: exception.code,
      meta: exception.meta,
      exception,
      stack: exception.stack,
    });
  }
}
