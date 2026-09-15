
import { BrowserRouter, Route } from 'react-router-dom'
import { PrivateRoutes, PublicRoutes, Roles } from './models'
import { AuthGuard } from './guards'
import { Suspense, lazy } from 'react'
import { Provider } from 'react-redux'
import store from './redux/store'
import RoleGuard from './guards/rol.guard'
import Admin from './pages/Private/Admin/Admin'
import Header from './components/Header'
import Footer from './components/Footer'
import UserPage from './pages/Private/User/User'
import ProfilePage from './pages/Private/Profile'
import { LogoutRoute } from './components/Logout/LogoutRoute'
import RoutesWithNotFound from './utilities/RoutesWithNotFound.utility'
import GuestPage from './pages/Private/Guest/Guest'
import Home from './pages/Public/Home/Home'
import ProductDetail from './pages/Public/ProductDetail/ProductDetail'
import ServiceUnavailable from './pages/Public/ServiceUnavailable/ServiceUnavailable'
import ContactPage from './pages/Public/Contact/ContactPage'
import CartPage from './pages/Public/Cart/CartPage'
import CheckoutPage from './pages/Public/Checkout/CheckoutPage'
import CheckoutResultPage from './pages/Public/Checkout/CheckoutResultPage'
import { catalogs } from './catalogs'

const Login = lazy(() => import('./pages/Login/Login'))
const Private = lazy(() => import('./pages/Private/Private'))

function App() {

  return (
    <div>
      <div></div>
      <div>
        <Suspense fallback={<div>Loading...</div>}>

          <Provider store={store}>

            <BrowserRouter>
              <Header />

              <RoutesWithNotFound>

                {/* Rutas públicas — la Landing (elegir diseño de catálogo)
                    es la home del sitio, sin login. Cada diseño se monta
                    en su propia ruta a partir del registro central (ver
                    src/catalogs/catalogs.config.tsx) — agregar un catálogo
                    nuevo no requiere tocar este archivo, solo sumar una
                    entrada ahí. */}
                <Route path='/' element={<Home />} />
                {catalogs.map((catalog) => (
                  <Route
                    key={catalog.id}
                    path={catalog.hasSubRoutes ? `${catalog.path}/*` : catalog.path}
                    element={<catalog.component />}
                  />
                ))}
                <Route path='productos/:id' element={<ProductDetail />} />
                {/* NO va en PublicRoutes (a diferencia de login/servicio-no-
                    disponible): esas ocultan el menú privado de un usuario
                    logueado (Header.tsx las trata como "estás afuera de la
                    app"), pero acá un ADMIN/USER logueado tiene que poder
                    seguir viendo su navegación — mismo criterio que Catalog/
                    ProductDetail, que tampoco están en PublicRoutes. */}
                <Route path='contacto' element={<ContactPage />} />
                {/* carrito client-side (ver redux/states/cart.ts) — mismo
                    criterio que contacto/productos: no va en PublicRoutes,
                    un ADMIN/USER logueado tiene que poder seguir viendo su
                    navegación acá. */}
                <Route path='carrito' element={<CartPage />} />
                {/* checkout como invitado — mismo criterio que carrito:
                    pública, no en PublicRoutes. /checkout/resultado es
                    adonde apuntan las back_urls de Mercado Pago (ver
                    Backend/CLAUDE.md), tiene que ser la MISMA ruta para
                    los tres casos (éxito/pendiente/rechazo) — lee el
                    resultado de los parámetros de query que agrega
                    Mercado Pago, no de la ruta en sí. */}
                <Route path='checkout' element={<CheckoutPage />} />
                <Route path='checkout/resultado' element={<CheckoutResultPage />} />
                <Route path={PublicRoutes.LOGIN} element={<Login />} />
                {/* destino del interceptor de axios cuando no hay respuesta del
                    servidor (ver src/api/axios.ts) — pública, sin login, y sin
                    fetch propio al montarse (ver ServiceUnavailable.tsx) */}
                <Route
                  path={PublicRoutes.SERVICE_UNAVAILABLE}
                  element={<ServiceUnavailable />}
                />
                {/* No hay signup público en el backend (POST /auth/nuevo-usuario
                    requiere ADMIN) — la ruta de registro queda deshabilitada.
                    pages/Register/Register.tsx y services/register.service.ts
                    quedan sin usar por ahora, sin borrar (ver CLAUDE.md). */}

                {/* Rutas privadas protegidas por AuthGuard */}
                <Route element={<AuthGuard privateValidation={true} />}>

                  {/* Rutas accesibles para todos los usuarios autenticados */}
                  <Route path={`${PrivateRoutes.PRIVATE}/*`} element={<Private />} />
                  <Route path={PrivateRoutes.PERFIL} element={<ProfilePage />} />

                  {/* Rutas protegidas por RoleGuard */}
                  <Route element={<RoleGuard roles={[Roles.ADMIN]} />}>
                    {/* /* porque Admin tiene su propio sub-ruteo interno
                        (productos, productos/nuevo, productos/:id/editar,
                        categorias) — ver pages/Private/Admin/Admin.tsx */}
                    <Route path={`${PrivateRoutes.ADMIN}/*`} element={<Admin />} />
                  </Route>

                  <Route element={<RoleGuard roles={[Roles.USER]} />}>
                    {/* /* porque UserPage tiene su propio sub-ruteo interno
                        (cargar producto, mis-productos) — ver
                        pages/Private/User/User.tsx */}
                    <Route path={`${PrivateRoutes.USER}/*`} element={<UserPage />} />
                  </Route>

                  <Route element={<RoleGuard roles={[Roles.GUEST]} />}>
                    <Route path={PrivateRoutes.GUEST} element={<GuestPage />} />
                  </Route>

                  {/* Ruta para logout */}
                  <Route path={PrivateRoutes.LOGOUT} element={<LogoutRoute />} />
                </Route>
              </RoutesWithNotFound>

              <Footer />
            </BrowserRouter>

          </Provider>

        </Suspense>

      </div>
    </div>
  )
}

export default App
