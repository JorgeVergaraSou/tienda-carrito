import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
  activateCategoryService,
  createCategoryService,
  deactivateCategoryService,
  getAdminCategoriesService,
  updateCategoryService,
} from '@/services';
import { Category } from '@/interfaces';
import { getErrorMessage } from '@/utilities';
import { showError, showSuccess } from '@/utilities/alerts/alert.utils';
import {
  Button,
  BanIcon,
  CheckCircleIcon,
  PencilIcon,
  EmptyState,
  FormField,
  PageHeader,
  inputClass,
} from '@/components/ui';

/** Gestión de categorías — separada del resto del panel admin (antes vivía
 * en la misma página que "nuevo producto" y "listado de productos").
 *
 * El listado pasó de una lista de "pills" sueltas (ancho variable según
 * el nombre, se veía desprolijo con muchas categorías — pedido explícito
 * del usuario) a una tabla, igual criterio que ya usan
 * ProductsListPage.tsx/UsersPage.tsx: filas parejas, mismo patrón de
 * columnas (Nombre / Estado / Acciones) en todo el panel. Los botones de
 * texto "Editar"/"Dar de baja"/"Reactivar" pasaron a íconos
 * (components/ui/icons.tsx, sin librería nueva) — cada uno con
 * `title`/`aria-label` porque, sin texto visible, un botón sin nombre
 * accesible es invisible para un lector de pantalla. */
function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      setLoading(true);
      setListError('');

      try {
        const data = await getAdminCategoriesService();
        if (!cancelado) setCategories(data);
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

  const resetForm = () => {
    setEditingId(null);
    setNameInput('');
    setFormError('');
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.idCategoria);
    setNameInput(category.nombre);
    setFormError('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!nameInput.trim()) {
      setFormError('El nombre es obligatorio');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      if (editingId) {
        await updateCategoryService(editingId, { nombre: nameInput.trim() });
      } else {
        await createCategoryService({ nombre: nameInput.trim() });
      }

      await showSuccess(editingId ? 'Categoría actualizada' : 'Categoría creada');
      resetForm();
      setReloadToken((token) => token + 1);
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (category: Category) => {
    const estaActiva = !category.deletedAt;

    const { isConfirmed } = await Swal.fire({
      icon: 'question',
      title: estaActiva ? 'Dar de baja categoría' : 'Reactivar categoría',
      text: `¿Confirmás ${estaActiva ? 'dar de baja a' : 'reactivar'} "${category.nombre}"? ${
        estaActiva ? 'Los productos que ya la tengan asignada no se ven afectados.' : ''
      }`,
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar',
    });

    if (!isConfirmed) {
      return;
    }

    try {
      if (estaActiva) {
        await deactivateCategoryService(category.idCategoria);
      } else {
        await activateCategoryService(category.idCategoria);
      }
      setReloadToken((token) => token + 1);
    } catch (error) {
      showError(getErrorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader title="Categorías" description="Organizan el catálogo — el ADMIN las crea y renombra libremente." />

      <form onSubmit={handleSubmit} className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end">
        <FormField label={editingId ? 'Editar nombre' : 'Nueva categoría'} htmlFor="nombreCategoria" className="flex-1">
          <input
            id="nombreCategoria"
            type="text"
            placeholder="Ej: Juguetes"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {editingId ? 'Guardar' : 'Crear'}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancelar
            </Button>
          )}
        </div>
      </form>

      {formError && <p className="mb-3 text-sm text-red-600">{formError}</p>}
      {loading && <p className="text-sm text-slate-500">Cargando categorías...</p>}
      {listError && <p className="text-sm text-red-600">{listError}</p>}

      {/* max-h + overflow-y-auto: antes la tabla crecía sin límite hacia
          abajo con muchas categorías (pedido explícito del usuario) — el
          header queda "pegado" (sticky) arriba del scroll interno, así
          no se pierde de vista con listas largas. 60vh relativo al alto
          de pantalla, no un píxel fijo, para que se adapte a cualquier
          tamaño de ventana. */}
      <div className="overflow-auto max-h-[60vh] rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Nombre</th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Estado</th>
              <th className="py-2.5 px-4 sticky top-0 z-10 bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.idCategoria} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="py-2.5 px-4 text-slate-800">{category.nombre}</td>
                <td className="py-2.5 px-4">
                  {category.deletedAt ? (
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Inactiva</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Activa</span>
                  )}
                </td>
                <td className="py-2.5 px-4">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleEdit(category)}
                      title="Editar"
                      aria-label={`Editar ${category.nombre}`}
                      className="p-1.5 rounded-full text-slate-500 hover:bg-teal-50 hover:text-teal-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(category)}
                      title={category.deletedAt ? 'Reactivar' : 'Dar de baja'}
                      aria-label={`${category.deletedAt ? 'Reactivar' : 'Dar de baja'} ${category.nombre}`}
                      className={`p-1.5 rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                        category.deletedAt
                          ? 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                          : 'text-red-400 hover:bg-red-50 hover:text-red-600'
                      }`}
                    >
                      {category.deletedAt ? <CheckCircleIcon /> : <BanIcon />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && categories.length === 0 && (
          <EmptyState message="No hay categorías todavía — creá la primera arriba." />
        )}
      </div>
    </div>
  );
}

export default CategoriesPage;
