import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { POOL_PROVIDER } from './pool.provider';
import { TransactionService } from './transaction.service';

const poolFactory = {
  provide: POOL_PROVIDER,
  useFactory: (configService: ConfigService) => {
    const databaseUrl = configService.get<string>('database.url');
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    return new Pool({ connectionString: databaseUrl });
  },
  inject: [ConfigService],
};

@Global()
@Module({
  providers: [poolFactory, TransactionService],
  exports: [POOL_PROVIDER, TransactionService],
})
export class DatabaseModule {}
