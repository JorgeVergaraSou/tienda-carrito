import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { AppStore } from '@/redux/store';
import { ShoppingCartIcon } from '@/components/ui';

interface CartLinkProps {
  /** para que cada catálogo pueda pisar el color del ícono (ej. texto
   * blanco sobre una franja de marca oscura) sin tocar este componente. */
  className?: string;
}

/** Link al carrito con badge de cantidad — pensado para vivir en el propio
 * header de cada catálogo (los 7 diseños arman su propia franja superior,
 * no hay un Header compartido para las páginas públicas, ver
 * Frontend/CLAUDE.md). Por ahora solo lo usa Catalog.tsx (Fase 2, alcance
 * acotado a un solo catálogo, pedido explícito del usuario) — queda como
 * componente aparte para poder sumarlo a los demás catálogos más adelante
 * sin duplicar esta lógica. */
export function CartLink({ className = '' }: CartLinkProps) {
  const cantidad = useSelector((state: AppStore) =>
    state.cart.items.reduce((total, item) => total + item.cantidad, 0),
  );

  return (
    <Link
      to="/carrito"
      className={`relative inline-flex items-center ${className}`.trim()}
      aria-label={`Ver carrito${cantidad > 0 ? ` (${cantidad} unidades)` : ''}`}
    >
      <ShoppingCartIcon className="h-6 w-6" />
      {cantidad > 0 && (
        <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {cantidad}
        </span>
      )}
    </Link>
  );
}

export default CartLink;
