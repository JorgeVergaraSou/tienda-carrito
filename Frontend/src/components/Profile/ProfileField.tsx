//src/components/Profile/ProfileField.tsx
/**
 * Un campo editable del perfil (usuario, nombre, email, contraseña).
 * En reposo muestra el valor actual + un link "Editar"; al hacer click se
 * abre el input con Guardar/Cancelar. El guardado en sí (validación,
 * confirmación con contraseña, llamada al service) sigue siendo
 * responsabilidad de la página (Profile.tsx) — este componente solo
 * maneja el mostrar/ocultar del input y vuelve a modo lectura si `onSave`
 * avisa que salió bien. Puerto de components/Profile/ProfileField.tsx de
 * otro proyecto propio del mismo usuario (siscofar-frontend) — mismo
 * comportamiento, clases custom (field-input/btn-primary/btn-secondary)
 * cambiadas por utilidades de Tailwind directas y el Button que ya existe
 * acá, para no depender de CSS que este proyecto no tiene.
 */
import { useState } from 'react';
import { Button, inputClass } from '@/components/ui';

interface ProfileFieldProps {
  label: string;
  currentValue: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => Promise<boolean>;
  type?: string;
  placeholder?: string;
}

export function ProfileField({
  label,
  currentValue,
  value,
  onChange,
  onSave,
  type = 'text',
  placeholder,
}: ProfileFieldProps) {
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const handleGuardar = async () => {
    setGuardando(true);

    try {
      const exito = await onSave();

      if (exito) {
        setEditando(false);
      }
    } finally {
      setGuardando(false);
    }
  };

  const handleCancelar = () => {
    onChange('');
    setEditando(false);
  };

  if (!editando) {
    return (
      <div className="flex items-center gap-4 border-b border-slate-100 py-3 last:border-0">
        <div className="text-left flex-1">
          <div className="text-xs font-medium text-slate-400">{label}</div>
          <div className="text-sm text-slate-900">{currentValue}</div>
        </div>

        <button
          type="button"
          onClick={() => setEditando(true)}
          className="text-sm font-medium text-teal-700 hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded"
        >
          Editar
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <div className="mb-2 text-left text-xs font-medium text-slate-400">{label}</div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} flex-1`}
          autoFocus
        />

        <div className="flex gap-2">
          <Button onClick={handleGuardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </Button>

          <Button variant="secondary" onClick={handleCancelar} disabled={guardando}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ProfileField;
