import { useState } from 'react';
import { DialogTitle } from '@headlessui/react';
import { createUserService, updateUserAdminService } from '@/services';
import { UserListItem } from '@/interfaces';
import { Roles } from '@/models';
import { getErrorMessage } from '@/utilities';
import { Modal, Button, FormField, inputClass } from '@/components/ui';

interface UserFormState {
  nickUsuario: string;
  nombre: string;
  apellido: string;
  email: string;
  role: string;
  // en modo edición, en blanco = no tocar la contraseña actual (ver
  // AdminUpdateUserData.password). En modo creación es obligatoria.
  password: string;
}

const emptyForm: UserFormState = {
  nickUsuario: '',
  nombre: '',
  apellido: '',
  email: '',
  role: Roles.USER,
  password: '',
};

interface UserFormModalProps {
  /** null = cerrado y en modo creación. Un UserListItem = editando ese
   * usuario (el modal se abre con sus datos precargados). */
  user: UserListItem | null;
  /** el modal también se usa para "+ Nuevo usuario" — se abre en modo
   * creación aunque `user` sea null, así que hace falta esta bandera
   * aparte para saber si debe estar abierto. */
  open: boolean;
  onClose: () => void;
  /** se llama después de crear/editar con éxito, para que UsersPage
   * recargue el listado. */
  onSaved: () => void;
}

/** Crear o editar un usuario — mismo componente para los dos casos (igual
 * criterio que ProductFormPage), diferenciado por si `user` viene o no.
 * ADMIN edita CUALQUIER usuario acá (PATCH /auth/editar-usuario/:id,
 * nuevo en el backend) — a diferencia de Profile.tsx (autoservicio, exige
 * tu propia contraseña actual por campo), esto no pide contraseña porque
 * el ADMIN ya está autenticado por su propio JWT y no tiene por qué
 * conocer la del usuario que edita. */
export function UserFormModal({ user, open, onClose, onSaved }: UserFormModalProps) {
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // precarga el form (o lo vacía, en modo creación) cada vez que el modal
  // pasa de cerrado a abierto — así arranca fresco tanto si es la primera
  // vez, si se reabre para otro usuario, o si se reabre para "nuevo"
  // después de haber creado uno. Ajustar el estado durante el render (en
  // vez de un useEffect) es el patrón que recomienda React para esto, sin
  // disparar un render en cascada (ver react-hooks/set-state-in-effect,
  // mismo criterio que ya usa ProductDetailModal.tsx).
  const [estabaAbierto, setEstabaAbierto] = useState(open);
  if (open !== estabaAbierto) {
    setEstabaAbierto(open);

    if (open) {
      setFormError('');
      setForm(
        user
          ? {
              nickUsuario: user.nickUsuario,
              nombre: user.nombre,
              apellido: user.apellido,
              email: user.email ?? '',
              role: user.role,
              password: '',
            }
          : emptyForm,
      );
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.nickUsuario.trim() || !form.nombre.trim() || !form.apellido.trim()) {
      setFormError('Usuario, nombre y apellido son obligatorios');
      return;
    }

    if (!user && !form.password.trim()) {
      setFormError('La contraseña es obligatoria para crear un usuario');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      if (user) {
        await updateUserAdminService(user.idUser, {
          nickUsuario: form.nickUsuario.trim(),
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          email: form.email.trim() || undefined,
          role: form.role,
          // en blanco = no se manda el campo = no se toca la contraseña.
          password: form.password.trim() || undefined,
        });
      } else {
        await createUserService({
          nickUsuario: form.nickUsuario.trim(),
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          email: form.email.trim() || undefined,
          role: form.role,
          password: form.password.trim(),
        });
      }

      onSaved();
      onClose();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <div className="p-6">
        <DialogTitle as="h2" className="text-lg font-semibold text-slate-900 mb-4">
          {user ? `Editar usuario @${user.nickUsuario}` : 'Nuevo usuario'}
        </DialogTitle>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="Usuario" htmlFor="nickUsuario">
            <input
              id="nickUsuario"
              type="text"
              value={form.nickUsuario}
              onChange={(e) => setForm({ ...form, nickUsuario: e.target.value })}
              className={inputClass}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nombre" htmlFor="nombre">
              <input
                id="nombre"
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className={inputClass}
              />
            </FormField>
            <FormField label="Apellido" htmlFor="apellido">
              <input
                id="apellido"
                type="text"
                value={form.apellido}
                onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                className={inputClass}
              />
            </FormField>
          </div>

          <FormField label="Email (opcional)" htmlFor="email">
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
            />
          </FormField>

          <FormField label="Rol" htmlFor="role">
            <select
              id="role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className={inputClass}
            >
              <option value={Roles.ADMIN}>ADMIN</option>
              <option value={Roles.USER}>USER</option>
              <option value={Roles.GUEST}>GUEST</option>
            </select>
          </FormField>

          <FormField
            label={user ? 'Nueva contraseña (opcional)' : 'Contraseña'}
            htmlFor="password"
          >
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={user ? 'Dejar en blanco para no cambiarla' : undefined}
              className={inputClass}
            />
          </FormField>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="mt-1 flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : user ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export default UserFormModal;
