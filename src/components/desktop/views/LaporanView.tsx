import React, { useState, useEffect, useRef } from 'react';
import {
  DollarSign,
  Receipt,
  Wallet,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { UnitBadge, PaymentBadge } from '../../common/Badge';
import { ExportDropdown } from '../../common/ExportDropdown';
import {
  ensureCoreNameFieldInSections,
  getActiveAcademicYear,
  getActiveAcademicYearLabel,
  resolveStudentNameFromSchema,
} from '../../../utils/studentFieldResolver';

export const LaporanView: React.FC = () => {
  const { payments, students, formSchemas, units, activeSchoolId, academicYears } = usePPDB();

  const resolvePayStudentName = (p: { registrationId: string; registrationNumber: string; studentName: string }) => {
    const stu = students.find((s) => s.id === p.registrationId || s.registrationNumber === p.registrationNumber);
    if (!stu) return p.studentName;
    const rawSchema = formSchemas.find((fs) => fs.unitId === stu.unit);
    const schema = rawSchema ? { ...rawSchema, sections: ensureCoreNameFieldInSections(rawSchema.sections, rawSchema.unitId) } : undefined;
    return resolveStudentNameFromSchema(stu, schema) || p.studentName;
  };

  const activeAcademicYear = getActiveAcademicYear(academicYears);
  const activeAcademicYearLabel = getActiveAcademicYearLabel(academicYears);
  const currentYear = new Date().getFullYear();

  const [startDate, setStartDate] = useState(
    () => activeAcademicYear?.startDate || `${currentYear}-01-01`
  );
  const [endDate, setEndDate] = useState(
    () => activeAcademicYear?.endDate || `${currentYear}-12-31`
  );
  const hasUserEditedDates = useRef(false);

  useEffect(() => {
    if (hasUserEditedDates.current || !activeAcademicYear) return;
    if (activeAcademicYear.startDate) setStartDate(activeAcademicYear.startDate);
    if (activeAcademicYear.endDate) setEndDate(activeAcademicYear.endDate);
  }, [activeAcademicYear]);

  const [filterUnit, setFilterUnit] = useState<string>(
    activeSchoolId === 'MASTER' ? 'all' : activeSchoolId
  );

  // Filter only 'lunas' payments for financial revenue
  const lunasPayments = payments.filter((p) => {
    if (p.status !== 'lunas') return false;
    if (activeSchoolId !== 'MASTER' && p.unit !== activeSchoolId) return false;
    if (filterUnit !== 'all' && p.unit !== filterUnit) return false;
    // Date filter
    const payDate = p.date.split(' ')[0];
    if (startDate && payDate < startDate) return false;
    if (endDate && payDate > endDate) return false;
    return true;
  });

  const totalRevenue = lunasPayments.reduce((acc, curr) => acc + curr.amount, 0);
  const formulirRevenue = lunasPayments
    .filter((p) => p.type === 'Formulir')
    .reduce((acc, curr) => acc + curr.amount, 0);
  const daftarUlangRevenue = lunasPayments
    .filter((p) => p.type === 'Daftar Ulang')
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Revenue per unit
  const revenuePerUnit = units.map((u) => {
    const amount = payments
      .filter((p) => p.status === 'lunas' && p.unit === u.id)
      .reduce((acc, curr) => acc + curr.amount, 0);
    return {
      unitId: u.id,
      name: u.shortName,
      amount,
    };
  });
  const maxRevenueUnit = Math.max(...revenuePerUnit.map((r) => r.amount), 1);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* 3 Summary Revenue Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Pemasukan Bersih
            </span>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1 font-mono tabular-nums">
              {formatRupiah(totalRevenue)}
            </h3>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1">
              Dari {lunasPayments.length} transaksi lunas
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Penerimaan Biaya Formulir
            </span>
            <h3 className="text-2xl font-extrabold text-teal-700 mt-1 font-mono tabular-nums">
              {formatRupiah(formulirRevenue)}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Registrasi awal pendaftaran online
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Penerimaan Daftar Ulang
            </span>
            <h3 className="text-2xl font-extrabold text-emerald-700 mt-1 font-mono tabular-nums">
              {formatRupiah(daftarUlangRevenue)}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Biaya masuk, seragam, buku & asrama
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Export Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-emerald-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 w-full">
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
            <span className="text-slate-500 font-semibold shrink-0">Periode:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                hasUserEditedDates.current = true;
                setStartDate(e.target.value);
              }}
              className="flex-1 sm:flex-none bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
            />
            <span className="text-slate-400">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                hasUserEditedDates.current = true;
                setEndDate(e.target.value);
              }}
              className="flex-1 sm:flex-none bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
            />
          </div>

          {activeSchoolId === 'MASTER' && (
            <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
              <span className="text-slate-500 font-semibold shrink-0">Unit:</span>
              <select
                value={filterUnit}
                onChange={(e) => setFilterUnit(e.target.value)}
                className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
              >
                <option value="all">Semua Unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.shortName} ({u.id})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <ExportDropdown
          moduleName="Laporan"
          title="Laporan Keuangan & Mutasi Penerimaan Kas PPDB"
          filename="Laporan_Keuangan_PPDB"
          headers={[
            'ID Transaksi',
            'No. Pendaftaran',
            'Nama Siswa',
            'Unit',
            'Jenis Pembayaran',
            'Nominal (Rp)',
            'Status',
            'Tanggal Bayar',
            'Verifikator',
          ]}
          rows={lunasPayments.map((p) => [
            p.id,
            p.registrationNumber,
            resolvePayStudentName(p),
            p.unit,
            p.type,
            p.amount,
            p.status,
            p.date,
            p.verifiedBy || 'Bendahara Yayasan',
          ])}
        />
      </div>

      {/* Bar Chart Pemasukan Per Unit */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-base font-bold text-slate-900">
              Pemasukan Kas PPDB per Unit Sekolah
            </h4>
            <p className="text-xs text-slate-500">
              Distribusi dana penerimaan formulir dan daftar ulang yang telah tervalidasi.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-400 font-mono">
            Tahun Ajaran {activeAcademicYearLabel}
          </span>
        </div>

        <div className="space-y-4 pt-2">
          {revenuePerUnit.map((item) => {
            const pct = Math.round((item.amount / maxRevenueUnit) * 100);
            return (
              <div key={item.unitId} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-800">
                    {item.name} ({item.unitId})
                  </span>
                  <span className="font-mono text-emerald-800 tabular-nums">
                    {formatRupiah(item.amount)}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-[#16a34a] h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(5, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mutasi Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h4 className="text-sm font-bold text-slate-900">
            Rincian Mutasi Pembayaran Masuk
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Tanggal Masuk</th>
                <th className="py-3 px-4">Calon Siswa</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4">Jenis Tagihan</th>
                <th className="py-3 px-4 text-right">Nominal</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Diverifikasi Oleh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lunasPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Tidak ada transaksi lunas pada rentang tanggal yang dipilih.
                  </td>
                </tr>
              ) : (
                lunasPayments.map((p, idx) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-emerald-50/30 transition-colors ${
                      idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                      {p.date}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {resolvePayStudentName(p)}
                      <span className="block text-[10px] text-slate-400 font-mono">
                        {p.registrationNumber}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <UnitBadge unit={p.unit} />
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {p.type}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800 tabular-nums">
                      {formatRupiah(p.amount)}
                    </td>
                    <td className="py-3 px-4">
                      <PaymentBadge status={p.status} />
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {p.verifiedBy || 'Bendahara Yayasan'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
