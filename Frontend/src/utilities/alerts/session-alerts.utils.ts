// src/utilities/alerts/session-alerts.utils.ts
/**
 * Alertas relacionadas a la sesión/token, usadas por el interceptor de
 * axios (src/api/axios.ts). Separadas de alert.utils.ts (genérico) para
 * que cada proyecto agregue sus propias alertas de negocio en un archivo
 * aparte sin tocar este.
 *
 * Vacío por ahora: la única alerta que tenía (servidorNoDisponibleAlert,
 * "vas a ser redirigido al login") se sacó al cambiar el destino de
 * "servidor caído" de /login a la página dedicada ServiceUnavailable (ver
 * App.tsx) — esa página ya comunica el problema, no hacía falta además un
 * alert previo diciendo algo que, encima, ya no es cierto. Si en el
 * futuro hace falta una alerta de sesión/token nueva, va acá.
 */
