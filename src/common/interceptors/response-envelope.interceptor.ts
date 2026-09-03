import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = (request as any).requestId;

    return next.handle().pipe(
      map((payload) => {
        // If a controller already returned an envelope ({ success, ... }), don't
        // wrap it a second time — just attach the requestId. Otherwise treat the
        // return value as the `data` payload and wrap it once.
        if (
          payload !== null &&
          typeof payload === 'object' &&
          'success' in payload
        ) {
          return { ...(payload as Record<string, unknown>), requestId };
        }

        return {
          success: true,
          data: payload,
          requestId,
        };
      }),
    );
  }
}
