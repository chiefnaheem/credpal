import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || exception.message;
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : exception);
    }

    response.status(status).json({
      success: false,
      message: Array.isArray(message) ? message.join(', ') : message,
      statusCode: status,
      timestamp: new Date().toISOString(),
    });
  }
}
