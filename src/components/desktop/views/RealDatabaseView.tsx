import React, { useState, useEffect } from 'react';
import {
  Database,
  Lock,
  Unlock,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Search,
  Eye,
  EyeOff,
  Server,
  Layers,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  FileJson,
  CheckCircle2,
  X,
  Code,
  Info,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { isSuperAdmin } from '../../../utils/rbac';
import { apiFetch, getAuthHeaders } from '../../../utils/auth';

interface TableMeta {
  name: string;
  label: string;
  rowCount: number;
  isLiveMySQL: boolean;
}

interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  key: string;
  default: any;
}

interface TableDataResponse {
  tableName: string;
  columns: TableColumn[];
  rows: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isLiveMySQL: boolean;
  connectionInfo: {
    host: string;
    port: number;
    database: string;
    user: string;
  };
}

export const RealDatabaseView: React.FC = () => {
  const { currentUser, showToast } = usePPDB();
  const isMaster = isSuperAdmin(currentUser);

  // PIN & Unlock State (Session-only in memory, never saved to persistent storage)
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [dbToken, setDbToken] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Table Data State
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('students');
  const [tableData, setTableData] = useState<TableDataResponse | null>(null);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Detail Modal for cell content (especially JSON or long text)
  const [cellModal, setCellModal] = useState<{ title: string; content: any } | null>(null);

  // 1. PIN Verification Handler
  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    if (!pinInput.trim()) {
      setPinError('Silakan masukkan 8-digit PIN Otorisasi Database Master.');
      return;
    }

    setIsVerifyingPin(true);

    try {
      const res = await apiFetch('/api/real-db/verify-pin', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ pin: pinInput.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.token) {
        setDbToken(data.token);
        setIsUnlocked(true);
        setPinInput('');
        showToast('Otorisasi PIN Database berhasil. Menghubungkan ke real database...', 'success');
      } else {
        setPinError(data.error || 'PIN tidak valid. Akses inspeksi database ditolak.');
      }
    } catch (err: any) {
      setPinError('Gagal menghubungi server verifikasi otorisasi. Periksa koneksi backend.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // 2. Lock & Revoke Session Handler
  const handleLockSession = async () => {
    if (dbToken) {
      try {
        await apiFetch('/api/real-db/revoke-pin', {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'x-db-access-token': dbToken,
          },
        });
      } catch (e) {}
    }

    setDbToken(null);
    setIsUnlocked(false);
    setTableData(null);
    setPinInput('');
    showToast('Sesi inspeksi database telah dikunci demi keamanan.');
  };

  // 3. Load Tables List
  const fetchTables = async () => {
    if (!dbToken) return;
    setIsLoadingTables(true);
    try {
      const res = await apiFetch('/api/real-db/tables', {
        headers: {
          'x-db-access-token': dbToken,
        },
      });

      if (res.status === 401) {
        handleLockSession();
        setPinError('Sesi inspeksi database telah berakhir. Masukkan PIN kembali.');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setTables(data);
      }
    } catch (e) {
      showToast('Gagal memuat daftar tabel database.', 'error');
    } finally {
      setIsLoadingTables(false);
    }
  };

  // 4. Load Specific Table Content
  const fetchTableContent = async (tableName: string, page = 1) => {
    if (!dbToken) return;
    setIsLoadingData(true);
    try {
      const url = `/api/real-db/table/${tableName}?page=${page}&limit=${pageSize}&search=${encodeURIComponent(
        searchFilter
      )}`;

      const res = await apiFetch(url, {
        headers: {
          'x-db-access-token': dbToken,
        },
      });

      if (res.status === 401) {
        handleLockSession();
        setPinError('Sesi inspeksi database kedaluwarsa. Silakan masukkan PIN kembali.');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setTableData(data);
        setCurrentPage(page);
      } else {
        const err = await res.json();
        showToast(err.error || 'Gagal memuat isi tabel.', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan memuat data tabel.', 'error');
    } finally {
      setIsLoadingData(false);
    }
  };

  // On unlock, fetch tables and initial table
  useEffect(() => {
    if (isUnlocked && dbToken) {
      fetchTables();
      fetchTableContent(selectedTable, 1);
    }
  }, [isUnlocked, dbToken]);

  // When selectedTable changes, fetch its content
  const handleSelectTable = (name: string) => {
    setSelectedTable(name);
    setSearchFilter('');
    setCurrentPage(1);
    fetchTableContent(name, 1);
  };

  // Export current table rows to CSV
  const handleExportCsv = () => {
    if (!tableData || tableData.rows.length === 0) {
      showToast('Tidak ada data tabel untuk diekspor.', 'error');
      return;
    }

    const headers = tableData.columns.map((c) => c.name);
    const csvRows = [headers.join(',')];

    for (const row of tableData.rows) {
      const values = headers.map((header) => {
        const val = row[header];
        if (val === null || val === undefined) return '""';
        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `real_db_${selectedTable}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Tabel ${selectedTable} berhasil diekspor ke CSV.`);
  };

  // Guard for non-master access
  if (!isMaster) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-red-200 text-center max-w-xl mx-auto shadow-sm my-12">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Akses Terlarang (403 Forbidden)</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          Modul Inspeksi Real Database hanya diizinkan untuk <strong>Super Admin Master Yayasan</strong>. Akun Anda tidak memiliki hak otorisasi untuk membuka modul ini.
        </p>
      </div>
    );
  }

  // SCREEN 1: LOCKED (PIN Entry)
  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto my-12">
        <div className="bg-white rounded-3xl border border-emerald-100 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-br from-[#14532d] via-emerald-900 to-[#14532d] p-6 text-white text-center relative">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <Database className="w-8 h-8 text-emerald-300" />
            </div>
            <h3 className="text-lg font-extrabold tracking-tight">Inspeksi Real Database</h3>
            <p className="text-xs text-emerald-200 mt-1">
              Yayasan Ar-Risalah Aceh • Master Admin Tool
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/30 text-[10px] font-bold mt-3">
              <Lock className="w-3 h-3 text-amber-300" />
              <span>Proteksi Enkripsi PIN Otentikasi Ganda</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleVerifyPin} className="p-6 space-y-4">
            <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Halaman ini mengakses tabel live MySQL secara langsung. Masukkan <strong>PIN Keamanan Master</strong> (yang telah dikonfigurasi pada variabel lingkungan) untuk membuka sesi inspeksi database.
                </span>
              </div>
            </div>

            {pinError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 animate-in fade-in">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="font-medium leading-relaxed">{pinError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                PIN Keamanan Database Master:
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPin ? 'text' : 'password'}
                  maxLength={12}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Masukkan PIN Rahasia Anda..."
                  autoFocus
                  required
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] focus:bg-white rounded-2xl pl-10 pr-11 py-2.5 text-sm tracking-wider font-mono font-bold text-slate-900 placeholder:font-sans placeholder:text-xs placeholder:font-normal placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 transition-all text-center"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                  title={showPin ? 'Sembunyikan' : 'Tampilkan'}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isVerifyingPin}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#16a34a] hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-700/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                {isVerifyingPin ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Memverifikasi Enkripsi PIN...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>Buka Inspeksi Real Database</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 text-center pt-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>PIN diverifikasi secara aman menggunakan salted Bcrypt hash di backend.</span>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // SCREEN 2: UNLOCKED (Real DB Table Viewer)
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Bar: Connection Status & Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#14532d] text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
            <Database className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Inspeksi Real Database (Live MySQL)
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                Live Explorer Aktif
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>Database: <strong>{tableData?.connectionInfo?.database || 'ppdb_arrisalah'}</strong></span>
              <span>•</span>
              <span>Host: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono text-emerald-800">{tableData?.connectionInfo?.host || 'localhost'}:{tableData?.connectionInfo?.port || 3306}</code></span>
              <span>•</span>
              <span className="text-emerald-700 font-semibold">User: {tableData?.connectionInfo?.user || 'root'}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchTableContent(selectedTable, currentPage)}
            disabled={isLoadingData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
            title="Muat ulang data tabel live"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin text-emerald-600' : ''}`} />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={!tableData || tableData.rows.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#14532d] text-xs font-bold border border-emerald-200 transition-colors cursor-pointer disabled:opacity-40"
            title="Ekspor data tabel ke CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ekspor CSV</span>
          </button>

          <button
            onClick={handleLockSession}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-colors cursor-pointer"
            title="Kunci kembali sesi inspeksi database"
          >
            <Lock className="w-3.5 h-3.5 text-rose-600" />
            <span>Kunci Kembali</span>
          </button>
        </div>
      </div>

      {/* Table Selector Grid */}
      <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-sm space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            <span>Pilih Tabel Database yang Terkoneksi ({tables.length} Tabel):</span>
          </span>
          <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
            Klik nama tabel untuk melihat isi data mentah
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {tables.map((t) => {
            const isSelected = selectedTable === t.name;
            return (
              <button
                key={t.name}
                onClick={() => handleSelectTable(t.name)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#14532d] border-[#14532d] text-white shadow-sm ring-2 ring-emerald-500/20'
                    : 'bg-slate-50/80 hover:bg-emerald-50/60 border-slate-200 hover:border-emerald-300 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    className={`font-mono text-xs font-bold truncate ${
                      isSelected ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {t.name}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md font-mono ${
                      isSelected
                        ? 'bg-emerald-700 text-emerald-100'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {t.rowCount} baris
                  </span>
                </div>
                <p
                  className={`text-[10px] truncate ${
                    isSelected ? 'text-emerald-200' : 'text-slate-400'
                  }`}
                >
                  {t.label.split('(')[0].trim()}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table Viewer Box */}
      <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden flex flex-col">
        {/* Table Title Bar & Search */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TableIcon className="w-4 h-4 text-emerald-600" />
            <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
              Isi Data Tabel: <code className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-mono">{selectedTable}</code>
            </h4>
            <span className="text-xs text-slate-500 hidden sm:inline">
              (Total {tableData?.total || 0} baris data)
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetchTableContent(selectedTable, 1);
                  }
                }}
                placeholder="Filter data dalam tabel..."
                className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:border-transparent transition-all"
              />
            </div>
            {searchFilter && (
              <button
                onClick={() => {
                  setSearchFilter('');
                  fetchTableContent(selectedTable, 1);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                title="Hapus filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Data Table Grid */}
        <div className="overflow-x-auto min-h-[360px] max-h-[580px] scrollbar-thin scrollbar-thumb-emerald-800/40">
          {isLoadingData ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
              <span className="text-xs font-semibold text-slate-500">
                Memuat data dari database MySQL...
              </span>
            </div>
          ) : !tableData || tableData.rows.length === 0 ? (
            <div className="text-center py-20 space-y-2">
              <Database className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">
                Tidak ada data pada tabel {selectedTable}.
              </p>
              <p className="text-[11px] text-slate-400">
                Tabel ini saat ini belum memiliki record tersimpan atau hasil pencarian nihil.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/90 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-12 text-center text-slate-400">#</th>
                  {tableData.columns.map((col) => (
                    <th key={col.name} className="py-2.5 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-slate-900">{col.name}</span>
                        {col.key === 'PRI' && (
                          <span className="px-1 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                            PK
                          </span>
                        )}
                        <span className="text-[9px] text-slate-400 lowercase font-normal">
                          {col.type}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {tableData.rows.map((row, rowIdx) => {
                  const globalIdx = (tableData.page - 1) * tableData.limit + rowIdx + 1;
                  return (
                    <tr
                      key={row.id || rowIdx}
                      className={`hover:bg-emerald-50/40 transition-colors ${
                        rowIdx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400 font-sans select-none">
                        {globalIdx}
                      </td>
                      {tableData.columns.map((col) => {
                        const val = row[col.name];
                        const isNull = val === null || val === undefined;
                        const isJson = typeof val === 'object' && val !== null;
                        const strVal = String(val);

                        return (
                          <td key={col.name} className="py-2 px-3.5 max-w-xs truncate">
                            {isNull ? (
                              <span className="text-slate-300 italic font-sans text-[10px]">
                                NULL
                              </span>
                            ) : isJson ? (
                              <button
                                onClick={() =>
                                  setCellModal({
                                    title: `${selectedTable}.${col.name} (Baris #${globalIdx})`,
                                    content: val,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-semibold transition-colors cursor-pointer"
                              >
                                <Code className="w-3 h-3" />
                                <span>Lihat JSON</span>
                              </button>
                            ) : strVal.length > 40 ? (
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-slate-800">{strVal}</span>
                                <button
                                  onClick={() =>
                                    setCellModal({
                                      title: `${selectedTable}.${col.name} (Baris #${globalIdx})`,
                                      content: strVal,
                                    })
                                  }
                                  className="text-emerald-700 hover:text-emerald-900 shrink-0 font-sans text-[10px] underline font-bold"
                                >
                                  Detail
                                </button>
                              </div>
                            ) : (
                              <span
                                className={
                                  col.name === 'id' || col.name.includes('id')
                                    ? 'text-emerald-800 font-bold'
                                    : col.name.includes('password')
                                    ? 'text-slate-400 font-mono'
                                    : 'text-slate-800'
                                }
                              >
                                {strVal}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        {tableData && tableData.totalPages > 1 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">
              Menampilkan halaman <strong>{tableData.page}</strong> dari{' '}
              <strong>{tableData.totalPages}</strong> ({tableData.total} total data)
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => fetchTableContent(selectedTable, tableData.page - 1)}
                disabled={tableData.page <= 1 || isLoadingData}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>

              <span className="px-3 py-1 font-mono font-bold text-slate-800">
                {tableData.page} / {tableData.totalPages}
              </span>

              <button
                onClick={() => fetchTableContent(selectedTable, tableData.page + 1)}
                disabled={tableData.page >= tableData.totalPages || isLoadingData}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* JSON / Content Viewer Modal */}
      {cellModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-emerald-400" />
                <span className="font-mono text-xs font-bold truncate">
                  {cellModal.title}
                </span>
              </div>
              <button
                onClick={() => setCellModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-slate-950 font-mono text-xs text-emerald-300">
              <pre className="whitespace-pre-wrap break-all">
                {typeof cellModal.content === 'object'
                  ? JSON.stringify(cellModal.content, null, 2)
                  : String(cellModal.content)}
              </pre>
            </div>

            <div className="p-3 bg-slate-100 flex justify-end">
              <button
                onClick={() => setCellModal(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
