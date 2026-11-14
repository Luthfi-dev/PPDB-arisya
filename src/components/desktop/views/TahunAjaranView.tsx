import React, { useState } from 'react';
import {
  CalendarRange,
  Plus,
  CheckCircle2,
  Calendar,
  Lock,
  Eye,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { AcademicYear } from '../../../types/ppdb';
import { Modal } from '../../common/Modal';
import { hasActionPermission } from '../../../utils/rbac';

export const TahunAjaranView: React.FC = () => {
  const { academicYears, addAcademicYear, activateAcademicYear, currentUser, roles } = usePPDB();

  const canAdd = hasActionPermission(currentUser, 'Tahun Ajaran', 'add', roles);
  const canEdit = hasActionPermission(currentUser, 'Tahun Ajaran', 'edit', roles);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [yearStr, setYearStr] = useState('2027/2028');
  const [startDate, setStartDate] = useState('2027-10-01');
  const [endDate, setEndDate] = useState('2028-02-28');

  const handleCreate = async () => {
    if (!yearStr || !canAdd) return;
    const ok = await addAcademicYear({
      year: yearStr,
      startDate,
      endDate,
    });
    if (ok) {
      setIsAddOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-emerald-600" />
            <span>Manajemen Periode Tahun Ajaran PPDB</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Khusus Super Admin Master Yayasan. Hanya satu tahun ajaran yang boleh berstatus aktif dalam satu waktu.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!canEdit && !canAdd && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">
              <Eye className="w-4 h-4 text-slate-500" />
              <span>Mode Baca (Lihat Saja)</span>
            </div>
          )}

          {canAdd && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Periode Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Tahun Ajaran</th>
                <th className="py-3.5 px-4">Tanggal Pembukaan PPDB</th>
                <th className="py-3.5 px-4">Tanggal Penutupan PPDB</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {academicYears.map((ay, idx) => (
                <tr
                  key={ay.id}
                  className={`hover:bg-emerald-50/30 transition-colors ${
                    idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                  }`}
                >
                  <td className="py-4 px-4 font-bold text-slate-900 font-mono text-sm">
                    {ay.year}
                  </td>

                  <td className="py-4 px-4 font-mono text-slate-600 tabular-nums">
                    {ay.startDate}
                  </td>

                  <td className="py-4 px-4 font-mono text-slate-600 tabular-nums">
                    {ay.endDate}
                  </td>

                  <td className="py-4 px-4">
                    {ay.isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Aktif (Sedang Berjalan)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        Nonaktif
                      </span>
                    )}
                  </td>

                  <td className="py-4 px-4 text-center">
                    {ay.isActive ? (
                      <span className="text-xs text-emerald-700 font-semibold italic">
                        Sedang Aktif
                      </span>
                    ) : canEdit ? (
                      <button
                        onClick={() => activateAcademicYear(ay.id)}
                        className="px-4 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-bold transition-all shadow-xs"
                      >
                        Aktifkan
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        Tidak Ada Akses Ubah
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Tahun Ajaran */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Buka Tahun Ajaran Baru"
        description="Tambahkan periode PPDB baru untuk penerimaan siswa."
        icon={<CalendarRange className="w-6 h-6 text-emerald-600" />}
        confirmLabel="Simpan Tahun Ajaran"
        onConfirm={handleCreate}
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Label Tahun Ajaran *
            </label>
            <input
              type="text"
              value={yearStr}
              onChange={(e) => setYearStr(e.target.value)}
              placeholder="Contoh: 2027/2028"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Tanggal Buka Pendaftaran
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Tanggal Tutup Pendaftaran
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
