// Fase 4 (5.6 de la guía): archivos subidos (portada, galería y avatar).
import {
  api,
  archivosSubidos,
  cerrar,
  createTestApp,
  crearProducto,
  PNG_1X1,
  rawRequest,
  TestContext,
} from './helpers';

const HTML = Buffer.from(
  '<html><script>alert(document.cookie)</script></html>',
);

describe('Archivos subidos (5.6)', () => {
  let ctx: TestContext;
  let http: ReturnType<typeof api>;
  let producto: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    http = api(ctx);
    producto = await crearProducto(ctx, { creadoPor: 'USER_A' });
  });
  afterAll(async () => cerrar(ctx));
  beforeEach(() => ctx.clearRateLimits());

  const subir = (
    ruta: string,
    quien: string,
    buf: Buffer,
    meta: { filename?: string; contentType?: string; campo?: string } = {},
  ) =>
    http
      .post(ruta)
      .set(ctx.auth(quien))
      .attach(meta.campo ?? 'file', buf, {
        filename: meta.filename ?? 'foto.png',
        contentType: meta.contentType ?? 'image/png',
      });

  describe('el contenido tiene que ser realmente una imagen (no confiar en el Content-Type)', () => {
    it.each([
      ['portada', () => `/productos/${producto}/imagen`, 'ADMIN'],
      ['galería', () => `/productos/${producto}/fotos`, 'ADMIN'],
      ['avatar', () => '/auth/foto', 'USER_A'],
    ])(
      'HTML con Content-Type image/png en %s → 400',
      async (_n, ruta, quien) => {
        const antes =
          archivosSubidos('products').length +
          archivosSubidos('avatars').length;
        await subir(ruta(), quien, HTML).expect(400);
        // ...y no queda el archivo en disco
        expect(
          archivosSubidos('products').length +
            archivosSubidos('avatars').length,
        ).toBe(antes);
      },
    );

    it('un .exe con firma "MZ" declarado como image/jpeg → 400', async () => {
      await subir(
        `/productos/${producto}/fotos`,
        'ADMIN',
        Buffer.from('MZ\x90\x00\x03\x00\x00\x00'),
        { contentType: 'image/jpeg', filename: 'a.jpg' },
      ).expect(400);
    });

    it('un archivo vacío declarado como image/png → 400', async () => {
      await subir(
        `/productos/${producto}/fotos`,
        'ADMIN',
        Buffer.alloc(0),
      ).expect(400);
    });

    it('un PNG real declarado como image/jpeg → 400 (la firma no corresponde al tipo declarado)', async () => {
      await subir(`/productos/${producto}/fotos`, 'ADMIN', PNG_1X1, {
        contentType: 'image/jpeg',
        filename: 'a.jpg',
      }).expect(400);
    });

    it.each([
      'image/svg+xml',
      'text/html',
      'application/pdf',
      'application/x-msdownload',
      'image/gif',
    ])('tipo %s → 400 (lista blanca: jpg, png y webp)', async (tipo) => {
      await subir(`/productos/${producto}/fotos`, 'ADMIN', HTML, {
        contentType: tipo,
      }).expect(400);
    });

    it('un PNG válido se acepta (201)', async () => {
      await subir(`/productos/${producto}/fotos`, 'ADMIN', PNG_1X1).expect(201);
    });
  });

  describe('el nombre y el tamaño', () => {
    it('el nombre final lo decide el servidor (uuid): "../../evil.php" no llega al disco', async () => {
      const res = await subir(
        `/productos/${producto}/imagen`,
        'ADMIN',
        PNG_1X1,
        { filename: '../../evil.php.png' },
      ).expect(201);
      expect(res.body.imageUrl).toMatch(
        /^\/uploads\/products\/[0-9a-f-]{36}\.png$/,
      );
    });

    it('un nombre de 300 caracteres no rompe (no 500)', async () => {
      const res = await subir(
        `/productos/${producto}/fotos`,
        'ADMIN',
        PNG_1X1,
        { filename: `${'a'.repeat(300)}.png` },
      );
      expect(res.status).toBe(201);
    });

    it('un nombre con ñ y tildes no rompe', async () => {
      await subir(`/productos/${producto}/fotos`, 'ADMIN', PNG_1X1, {
        filename: 'niño-café.png',
      }).expect(201);
    });

    it('un archivo de 6 MB (límite 5 MB) → 413', async () => {
      const grande = Buffer.concat([PNG_1X1, Buffer.alloc(6 * 1024 * 1024)]);
      await subir(`/productos/${producto}/fotos`, 'ADMIN', grande).expect(413);
    });

    it('un campo de archivo con otro nombre → 400 (no 500)', async () => {
      await subir(`/productos/${producto}/fotos`, 'ADMIN', PNG_1X1, {
        campo: 'otro',
      }).expect(400);
    });

    it('varios archivos a la vez → 400 (no 500)', async () => {
      const res = await http
        .post(`/productos/${producto}/fotos`)
        .set(ctx.auth('ADMIN'))
        .attach('file', PNG_1X1, {
          filename: 'a.png',
          contentType: 'image/png',
        })
        .attach('file', PNG_1X1, {
          filename: 'b.png',
          contentType: 'image/png',
        });
      expect(res.status).toBeLessThan(500);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('archivos huérfanos: si el pedido falla DESPUÉS de que multer guardó, se borra', () => {
    it('subir a un producto ajeno (403) no deja el archivo en disco', async () => {
      const antes = archivosSubidos('products').length;
      await subir(`/productos/${producto}/fotos`, 'USER_B', PNG_1X1).expect(
        403,
      );
      expect(archivosSubidos('products').length).toBe(antes);
    });

    it('subir a un producto inexistente (404) no deja el archivo en disco', async () => {
      const antes = archivosSubidos('products').length;
      await subir('/productos/999999/imagen', 'ADMIN', PNG_1X1).expect(404);
      expect(archivosSubidos('products').length).toBe(antes);
    });

    it('reemplazar el avatar borra el anterior (queda 1 solo archivo)', async () => {
      for (let i = 0; i < 3; i++)
        await subir('/auth/foto', 'USER_B', PNG_1X1).expect(201);
      expect(archivosSubidos('avatars')).toHaveLength(1);
    });
  });

  describe('servir imágenes', () => {
    it('una imagen subida se sirve con nosniff y tipo de imagen', async () => {
      const res = await subir(
        `/productos/${producto}/imagen`,
        'ADMIN',
        PNG_1X1,
      ).expect(201);
      const img = await rawRequest(ctx, res.body.imageUrl);
      expect(img.status).toBe(200);
      expect(img.headers['content-type']).toMatch(/^image\//);
      expect(img.headers['x-content-type-options']).toBe('nosniff');
    });
  });
});
