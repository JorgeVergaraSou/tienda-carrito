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

    // Los errores del propio Express / body-parser (cuerpo demasiado grande,
    // JSON mal formado, charset inválido, etc.) NO son HttpException de Nest
    // pero traen un `status` 4xx y `expose: true` — marcan que el error es
    // del cliente y se puede mostrar. Sin esto caían en el 500 de abajo: un
    // cuerpo de 1 MB daba 500 en vez de 413 y un JSON roto 500 en vez de 400.
    const errorDeCliente = this.errorDeClienteExpress(exception);

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (errorDeCliente?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);

    const message =
      exception instanceof HttpException
        ? typeof exception.getResponse() === 'object'
          ? (exception.getResponse() as any).message
          : exception.getResponse()
        : (errorDeCliente?.message ?? 'Error interno');

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

  /** si `exception` es un error 4xx "exponible" de Express (body-parser,
   * etc.), devuelve su status y un mensaje en español sin detalles
   * internos; si no, undefined (y el filtro lo trata como un 500). */
  private errorDeClienteExpress(
    exception: unknown,
  ): { status: number; message: string } | undefined {
    // Un JSON con miles de niveles de anidado (cabe en el límite de 100 KB)
    // se parsea bien pero desborda la pila al validarlo/transformarlo
    // (RangeError) — es un cuerpo inválido del cliente, no una falla del
    // servidor.
    if (
      exception instanceof RangeError &&
      /Maximum call stack size exceeded/i.test(exception.message)
    ) {
      return { status: 400, message: 'El cuerpo de la petición es inválido' };
    }

    const e = exception as {
      status?: number;
      statusCode?: number;
      expose?: boolean;
      type?: string;
    };
    const status = e?.status ?? e?.statusCode;

    if (
      typeof status !== 'number' ||
      status < 400 ||
      status >= 500 ||
      e.expose !== true
    ) {
      return undefined;
    }

    if (status === 413) {
      return {
        status,
        message: 'El cuerpo de la petición es demasiado grande',
      };
    }

    if (e.type === 'entity.parse.failed') {
      return {
        status,
        message: 'El cuerpo de la petición no es un JSON válido',
      };
    }

    return { status, message: 'Petición inválida' };
  }
}
