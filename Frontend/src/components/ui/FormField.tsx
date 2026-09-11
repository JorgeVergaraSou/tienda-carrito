import type { ReactNode } from 'react';

/**
 * Clases compartidas para inputs/selects/textareas del "App Shell"
 * (Login, Perfil, panel Admin/User, Contacto — ver Frontend/CLAUDE.md).
 * Antes cada página repetía `"border border-gray-300 rounded-md px-3 py-2
 * w-full"` a mano, sin foco visible más allá del outline default del
 * navegador. Exportado (no solo usado adentro de FormField) porque no
 * todos los inputs del proyecto quieren el label+error de FormField
 * alrededor — ej. el checkbox de "Mostrar stock" solo necesita el color
 * de foco/acento, no el wrapper completo.
 */
export const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 disabled:bg-slate-50 disabled:text-slate-400';

export const checkboxClass = 'h-4 w-4 rounded accent-teal-600 cursor-pointer';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Envoltorio de label + control + error/hint — no sabe nada del input que
 * envuelve (`children`), así que sirve igual para `<input>`, `<select>` o
 * `<textarea>` sin duplicar esa estructura en cada form del panel. La
 * validación/el estado siguen siendo responsabilidad de la página, como
 * siempre — esto es solo la piel.
 */
export function FormField({ label, htmlFor, error, hint, required, children, className = '' }: FormFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

export default FormField;
