// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { AllExceptionsFilter } from './filters/http-exception.filter';
import { winstonConfig } from './config/winston.config';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  // Usamos la configuración completa de Winston
  const winstonLogger = WinstonModule.createLogger(winstonConfig);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: winstonLogger, // Logger global de NestJS
  });

  // Configura el filtro global de excepciones con el logger de Winston
  app.useGlobalFilters(new AllExceptionsFilter(winstonLogger));

  // Headers de seguridad básicos (oculta X-Powered-By, agrega
  // X-Content-Type-Options, etc.). No configuramos una CSP acá porque esta
  // app es una API pura (sin vistas HTML propias) — si algún proyecto hijo
  // de esta base sirve HTML, ahí sí conviene revisar la CSP por default.
  // crossOriginResourcePolicy en 'cross-origin': sin esto, el frontend (en
  // otro origen/puerto) no puede ni mostrar un <img src> apuntando a
  // /uploads — el default 'same-origin' de helmet lo bloquea en el browser.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Fotos de perfil servidas como estático, ANTES del prefijo global — la
  // URL resultante (/uploads/avatars/<uuid>.ext) no lleva /tienda/v1.
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  app.setGlobalPrefix('tienda-carrito/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // credentials:true no puede combinarse con origin:'*' (los navegadores lo
  // rechazan). El frontend autentica con Authorization: Bearer, no con
  // cookies, así que no hace falta credentials:true.
  // CORS_ORIGIN: lista separada por comas de orígenes permitidos. Sin
  // definir, sigue abierto a "*" (comportamiento actual de desarrollo) —
  // antes de producción, setearla al dominio real del frontend.
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : '*';

  app.enableCors({
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  await app.listen(process.env.PORT || 3006);
}
bootstrap();
