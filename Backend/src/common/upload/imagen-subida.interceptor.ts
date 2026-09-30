import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { closeSync, existsSync, openSync, readSync, unlinkSync } from 'fs';
import { Observable, catchError, throwError } from 'rxjs';

/** Firma (primeros bytes) de cada formato aceptado, por mimetype declarado.
 * El Content-Type de un multipart lo declara el CLIENTE: un HTML o un .exe
 * enviado como `image/png` pasa el `fileFilter` de multer (que solo mira ese
 * texto). Acá se lee el contenido real del archivo ya guardado. */
const FIRMAS: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/jpg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) =>
    b
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) =>
    b.subarray(0, 4).toString('ascii') === 'RIFF' &&
    b.subarray(8, 12).toString('ascii') === 'WEBP',
};

function leerCabecera(ruta: string): Buffer {
  const fd = openSync(ruta, 'r');
  try {
    const buffer = Buffer.alloc(12);
    const leidos = readSync(fd, buffer, 0, 12, 0);
    return buffer.subarray(0, leidos);
  } finally {
    closeSync(fd);
  }
}

function borrar(file?: Express.Multer.File): void {
  if (file?.path && existsSync(file.path)) {
    try {
      unlinkSync(file.path);
    } catch {
      // si no se puede borrar no se tapa el error original con este otro
    }
  }
}

/** Corre DESPUÉS de `FileInterceptor` (multer ya guardó el archivo en
 * disco) y hace dos cosas:
 *
 * 1. Verifica que el contenido sea realmente lo que dice ser (firma de
 *    bytes, ver FIRMAS). Si no, borra el archivo y responde 400.
 * 2. Si el handler (o el service) falla DESPUÉS de que el archivo ya se
 *    guardó — producto ajeno (403), producto inexistente (404), error de
 *    base — borra el archivo. Sin esto, cada pedido rechazado dejaba un
 *    archivo huérfano en uploads/ (y cualquiera logueado podía llenar el
 *    disco subiendo a productos que no son suyos).
 *
 * Uso: `@UseInterceptors(FileInterceptor('file', {...}), ImagenSubidaInterceptor)`
 * — el orden importa, el de multer va primero. */
@Injectable()
export class ImagenSubidaInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const file: Express.Multer.File | undefined = context
      .switchToHttp()
      .getRequest().file;

    // sin archivo no hay nada que verificar: el service responde su 400
    // "Debe adjuntar una imagen"
    if (!file) {
      return next.handle();
    }

    const verifica = FIRMAS[file.mimetype];
    if (!verifica || !file.path || !verifica(leerCabecera(file.path))) {
      borrar(file);
      throw new BadRequestException(
        'El archivo no es una imagen válida (jpg, png o webp)',
      );
    }

    return next.handle().pipe(
      catchError((error) => {
        borrar(file);
        return throwError(() => error);
      }),
    );
  }
}
