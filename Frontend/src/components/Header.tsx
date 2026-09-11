// src/components/Header.tsx
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AppStore } from "@/redux/store";
import { PublicRoutes } from "@/models";
import { UserKey, createUser, resetUser } from "@/redux/states/user";
import DropdownMenu from "./NavBars/DropdownMenu";

const publicPaths: string[] = Object.values(PublicRoutes);

function Header() {
    const user = useSelector((state: AppStore) => state.user);
    const dispatch = useDispatch();
    const location = useLocation();

    // Si la sesión cambia en otra pestaña (login o logout), el evento
    // "storage" avisa acá para mantenerlas sincronizadas. El navegador solo
    // dispara este evento en pestañas *distintas* a la que hizo el cambio
    // (no en la propia), así que no hay riesgo de loop.
    useEffect(() => {
        const onStorageChange = (event: StorageEvent) => {
            if (event.key !== UserKey) {
                return;
            }

            if (!event.newValue) {
                dispatch(resetUser());
                return;
            }

            try {
                dispatch(createUser(JSON.parse(event.newValue)));
            } catch {
                dispatch(resetUser());
            }
        };

        window.addEventListener('storage', onStorageChange);
        return () => window.removeEventListener('storage', onStorageChange);
    }, [dispatch]);

    // En rutas públicas (login, register) nunca se muestra el menú
    // privado, aunque haya quedado un token viejo en el store/localStorage.
    const enRutaPublica = publicPaths.some((path) => location.pathname.startsWith(`/${path}`));

    const isAuthenticated = Boolean(user?.token) && !enRutaPublica;

    return (
        <>
            <header>
                {isAuthenticated && <DropdownMenu />}
            </header>
        </>
    );
}

export default Header;
