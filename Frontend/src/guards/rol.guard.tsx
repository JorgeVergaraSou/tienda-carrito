//src/guards/rol.guard.tsx
import { useSelector } from 'react-redux';
import { Navigate, Outlet } from 'react-router-dom';
import { PrivateRoutes } from '@/models';
import { AppStore } from '@/redux/store';
import { RoleProps } from '@/interfaces';

function RoleGuard({ roles }: RoleProps) {
  const userState = useSelector((store: AppStore) => store.user);
  // ruta ABSOLUTA (con "/" adelante) a propósito — no `to={PrivateRoutes.PRIVATE}`
  // a secas: ese string es relativo ("private", sin "/"), y React Router
  // resuelve una navegación relativa contra la base del router más
  // cercano. Mientras este guard solo se usaba en el router de nivel
  // superior (App.tsx) eso coincidía con la raíz del sitio y andaba bien
  // por casualidad — pero al reusarlo también dentro del router anidado
  // de Private.tsx (que ya vive bajo /private), la misma navegación
  // relativa resolvía contra esa base anidada y quedaba pegando
  // "/private" de nuevo sobre la URL actual en cada redirect, en un loop
  // real (bug encontrado en una pasada de QA, ver Frontend/CLAUDE.md).
  // Absoluta, el destino es siempre el mismo sin importar en qué router
  // (de nivel superior o anidado) esté montado este guard.
  return roles.includes(userState.role) ? <Outlet /> : <Navigate replace to={`/${PrivateRoutes.PRIVATE}`} />;
}

export default RoleGuard;
