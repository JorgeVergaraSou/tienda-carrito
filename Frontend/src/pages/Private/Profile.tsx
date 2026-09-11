import { useDispatch, useSelector } from 'react-redux';
import { AppStore } from '@/redux/store';
import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { resetUser } from '@/redux/states/user';
import { actualizarFotoService, profileService, updateUserService } from '@/services';
import { apiOrigin, getErrorMessage } from '@/utilities';
import { PublicRoutes, Roles } from '@/models';
import { User } from '@/interfaces';
import { ProfileField } from '@/components/Profile/ProfileField';
import { PasswordConfirmModal } from '@/components/ui';

const roleBadgeClass: Record<string, string> = {
  [Roles.ADMIN]: 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200',
  [Roles.USER]: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  [Roles.GUEST]: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
};

const getIniciales = (nombre: string): string => {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);

  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();

  return (partes[0][0] + partes[1][0]).toUpperCase();
};

// fotoUrl que devuelve el backend es una ruta relativa (ej.
// "/uploads/avatars/x.png"), servida fuera del prefijo tienda/v1 (ver
// main.ts) — mismo criterio que apiOrigin ya resuelve para las imágenes
// de producto (ver products.service.ts).
const construirUrlFoto = (fotoUrl: string | null): string | null =>
  fotoUrl ? `${apiOrigin}${fotoUrl}` : null;

/** Perfil del usuario logueado — puerto del Profile.tsx de otro proyecto
 * propio del mismo usuario (siscofar-frontend, sin relación de código
 * entre ambos), adaptado al contrato real de este backend: campos
 * nombre/apellido (no name/surname), roles ADMIN/USER/GUEST (no
 * SOLICITANTE), y PATCH /auth/updateUser/:id que YA exigía
 * `currentPassword` en cada actualización (ver
 * UsersService.updateUser) — antes el frontend pedía la contraseña
 * actual una sola vez en un campo fijo al pie de la página y la
 * reutilizaba para cualquier campo; ahora, como en el proyecto de
 * referencia, se confirma con un prompt de SweetAlert2 en el momento de
 * cada guardado individual.
 *
 * POST /auth/foto (subir/cambiar foto) y GET /auth/profile ya existían en
 * el backend — action el frontend nunca los usaba. */
