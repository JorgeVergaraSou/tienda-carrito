import { IsEmail, IsOptional, Matches } from 'class-validator';

/** body de PATCH /contacto/configuracion (ADMIN) — `email`/`whatsapp`
 * aceptan `null` explícito a propósito (a diferencia del resto de los
 * PATCH de este proyecto, donde omitir un campo es "no tocarlo"): acá el
 * form de configuración siempre manda los dos campos con lo que haya en
 * los inputs, `null` si el ADMIN los vació — no hace falta distinguir
 * "no cambiar" de "vaciar", como sí hace falta en, por ejemplo,
 * UpdateProductDto con idCategoria. */
export class UpdateContactSettingsDto {
  @IsOptional()
  @IsEmail(
    {},
    { message: 'El email debe ser una dirección de correo electrónico válida' },
  )
  email?: string | null;

  @IsOptional()
  @Matches(/^\+?[0-9]{8,15}$/, {
    message:
      'El WhatsApp debe ser un número válido (solo dígitos, opcionalmente con + al inicio, entre 8 y 15 dígitos)',
  })
  whatsapp?: string | null;
}
