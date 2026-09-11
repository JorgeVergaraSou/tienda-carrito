import { useEffect, useState } from 'react';
import {
  addProductPhotoService,
  createProductService,
  getCategoriesService,
  uploadProductImageService,
} from '@/services';
import { Category } from '@/interfaces';
import { getErrorMessage } from '@/utilities';
import { showSuccess } from '@/utilities/alerts/alert.utils';
import { Button, checkboxClass, FormField, inputClass, PageHeader } from '@/components/ui';

interface ProductFormState {
  nombre: string;
  descripcion: string;
  precio: string;
  stock: string;
  // controla si el número de stock se muestra a los clientes en el
  // catálogo público — ver Product.mostrarStock. Después de creado, se
  // puede seguir tocando desde MisProductos/MisProductosPage.tsx.
  mostrarStock: boolean;
  // '' = sin categoría; si no, es el idCategoria como string (viene de un
  // <select>, que solo maneja valores string).
  idCategoria: string;
}

const emptyForm: ProductFormState = {
  nombre: '',
  descripcion: '',
  precio: '',
  stock: '',
  mostrarStock: true,
  idCategoria: '',
};

/** Rol USER: solo puede cargar productos nuevos — no editar ni dar de
 * baja los existentes, ni tocar categorías (eso sigue siendo solo ADMIN,
 * ver pages/Private/Admin/Admin.tsx). Sí puede subirle una portada y
 * fotos adicionales al producto que acaba de crear (ProductEntity.creadoPor
 * guarda quién lo cargó, y el backend solo deja tocar la imagen/galería de
 * un producto ajeno a ADMIN — ver ProductsService.actualizarImagen/
 * agregarFoto), y también puede reactivar sus propios productos si los
 * dio de baja un ADMIN por error — ver MisProductos/MisProductosPage.tsx,
 * pestaña hermana de esta. No puede, en cambio, volver después a
 * cambiarle la imagen/fotos a un producto viejo desde acá: esta página no
 * tiene listado propio, así que la portada y las fotos que puede subir
 * son las del producto que recién creó en esta misma carga. */
function CargarProductoPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesError, setCategoriesError] = useState('');

  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  // fotos adicionales de la galería (además de la portada de arriba) —
  // selección múltiple, se suben una por una después de crear el producto
  // (mismo momento que la portada). Ver agregarFoto en el backend.
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const data = await getCategoriesService();
        if (!cancelado) setCategories(data);
      } catch (error) {
        if (!cancelado) setCategoriesError(getErrorMessage(error));
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.nombre.trim() || !form.precio.trim()) {
      setFormError('Nombre y precio son obligatorios');
      return;
    }

    const precio = Number(form.precio);
    if (Number.isNaN(precio) || precio < 0) {
      setFormError('El precio debe ser un número válido');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const product = await createProductService({
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || undefined,
        precio,
        stock: form.stock.trim() ? Number(form.stock) : undefined,
        mostrarStock: form.mostrarStock,
        idCategoria: form.idCategoria ? Number(form.idCategoria) : null,
      });

      if (imageFile) {
        await uploadProductImageService(product.idProducto, imageFile);
      }

      // una request por archivo (mismo criterio que el backend — ver
      // agregarFoto/product-image-upload.config.ts), secuencial para no
      // saturar la subida con varias en paralelo.
      for (const file of photoFiles) {
        await addProductPhotoService(product.idProducto, file);
      }

      await showSuccess('Producto creado');
      setForm(emptyForm);
      setImageFile(null);
      setPhotoFiles([]);
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Cargar producto"
        description="Para editar o dar de baja productos, o gestionar categorías, hace falta un usuario ADMIN."
      />

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Nombre" htmlFor="nombre">
            <input
              id="nombre"
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className={inputClass}
            />
          </FormField>

          <FormField label="Categoría" htmlFor="idCategoria" error={categoriesError}>
            <select
              id="idCategoria"
              value={form.idCategoria}
              onChange={(e) => setForm({ ...form, idCategoria: e.target.value })}
              className={inputClass}
            >
              <option value="">Sin categoría</option>
              {categories.map((category) => (
                <option key={category.idCategoria} value={category.idCategoria}>
                  {category.nombre}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Precio" htmlFor="precio">
            <input
              id="precio"
              type="number"
              step="0.01"
              min="0"
              value={form.precio}
              onChange={(e) => setForm({ ...form, precio: e.target.value })}
              className={inputClass}
            />
          </FormField>

          <FormField label="Stock" htmlFor="stock">
            <input
              id="stock"
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              className={inputClass}
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.mostrarStock}
                onChange={(e) => setForm({ ...form, mostrarStock: e.target.checked })}
                className={checkboxClass}
              />
              Mostrar stock a los clientes
            </label>
          </FormField>

          <FormField label="Descripción" htmlFor="descripcion" className="sm:col-span-2">
            <textarea
              id="descripcion"
              rows={4}
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className={inputClass}
            />
          </FormField>

          <FormField label="Imagen (portada)" htmlFor="imagen" className="sm:col-span-2">
            <input
              id="imagen"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-teal-700 hover:file:bg-teal-100 file:cursor-pointer cursor-pointer"
            />
          </FormField>

          <FormField label="Fotos adicionales" hint="Opcional, podés elegir varias." htmlFor="fotos" className="sm:col-span-2">
            <input
              id="fotos"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPhotoFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-teal-700 hover:file:bg-teal-100 file:cursor-pointer cursor-pointer"
            />
            {photoFiles.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-sm text-slate-600">
                {photoFiles.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center gap-2">
                    {file.name}
                    <button
                      type="button"
                      onClick={() =>
                        setPhotoFiles((files) => files.filter((_, i) => i !== index))
                      }
                      className="text-red-600 hover:underline cursor-pointer"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </FormField>
        </div>

        {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

        <div className="mt-5">
          <Button type="submit" disabled={saving}>Crear producto</Button>
        </div>
      </form>
    </div>
  );
}

export default CargarProductoPage;
