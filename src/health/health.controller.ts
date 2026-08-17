import {
  Controller,
  Get,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Pool } from 'pg';
import { POOL_PROVIDER } from '../database/pool.provider';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(@Inject(POOL_PROVIDER) private pool: Pool) {}

  @Get()
  @Public()
  async health() {
    try {
      await this.pool.query('SELECT 1');
      return {
        status: 'ok',
        database: 'connected',
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          database: 'disconnected',
          message: (error as any).message,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
