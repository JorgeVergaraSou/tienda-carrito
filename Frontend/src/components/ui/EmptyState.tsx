import type { ReactNode } from 'react';
import { InboxIcon } from '@heroicons/react/24/outline';

interface EmptyStateProps {
  message: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Reemplaza el `<p className="mt-4">No hay productos para mostrar.</p>`
 * suelto que repetían las listas del panel (Productos/Categorías/
 * Usuarios/Mis productos) — mismo mensaje de siempre, wrapper con más
 * intención visual (ícono + centrado) en vez de una línea de texto gris
 * perdida debajo de una tabla vacía. Sin lógica propia: el mensaje y la
 * acción opcional (ej. un botón "Crear la primera categoría") los decide
 * quien lo usa.
 */
export function EmptyState({ message, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center gap-3 py-10 text-center ${className}`.trim()}>
      <InboxIcon className="h-8 w-8 text-slate-300" aria-hidden="true" />
      <p className="text-sm text-slate-500">{message}</p>
      {action}
    </div>
  );
}

export default EmptyState;
