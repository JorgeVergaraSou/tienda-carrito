import { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Category } from '@/interfaces';

interface CategoryDrawerProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  onSelectCategory: (categoriaId: string) => void;
}

/** Panel lateral deslizante con las categorías reales del catálogo (sin
 * subcategorías: las categorías de este proyecto son planas, no hay
 * jerarquía de segundo nivel que mostrar — el spec original pedía
 * acordeón de subcategorías, pero inventar una jerarquía que no existe en
 * el backend sería mentir sobre la estructura real del catálogo).
 *
 * Anima con `translate-x` + `transition-transform` (CSS puro). Se cierra
 * con la X, clickeando el backdrop (afuera del panel), o con Escape. */
export function CategoryDrawer({ open, onClose, categories, onSelectCategory }: CategoryDrawerProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleSelect = (categoriaId: string) => {
    onSelectCategory(categoriaId);
    onClose();
  };

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Categorías"
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] bg-white shadow-xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-c6-line px-4 py-4">
          <span className="font-bold text-c6-ink">Categorías</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar categorías"
            className="p-1.5 rounded-full text-c6-ink/50 hover:bg-c6-surface hover:text-c6-ink transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c6-primary"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col py-2 overflow-y-auto">
          <button
            type="button"
            onClick={() => handleSelect('')}
            className="px-4 py-3 text-left text-sm font-semibold text-c6-primary hover:bg-c6-surface transition-colors cursor-pointer"
          >
            Todas las categorías
          </button>
          {categories.map((category) => (
            <button
              key={category.idCategoria}
              type="button"
              onClick={() => handleSelect(String(category.idCategoria))}
              className="px-4 py-3 text-left text-sm text-c6-ink/80 hover:bg-c6-surface hover:text-c6-ink transition-colors cursor-pointer"
            >
              {category.nombre}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}

export default CategoryDrawer;
