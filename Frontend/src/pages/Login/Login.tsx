import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { createUser } from '@/redux/states/user';
import { loginService } from '@/services';
import { getErrorMessage, getRoleRoute } from '@/utilities';
import { Roles } from '@/models';
import { Button, FormField, inputClass } from '@/components/ui';

/** Login — puerta de entrada al panel de administración y al área de
 * usuario, no una página de marketing: fondo neutro (slate-50, heredado
 * de `body` en index.css, ver "App Shell" en Frontend/CLAUDE.md), una
 * sola tarjeta centrada, sin imagen inventada. La lógica de autenticación
 * (loginService, redirect por rol, manejo de `?redirect=`) no se tocó. */
function Login() {
  const [nickUsuarioInput, setNickUsuarioInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nickUsuarioInput || !passwordInput) {
      return setError('Todos los campos son obligatorios');
    }
    setLoading(true);
    setError('');
    try {
      const { token, nickUsuario, role, name, idUser } = await loginService(nickUsuarioInput, passwordInput);

      dispatch(createUser({ nickUsuario, role, token, name, idUser }));

      const roleRoute = getRoleRoute(role as Roles);

      // Obtener la ruta de redirección de la query string
      const query = new URLSearchParams(location.search);
      const redirectPath = query.get('redirect') || roleRoute;

      navigate(redirectPath, { replace: true });

    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Link to="/" className="text-lg font-extrabold tracking-tight text-slate-900">
            Tienda Básica
          </Link>
          <h1 className="mt-3 text-xl font-semibold text-slate-900">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-slate-500">Panel de administración y cuenta de usuario.</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <FormField label="Usuario" htmlFor="nickUsuario">
            <input
              name="nickUsuario"
              id="nickUsuario"
              type="text"
              placeholder="tu usuario"
              autoComplete="username"
              value={nickUsuarioInput}
              onChange={(e) => setNickUsuarioInput(e.target.value)}
              className={inputClass}
            />
          </FormField>

          <FormField label="Contraseña" htmlFor="password">
            <input
              name="password"
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className={inputClass}
            />
          </FormField>

          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="mt-1 w-full">
            {loading ? 'Ingresando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default Login;
