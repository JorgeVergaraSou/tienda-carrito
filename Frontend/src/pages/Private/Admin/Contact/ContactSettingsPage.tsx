import { useEffect, useState } from 'react';
import { getContactSettingsService, updateContactSettingsService } from '@/services';
import { getErrorMessage } from '@/utilities';
import { showSuccess } from '@/utilities/alerts/alert.utils';
import { Button, FormField, inputClass, PageHeader } from '@/components/ui';

interface SettingsFormState {
  email: string;
  whatsapp: string;
}

/** Configuración del canal de contacto (ADMIN-only) — dónde le llegan al
 * negocio los mensajes del formulario público (pages/Public/Contact/).
 * No es parte de Profile.tsx a propósito: es un dato del negocio (puede
 * haber varios ADMIN, ver Admin/Users/), no de una cuenta personal
 * puntual, y no tiene relación con el email de *login* de nadie. */
function ContactSettingsPage() {
  const [form, setForm] = useState<SettingsFormState>({ email: '', whatsapp: '' });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      setLoading(true);
      setLoadError('');

      try {
        const data = await getContactSettingsService();
        if (cancelado) return;

        setForm({
          email: data.email ?? '',
          whatsapp: data.whatsapp ?? '',
        });
      } catch (error) {
        if (!cancelado) setLoadError(getErrorMessage(error));
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSaving(true);
    setFormError('');

    try {
      // input vacío = mandar null (vaciar el campo) — ver
      // UpdateContactSettingsData, este endpoint sí distingue "vaciar" de
      // "no tocar", pero acá siempre se mandan los dos.
      await updateContactSettingsService({
        email: form.email.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
      });

      await showSuccess('Configuración de contacto actualizada');
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Cargando...</p>;
  }

  return (
    <div>
      <PageHeader
        title="Contacto"
        description="Acá llegan los mensajes que los clientes mandan desde la página pública de contacto."
      />

      {loadError && <p className="mb-4 text-sm text-red-600">{loadError}</p>}

      <form
        onSubmit={handleSubmit}
        className="flex max-w-md flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5"
      >
        <FormField
          label="Email de contacto"
          htmlFor="email"
          hint="Los mensajes del formulario de contacto llegan acá. Sin un email configurado, los clientes no van a poder enviar mensajes."
        >
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Sin configurar — el formulario público no va a funcionar"
            className={inputClass}
          />
        </FormField>

        <FormField
          label="WhatsApp"
          htmlFor="whatsapp"
          hint="Cuando un cliente envía el formulario, se le abre WhatsApp con el mensaje ya escrito para que lo mande él mismo — todavía no hay un envío 100% automático."
        >
          <input
            id="whatsapp"
            type="text"
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            placeholder="Ej: +5491122334455"
            className={inputClass}
          />
        </FormField>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default ContactSettingsPage;
