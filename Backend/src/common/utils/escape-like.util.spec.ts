import { escapeLikeWildcards } from './escape-like.util';

describe('escapeLikeWildcards', () => {
  it('escapa "%" para que se busque como texto literal, no como comodín', () => {
    expect(escapeLikeWildcards('10%')).toBe('10\\%');
  });

  it('escapa "_" para que se busque como texto literal, no como comodín de un carácter', () => {
    expect(escapeLikeWildcards('a_b')).toBe('a\\_b');
  });

  it('escapa el propio carácter de escape ("\\") primero, antes que % y _', () => {
    // si escapara % y _ antes que \, el \ que agrega esa escapada
    // quedaría sin escapar él mismo y MySQL lo interpretaría como el
    // inicio de una secuencia de escape real, no como un backslash
    // literal.
    expect(escapeLikeWildcards('a\\b')).toBe('a\\\\b');
  });

  it('deja intacto un texto de búsqueda normal, sin comodines', () => {
    expect(escapeLikeWildcards('adidas')).toBe('adidas');
  });

  it('escapa varios comodines mezclados en el mismo texto', () => {
    expect(escapeLikeWildcards('100%_off\\now')).toBe('100\\%\\_off\\\\now');
  });

  it('un string vacío queda vacío', () => {
    expect(escapeLikeWildcards('')).toBe('');
  });
});
