import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { usePPDB } from '../../context/PPDBContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = usePPDB();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-xl border backdrop-blur-md transform transition-all duration-300 animate-in slide-in-from-right-8 ${
              isSuccess
                ? 'bg-emerald-900/90 text-white border-emerald-700/60'
                : 'bg-red-900/90 text-white border-red-700/60'
            }`}
          >
            <div className="shrink-0">
              {isSuccess ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400" />
              )}
            </div>
            <p className="text-sm font-medium leading-snug flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
