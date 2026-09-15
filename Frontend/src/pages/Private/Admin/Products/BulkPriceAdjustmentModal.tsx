import { useEffect, useState } from 'react';
import { DialogTitle } from '@headlessui/react';
import Swal from 'sweetalert2';
import {
  bulkPriceAdjustmentService,
  getAdminCategoriesService,
  getAdminProductsService,
  type TipoAjustePrecio,
} from '@/services';
import { Category } from '@/interfaces';
import { getErrorMessage } from '@/utilities';
import { showSuccess } from '@/utilities/alerts/alert.utils';
import { Modal, Button, FormField, inputClass } from '@/components/ui';

interface BulkPriceFormState {
  // '' = todo el catálogo, si no el id de la categoría como string
  // (mismo criterio de <select> controlado que ya usa ProductFormPage).
  idCategoria: string;
  tipo: TipoAjustePrecio;
  // texto libre mientras se escribe (admite "-", "." a medio tipear) — se
  // parsea a number recién al validar/enviar.
  valor: string;
}

const emptyForm: BulkPriceFormState = {
  idCategoria: '',
  tipo: 'PORCENTAJE',
  valor: '',
};

interface BulkPriceAdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  /** se llama después de aplicar el ajuste con éxito, para que
   * ProductsListPage recargue el listado (los precios cambiaron). */
  onApplied: () => void;
}

/** Ajuste masivo de precio — pedido explícito del usuario: editar el
 * precio de a un producto por vez no escala con un catálogo de miles.
 * Cubre los dos casos que pidió con un solo form: "por categoría"
 * (elegir una del <select>) y "general" (dejar "Todo el catálogo", la
 * opción por default) — mismo criterio que el backend, que también los
 * resuelve con un único endpoint/DTO (ver BulkPriceAdjustmentDto). ADMIN
 * only (el botón que abre este modal ya vive en una ruta ADMIN-only, ver
 * ProductsListPage).
 *
 * Antes de aplicar nada, muestra cuántos productos va a afectar la
 * selección actual (reutiliza GET /productos/admin/listado con el mismo
 * filtro, leyendo `total` — no hizo falta un endpoint de preview nuevo) y
 * pide una confirmación explícita con ese número, porque a diferencia de
 * "dar de baja" (reversible con un click) deshacer un ajuste masivo
 * significa aplicar otro a mano con el valor inverso. */
