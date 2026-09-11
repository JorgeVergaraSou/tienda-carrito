import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Auth } from '@/auth/decorators/auth.decorator';
import { Role } from '@/common/enums/role.enum';
import { ContactService } from './contact.service';
import { SendContactMessageDto } from './dto/send-contact-message.dto';
import { UpdateContactSettingsDto } from './dto/update-contact-settings.dto';

@Controller('contacto')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  /** público — sin @Auth, es la página de contacto del catálogo. Mismo
   * patrón de throttle que requestResetPassword en auth/ (otro endpoint
   * público que dispara un mail): limita el abuso/spam por IP sin
   * requerir login. */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 600000 } }) // máx. 5 mensajes cada 10 min por IP
  @Post()
  async enviarMensaje(@Body() dto: SendContactMessageDto): Promise<void> {
    return this.contactService.enviarMensaje(dto);
  }

  /** público — solo el número de WhatsApp (no el email), para que
   * ContactPage.tsx arme el link `wa.me` sin login. Ver
   * ContactService.getWhatsappPublico. */
  @Get('whatsapp')
  async getWhatsapp() {
    return this.contactService.getWhatsappPublico();
  }

  /** ADMIN — email/WhatsApp donde el negocio recibe los mensajes, para
   * precargar el form de configuración del panel. */
  @Auth(Role.ADMIN)
  @Get('configuracion')
  async getConfiguracion() {
    return this.contactService.getSettings();
  }

  @Auth(Role.ADMIN)
  @Patch('configuracion')
  async actualizarConfiguracion(@Body() dto: UpdateContactSettingsDto) {
    return this.contactService.updateSettings(dto);
  }
}
