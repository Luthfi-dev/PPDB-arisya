import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { usePPDB } from '../../context/PPDBContext';
import { hasActionPermission } from '../../utils/rbac';
import { exportToExcel, exportToPdf, ExportDataOptions } from '../../utils/exportUtils';

interface ExportDropdownProps extends Omit<ExportDataOptions, 'filename'> {
  moduleName: string;
  filename?: string;
  className?: string;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
  moduleName,
  filename = 'Export_Data_PPDB',
  title,
  subtitle,
  headers,
  rows,
  unitName,
  className = '',
}) => {
  const { currentUser, roles, showToast, addAuditLog, activeSchoolId, exportConfigs } = usePPDB();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // RBAC Permission check
  const canExport = hasActionPermission(currentUser, moduleName, 'export', roles);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Strict Deny: Hide button completely if role does not have export permission
  if (!canExport) {
    return null;
  }

  // Dynamic Master Export Field Resolution
  // 1. Check if specific rule exists for this role
  // 2. If not, fallback to 'ALL' (Default Umum)
  // 3. If neither, use original headers & rows
  const getFilteredExportData = () => {
    if (!exportConfigs || exportConfigs.length === 0) {
      return { finalHeaders: headers, finalRows: rows };
    }

    const userRoleName = currentUser?.role || '';
    const specificRule = exportConfigs.find(
      (c) => c.moduleName === moduleName && c.roleId === userRoleName
    );
    const defaultRule = exportConfigs.find(
      (c) => c.moduleName === moduleName && c.roleId === 'ALL'
    );

    const activeRule = specificRule || defaultRule;
    if (!activeRule || !Array.isArray(activeRule.allowedHeaders) || activeRule.allowedHeaders.length === 0) {
      return { finalHeaders: headers, finalRows: rows };
    }

    const allowedIndices: number[] = [];
    const finalHeaders: string[] = [];

    headers.forEach((h, idx) => {
      if (activeRule.allowedHeaders.includes(h)) {
        allowedIndices.push(idx);
        finalHeaders.push(h);
      }
    });

    if (finalHeaders.length === 0) {
      return { finalHeaders: headers, finalRows: rows };
    }

    const finalRows = rows.map((row) => allowedIndices.map((i) => row[i] ?? ''));
    return { finalHeaders, finalRows };
  };

  const handleExportExcel = () => {
    setIsOpen(false);
    if (rows.length === 0) {
      showToast('Tidak ada data untuk diekspor ke Excel.', 'error');
      return;
    }
    const { finalHeaders, finalRows } = getFilteredExportData();
    const safeFilename = `${filename}_${new Date().toISOString().slice(0, 10)}`;
    exportToExcel({
      filename: safeFilename,
      title,
      subtitle,
      headers: finalHeaders,
      rows: finalRows,
      unitName: unitName || (activeSchoolId === 'MASTER' ? 'Semua Unit' : activeSchoolId),
    });
    addAuditLog('export_data', activeSchoolId, `Ekspor data ${title} ke format Excel (.csv) - ${finalHeaders.length} kolom`);
    showToast(`Data ${title} berhasil diekspor ke Excel! (${finalHeaders.length} kolom sesuai izin)`);
  };

  const handleExportPdf = async () => {
    setIsOpen(false);
    if (rows.length === 0) {
      showToast('Tidak ada data untuk diekspor ke PDF.', 'error');
      return;
    }
    try {
      const { finalHeaders, finalRows } = getFilteredExportData();
      const safeFilename = `${filename}_${new Date().toISOString().slice(0, 10)}`;
      await exportToPdf({
        filename: safeFilename,
        title,
        subtitle,
        headers: finalHeaders,
        rows: finalRows,
        unitName: unitName || (activeSchoolId === 'MASTER' ? 'Semua Unit' : activeSchoolId),
      });
      addAuditLog('export_data', activeSchoolId, `Ekspor data ${title} ke format dokumen PDF - ${finalHeaders.length} kolom`);
      showToast(`Dokumen PDF ${title} berhasil dicetak/diunduh! (${finalHeaders.length} kolom sesuai izin)`);
    } catch (err) {
      console.error('Export PDF failed:', err);
      showToast('Gagal membuat dokumen PDF. Silakan coba lagi.', 'error');
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.98]"
        title="Ekspor data tabel ke Excel atau PDF"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">Ekspor Data</span>
        <ChevronDown className={`hidden sm:inline w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-52 rounded-2xl shadow-xl bg-white ring-1 ring-black/5 divide-y divide-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2 space-y-1">
            <button
              type="button"
              onClick={handleExportExcel}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-xl transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-left">
                <span className="block font-bold">Ekspor ke Excel</span>
                <span className="text-[10px] text-slate-400 font-normal">Format spreadsheet (.csv/.xlsx)</span>
              </div>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-red-50 hover:text-red-800 rounded-xl transition-colors"
            >
              <FileText className="w-4 h-4 text-red-600 shrink-0" />
              <div className="text-left">
                <span className="block font-bold">Ekspor ke PDF</span>
                <span className="text-[10px] text-slate-400 font-normal">Dokumen cetak (.pdf)</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
