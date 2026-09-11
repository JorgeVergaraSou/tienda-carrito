import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
  activateUserService,
  deactivateUserService,
  getUsersService,
} from '@/services';
import { UserListItem } from '@/interfaces';
import { getErrorMessage } from '@/utilities';
import { showError } from '@/utilities/alerts/alert.utils';
import { Button, BanIcon, CheckCircleIcon, PencilIcon, EmptyState, PageHeader } from '@/components/ui';
import { UserFormModal } from './UserFormModal';

/** Gestión de usuarios — ADMIN-only (RoleGuard en App.tsx + @Auth(Role.ADMIN)
 * en cada ruta de /auth/* que se usa acá: listar-usuarios, nuevo-usuario,
 * editar-usuario/:id, dar-de-baja-usuario/:id, activar-usuario/:id). Mismo
 * patrón que CategoriesPage (listado + form + dar de baja/reactivar), con
 * el form en un modal en vez de inline porque tiene más campos. */
function UsersPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  // null + modalOpen=false: modal cerrado.
  // null + modalOpen=true: modal abierto en modo creación.
  // UserListItem + modalOpen=true: modal abierto editando ese usuario.
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      setLoading(true);
      setListError('');

      try {
        const data = await getUsersService();
        if (!cancelado) setUsers(data);
      } catch (error) {
        if (!cancelado) setListError(getErrorMessage(error));
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [reloadToken]);

  const handleNuevo = () => {
    setEditingUser(null);
    setModalOpen(true);
  };

  const handleEditar = (user: UserListItem) => {
    setEditingUser(user);
    setModalOpen(true);
  };

  const handleGuardado = () => {
    setReloadToken((token) => token + 1);
  };

  const handleToggleActive = async (user: UserListItem) => {
    const estaActivo = !user.deletedAt;

    const { isConfirmed } = await Swal.fire({
      icon: 'question',
      title: estaActivo ? 'Dar de baja usuario' : 'Reactivar usuario',
      text: `¿Confirmás ${estaActivo ? 'dar de baja a' : 'reactivar a'} "${user.nombre} ${user.apellido}" (@${user.nickUsuario})?`,
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar',
    });

    if (!isConfirmed) {
      return;
    }

    try {
      if (estaActivo) {
        await deactivateUserService(user.idUser);
      } else {
        await activateUserService(user.idUser);
      }
      setReloadToken((token) => token + 1);
    } catch (error) {
      // acá llega, por ejemplo, el 400 de "no podés dar de baja al único
      // administrador activo" (ver UsersService.esUnicoAdminActivo).
      showError(getErrorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader title="Usuarios" action={<Button onClick={handleNuevo}>+ Nuevo usuario</Button>} />

      {loading && <p className="text-sm text-slate-500">Cargando...</p>}
      {listError && <p className="text-sm text-red-600">{listError}</p>}

      {/* max-h + overflow-auto: mismo criterio que CategoriesPage.tsx (ver
          ese archivo) — no crece sin límite con muchos usuarios, header
          sticky para no perderlo de vista al scrollear. */}
      <div className="overflow-auto max-h-[60vh] rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Usuario</th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Nombre</th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Email</th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Rol</th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Estado</th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.idUser} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="py-2.5 px-4 text-slate-800">@{user.nickUsuario}</td>
                <td className="py-2.5 px-4 text-slate-800">
                  {user.nombre} {user.apellido}
                </td>
                <td className="py-2.5 px-4 text-slate-600">{user.email ?? '—'}</td>
                <td className="py-2.5 px-4">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {user.role}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  {user.deletedAt ? (
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Inactivo</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Activo</span>
                  )}
                </td>
                <td className="py-2.5 px-4">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleEditar(user)}
                      title="Editar"
                      aria-label={`Editar ${user.nickUsuario}`}
                      className="p-1.5 rounded-full text-slate-500 hover:bg-teal-50 hover:text-teal-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(user)}
                      title={user.deletedAt ? 'Reactivar' : 'Dar de baja'}
                      aria-label={`${user.deletedAt ? 'Reactivar' : 'Dar de baja'} ${user.nickUsuario}`}
                      className={`p-1.5 rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                        user.deletedAt
                          ? 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                          : 'text-red-400 hover:bg-red-50 hover:text-red-600'
                      }`}
                    >
                      {user.deletedAt ? <CheckCircleIcon /> : <BanIcon />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && users.length === 0 && <EmptyState message="No hay usuarios para mostrar." />}
      </div>

      <UserFormModal
        user={editingUser}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleGuardado}
      />
    </div>
  );
}

export default UsersPage;
