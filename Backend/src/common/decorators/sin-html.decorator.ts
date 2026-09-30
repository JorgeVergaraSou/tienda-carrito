import { registerDecorator, ValidationOptions } from 'class-validator';

/** Rechaza `<` y `>` en nombres y datos de contacto (defensa en
 * profundidad contra HTML/JS guardado y luego mostrado por algún cliente
 * que no escape — un popup de SweetAlert2 con `html:`, un mail, el título
 * del ítem en Mercado Pago). NO aplicar a texto libre (descripción, notas,
 * mensajes): ahí "menor que"/"mayor que" son texto legítimo y la defensa
 * real es escapar al mostrar. */
export function SinHtml(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'sinHtml',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} no puede contener los símbolos < ni >`,
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          typeof value !== 'string' || !/[<>]/.test(value),
      },
    });
}

/** Rechaza saltos de línea y otros caracteres de control en un valor que
 * termina en una cabecera de mail (asunto, remitente, reply-to) — evita
 * inyectar cabeceras adicionales (`Bcc:`) escondidas tras un `\r\n`. */
export function SinSaltosDeLinea(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'sinSaltosDeLinea',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} no puede contener saltos de línea`,
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          typeof value !== 'string' || !/[\u0000-\u001F\u007F]/.test(value),
      },
    });
}
