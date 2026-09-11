import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  LoggerService,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {} // Cambiamos el tipo a LoggerService

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? typeof exception.getResponse() === 'object'
          ? (exception.getResponse() as any).message
          : exception.getResponse()
        : 'Error interno';

    this.logger.error(
      `HTTP ${status} Error en ${request.method} ${request.url}: ${JSON.stringify(message)}`,
      exception instanceof Error ? exception.stack : '',
    );

    // NOTA: no se manda el stack trace en la respuesta (solo queda en el
    // log de arriba) — este proyecto no setea NODE_ENV en ningún lado, así
    // que un chequeo tipo `NODE_ENV !== 'production'` trataría cualquier
    // deploy real como desarrollo y filtraría el stack trace a usuarios
    // reales. Si en algún momento se define NODE_ENV de forma confiable en
    // todos los entornos, ahí sí tiene sentido condicionar esto.
    response.status(status).json({
      success: false,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
