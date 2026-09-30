// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './config/winston.config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from './app.setup';

async function bootstrap() {
  // Usamos la configuración completa de Winston
  const winstonLogger = WinstonModule.createLogger(winstonConfig);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: winstonLogger, // Logger global de NestJS
  });

  // filtro, helmet, estáticos, prefijo, validación y CORS: ver app.setup.ts
  // (compartido con los tests e2e de seguridad).
  configureApp(app, winstonLogger);

  await app.listen(process.env.PORT || 3006);
}
bootstrap();
