export interface ContactSettings {
  email: string | null;
  // guardado nomás por ahora — todavía no dispara ninguna notificación
  // automática (no hay integración con ningún proveedor de WhatsApp
  // conectada, ver Backend/CLAUDE.md sección "Página pública de
  // contacto").
  whatsapp: string | null;
  updatedAt: string;
}
