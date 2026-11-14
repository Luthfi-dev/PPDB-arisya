import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  CalendarCheck,
  TrendingUp,
  UserPlus,
  CheckSquare,
  ArrowUpRight,
  School,
  QrCode,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { StatusBadge, UnitBadge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { canManageUnitQr } from '../../../utils/rbac';
import {
  ensureCoreNameFieldInSections,
  getActiveAcademicYearLabel,
  getLockedNameFieldFromSchema,
  resolveStudentNameFromSchema,
} from '../../../utils/studentFieldResolver';

export const DashboardView: React.FC = () => {
  const {
    students,
    units,
    formSchemas,
    academicYears,
    activeSchoolId,
    setDesktopActiveMenu,
    addStudent,
    showToast,
    currentUser,
    roles,
  } = usePPDB();

  const getNormalizedSchema = (unitId: string) => {
    const found = formSchemas.find((s) => s.unitId === unitId);
    if (!found) return undefined;
    return {
      ...found,
      sections: ensureCoreNameFieldInSections(found.sections, found.unitId),
    };
  };

  const defaultUnitId = activeSchoolId !== 'MASTER' ? activeSchoolId : (units[0]?.id || 'TK01');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string>(defaultUnitId);
  const [dynamicValues, setDynamicValues] = useState<Record<string, any>>({});
  const [dynamicDocuments, setDynamicDocuments] = useState<Record<string, string>>({});

  // Filter students based on activeSchoolId
  const filteredStudents = students.filter((s) =>
    activeSchoolId === 'MASTER' ? true : s.unit === activeSchoolId
  );

  const grandTotalQuota = units.reduce((acc, u) => acc + u.totalQuota, 0);
  const grandTotalFilled = units.reduce((acc, u) => acc + u.filledQuota, 0);

  const activeAddSchema = getNormalizedSchema(selectedUnit);
  const lockedNameField = getLockedNameFieldFromSchema(activeAddSchema);
  const resolvedFullName = String(dynamicValues[lockedNameField?.id || 'fullName'] || '').trim();

  const handleQuickFileChange = (fieldId: string, file?: File) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      showToast('Format berkas harus JPG, PNG, WEBP, atau PDF.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran berkas maksimal 5MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      if (!result) return;
      setDynamicDocuments((prev) => ({ ...prev, [fieldId]: result }));
      setDynamicValues((prev) => ({ ...prev, [fieldId]: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleCreateStudent = async () => {
    if (!resolvedFullName) {
      showToast(`${lockedNameField?.label || 'Nama Lengkap Calon Siswa'} wajib diisi.`, 'error');
      return;
    }

    if (activeAddSchema) {
      for (const sec of activeAddSchema.sections) {
        for (const f of sec.fields) {
          if (!f.required) continue;
          const val = f.type === 'file' ? dynamicDocuments[f.id] || dynamicValues[f.id] : dynamicValues[f.id];
          if (!val || String(val).trim() === '') {
            showToast(`Kolom wajib "${f.label}" harus diisi.`, 'error');
            return;
          }
        }
      }
    }

    let nisn = '';
    let gender: 'Laki-laki' | 'Perempuan' = 'Laki-laki';
    let birthPlace = '';
    let birthDate = '';
    let address = '';
    let parentName = '';
    let parentPhone = '';
    let parentJob = '';
    let parentIncome = '';
    let schoolOrigin = '';

    if (activeAddSchema) {
      for (const sec of activeAddSchema.sections) {
        for (const f of sec.fields) {
          if (f.type === 'file') continue;
          const val = String(dynamicValues[f.id] || '').trim();
          if (!val) continue;
          const l = (f.label || '').toLowerCase();
          const fid = (f.id || '').toLowerCase();
          if (/nisn/.test(l) || /nisn/.test(fid)) nisn = val.replace(/\D/g, '');
          else if (/jenis.?kelamin/.test(l) || /gender/.test(fid)) gender = val === 'Perempuan' ? 'Perempuan' : 'Laki-laki';
          else if (/tempat.?lahir/.test(l) || /birthplace/.test(fid)) birthPlace = val;
          else if (/tanggal.?lahir/.test(l) || /birthdate/.test(fid)) birthDate = val;
          else if (/alamat/.test(l) || /address/.test(fid)) address = val;
          else if (/nama.?orang.?tua|nama.?wali|nama.?ayah/.test(l) || /parentname/.test(fid)) parentName = val;
          else if (/whatsapp|nomor.?hp|no\.?\s*hp|telepon/.test(l) || /parentphone|phone/.test(fid)) parentPhone = val;
          else if (/pekerjaan/.test(l) || /parentjob/.test(fid)) parentJob = val;
          else if (/penghasilan/.test(l) || /parentincome/.test(fid)) parentIncome = val;
          else if (/tk.?asal|paud|sekolah.?asal|asal.?sekolah|nama.?sekolah/.test(l) || /schoolorigin|tkorigin/.test(fid)) schoolOrigin = val;
        }
      }
    }

    try {
      await addStudent({
        fullName: resolvedFullName,
        nisn,
        unit: selectedUnit,
        gender,
        birthPlace,
        birthDate,
        address,
        parentName,
        parentPhone,
        parentJob,
        parentIncome,
        schoolOrigin: schoolOrigin || undefined,
        documents: dynamicDocuments,
        dynamicAnswers: {
          ...dynamicValues,
          [lockedNameField?.id || 'fullName']: resolvedFullName,
        },
      });
      setIsAddModalOpen(false);
      setSelectedUnit(defaultUnitId);
      setDynamicValues({});
      setDynamicDocuments({});
    } catch (e) {
      // Error toast already shown by addStudent; keep modal open
    }
  };

  // Recent 6 registrations
  const recentStudents = [...filteredStudents].slice(0, 6);

  // Real 7-day registration trend calculated directly from student registration dates
  const daysOfWeek = ['Aha', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const sortedStudents = [...filteredStudents].sort(
    (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
  );

  const latestDateStr =
    sortedStudents.length > 0 && sortedStudents[0].registeredAt
      ? sortedStudents[0].registeredAt.split(' ')[0]
      : new Date().toISOString().slice(0, 10);

  const refDate = new Date(latestDateStr);
  if (isNaN(refDate.getTime())) refDate.setTime(Date.now());

  const trendDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(refDate);
    d.setDate(refDate.getDate() - (6 - i));

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dayNum = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayNum}`;

    const count = filteredStudents.filter(
      (s) => s.registeredAt && s.registeredAt.startsWith(dateStr)
    ).length;
    const dayName = daysOfWeek[d.getDay()];

    return {
      day: dayName,
      dateFormatted: `${dayNum}/${month}`,
      count,
      dateStr,
    };
  });

  const maxTrend = Math.max(...trendDays.map((d) => d.count), 1);
  const totalPeriodStudents = trendDays.reduce((acc, d) => acc + d.count, 0);
  const avgPerDay = (totalPeriodStudents / 7).toFixed(1);

  const verifiedPeriodCount = filteredStudents.filter(
    (s) => s.status === 'tes' || s.status === 'lulus' || s.status === 'terdaftar'
  ).length;
  const conversionRate =
    filteredStudents.length > 0
      ? Math.round((verifiedPeriodCount / filteredStudents.length) * 100)
      : 0;

  const currentUnit = units.find((u) => u.id === activeSchoolId);
  const unitStudents = students.filter((s) => s.unit === activeSchoolId);
  const unitFilled = currentUnit?.filledQuota || unitStudents.length;
  const unitQuota = currentUnit?.totalQuota || 150;
  const unitRemaining = Math.max(0, unitQuota - unitFilled);

  const unitVerified = unitStudents.filter((s) => s.status === 'tes' || s.status === 'lulus' || s.status === 'terdaftar').length;
  const unitLulus = unitStudents.filter((s) => s.status === 'lulus' || s.status === 'terdaftar').length;

  return (
    <div className="space-y-6">
      {/* Stat Cards Row - Master vs Unit Scoped */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${activeSchoolId === 'MASTER' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
        {activeSchoolId === 'MASTER' ? (
          <>
            {/* Total Pendaftar Master */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Pendaftar
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#16a34a] flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {grandTotalFilled}
                </h3>
                <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Target {grandTotalQuota.toLocaleString('id-ID')} Siswa Baru</span>
                </p>
              </div>
            </div>

            {units.map((u, idx) => {
              const uTotal = u.totalQuota || 100;
              const uFilled = u.filledQuota ?? students.filter((s) => s.unit === u.id).length;
              const uRemaining = Math.max(0, uTotal - uFilled);
              const colorPairs = [
                { badge: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' },
                { badge: 'bg-teal-50 text-teal-600', bar: 'bg-teal-500' },
                { badge: 'bg-sky-50 text-sky-600', bar: 'bg-sky-500' },
                { badge: 'bg-indigo-50 text-indigo-600', bar: 'bg-indigo-500' },
                { badge: 'bg-violet-50 text-violet-600', bar: 'bg-violet-500' },
                { badge: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500' },
              ];
              const colorPair = colorPairs[idx % colorPairs.length];
              const badgeColor = colorPair.badge;
              const barColor = colorPair.bar;

              return (
                <div
                  key={u.id}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
                      {u.shortName} ({u.id})
                    </span>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${badgeColor}`}>
                      <School className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <h3 className="text-3xl font-extrabold text-slate-900 tabular-nums">
                      {uFilled}
                    </h3>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
                      <div
                        className={`${barColor} h-full rounded-full`}
                        style={{ width: `${Math.min(100, (uFilled / uTotal) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 tabular-nums">
                      Kuota {uTotal} · Sisa {uRemaining} kursi
                    </p>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <>
            {/* Scoped Unit Total Pendaftar */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Pendaftar {currentUnit?.name || activeSchoolId}
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#16a34a] flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {unitFilled}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Pendaftar aktif di unit ini
                </p>
              </div>
            </div>

            {/* Scoped Unit Kuota */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Kuota Kursi Unit
                </span>
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <School className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {unitQuota}
                </h3>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
                  <div
                    className="bg-teal-500 h-full rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        (unitFilled / unitQuota) * 100
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 tabular-nums">
                  Terisi {unitFilled} · Sisa {unitRemaining} kursi
                </p>
              </div>
            </div>

            {/* Scoped Unit Verifikasi */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Berkas Terverifikasi
                </span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {unitVerified}
                </h3>
                <p className="text-xs text-blue-600 font-semibold mt-1">
                  Siap untuk Tahap Tes Seleksi
                </p>
              </div>
            </div>

            {/* Scoped Unit Lulus */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Siswa Diterima (Lulus)
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {unitLulus}
                </h3>
                <p className="text-xs text-amber-600 font-semibold mt-1">
                  Tahap Daftar Ulang
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Action Toolbar Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-emerald-100">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-xs font-semibold text-slate-700">
            Pendaftaran Tahun Ajaran {getActiveAcademicYearLabel(academicYears)} ({units.filter((u) => u.isOpen !== false).length}/{units.length} Unit Dibuka)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canManageUnitQr(currentUser, roles) && (
            <button
              onClick={() => setDesktopActiveMenu('qr_pendaftaran')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span>QR Code Pendaftaran{activeSchoolId !== 'MASTER' ? ` (${activeSchoolId})` : ''}</span>
            </button>
          )}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Pendaftar</span>
          </button>
          <button
            onClick={() => setDesktopActiveMenu('verifikasi')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#14532d] text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer"
          >
            <CheckSquare className="w-4 h-4 text-emerald-600" />
            <span>Verifikasi Hari Ini</span>
          </button>
        </div>
      </div>

      {/* 2-Column Split: Trend Chart & Latest Applicants */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trend Bar/Line Visual */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-base font-bold text-slate-900">
                Tren Pendaftar Harian
              </h4>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                7 Hari Terakhir
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Grafik rata-rata registrasi online siswa baru per hari.
            </p>
          </div>

          <div className="h-48 flex items-end justify-between gap-2.5 pt-8 pb-2">
            {trendDays.map((item, index) => {
              const heightPct = item.count > 0 ? Math.max(12, (item.count / maxTrend) * 100) : 4;
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <span className="text-[10px] font-bold text-emerald-800 tabular-nums">
                    {item.count}
                  </span>
                  <div className="w-full bg-emerald-50/80 rounded-xl flex items-end h-28 p-1 overflow-hidden">
                    <div
                      className={`w-full rounded-lg transition-all duration-300 ${
                        item.count > 0
                          ? 'bg-[#16a34a] group-hover:bg-emerald-700'
                          : 'bg-emerald-200/50'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-bold text-slate-700 block">
                      {item.day}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {item.dateFormatted}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Rata-rata: <strong className="text-slate-800">{avgPerDay}</strong> siswa/hari</span>
            <span className="font-semibold text-emerald-700">Tingkat Verifikasi: <strong>{conversionRate}%</strong></span>
          </div>
        </div>

        {/* List Pendaftar Terbaru */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-emerald-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-base font-bold text-slate-900">
                Pendaftar Terbaru
              </h4>
              <p className="text-xs text-slate-500">
                Pendaftar online yang baru masuk ke sistem.
              </p>
            </div>
            <button
              onClick={() => setDesktopActiveMenu('pendaftar')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors"
            >
              Lihat Semua →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Nama Anak</th>
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {recentStudents.map((student) => {
                  const rowSchema = getNormalizedSchema(student.unit);
                  const displayName = resolveStudentNameFromSchema(student, rowSchema);
                  return (
                  <tr key={student.id} className="hover:bg-emerald-50/40 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800">
                        {displayName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {student.registrationNumber}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <UnitBadge unit={student.unit} />
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={student.status} />
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[11px] text-slate-500 tabular-nums">
                      {student.registeredAt.split(' ')[0]}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Quick Tambah Pendaftar (Dinamis Form Builder) */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Tambah Calon Siswa Baru"
        description="Input formulir pendaftaran siswa baru secara dinamis mengikuti Form Builder unit."
        icon={<UserPlus className="w-6 h-6" />}
        maxWidth="2xl"
        confirmLabel="Simpan Pendaftar"
        onConfirm={handleCreateStudent}
        confirmDisabled={!resolvedFullName}
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Pilihan Unit Sekolah *
            </label>
            <select
              value={selectedUnit}
              onChange={(e) => {
                setSelectedUnit(e.target.value);
                setDynamicValues({});
                setDynamicDocuments({});
              }}
              disabled={activeSchoolId !== 'MASTER'}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white disabled:opacity-70"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.id})
                </option>
              ))}
            </select>
          </div>

          {activeAddSchema ? (
            <div className="space-y-4">
              {activeAddSchema.sections.map((sec) => (
                <div key={sec.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div>
                    <h5 className="text-xs font-bold text-emerald-950">{sec.title}</h5>
                    {sec.description && <p className="text-[11px] text-slate-500">{sec.description}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sec.fields.map((field) => {
                      const val = dynamicValues[field.id] ?? '';
                      return (
                        <div key={field.id} className={field.type === 'textarea' || field.type === 'file' ? 'sm:col-span-2' : ''}>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            {field.label} {field.required && <span className="text-rose-500">*</span>}
                          </label>
                          {field.type === 'dropdown' ? (
                            <select
                              value={String(val)}
                              onChange={(e) => setDynamicValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                            >
                              <option value="">-- Pilih {field.label} --</option>
                              {(field.options || []).map((opt, oIdx) => (
                                <option key={oIdx} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : field.type === 'textarea' ? (
                            <textarea
                              rows={2}
                              value={String(val)}
                              onChange={(e) => setDynamicValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                              placeholder={field.helpText || `Isi ${field.label}`}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                            />
                          ) : field.type === 'file' ? (
                            <div className="p-2.5 rounded-xl bg-white border border-dashed border-slate-300 space-y-1.5">
                              {dynamicDocuments[field.id] && (
                                <p className="text-[11px] font-semibold text-emerald-700">Berkas siap diunggah</p>
                              )}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                onChange={(e) => handleQuickFileChange(field.id, e.target.files?.[0])}
                                className="w-full text-[11px] text-slate-600"
                              />
                            </div>
                          ) : (
                            <input
                              type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                              value={String(val)}
                              onChange={(e) => setDynamicValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                              placeholder={field.helpText || `Masukkan ${field.label}`}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nama Lengkap Calon Siswa *
              </label>
              <input
                type="text"
                value={String(dynamicValues.fullName || '')}
                onChange={(e) => setDynamicValues((prev) => ({ ...prev, fullName: e.target.value }))}
                placeholder="Masukkan nama lengkap calon siswa"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
