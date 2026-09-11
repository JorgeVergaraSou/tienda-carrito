//src/redux/states/cart.ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { CartItem } from "@/interfaces";
import { clearLocalStorage, persistLocalStorage } from "@/utilities";

export interface CartState {
    items: CartItem[];
}

export const EmptyCartState: CartState = { items: [] };

export const CartKey = 'cart';

/**
 * Carrito 100% client-side (pedido explícito del usuario — ver
 * Backend/CLAUDE.md, sección "Carrito de compra + Mercado Pago"): no hay
 * ningún endpoint de "carrito en progreso" del lado del backend, este
 * store es la única fuente de verdad hasta que se arma el pedido (Fase 3,
 * todavía sin conectar). Se persiste en localStorage para sobrevivir un
 * refresh/cierre de pestaña — mismo mecanismo (persistLocalStorage/
 * clearLocalStorage) que ya usa redux/states/user.ts para la sesión.
 */
const getInitialCartState = (): CartState => {
    const cartStorage = localStorage.getItem(CartKey);

    if (!cartStorage) {
        return EmptyCartState;
    }

    try {
        const parsed = JSON.parse(cartStorage) as CartState;

        if (!Array.isArray(parsed.items)) {
            throw new Error('Carrito guardado con formato inválido');
        }

        return parsed;
    } catch {
        clearLocalStorage(CartKey);
        return EmptyCartState;
    }
};

/** clampea la cantidad a un mínimo de 1 y, si se conoce el stock
 * disponible del producto, a ese máximo — misma regla para las tres
 * acciones que tocan `cantidad` (agregar, sumar lo ya agregado, setear
 * directo desde el carrito), para no duplicarla. Es solo una ayuda de UX:
 * el backend vuelve a validar el stock real al crear el pedido. */
function clampCantidad(cantidad: number, stockDisponible: number | null): number {
    const minimo = Math.max(1, Math.floor(cantidad) || 1);
    return stockDisponible !== null ? Math.min(minimo, stockDisponible) : minimo;
}

export const cartSlice = createSlice({
    name: 'cart',
    initialState: getInitialCartState(),
    reducers: {
        /** agrega `cantidad` unidades de un producto (default 1) — si ya
         * estaba en el carrito, suma a lo que ya tenía en vez de duplicar
         * la fila. */
        addToCart: (
            state,
            action: PayloadAction<{ item: Omit<CartItem, 'cantidad'>; cantidad?: number }>,
        ) => {
            const { item, cantidad = 1 } = action.payload;
            const yaEstaba = state.items.some((i) => i.idProducto === item.idProducto);

            const items = yaEstaba
                ? state.items.map((i) =>
                    i.idProducto === item.idProducto
                        ? { ...i, cantidad: clampCantidad(i.cantidad + cantidad, item.stockDisponible) }
                        : i,
                )
                : [...state.items, { ...item, cantidad: clampCantidad(cantidad, item.stockDisponible) }];

            const result = { items };
            persistLocalStorage(CartKey, result);
            return result;
        },

        /** setea la cantidad de un renglón ya existente (ej. desde el
         * stepper del carrito) — no hace nada si el producto no está en el
         * carrito. */
        setCantidad: (state, action: PayloadAction<{ idProducto: number; cantidad: number }>) => {
            const items = state.items.map((i) =>
                i.idProducto === action.payload.idProducto
                    ? { ...i, cantidad: clampCantidad(action.payload.cantidad, i.stockDisponible) }
                    : i,
            );

            const result = { items };
            persistLocalStorage(CartKey, result);
            return result;
        },

        removeFromCart: (state, action: PayloadAction<number>) => {
            const result = { items: state.items.filter((i) => i.idProducto !== action.payload) };
            persistLocalStorage(CartKey, result);
            return result;
        },

        clearCart: () => {
            clearLocalStorage(CartKey);
            return EmptyCartState;
        },
    },
});

export const { addToCart, setCantidad, removeFromCart, clearCart } = cartSlice.actions;

export default cartSlice.reducer;
