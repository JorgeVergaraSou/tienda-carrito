import { Navigate, Route } from "react-router-dom"
import { useSelector } from "react-redux"
import { PrivateRoutes, Roles } from "@/models"
import { AppStore } from "@/redux/store"
import RoleGuard from "@/guards/rol.guard"
import { lazy } from "react"
import RoutesWithNotFound from "@/utilities/RoutesWithNotFound.utility"
import GuestPage from "./Guest/Guest"


const Admin = lazy(() => import('./Admin/Admin'))
const UserPage = lazy(() => import('./User/User'))

// adónde manda '/' según el rol activo — antes iba siempre a ADMIN sin
// importar el rol (bug real, encontrado en una pasada de QA final:
// AuthGuard solo exige estar logueado, sin chequear rol, así que un USER
// que caía acá por cualquier motivo terminaba viendo el layout del panel
// ADMIN, aunque el backend después rechazara cada request con 403 —
// nunca hubo fuga de datos, pero sí una ruta sin el mismo RoleGuard que
// ya protege /admin y /user a nivel de App.tsx).
const rutaPorRol: Record<Roles, string> = {
  [Roles.ADMIN]: PrivateRoutes.ADMIN,
  [Roles.USER]: PrivateRoutes.USER,
  [Roles.GUEST]: PrivateRoutes.GUEST,
  [Roles.EMPTY]: PrivateRoutes.ADMIN,
}

function Private() {
  const role = useSelector((store: AppStore) => store.user.role)

  return (
     <RoutesWithNotFound>
      <Route path='/' element={<Navigate replace to={rutaPorRol[role]} />} />
      {/* /* porque Admin tiene su propio sub-ruteo interno — ver Admin.tsx.
          RoleGuard acá adentro, no solo en App.tsx: sin esto, cualquier
          usuario logueado (no solo ADMIN) que aterrizara en /private podía
          navegar a /private/admin/* y ver el layout del panel entero (ver
          el comentario de rutaPorRol arriba) — mismo criterio de
          protección que ya usan las rutas de nivel superior. */}
      <Route element={<RoleGuard roles={[Roles.ADMIN]} />}>
        <Route path={`${PrivateRoutes.ADMIN}/*`} element={<Admin />} />
      </Route>
      {/* /* porque UserPage tiene su propio sub-ruteo interno — ver User.tsx */}
      <Route element={<RoleGuard roles={[Roles.USER]} />}>
        <Route path={`${PrivateRoutes.USER}/*`} element={<UserPage />} />
      </Route>
      <Route element={<RoleGuard roles={[Roles.GUEST]} />}>
        <Route path={PrivateRoutes.GUEST} element={<GuestPage />} />
      </Route>
    </RoutesWithNotFound>
  )
}
export default Private
