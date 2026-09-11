import type { ReactNode } from 'react';

type MenuToggleButtonVariant = 'desktop' | 'mobile';

// Las clases largas viven acá una sola vez por variante, en vez de
// repetidas en cada lugar donde se usa el botón (ver DropdownMenu.tsx).
const variantClasses: Record<MenuToggleButtonVariant, string> = {
  desktop:
    'px-2 py-2 bg-gray-100 bg-opacity-80 hover:bg-cyan-300 hover:bg-opacity-75 text-black cursor-pointer hover:rounded-full focus:outline-none hover:animate-wiggle',
  mobile:
    'px-2 py-2 bg-cyan-700 bg-opacity-80 hover:bg-cyan-500 hover:bg-opacity-75 text-left text-black cursor-pointer focus:outline-none hover:animate-wiggle',
};

interface MenuToggleButtonProps {
  variant: MenuToggleButtonVariant;
  onClick: () => void;
  children: ReactNode;
}

export function MenuToggleButton({ variant, onClick, children }: MenuToggleButtonProps) {
  return (
    <button type="button" onClick={onClick} className={variantClasses[variant]}>
      {children}
    </button>
  );
}

export default MenuToggleButton;
