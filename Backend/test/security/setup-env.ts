// Corre ANTES de cargar cualquier módulo de la app (jest "setupFiles"): deja
// el entorno apuntando a la base de TESTS y a un directorio de trabajo
// descartable. Ver guia-seguridad-proyectos.md, Fase 0.
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parse } from 'dotenv';

const envFile = join(__dirname, '..', '..', '.env.e2e');

if (!existsSync(envFile)) {
  throw new Error(
    `Falta ${envFile}: credenciales de la base de tests (tienda-carrito_e2e). Ver test/security/README.md`,
  );
}

const vars = parse(readFileSync(envFile));

// Se FUERZA (no "si no está definido"): un .env real o variables del shell
// no pueden desviar estas pruebas hacia la base de verdad.
Object.assign(process.env, vars, {
  DB_TYPE: 'mysql',
  MAIL_USER: 'tests@example.com',
  MAIL_PASSWORD: 'no-se-usa',
  MERCADOPAGO_ACCESS_TOKEN: 'TEST-token-falso',
  MERCADOPAGO_WEBHOOK_URL: '',
  FRONTEND_URL: 'http://localhost:5173',
  // como en producción: una lista explícita (el front de desarrollo)
  CORS_ORIGIN: 'http://localhost:5173',
  SEED_ADMIN_NICK: '',
  SEED_ADMIN_PASSWORD: '',
  SEED_ADMIN_EMAIL: '',
});

// Guarda dura: la base tiene que ser una base de tests. Abortar antes de
// que nada se conecte es mejor que descubrirlo después de borrar datos.
if (!/_e2e$/.test(process.env.DB_NAME ?? '')) {
  throw new Error(
    `ABORTADO: DB_NAME="${process.env.DB_NAME}" no termina en "_e2e". Estas pruebas crean y borran datos.`,
  );
}

// logs/ y uploads/ son relativos al cwd: se trabaja en un directorio
// temporal para no ensuciar (ni borrar por error) los uploads/ reales, que
// mezclan datos de prueba y datos reales (ver Backend/CLAUDE.md).
const workdir = join(tmpdir(), `tienda-carrito-e2e-${process.pid}`);
mkdirSync(workdir, { recursive: true });
process.chdir(workdir);
process.env.E2E_WORKDIR = workdir;
