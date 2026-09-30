// src/app.setup.ts
import { LoggerService, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import * as express from 'express';
import { AllExceptionsFilter } from './filters/http-exception.filter';

/** Toda la configuración "de servidor" de la app (filtro global, helmet,
 * estáticos, prefijo, validación, CORS) en un solo lugar: la usa `main.ts`
 * para el servidor real y los tests e2e de seguridad (test/security/) para
 * levantar la app EXACTAMENTE igual — así una prueba de cabeceras, CORS o
 * validación no se puede desviar de lo que corre en producción por haber
 * copiado la configuración a mano en otro lado. */
export function configureApp(
  app: NestExpressApplication,
  logger: LoggerService,
): void {
  // Configura el filtro global de excepciones con el logger de Winston
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  // Detrás de un proxy inverso (nginx, etc.), sin esto `req.ip` es siempre
  // la IP del proxy y los límites por IP (login, contacto, webhook) cuentan
  // a TODOS los visitantes como uno solo. TRUST_PROXY = cantidad de proxies
  // de confianza (ej. "1"); sin definir, no se confía en X-Forwarded-For
  // (un cliente podría falsearlo para esquivar los límites).
  if (process.env.TRUST_PROXY) {
    app.set(
      'trust proxy',
      /^\d+$/.test(process.env.TRUST_PROXY)
        ? Number(process.env.TRUST_PROXY)
        : process.env.TRUST_PROXY,
    );
  }

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
  // definir, NO se abre a "*": se permite solo el origen del frontend
  // (FRONTEND_URL, o el de Vite en desarrollo). Antes el default era "*",
  // así que un deploy con la variable olvidada quedaba abierto a cualquier
  // sitio sin ningún aviso.
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : [process.env.FRONTEND_URL || 'http://localhost:5173'];

  app.enableCors({
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
}
