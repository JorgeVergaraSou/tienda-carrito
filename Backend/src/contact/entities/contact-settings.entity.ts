import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** fila única (singleton, PK fija en 1 — ver ContactService) con el email
 * y el número de WhatsApp donde el negocio recibe los mensajes del
 * formulario público de contacto. No es un dato personal de un ADMIN
 * puntual (puede haber varios ADMIN, ver users/) sino una configuración
 * del negocio, editable desde el panel (pedido explícito del usuario). */
@Entity('contact_settings')
export class ContactSettingsEntity {
  @PrimaryColumn({ type: 'int', unsigned: true, name: 'id_contact_settings' })
  idContactSettings!: number;

  /** email donde llegan los mensajes del formulario de contacto — null
   * mientras el ADMIN no lo configuró todavía (el formulario público
   * rechaza el envío con un mensaje claro en ese caso, ver
   * ContactService.enviarMensaje). */
  @Column({ type: 'varchar', nullable: true, name: 'email' })
  email!: string | null;

  /** número de WhatsApp del negocio, solo para mostrar/guardar por ahora
   * — todavía no dispara ninguna notificación automática (no hay
   * integración con ningún proveedor de WhatsApp todavía, pedido
   * explícito del usuario: "ninguno todavía, solo guardar el número"). */
  @Column({ type: 'varchar', nullable: true, name: 'whatsapp' })
  whatsapp!: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
