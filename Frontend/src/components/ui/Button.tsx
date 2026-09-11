import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

const variantClasses: Record<ButtonVariant, string> = {
  // teal, no azul — es el acento del "App Shell" (Login/Admin/Perfil/
  // Contacto, ver Frontend/CLAUDE.md), deliberadamente distinto de los
  // colores propios de cada catálogo (brand/red/fuchsia) para que nunca se
  // confunda "estoy en una herramienta interna" con "estoy en un
  // catálogo". Los catálogos que necesitan otro color lo pisan vía
  // `className` (ver Catalog2.tsx/Catalog3.tsx) — la cascada de Tailwind
  // ya resolvía bien ese override antes de este cambio, sigue igual.
  primary:
    'bg-teal-600 hover:bg-teal-700 text-white disabled:bg-teal-300',
  secondary:
    'bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:bg-gray-50 disabled:text-gray-400',
  // reservado para acciones destructivas de verdad (no "dar de baja" — eso
  // se puede reactivar — sino cosas como borrar una foto sin vuelta atrás).
  danger:
    'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/**
 * Botón base del proyecto. index.css ya no trae un reset global de
 * <button> (era CSS heredado de la plantilla vieja) — este componente es
 * el reemplazo: úsalo en vez de un <button> a mano para tener el mismo
 * look consistente en toda la app.
 */
export function Button({ variant = 'primary', type = 'button', className = '', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`px-4 py-2 rounded-md font-medium cursor-pointer disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-600 ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    />
  );
}

export default Button;
