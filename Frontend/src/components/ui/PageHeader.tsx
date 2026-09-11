import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Título + descripción opcional + una acción a la derecha (ej. "+ Nuevo
 * producto") — reemplaza el `<h2 className="text-xl font-semibold mb-4">`
 * repetido a mano en cada página del panel Admin/User, sin agregarle
 * ningún comportamiento: es puro layout, la acción sigue siendo cualquier
 * botón que la página ya tenía.
 */
export function PageHeader({ title, description, action, className = '' }: PageHeaderProps) {
  return (
    <div className={`mb-6 flex items-start justify-between gap-4 ${className}`.trim()}>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default PageHeader;
