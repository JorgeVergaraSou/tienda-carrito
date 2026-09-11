import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getContactWhatsappService, sendContactMessageService } from '@/services';
import { getErrorMessage } from '@/utilities';
import { Button, FormField, inputClass } from '@/components/ui';

interface ContactFormState {
  nombre: string;
  email: string;
  mensaje: string;
}

const emptyForm: ContactFormState = { nombre: '', email: '', mensaje: '' };

/** Página pública de contacto — sin login (ver POST /contacto en el
 * backend, sin @Auth). Al enviar pasan dos cosas en paralelo, igual que
 * pidió el usuario ("que se envíe por correo y por whatsapp el
 * mensaje"):
 * - Mail: vía el backend, al email que haya configurado el ADMIN
 *   (Admin/Contact/ContactSettingsPage.tsx) — si todavía no configuró
 *   ninguno, el backend responde 400 con un mensaje claro.
 * - WhatsApp: 100% client-side, mismo mecanismo que ya usa el usuario en
 *   otro proyecto propio (sweet-moment-candy/Servicios.tsx) — un link
 *   `wa.me` con el mensaje precargado, que abre una pestaña nueva. No hay
 *   backend ni proveedor de por medio acá: lo termina enviando el propio
 *   cliente desde su WhatsApp, nosotros solo armamos el link. */
function ContactPage() {
  const [form, setForm] = useState<ContactFormState>(emptyForm);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [formError, setFormError] = useState('');
  const [enviado, setEnviado] = useState(false);

  // se pide apenas se monta la página (no recién al enviar): hace falta
  // tenerlo ANTES del click en "Enviar" para poder abrir la ventana de
  // WhatsApp de forma sincrónica dentro del propio handler del submit —
  // ver el comentario en handleSubmit.
  useEffect(() => {
    getContactWhatsappService()
      .then((data) => setWhatsapp(data.whatsapp))
      .catch(() => {
        // sin bloquear el formulario si esto falla — el mail sigue
        // funcionando igual, WhatsApp queda como un extra opcional.
      });
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.nombre.trim() || !form.email.trim() || !form.mensaje.trim()) {
      setFormError('Todos los campos son obligatorios');
      return;
    }

    // Se abre ACÁ, todavía de forma sincrónica dentro del click (antes de
    // cualquier `await`) — si esperáramos a que el mail termine de
    // mandarse para recién ahí abrir la ventana, la mayoría de los
    // navegadores bloquean el popup por no venir de una interacción
    // directa del usuario. `wa.me` espera el número en dígitos, sin "+"
    // ni espacios (por eso el replace), aunque en la configuración se
    // haya guardado con "+" adelante.
    if (whatsapp) {
      const numero = whatsapp.replace(/\D/g, '');
      const mensajeWhatsapp = encodeURIComponent(
        `Hola, mi nombre es ${form.nombre.trim()}. ${form.mensaje.trim()}`,
      );
      window.open(`https://wa.me/${numero}?text=${mensajeWhatsapp}`, '_blank');
    }

    setEnviando(true);
    setFormError('');

    try {
      await sendContactMessageService({
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        mensaje: form.mensaje.trim(),
      });

      setForm(emptyForm);
      setEnviado(true);
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      {/* apuntaba a '/', que ahora es la Landing — el catálogo clásico
          (de donde se llega acá normalmente) se movió a '/catalog', ver
          App.tsx y Frontend/CLAUDE.md. */}
      <Link to="/catalog" className="text-sm font-medium text-teal-700 hover:underline">
        ← Volver al catálogo
      </Link>

      <h1 className="mt-4 mb-2 text-2xl font-semibold tracking-tight text-slate-900">Contacto</h1>
      <p className="mb-6 text-slate-600">
        ¿Tenés una consulta? Escribinos y te respondemos a la brevedad.
      </p>

      {enviado ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
          ¡Gracias! Tu mensaje se envió correctamente, te vamos a responder pronto.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <FormField label="Nombre" htmlFor="nombre">
            <input
              id="nombre"
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className={inputClass}
            />
          </FormField>

          <FormField label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
            />
          </FormField>

          <FormField label="Mensaje" htmlFor="mensaje">
            <textarea
              id="mensaje"
              value={form.mensaje}
              onChange={(e) => setForm({ ...form, mensaje: e.target.value })}
              rows={5}
              className={inputClass}
            />
          </FormField>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          {whatsapp && (
            <p className="text-xs text-slate-500">
              Al enviar también se va a abrir WhatsApp con el mensaje listo para mandar.
            </p>
          )}

          <div>
            <Button type="submit" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Enviar mensaje'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export default ContactPage;
