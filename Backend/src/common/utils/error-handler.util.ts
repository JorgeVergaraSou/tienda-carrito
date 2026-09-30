import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { EntityNotFoundError, QueryFailedError, TypeORMError } from 'typeorm';

interface MinimalLogger {
  error: (message: string, meta?: unknown) => void;
}

/**
 * Maneja errores internos de servicios de forma consistente: los loguea
 * con Winston (al logger propio del módulo que se le pase) y lanza la
 * excepción adecuada para que la maneje el filtro global de NestJS.
 *
 * `context` es opcional: información adicional (ids, parámetros, etc.)
 * que se agrega a la línea de log para facilitar el debug.
 *
 * Está tipada `never` — no hace falta `return` después de llamarla.
 */
export function handleServiceError(
  error: unknown,
  logger: MinimalLogger,
  serviceName: string,
  defaultMessage: string,
  context?: Record<string, unknown>,
): never {
  const contextoTexto = context
    ? ` | Contexto: ${JSON.stringify(context)}`
    : '';

  logger.error(
    `[${serviceName}] Error: ${error instanceof Error ? error.message : error}${contextoTexto}`,
    (error as any)?.stack || undefined,
  );

  // Si el error ya es una excepción de negocio (BadRequestException,
  // NotFoundException, UnauthorizedException, etc.), se relanza tal cual
  // en vez de envolverla en un 500 — permite lanzar esas excepciones desde
  // dentro de un try/catch sin que este helper las pise.
  if (error instanceof HttpException) {
    throw error;
  }

  if (error instanceof QueryFailedError) {
    // Entrada duplicada en una columna única (ej. dos registros
    // simultáneos con el mismo email, ganándole a la validación previa por
    // una condición de carrera) — 409, no 500: el cliente puede reintentar
    // con otro valor en vez de recibir un error genérico de servidor.
    if (
      (error as any).driverError?.code === 'ER_DUP_ENTRY' ||
      (error as any).driverError?.errno === 1062
    ) {
      throw new ConflictException('El valor ya está en uso');
    }

    // un dato que no entra en la columna (texto más largo, número fuera de
    // rango): es un error del CLIENTE, no del servidor — 400 con un mensaje
    // genérico. Los DTOs ya validan los límites de cada campo; esto es la
    // red de seguridad para el que se les escape.
    const errno = (error as any).driverError?.errno;
    if ([1406, 1264, 1265, 1366, 1292].includes(errno)) {
      throw new BadRequestException(
        'Alguno de los datos enviados no es válido o supera el límite permitido',
      );
    }

    // el mensaje real del error SQL (nombres de tablas y columnas, la
    // consulta) queda en el log de arriba; al cliente NUNCA se le devuelve.
    throw new InternalServerErrorException(defaultMessage);
  }

  // igual que arriba: el detalle queda en el log, no en la respuesta
  if (error instanceof EntityNotFoundError || error instanceof TypeORMError) {
    throw new InternalServerErrorException(defaultMessage);
  }

  throw new InternalServerErrorException(defaultMessage);
}
