import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tiendabasica.tienda',
  appName: 'Tienda Básica',
  webDir: 'dist',
  // 'http' en vez del default 'https': el backend de desarrollo corre en HTTP plano
  // (ver network_security_config.xml), y si la app se sirve por HTTPS el WebView
  // bloquea esas llamadas como "Mixed Content" aunque el cleartext esté permitido.
  // Sirviendo la app también por HTTP quedan del mismo lado y deja de aplicar esa
  // política. Revertir a 'https' (el default) cuando el backend tenga HTTPS real.
  server: {
    androidScheme: 'http'
  }
};

export default config;
