// src/components/Footer.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getContactWhatsappService } from '@/services';

/**
 * Pie de página, global (montado en App.tsx junto a Header) — a
 * diferencia de Header, este SÍ se muestra siempre, en cualquier ruta,
 * con o sin sesión.
 *
 * Pedido explícito del usuario, después de preguntar qué era el footer
 * que veía en otros sitios (Western Union, Emol) y si correspondía
 * sumarlo acá. A propósito NO tiene nada de lo que esos ejemplos
 * mostraban pero acá sería inventado:
 * - Sin redes sociales: no hay ninguna cuenta configurada en el proyecto.
 * - Sin Términos/Privacidad: esas páginas no existen, un link ahí
 *   rompería (404).
 * - Sin razón social en el copyright: el proyecto no tiene un nombre de
 *   negocio definido en ningún lado.
 *
 * Solo contenido real: las páginas públicas que existen (Catálogo,
 * Contacto), y el WhatsApp de contacto si el ADMIN lo configuró (mismo
 * GET /contacto/whatsapp público que ya usa ContactPage.tsx para el link
 * `wa.me` — ver Backend/CLAUDE.md, sección "Página pública de contacto").
 */
function Footer() {
  const [whatsapp, setWhatsapp] = useState<string | null>(null);

  useEffect(() => {
    getContactWhatsappService()
      .then((data) => setWhatsapp(data.whatsapp))
      .catch(() => {
        // el footer no debe romper ni mostrar error por esto — si falla,
        // simplemente no aparece el link de WhatsApp.
      });
  }, []);

  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-500">
        <div className="flex gap-4">
          {/* antes decía "Catálogo" y apuntaba directo al listado — ahora
              '/' es la Landing (elegir diseño de catálogo, ver
              pages/Public/Home), así que este link sigue cumpliendo el
              mismo rol de "volver al inicio" desde cualquier página
              (incluidos los catálogos nuevos que se agreguen). */}
          <Link to="/" className="hover:text-teal-700 hover:underline">
            Inicio
          </Link>
          <Link to="/contacto" className="hover:text-teal-700 hover:underline">
            Contacto
          </Link>
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-teal-700 hover:underline"
            >
              WhatsApp
            </a>
          )}
        </div>

        <p>© {new Date().getFullYear()}. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}

export default Footer;
