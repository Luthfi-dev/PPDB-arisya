import React from 'react';
import { Search, ShieldCheck, Database, Download, Menu } from 'lucide-react';
import { usePPDB } from '../../context/PPDBContext';
import { isSuperAdmin } from '../../utils/rbac';

interface HeaderProps {
  title: string;
  subtitle?: string;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  searchQuery,
  setSearchQuery,
  onToggleSidebar,
}) => {
  const { activeSchoolId, dbStatus, downloadMySqlDump, currentUser } = usePPDB();
  const canDownloadSql = isSuperAdmin(currentUser);

  return (
    <header className="sticky top-0 z-20 bg-[#f0fdf4]/95 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3.5 border-b border-emerald-100/80 flex flex-wrap items-center justify-between gap-3 w-full">
      {/* Title & Context */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-xl bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 transition-colors shadow-2xs"
            title="Buka Menu Samping"
          >
            <Menu className="w-5 h-5 text-[#14532d]" />
          </button>
        )}

        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">{title}</h2>
            <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-100 text-[#14532d] border border-emerald-200">
              {activeSchoolId === 'MASTER' ? 'Yayasan Master' : activeSchoolId}
            </span>
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 sm:flex-none justify-end w-full sm:w-auto">
        {/* Search Input */}
        <div className="relative flex-1 sm:w-64 md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari siswa, no pendaftaran, wali..."
            className="w-full bg-white border border-emerald-100 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-700 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:border-transparent transition-all"
          />
        </div>

        {/* MySQL Status Pill (Hanya Role Master / Super Admin Yayasan) */}
        {canDownloadSql && (
          <div
            onClick={downloadMySqlDump}
            className="cursor-pointer flex items-center gap-1.5 px-2.5 py-2 sm:px-3 sm:py-1.5 rounded-xl bg-white border border-emerald-200 hover:border-emerald-300 text-xs font-semibold text-emerald-800 shadow-xs transition-colors shrink-0"
            title="Klik untuk download skema database MySQL (.sql)"
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden xl:inline">MySQL:</span>
            <span className="text-[11px] font-bold text-emerald-700 hidden sm:inline">
              {dbStatus?.connected ? 'Live Connected' : 'Auto-Sync Active'}
            </span>
            <Download className="w-3 h-3 text-slate-400 ml-0.5" />
          </div>
        )}

        {/* Security Indicator */}
        <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>CSRF & Session Aktif</span>
        </div>
      </div>
    </header>
  );
};
