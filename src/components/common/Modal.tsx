import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  hideFooter?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon,
  children,
  confirmLabel = 'Simpan',
  confirmVariant = 'primary',
  onConfirm,
  confirmDisabled = false,
  maxWidth = 'md',
  hideFooter = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 print-modal-container">
      {/* 50% black backdrop overlay with blur */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity print-hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidthClass} max-h-[92vh] sm:max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-emerald-100 overflow-hidden transform transition-all z-10 print-modal-dialog`}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 pt-5 pb-3.5 pr-12 border-b border-slate-100/80 print-hidden">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>

          {icon && (
            <div className="mb-3 inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-emerald-50 text-[#16a34a]">
              {icon}
            </div>
          )}

          <h3 className="text-base sm:text-xl font-bold text-slate-900 leading-snug break-words">
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed break-words">
              {description}
            </p>
          )}
        </div>

        {/* Content Body */}
        {children && (
          <div className="px-4 sm:px-6 py-3.5 overflow-y-auto overflow-x-hidden flex-1 min-w-0 text-slate-700 print-modal-body">
            {children}
          </div>
        )}

        {/* Footer */}
        {!hideFooter && (
          <div className="p-4 sm:p-6 pt-3.5 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-2.5 bg-slate-50/60 print-hidden">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-center whitespace-normal leading-snug cursor-pointer"
            >
              Batal
            </button>
            {onConfirm && (
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirmDisabled}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white shadow-sm transition-all text-center whitespace-normal leading-snug cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  confirmVariant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 active:scale-[0.98]'
                    : 'bg-[#16a34a] hover:bg-emerald-700 active:scale-[0.98]'
                }`}
              >
                {confirmLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
