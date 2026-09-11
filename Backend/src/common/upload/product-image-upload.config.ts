//src/common/upload/product-image-upload.config.ts

import { diskStorage } from 'multer';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';

/** mismo mecanismo que avatar-upload.config.ts (mismos mimetypes
 * aceptados, misma razón para derivar la extensión del mimetype y no del
 * nombre de archivo que manda el cliente), pero guardando en
 * uploads/products en vez de uploads/avatars. */
const MIME_A_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const productImageStorage = diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = join(process.cwd(), 'uploads', 'products');

    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const extension = MIME_A_EXTENSION[file.mimetype] ?? '.jpg';
    cb(null, `${randomUUID()}${extension}`);
  },
});

export const productImageFileFilter = (
  req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!MIME_A_EXTENSION[file.mimetype]) {
    return cb(
      new BadRequestException('La imagen debe ser un archivo jpg, png o webp'),
      false,
    );
  }

  cb(null, true);
};
