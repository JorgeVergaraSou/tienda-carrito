import { defineConfig, loadEnv, type Plugin, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

/**
 * Inyecta una Content-Security-Policy como <meta> en el index.html del BUILD
 * (no en `vite dev`, donde el HMR necesita scripts inline/eval y la CSP solo
 * estorbaría). Es la tercera barrera contra XSS: aunque alguien lograra
 * inyectar HTML, el navegador se niega a ejecutar código que no venga de la
 * propia app (`script-src 'self'`: sin inline ni eval) y a mandar datos —
 * como el token de sesión — a un servidor que no sea el backend
 * (`connect-src`).
 *
 * El origen del backend sale de `VITE_API_BASE_URL` — el mismo valor que ya
 * usa `src/utilities/apiUrl.utility.ts` — así no se repite una lista de
 * orígenes a mano que se desincronice.
 *
 * - `style-src 'unsafe-inline'`: React pone estilos en línea (atributo
 *   `style`) y SweetAlert2 inyecta su <style> en runtime — mismo
 *   compromiso que documenta la guía de seguridad. Sin `unsafe-inline`
 *   en `script-src`, que es lo que importa contra XSS.
 * - Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`): las
 *   tipografías de los distintos diseños de catálogo (ver index.html).
 * - `img-src ... <api>`: las imágenes de producto y de perfil las sirve el
 *   backend desde /uploads, otro origen que el del frontend.
 * - `frame-ancestors` NO se puede poner en un <meta> (los navegadores lo
 *   ignoran ahí): tiene que ir como cabecera HTTP del servidor que sirva el
 *   build (junto con `X-Frame-Options`) — ver Frontend/CLAUDE.md.
 * - No se aplica al build móvil (`--mode mobile`, Capacitor): el WebView
 *   nativo inyecta su propio puente JS y no se probó la CSP ahí.
 */
function cspPlugin(apiOrigin: string): Plugin {
  const directivas = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    `img-src 'self' data: blob: ${apiOrigin}`,
    `connect-src 'self' ${apiOrigin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  return {
    name: 'inyectar-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html.replace(
          '<head>',
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${directivas}" />`,
        ),
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const plugins: PluginOption[] = [react(), tailwindcss()];

  if (mode !== 'mobile' && env.VITE_API_BASE_URL) {
    plugins.push(cspPlugin(new URL(env.VITE_API_BASE_URL).origin));
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
  };
});
