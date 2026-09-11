import { Link } from 'react-router-dom';

const submenuItemClasses =
  'block px-4 py-2 bg-gray-100 bg-opacity-80 hover:bg-gray-200 hover:bg-opacity-75 text-gray-700';

interface SubmenuItemProps {
  label: string;
  path: string;
  // true = ejecuta onSelect en vez de navegar (ej. "Cerrar sesión").
  isAction?: boolean;
  onSelect: (path: string) => void;
}

/**
 * Ítem de un submenú desplegable. Cuando isAction es true renderiza un
 * <button> en vez de un <Link>: es una acción con efecto secundario, no una
 * navegación a contenido — así se evita que el <Link> dispare su propia
 * navegación además del efecto que ya maneja onSelect (ver el bug de
 * logout que este componente reemplazó, en DropdownMenu.tsx).
 */
export function SubmenuItem({ label, path, isAction = false, onSelect }: SubmenuItemProps) {
  if (isAction) {
    return (
      <button
        type="button"
        onClick={() => onSelect(path)}
        className={`w-full text-left ${submenuItemClasses}`}
      >
        {label}
      </button>
    );
  }

  return (
    <Link to={path} onClick={() => onSelect(path)} className={submenuItemClasses}>
      {label}
    </Link>
  );
}

export default SubmenuItem;
