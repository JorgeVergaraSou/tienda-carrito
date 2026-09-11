//src/common/upload/avatar-upload.config.ts

import { diskStorage } from 'multer';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';

/** único lugar que decide qué mimetypes de imagen se aceptan — usado tanto
 * para filtrar el upload como para elegir la extensión con la que se
 * guarda (ver avatarStorage.filename más abajo: la extensión NUNCA sale
 * del nombre de archivo que manda el cliente). */
const MIME_A_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const avatarStorage = diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = join(process.cwd(), 'uploads', 'avatars');

    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    // la extensión se deriva del mimetype ya validado por
    // avatarFileFilter (que corre antes y solo deja pasar mimetypes de
    // MIME_A_EXTENSION) — nunca del nombre de archivo original, que manda
    // el cliente y podría traer cualquier extensión (ej. .php) sin
    // relación real con el contenido subido.
    const extension = MIME_A_EXTENSION[file.mimetype] ?? '.jpg';
    cb(null, `${randomUUID()}${extension}`);
  },
});

export const avatarFileFilter = (
  req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!MIME_A_EXTENSION[file.mimetype]) {
    return cb(
      new BadRequestException('La foto debe ser una imagen (jpg, png o webp)'),
      false,
    );
  }

  cb(null, true);
};
