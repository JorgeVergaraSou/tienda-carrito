const { VITE_API_BASE_URL } = import.meta.env;

if (!VITE_API_BASE_URL) {
  // Falla rápido y claro en vez de dejar que todos los requests salgan
  // hacia "undefined/..." con un error de red confuso. Ver .env.example.
  throw new Error(
    'Falta VITE_API_BASE_URL en el .env. Copiá .env.example a .env y completá la URL del backend.',
  );
}

export const apiUrl = VITE_API_BASE_URL;

/**
 * Origen del backend (sin el path /tienda/v1) — hace falta para armar la
 * URL completa de archivos servidos como estático (ej. imágenes de
 * productos en /uploads/products/<archivo>), que el backend monta
 * deliberadamente FUERA del prefijo global de la API (ver main.ts).
 */
export const apiOrigin = new URL(apiUrl).origin;
