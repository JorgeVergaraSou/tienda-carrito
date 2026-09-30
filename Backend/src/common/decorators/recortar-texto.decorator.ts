import { Transform } from 'class-transformer';

/** Recorta espacios SOLO si el valor es texto. El `@Transform(({ value }) =>
 * value.trim())` que había en cada DTO tiraba un TypeError (→ 500) apenas
 * llegaba un número, un objeto o un array — y `value?.trim()` tampoco
 * alcanza: el `?.` solo protege contra null/undefined, no contra "no es un
 * string". Acá el valor raro pasa intacto y lo rechaza el `@IsString` del
 * DTO con un 400 claro. */
export const RecortarTexto = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