function ProfilePage() {
  const user = useSelector((state: AppStore) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [newNick, setNewNick] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newApellido, setNewApellido] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileData, setProfileData] = useState<User | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  // Reemplaza el Swal.fire({ input: 'password' }) que antes pedía la
  // confirmación de contraseña — mismo contrato hacia ProfileField
  // (onSave sigue siendo `() => Promise<boolean>`), solo cambia quién
  // dibuja el prompt (PasswordConfirmModal, components/ui/). El resolver
  // de la promesa se guarda en un ref porque handleUpdate necesita
  // "esperar" a que el usuario confirme o cancele el modal antes de saber
  // qué devolverle a ProfileField.
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingField, setPendingField] = useState<string | null>(null);
  const [confirmingPassword, setConfirmingPassword] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState('');
  const resolveFieldRef = useRef<((success: boolean) => void) | null>(null);

  const fetchProfileData = async () => {
    try {
      const data = await profileService();
      setProfileData(data);
    } catch (error) {
      console.error('Error al obtener el perfil:', getErrorMessage(error));
    }
  };

  // No llama fetchProfileData() directo acá por el mismo motivo que ya
  // documentaba este archivo (react-hooks/set-state-in-effect no deja
  // llamar dentro de un efecto a una función que termina en setState,
  // aunque sea async) — encadenar la promesa evita el falso positivo.
  useEffect(() => {
    profileService()
      .then((data) => setProfileData(data))
      .catch((error) => console.error('Error al obtener el perfil:', getErrorMessage(error)));
  }, []);

  // val/mensaje por campo — se usa tanto para la validación sincrónica de
  // abajo como para armar el body del PATCH una vez confirmada la
  // contraseña (ver handlePasswordConfirm).
  const fieldValidations: Record<string, { value: string; message: string }> = {
    nickUsuario: { value: newNick, message: 'El campo nombre de usuario no puede estar vacío.' },
    nombre: { value: newNombre, message: 'El campo nombre no puede estar vacío.' },
    apellido: { value: newApellido, message: 'El campo apellido no puede estar vacío.' },
    email: { value: newEmail, message: 'El campo email no puede estar vacío.' },
    password: { value: newPassword, message: 'El campo contraseña no puede estar vacío.' },
  };

  const successMessages: Record<string, string> = {
    nickUsuario: 'El nombre de usuario se actualizó correctamente.',
    nombre: 'El nombre se actualizó correctamente.',
    apellido: 'El apellido se actualizó correctamente.',
    email: 'El email se actualizó correctamente.',
    password: 'La contraseña se actualizó correctamente.',
  };

  /** Devuelve si la actualización salió bien, para que ProfileField sepa
   * si puede volver a modo lectura (ver ProfileField.onSave). El backend
   * exige currentPassword en cada PATCH /auth/updateUser/:id (ver
   * UsersService.updateUser) — se pide acá, en el momento de guardar este
   * campo puntual, no una sola vez para toda la página. La confirmación en
   * sí queda pendiente hasta que el usuario responda en
   * PasswordConfirmModal (handlePasswordConfirm/handlePasswordCancel más
   * abajo resuelven esta promesa). */
  const handleUpdate = (field: string): Promise<boolean> => {
    if (fieldValidations[field] && fieldValidations[field].value.trim() === '') {
      Swal.fire({ icon: 'error', title: 'Error', text: fieldValidations[field].message });
      return Promise.resolve(false);
    }

    setPendingField(field);
    setPasswordModalError('');
    setPasswordModalOpen(true);

    return new Promise((resolve) => {
      resolveFieldRef.current = resolve;
    });
  };

  const handlePasswordCancel = () => {
    setPasswordModalOpen(false);
    setPendingField(null);
    resolveFieldRef.current?.(false);
    resolveFieldRef.current = null;
  };

  const handlePasswordConfirm = async (password: string) => {
    if (!pendingField) return;

    setConfirmingPassword(true);
    setPasswordModalError('');

    const updateData: Record<string, unknown> = { currentPassword: password };
    if (pendingField in fieldValidations) {
      updateData[pendingField] = fieldValidations[pendingField].value;
    }

    try {
      await updateUserService(user.idUser, updateData);

      setPasswordModalOpen(false);
      setConfirmingPassword(false);

      Swal.fire({
        icon: 'success',
        title: 'Actualización exitosa',
        text: successMessages[pendingField] ?? 'Los datos se actualizaron correctamente.',
      });

      await fetchProfileData();

      // nickUsuario es el identificador de login en este proyecto (no
      // email, ver Backend/CLAUDE.md) — cambiarlo, igual que el email,
      // invalida la sesión de cara al usuario aunque el JWT siga siendo
      // técnicamente válido hasta que expire. Se cierra sesión a mano acá
      // (dispatch + navigate) en vez de con el hook useLogout() del
      // proyecto — ese hook siempre pide confirmación con otro Swal
      // ("¿Querés cerrar la sesión?"), que no corresponde acá: no es una
      // decisión del usuario, es una consecuencia obligada de lo que
      // acaba de hacer.
      if (pendingField === 'nickUsuario' || pendingField === 'email') {
        await Swal.fire({
          icon: 'info',
          title: pendingField === 'nickUsuario' ? 'Cambio de usuario exitoso' : 'Cambio de email exitoso',
          text: 'Tu sesión se cerrará y deberás iniciar sesión nuevamente con tus nuevos datos.',
        });

        dispatch(resetUser());
        navigate(`/${PublicRoutes.LOGIN}`, { replace: true });
      } else {
        setNewNick('');
        setNewNombre('');
        setNewApellido('');
        setNewEmail('');
        setNewPassword('');
      }

      resolveFieldRef.current?.(true);
      resolveFieldRef.current = null;
      setPendingField(null);
    } catch (error) {
      // se queda con el modal abierto — un 400 típico acá es "contraseña
      // actual incorrecta", tiene más sentido dejar reintentar ahí mismo
      // que mandar a un toast aparte y perder lo que ya había escrito.
      setConfirmingPassword(false);
      setPasswordModalError(getErrorMessage(error));
    }
  };

  const handleFotoSeleccionada = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // permite volver a elegir el mismo archivo más adelante

    if (!file) return;

    setSubiendoFoto(true);

    try {
      await actualizarFotoService(file);
      await fetchProfileData();

      Swal.fire({
        icon: 'success',
        title: 'Foto actualizada',
        text: 'Tu foto de perfil se actualizó correctamente.',
      });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: getErrorMessage(error) });
    } finally {
      setSubiendoFoto(false);
    }
  };

  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-lg">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {profileData && (
            <div>
              {/* Identidad */}
              <div className="flex flex-col items-center gap-3 mb-8">
                <div className="relative">
                  {construirUrlFoto(profileData.fotoUrl) ? (
                    <img
                      src={construirUrlFoto(profileData.fotoUrl)!}
                      alt="Foto de perfil"
                      className="h-16 w-16 rounded-full object-cover ring-1 ring-inset ring-teal-200"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-lg font-semibold text-teal-700 ring-1 ring-inset ring-teal-200">
                      {getIniciales(`${profileData.nombre} ${profileData.apellido}`)}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fotoInputRef.current?.click()}
                    disabled={subiendoFoto}
                    title="Cambiar foto"
                    aria-label="Cambiar foto de perfil"
                    className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-white text-xs shadow hover:bg-teal-700 disabled:opacity-60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-600"
                  >
                    {subiendoFoto ? '…' : '✎'}
                  </button>

                  <input
                    ref={fotoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFotoSeleccionada}
                    className="hidden"
                  />
                </div>

                <div className="text-center">
                  <div className="text-lg font-semibold text-slate-900">
                    {profileData.nombre} {profileData.apellido}
                  </div>
                  <div className="text-sm text-slate-500">@{profileData.nickUsuario}</div>
                </div>

                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    roleBadgeClass[user.role] ??
                    'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200'
                  }`}
                >
                  {user.role}
                </span>
              </div>

              <div className="mb-1 text-left text-sm font-semibold text-slate-700">
                Datos de la cuenta
              </div>
              <div className="mb-6">
                <ProfileField
                  label="Usuario"
                  currentValue={profileData.nickUsuario}
                  value={newNick}
                  onChange={setNewNick}
                  onSave={() => handleUpdate('nickUsuario')}
                  placeholder="Nuevo nombre de usuario"
                />

                <ProfileField
                  label="Nombre"
                  currentValue={profileData.nombre}
                  value={newNombre}
                  onChange={setNewNombre}
                  onSave={() => handleUpdate('nombre')}
                  placeholder="Nuevo nombre"
                />

                <ProfileField
                  label="Apellido"
                  currentValue={profileData.apellido}
                  value={newApellido}
                  onChange={setNewApellido}
                  onSave={() => handleUpdate('apellido')}
                  placeholder="Nuevo apellido"
                />

                <ProfileField
                  label="Email"
                  currentValue={profileData.email ?? 'sin asociar'}
                  value={newEmail}
                  onChange={setNewEmail}
                  onSave={() => handleUpdate('email')}
                  type="email"
                  placeholder="Nuevo email"
                />
              </div>

              <div className="mb-1 text-left text-sm font-semibold text-slate-700">
                Seguridad
              </div>
              <div>
                <ProfileField
                  label="Contraseña"
                  currentValue="••••••••"
                  value={newPassword}
                  onChange={setNewPassword}
                  onSave={() => handleUpdate('password')}
                  type="password"
                  placeholder="Nueva contraseña"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <PasswordConfirmModal
        open={passwordModalOpen}
        confirming={confirmingPassword}
        error={passwordModalError}
        onConfirm={handlePasswordConfirm}
        onCancel={handlePasswordCancel}
      />
    </div>
  );
}

export default ProfilePage;
