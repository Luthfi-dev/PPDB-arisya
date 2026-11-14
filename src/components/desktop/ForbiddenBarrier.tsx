import React from 'react';
import { ShieldAlert, Lock, ArrowLeft, LogOut, CheckCircle2, XCircle } from 'lucide-react';
import { AppUser } from '../../types/ppdb';
import { getMenuLabel } from '../../utils/rbac';

interface ForbiddenBarrierProps {
  menuId: string;
  user: AppUser | null;
  onReset: () => void;
  onLogout?: () => void;
}

export const ForbiddenBarrier: React.FC<ForbiddenBarrierProps> = ({
  menuId,
  user,
  onReset,
  onLogout,
}) => {
  const menuName = getMenuLabel(menuId);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-12 flex items-center justify-center font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="max-w-2xl w-full bg-white rounded-3xl border border-red-200 shadow-xl overflow-hidden">
        {/* Top Warning Banner */}
        <div className="bg-gradient-to-r from-red-600 to-rose-700 p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-white/20 text-white mb-1.5 border border-white/25">
                <Lock className="w-3 h-3" /> 403 Forbidden Access
              </div>
              <h2 className="text-xl md:text-2xl font-black tracking-tight">
                Akses Modul Ditolak oleh Middleware
              </h2>
              <p className="text-xs md:text-sm text-red-100 font-medium">
                Sistem keamanan berbasis Role-Based Access Control (RBAC) & Principle of Least Privilege
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8 space-y-6">
          <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-sm text-red-900 leading-relaxed">
            <span className="font-bold">Pemberitahuan Keamanan:</span> Akun Anda tidak memiliki izin atau wewenang resmi untuk mengakses modul{' '}
            <span className="font-bold underline text-red-800">"{menuName}"</span>. Upaya akses ke menu yang tidak sah dicegah secara otomatis oleh middleware otorisasi.
          </div>

          {/* User Session Inspection Matrix */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs md:text-sm">
            <div className="bg-slate-50 px-4 py-2.5 font-bold text-slate-700 flex items-center justify-between">
              <span>Informasi Kredensial Sesi Saat Ini</span>
              <span className="text-[11px] text-slate-400 font-mono">ENFORCED</span>
            </div>
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-slate-500 font-medium">Nama Pengguna:</span>
              <span className="font-semibold text-slate-900">{user?.name || 'Anonim'}</span>
            </div>
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-slate-500 font-medium">Email / Akun:</span>
              <span className="font-mono text-slate-800">{user?.email || '-'}</span>
            </div>
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-slate-500 font-medium">Role Ditugaskan:</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                {user?.role || 'Tidak Terdefinisi'}
              </span>
            </div>
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-slate-500 font-medium">Cakupan Unit Sekolah:</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                {user?.schoolId || 'MASTER'}
              </span>
            </div>
            <div className="px-4 py-3">
              <div className="text-slate-500 font-medium mb-2">Daftar Hak Akses (Permissions) Terdaftar:</div>
              <div className="flex flex-wrap gap-1.5">
                {user?.permissions && user.permissions.length > 0 ? (
                  user.permissions.map((p, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {p}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400 italic">Tidak ada izin operasional.</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onReset}
              className="flex-1 py-3 px-5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Modul Berwenang
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Keluar Sesi
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
