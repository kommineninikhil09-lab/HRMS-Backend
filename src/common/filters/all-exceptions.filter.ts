import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request as any).requestId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (exceptionResponse && typeof exceptionResponse === 'object') {
        const body = exceptionResponse as Record<string, any>;
        message = body.message ?? body.error ?? message;
        // Honour an explicit machine code if the thrower provided one, e.g.
        // `throw new HttpException({ message, error: { code: 'X' } }, status)`.
        if (body.error && typeof body.error === 'object' && body.error.code) {
          code = body.error.code;
        }
      }

      // Otherwise derive the code from the HTTP status (FORBIDDEN, NOT_FOUND, …)
      // rather than leaving the default INTERNAL_SERVER_ERROR.
      if (code === 'INTERNAL_SERVER_ERROR') {
        code = HttpStatus[status] ?? 'HTTP_ERROR';
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception);
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
      },
      requestId,
    });
  }
}
