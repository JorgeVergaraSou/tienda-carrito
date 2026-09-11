import { useState } from 'react';
import { DialogTitle } from '@headlessui/react';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { Modal } from './Modal';
import { Button } from './Button';
import { FormField, inputClass } from './FormField';

interface PasswordConfirmModalProps {
  open: boolean;
  title?: string;
  description?: string;
  confirming?: boolean;
  error?: string;
  onConfirm: (password: string) => void;
  onCancel: () => void;
}

/**
 * Reemplaza el `Swal.fire({ input: 'password' })` que usaba Profile.tsx
 * para confirmar cada cambio de dato de cuenta — funcionaba, pero es un
 * modal nativo de SweetAlert2 con su propio look, desconectado del resto
 * de la UI justo en el momento más sensible (cambiar tu contraseña). Este
 * componente no cambia el contrato: Profile.tsx sigue esperando una
 * contraseña (o cancelación) antes de mandar el PATCH — solo cambia quién
 * dibuja el prompt.
 *
 * El input se resetea cada vez que el modal pasa de cerrado a abierto
 * (ajustando el estado durante el render, no con un useEffect — mismo
 * patrón que ya usan ProductDetailModal.tsx/UserFormModal.tsx para no
 * pisar la regla react-hooks/set-state-in-effect).
 */
export function PasswordConfirmModal({
  open,
  title = 'Confirmá tu contraseña',
  description = 'Por seguridad, ingresá tu contraseña actual para continuar.',
  confirming = false,
  error,
  onConfirm,
  onCancel,
}: PasswordConfirmModalProps) {
  const [password, setPassword] = useState('');

  const [estabaAbierto, setEstabaAbierto] = useState(open);
  if (open !== estabaAbierto) {
    setEstabaAbierto(open);
    if (open) {
      setPassword('');
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) return;
    onConfirm(password);
  };

  return (
    <Modal open={open} onClose={onCancel} className="max-w-sm">
      <form onSubmit={handleSubmit} className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <LockClosedIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <DialogTitle as="h2" className="text-base font-semibold text-slate-900">
              {title}
            </DialogTitle>
            <p className="text-sm text-slate-500">{description}</p>
          </div>
        </div>

        <FormField label="Contraseña actual" htmlFor="password-confirm" error={error}>
          <input
            id="password-confirm"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </FormField>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={confirming}>
            Cancelar
          </Button>
          <Button type="submit" disabled={confirming || !password}>
            {confirming ? 'Confirmando...' : 'Confirmar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default PasswordConfirmModal;
