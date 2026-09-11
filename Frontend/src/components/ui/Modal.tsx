import type { ReactNode } from 'react';
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Modal genérico sobre @headlessui/react (ya era dependencia del proyecto
 * — package.json — pero no se usaba en ningún componente todavía). Trae
 * resuelto lo que hay que hacer bien en cualquier modal (cerrar con ESC,
 * click afuera, foco atrapado adentro) en vez de reimplementarlo a mano.
 * No impone contenido ni layout interno — el que lo usa arma su propio
 * `children` (ver ProductDetailModal.tsx, el primer caso de uso real).
 */
export function Modal({ open, onClose, children, className = '' }: ModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/50 transition-opacity duration-200 data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className={`w-full bg-white rounded-lg shadow-xl transition duration-200 data-[closed]:opacity-0 data-[closed]:scale-95 ${className}`.trim()}
        >
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export default Modal;
