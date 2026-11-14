import React, { useState } from 'react';
import {
  ClipboardList,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { UnitBadge } from '../../common/Badge';
import { ExportDropdown } from '../../common/ExportDropdown';
import { apiFetch } from '../../../utils/auth';

interface IntegrityReport {
  valid: boolean;
  totalLogs: number;
  chainedCount: number;
  legacyCount: number;
  brokenCount: number;
  brokenIds?: string[];
  verifiedAt: string;
}

export const AuditLogView: React.FC = () => {
  const { auditLogs, showToast } = usePPDB();

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isVerifying, setIsVerifying] = useState(false);
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const pageSize = 20;

  const handleVerifyIntegrity = async () => {
    setIsVerifying(true);
    try {
      const res = await apiFetch('/api/audit-logs/verify-integrity', {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        showToast(data?.error || 'Gagal memverifikasi integritas log audit di server.', 'error');
        return;
      }
      setIntegrityReport(data);
      if (data.valid) {
        showToast(`Integritas terverifikasi: ${data.chainedCount} entri berantai HMAC valid (0 rusak).`);
      } else {
        showToast(`Peringatan: ditemukan ${data.brokenCount} entri log yang gagal verifikasi HMAC!`, 'error');
      }
    } catch (e) {
      showToast('Gagal menghubungi server saat memverifikasi integritas log audit.', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const filteredLogs = auditLogs.filter((log) => {
    if (
      search &&
      !log.userEmail.toLowerCase().includes(search.toLowerCase()) &&
      !log.details.toLowerCase().includes(search.toLowerCase()) &&
      !log.action.toLowerCase().includes(search.toLowerCase()) &&
      !log.ipAddress.includes(search)
    ) {
      return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const formatActionBadge = (action: string) => {
    switch (action) {
      case 'login':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            LOGIN
          </span>
        );
      case 'logout':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            LOGOUT
          </span>
        );
      case 'create_pendaftar':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            PENDAFTARAN
          </span>
        );
      case 'verifikasi':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
            VERIFIKASI
          </span>
        );
      case 'update_status':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            UPDATE_STATUS
          </span>
        );
      case 'update_kuota':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            UPDATE_KUOTA
          </span>
        );
      case 'export_data':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            EKSPOR_CSV
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
            {action.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-600" />
            <span>Audit Trail & Security Event Logs</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Mencatat aktivitas staf secara real-time dengan HMAC-SHA256 hash chaining untuk deteksi manipulasi log.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleVerifyIntegrity}
            disabled={isVerifying}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
          >
            {isVerifying ? (
              <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
            ) : (
              <Shield className="w-4 h-4 text-emerald-600" />
            )}
            <span>{isVerifying ? 'Memverifikasi...' : 'Verifikasi Integritas Log'}</span>
          </button>

          <ExportDropdown
            moduleName="Audit Log"
            title="Log Audit Keamanan & Rekam Jejak Sistem (Audit Trail)"
            filename="Audit_Log_Keamanan"
            headers={['ID Log', 'Waktu (WIB)', 'Pengguna', 'Aksi/Event', 'Unit', 'Deskripsi Aktivitas', 'Alamat IP']}
            rows={filteredLogs.map((log) => [
              log.id,
              log.timestamp,
              log.userEmail,
              log.action,
              log.schoolId,
              log.details,
              log.ipAddress,
            ])}
          />
        </div>
      </div>

      {integrityReport && (
        <div
          className={`p-4 rounded-2xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
            integrityReport.valid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {integrityReport.valid ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <div>
              <p className="font-bold">
                {integrityReport.valid
                  ? 'Rantai Integritas Audit Log Terverifikasi Valid (HMAC-SHA256)'
                  : `Peringatan Integritas: ${integrityReport.brokenCount} Entri Log Terdeteksi Tidak Valid`}
              </p>
              <p className="text-[11px] opacity-85 mt-0.5">
                Total Log: {integrityReport.totalLogs} • Berantai HMAC: {integrityReport.chainedCount} • Legacy (Pra-HMAC): {integrityReport.legacyCount} • Terindikasi Rusak: {integrityReport.brokenCount}
              </p>
            </div>
          </div>
          <span className="font-mono text-[11px] opacity-75">
            Diperiksa: {new Date(integrityReport.verifiedAt).toLocaleString('id-ID')}
          </span>
        </div>
      )}

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari email user, aksi, IP address, atau detail..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
          />
        </div>
      </div>

      {/* Table with Pagination 20 per page */}
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Waktu (WIB)</th>
                <th className="py-3 px-4">Pengguna (Aktor)</th>
                <th className="py-3 px-4">Aksi / Event</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4">Deskripsi Aktivitas</th>
                <th className="py-3 px-4">Alamat IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Tidak ditemukan log audit yang cocok.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log, idx) => (
                  <tr
                    key={log.id}
                    className={`hover:bg-emerald-50/30 transition-colors ${
                      idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap tabular-nums">
                      {log.timestamp}
                    </td>

                    <td className="py-3 px-4 font-mono font-medium text-slate-800">
                      {log.userEmail}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {formatActionBadge(log.action)}
                    </td>

                    <td className="py-3 px-4">
                      <UnitBadge unit={log.schoolId} />
                    </td>

                    <td className="py-3 px-4 text-slate-700 max-w-sm">
                      {log.details}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                      {log.ipAddress}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            Menampilkan{' '}
            <span className="font-semibold text-slate-700">
              {filteredLogs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>
            -
            <span className="font-semibold text-slate-700">
              {Math.min(currentPage * pageSize, filteredLogs.length)}
            </span>{' '}
            dari <span className="font-semibold text-slate-700">{filteredLogs.length}</span> log tercatat (20 per halaman)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-slate-700 px-2 font-mono">
              Hal {currentPage} dari {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
