import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getTransporter } from '@/config/mailer';
import { handleServiceError } from '@/common/utils/error-handler.util';
import { contactErrorLogger } from '@/config/module-loggers';
import { insertLogger, updateLogger } from '@/config/db-loggers';
import { ContactSettingsEntity } from './entities/contact-settings.entity';
import { SendContactMessageDto } from './dto/send-contact-message.dto';
import { UpdateContactSettingsDto } from './dto/update-contact-settings.dto';
import { ContactSettingsResponseDto } from './dto/responses/contact-settings-response.dto';
import { ContactWhatsappResponseDto } from './dto/responses/contact-whatsapp-response.dto';

// singleton: nunca hay más que una fila de configuración de contacto, así
// que la PK queda fija en vez de auto-incremental (ver
// ContactSettingsEntity, @PrimaryColumn en vez de
// @PrimaryGeneratedColumn).
const CONTACT_SETTINGS_ID = 1;

/** escapa el contenido que manda el cliente antes de interpolarlo en el
 * HTML del mail de notificación — nombre/email/mensaje del form público
 * son datos no confiables, sin esto alguien podría meter HTML/links
 * falsos en el mail que recibe el ADMIN. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(ContactSettingsEntity)
    private readonly contactSettingsRepository: Repository<ContactSettingsEntity>,
  ) {}

  async getSettings(): Promise<ContactSettingsResponseDto> {
    try {
      return this.toResponseDto(await this.getOrCrearSettings());
    } catch (error) {
      handleServiceError(
        error,
        contactErrorLogger,
        'ContactService.getSettings',
        'Ocurrió un error al obtener la configuración de contacto',
      );
    }
  }

  async updateSettings(
    dto: UpdateContactSettingsDto,
  ): Promise<ContactSettingsResponseDto> {
    try {
      await this.getOrCrearSettings(); // garantiza que la fila ya existe

      await this.contactSettingsRepository.update(CONTACT_SETTINGS_ID, dto);

      updateLogger.info(
        `Configuración de contacto actualizada: campos ${JSON.stringify(Object.keys(dto))}`,
      );

      return this.toResponseDto(await this.getOrCrearSettings());
    } catch (error) {
      handleServiceError(
        error,
        contactErrorLogger,
        'ContactService.updateSettings',
        'Ocurrió un error al actualizar la configuración de contacto',
      );
    }
  }

  /** público — a diferencia de getSettings (ADMIN, email incluido), esto
   * solo expone el número de WhatsApp, para que la página pública de
   * contacto pueda armar el link `wa.me` sin necesitar login. Ver
   * ContactPage.tsx en el frontend — el envío por WhatsApp en sí es
   * 100% client-side (abre `wa.me` con el mensaje precargado, lo termina
   * mandando el propio cliente desde su WhatsApp), no hay integración con
   * ningún proveedor acá; esto solo le da el número al frontend. */
  async getWhatsappPublico(): Promise<ContactWhatsappResponseDto> {
    try {
      const settings = await this.getOrCrearSettings();
      return { whatsapp: settings.whatsapp };
    } catch (error) {
      handleServiceError(
        error,
        contactErrorLogger,
        'ContactService.getWhatsappPublico',
        'Ocurrió un error al obtener el WhatsApp de contacto',
      );
    }
  }

  /** envía por mail el mensaje del formulario público de contacto al
   * email configurado por el ADMIN (ver updateSettings). No manda nada
   * por WhatsApp — ese lado lo resuelve el frontend por su cuenta con el
   * número que le da getWhatsappPublico (ver el comentario ahí), esta
   * request es solo la mitad del email. */
  async enviarMensaje(dto: SendContactMessageDto): Promise<void> {
    try {
      const settings = await this.getOrCrearSettings();

      if (!settings.email) {
        throw new BadRequestException(
          'El formulario de contacto no está disponible todavía — todavía no se configuró un email de contacto.',
        );
      }

      const fromName = process.env.MAIL_FROM_NAME || 'Soporte';

      await getTransporter().sendMail({
        from: `"${fromName}" <${process.env.MAIL_USER}>`,
        to: settings.email,
        // así el ADMIN puede simplemente responder el mail desde su
        // cliente de correo y la respuesta le llega directo al cliente,
        // sin tener que copiar/pegar la dirección a mano.
        replyTo: dto.email,
        subject: `Nuevo mensaje de contacto de ${dto.nombre}`,
        html: `
          <p><b>Nombre:</b> ${escapeHtml(dto.nombre)}</p>
          <p><b>Email:</b> ${escapeHtml(dto.email)}</p>
          <p><b>Mensaje:</b></p>
          <p>${escapeHtml(dto.mensaje).replace(/\n/g, '<br />')}</p>
        `,
      });

      // no se loguea el mensaje en sí (puede ser largo/contener
      // cualquier cosa que haya escrito el cliente) — alcanza con saber
      // que se envió y desde qué email, para auditar volumen/abuso.
      insertLogger.info(
        `Mensaje de contacto enviado a ${settings.email} (de: ${dto.email})`,
      );
    } catch (error) {
      handleServiceError(
        error,
        contactErrorLogger,
        'ContactService.enviarMensaje',
        'No se pudo enviar el mensaje, intentá de nuevo más tarde',
      );
    }
  }

  private async getOrCrearSettings(): Promise<ContactSettingsEntity> {
    const existing = await this.contactSettingsRepository.findOneBy({
      idContactSettings: CONTACT_SETTINGS_ID,
    });

    if (existing) {
      return existing;
    }

    return this.contactSettingsRepository.save({
      idContactSettings: CONTACT_SETTINGS_ID,
      email: null,
      whatsapp: null,
    });
  }

  private toResponseDto(
    settings: ContactSettingsEntity,
  ): ContactSettingsResponseDto {
    return {
      email: settings.email,
      whatsapp: settings.whatsapp,
      updatedAt: settings.updatedAt,
    };
  }
}