export function BulkPriceAdjustmentModal({ open, onClose, onApplied }: BulkPriceAdjustmentModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<BulkPriceFormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // arranca en blanco cada vez que se abre — mismo patrón que
  // UserFormModal/ProductDetailModal (ajustar el estado durante el
  // render en vez de un useEffect, ver el comentario de esos archivos).
  const [estabaAbierto, setEstabaAbierto] = useState(open);
  if (open !== estabaAbierto) {
    setEstabaAbierto(open);
    if (open) {
      setForm(emptyForm);
      setFormError('');
    }
  }

  // categorías para el <select> — se cargan una sola vez, mismo servicio
  // (incluye inactivas) y mismo criterio "(inactiva)" que ya usa
  // ProductFormPage: una categoría dada de baja puede seguir teniendo
  // productos activos con ese precio para ajustar.
  useEffect(() => {
    if (!open) return;

    let cancelado = false;
    (async () => {
      try {
        const data = await getAdminCategoriesService();
        if (!cancelado) setCategories(data);
      } catch {
        // el <select> de categorías es un extra — si falla, "Todo el
        // catálogo" sigue disponible y funcionando.
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [open]);

  // cuántos productos afectaría la selección actual — se recalcula cada
  // vez que cambia el alcance (categoría vs. todo el catálogo). limit:1
  // porque acá solo importa `total`, no la lista de items.
  useEffect(() => {
    if (!open) return;

    let cancelado = false;
    (async () => {
      setPreviewLoading(true);
      try {
        const data = await getAdminProductsService({
          categoriaId: form.idCategoria ? Number(form.idCategoria) : undefined,
          limit: 1,
        });
        if (!cancelado) setPreviewTotal(data.total);
      } catch {
        if (!cancelado) setPreviewTotal(null);
      } finally {
        if (!cancelado) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [open, form.idCategoria]);

  const categoriaSeleccionada = categories.find(
    (category) => String(category.idCategoria) === form.idCategoria,
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const valorNumerico = Number(form.valor.replace(',', '.'));

    if (form.valor.trim() === '' || Number.isNaN(valorNumerico) || valorNumerico === 0) {
      setFormError('Ingresá un valor numérico distinto de 0');
      return;
    }

    if (form.tipo === 'PORCENTAJE' && valorNumerico < -100) {
      setFormError('El porcentaje no puede ser menor a -100');
      return;
    }

    setFormError('');

    const alcanceTexto = categoriaSeleccionada
      ? `${previewTotal ?? '…'} productos de la categoría "${categoriaSeleccionada.nombre}"`
      : `los ${previewTotal ?? '…'} productos del catálogo`;
    const signo = valorNumerico > 0 ? '+' : '';
    const valorTexto =
      form.tipo === 'PORCENTAJE' ? `${signo}${valorNumerico}%` : `${signo}$${valorNumerico}`;

    // confirmación explícita con el número real de productos afectados —
    // esto no tiene un botón de "deshacer" del lado del backend, así que
    // vale la pena un paso más antes de aplicarlo de verdad.
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'Confirmar ajuste masivo de precio',
      text: `Vas a aplicar ${valorTexto} a ${alcanceTexto}. Esta acción no se puede deshacer automáticamente. ¿Confirmás?`,
      showCancelButton: true,
      confirmButtonText: 'Sí, aplicar',
      cancelButtonText: 'Cancelar',
    });

    if (!isConfirmed) {
      return;
    }

    setSaving(true);

    try {
      const { productosAfectados } = await bulkPriceAdjustmentService({
        idCategoria: form.idCategoria ? Number(form.idCategoria) : undefined,
        tipo: form.tipo,
        valor: valorNumerico,
      });

      onApplied();
      onClose();
      showSuccess(
        'Precios actualizados',
        `Se ajustó el precio de ${productosAfectados} producto${productosAfectados === 1 ? '' : 's'}.`,
      );
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <div className="p-6">
        <DialogTitle as="h2" className="text-lg font-semibold text-slate-900 mb-1">
          Ajuste masivo de precio
        </DialogTitle>
        <p className="mb-4 text-sm text-slate-500">
          Aumentá o bajá el precio de venta de muchos productos a la vez, en vez de editarlos de a
          uno.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="Aplicar a" htmlFor="idCategoria">
            <select
              id="idCategoria"
              value={form.idCategoria}
              onChange={(e) => setForm({ ...form, idCategoria: e.target.value })}
              className={inputClass}
            >
              <option value="">Todo el catálogo</option>
              {categories.map((category) => (
                <option key={category.idCategoria} value={category.idCategoria}>
                  {category.nombre}
                  {category.deletedAt ? ' (inactiva)' : ''}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              {previewLoading
                ? 'Calculando cuántos productos afecta...'
                : previewTotal !== null &&
                  `Afecta a ${previewTotal} producto${previewTotal === 1 ? '' : 's'} (incluye los dados de baja).`}
            </p>
          </FormField>

          <FormField label="Tipo de ajuste" htmlFor="tipo">
            <select
              id="tipo"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoAjustePrecio })}
              className={inputClass}
            >
              <option value="PORCENTAJE">Porcentaje (%)</option>
              <option value="FIJO">Monto fijo ($)</option>
            </select>
          </FormField>

          <FormField
            label="Valor"
            htmlFor="valor"
            hint={
              form.tipo === 'PORCENTAJE'
                ? 'Positivo para aumentar, negativo para bajar. Ej: 10 = +10%, -10 = -10%.'
                : 'Positivo para aumentar, negativo para bajar. Ej: 500 = +$500, -500 = -$500.'
            }
          >
            <input
              id="valor"
              type="text"
              inputMode="decimal"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
              placeholder={form.tipo === 'PORCENTAJE' ? 'Ej: 10' : 'Ej: 500'}
              className={inputClass}
            />
          </FormField>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="mt-1 flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Aplicando...' : 'Aplicar ajuste'}
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

export default BulkPriceAdjustmentModal;
