import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { bootstrapDatabase } from './database/bootstrap';

async function bootstrap() {
  // Initialize database tables
  await bootstrapDatabase();

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const apiPrefix = configService.get('server.apiPrefix');
  const port = configService.get('server.port');

  app.setGlobalPrefix(apiPrefix);

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}${apiPrefix}`);
}
bootstrap();
