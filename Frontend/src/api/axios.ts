//src/api/axios.ts
import axios from 'axios';
import { apiUrl } from '@/utilities';
import { UserKey } from '@/redux/states/user';
import { PublicRoutes } from '@/models';

export const api = axios.create({
  baseURL: apiUrl,
});

/**
 * Evita disparar varias redirecciones a la vez cuando el servidor está
 * caído: varios componentes pueden estar pidiendo datos en paralelo y
 * todos van a fallar con el mismo error de conexión casi al mismo tiempo.
 * Al redirigir con `window.location.href` (recarga dura), este módulo se
 * reinstancia solo en la página nueva — no hace falta resetear la
 * bandera a mano.
 */
let redirigiendoPorServidorCaido = false;

api.interceptors.request.use(
  (config) => {
    const userStorage = localStorage.getItem(UserKey);

    if (userStorage) {
      // try/catch: si el valor guardado se corrompió (o alguien lo editó a
      // mano), un JSON.parse sin proteger hace fallar CADA pedido con un
      // SyntaxError que no dice nada. Se sigue sin token: el pedido sale
      // sin Authorization y el backend responde 401, que el interceptor
      // de respuesta ya maneja limpiando la sesión.
      try {
        const user = JSON.parse(userStorage);

        if (user?.token) {
          config.headers.Authorization = `Bearer ${user.token}`;
        }
      } catch {
        localStorage.removeItem(UserKey);
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,

  (error) => {

    // un 401 de /auth/login NO es "tu sesión venció" — es "la contraseña
    // que acabás de escribir está mal" (o el usuario no existe). Antes
    // esto se trataba igual que cualquier otro 401 y disparaba una
    // recarga dura a /login: el catch de Login.tsx alcanzaba a hacer
    // setError(...), pero un instante después la página entera se
    // recargaba (window.location.href) y se llevaba puesto ese estado —
    // el formulario "volvía a cero" en menos de un segundo y el usuario
    // nunca llegaba a leer el mensaje (bug real, reportado por el
    // usuario). El resto de los 401 (un token guardado que venció o es
    // inválido) sigue yendo por la rama de abajo sin cambios.
    const esIntentoDeLogin = error.config?.url === '/auth/login';

    if (error.response?.status === 401 && !esIntentoDeLogin) {

      localStorage.removeItem(UserKey);

      window.location.href = `/${PublicRoutes.LOGIN}`;

    } else if (!error.response) {

      // No hubo respuesta del servidor: caído, sin red, o similar (ej.
      // ERR_CONNECTION_REFUSED). Se cierra la sesión igual que en un 401
      // (fuerza un login nuevo cuando el servidor vuelva), pero a
      // diferencia del 401 NO se redirige a /login: un visitante anónimo
      // navegando el catálogo público nunca tuvo sesión, y mandarlo a una
      // pantalla de login que tampoco va a poder autenticar (el servidor
      // sigue caído) no tiene sentido. Va a una página dedicada
      // (ServiceUnavailable) que no le pega a la API al montarse, para no
      // repetir este mismo error apenas aterriza ahí.
      const enPaginaServicioNoDisponible = window.location.pathname.startsWith(
        `/${PublicRoutes.SERVICE_UNAVAILABLE}`,
      );

      if (!redirigiendoPorServidorCaido && !enPaginaServicioNoDisponible) {
        redirigiendoPorServidorCaido = true;

        localStorage.removeItem(UserKey);

        window.location.href = `/${PublicRoutes.SERVICE_UNAVAILABLE}`;
      }
    }

    const message =
      error.response?.data?.message ||
      (!error.response ? 'No se pudo conectar con el servidor' : 'Error desconocido');

    return Promise.reject(
      new Error(message),
    );
  },
);
