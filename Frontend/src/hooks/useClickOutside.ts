//src/hooks/useClickOutside.ts
/**
 * Cierra un menú/desplegable cuando se hace click fuera de él. Genérico,
 * sin lógica de negocio — lo usa el menú del header (DropdownMenu), y
 * cualquier otro desplegable que se agregue a futuro.
 */
import { useEffect, RefObject } from 'react';

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutsideClick: () => void,
) {
  useEffect(() => {
    const handleClickFuera = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutsideClick();
      }
    };

    document.addEventListener('mousedown', handleClickFuera);

    return () => {
      document.removeEventListener('mousedown', handleClickFuera);
    };
  }, [ref, onOutsideClick]);
}
