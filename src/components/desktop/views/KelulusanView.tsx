import React, { useState } from 'react';
import {
  GraduationCap,
  CheckCircle,
  XCircle,
  Award,
  Search,
  Filter,
  Send,
  Eye,
} from 'lucide-react';
import { StatusBadge, UnitBadge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { Pagination } from '../../common/Pagination';
import { StudentRegistration } from '../../../types/ppdb';
import { usePPDB } from '../../../context/PPDBContext';
import { hasActionPermission } from '../../../utils/rbac';
import { ExportDropdown } from '../../common/ExportDropdown';
import {
  ensureCoreNameFieldInSections,
  resolveGuardianSummaryFromSchema,
  resolveStudentNameFromSchema,
} from '../../../utils/studentFieldResolver';
import { PlainNumberInput } from '../../common/FormattedNumberInputs';

export const KelulusanView: React.FC = () => {
  const { students, units, formSchemas, activeSchoolId, setStudentTestResult, currentUser } = usePPDB();

  const getNormalizedSchema = (unitId: string) => {
    const found = formSchemas.find((s) => s.unitId === unitId);
    if (!found) return undefined;
    return {
      ...found,
      sections: ensureCoreNameFieldInSections(found.sections, found.unitId),
    };
  };

  const canEdit = hasActionPermission(currentUser, 'Kelulusan', 'edit');

  const [search, setSearch] = useState('');
  const [filterUnit, setFilterUnit] = useState<string>(
    activeSchoolId === 'MASTER' ? 'all' : activeSchoolId
  );
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [activeStudent, setActiveStudent] = useState<StudentRegistration | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal form state
  const [score, setScore] = useState<number>(85);
  const [resultStatus, setResultStatus] = useState<'lulus' | 'tidak_lulus'>('lulus');
  const [publishAnnounce, setPublishAnnounce] = useState(true);

  // Eligible students: status is 'tes', 'lulus', or 'tidak_lulus'
  const eligibleStudents = students.filter((s: StudentRegistration) => {
    if (activeSchoolId !== 'MASTER' && s.unit !== activeSchoolId) return false;
    if (filterUnit !== 'all' && s.unit !== filterUnit) return false;
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const resolvedName = resolveStudentNameFromSchema(s, getNormalizedSchema(s.unit)).toLowerCase();
      if (
        !resolvedName.includes(q) &&
        !(s.fullName || '').toLowerCase().includes(q) &&
        !(s.registrationNumber || '').toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const paginatedStudents = eligibleStudents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleOpenSetModal = (student: StudentRegistration) => {
    setActiveStudent(student);
    setScore(student.testScore || 80);
    setResultStatus(student.status === 'tidak_lulus' ? 'tidak_lulus' : 'lulus');
    setPublishAnnounce(student.testPublished ?? true);
    setIsModalOpen(true);
  };

  const handleSaveResult = async () => {
    if (!activeStudent) return;
    const ok = await setStudentTestResult(activeStudent.id, score, resultStatus, publishAnnounce);
    if (ok) {
      setIsModalOpen(false);
      setActiveStudent(null);
    }
  };

  const passedCount = eligibleStudents.filter((s: StudentRegistration) => s.status === 'lulus').length;
  const failedCount = eligibleStudents.filter((s: StudentRegistration) => s.status === 'tidak_lulus').length;
  const waitingCount = eligibleStudents.filter((s: StudentRegistration) => s.status === 'tes').length;

  return (
    <div className="space-y-6">
      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Dinyatakan Lulus
            </span>
            <h3 className="text-3xl font-extrabold text-emerald-600 mt-1 tabular-nums">
              {passedCount}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Siswa lolos ambang batas kelulusan
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Menunggu Keputusan
            </span>
            <h3 className="text-3xl font-extrabold text-blue-600 mt-1 tabular-nums">
              {waitingCount}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Selesai tes, belum ada nilai final
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tidak Lulus
            </span>
            <h3 className="text-3xl font-extrabold text-red-600 mt-1 tabular-nums">
              {failedCount}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Belum memenuhi passing grade
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <XCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-emerald-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 w-full">
        <div className="flex-1 w-full relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari siswa atau nomor pendaftaran..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
          >
            <option value="all">Semua Status Hasil</option>
            <option value="lulus">Lulus</option>
            <option value="tidak_lulus">Tidak Lulus</option>
            <option value="tes">Menunggu Nilai</option>
          </select>

          {activeSchoolId === 'MASTER' && (
            <select
              value={filterUnit}
              onChange={(e) => {
                setFilterUnit(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
            >
              <option value="all">Semua Unit</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.shortName} ({u.id})
                </option>
              ))}
            </select>
          )}

          {/* Export Dropdown Button */}
          <ExportDropdown
            moduleName="Kelulusan"
            title="Hasil Penetapan Kelulusan & Nilai Tes Siswa"
            filename="Hasil_Kelulusan_PPDB"
            headers={[
              'No. Pendaftaran',
              'Nama Siswa',
              'Unit',
              'Nama Wali',
              'Nilai Tes (0-100)',
              'Status Hasil',
              'Publikasi',
            ]}
            rows={eligibleStudents.map((s) => {
              const rowSchema = getNormalizedSchema(s.unit);
              const guardian = resolveGuardianSummaryFromSchema(s, rowSchema);
              return [
                s.registrationNumber,
                resolveStudentNameFromSchema(s, rowSchema),
                s.unit,
                guardian.name || '-',
                s.testScore !== undefined ? s.testScore : 'Belum dinilai',
                s.status === 'lulus' ? 'Lulus' : s.status === 'tidak_lulus' ? 'Tidak Lulus' : 'Menunggu Penilaian',
                s.testPublished ? 'Dipublish' : 'Draft',
              ];
            })}
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">No. Pendaftaran</th>
                <th className="py-3.5 px-4">Nama Calon Siswa</th>
                <th className="py-3.5 px-4">Unit</th>
                <th className="py-3.5 px-4">Nilai Tes</th>
                <th className="py-3.5 px-4">Status Hasil</th>
                <th className="py-3.5 px-4">Publikasi</th>
                <th className="py-3.5 px-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {eligibleStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Belum ada pendaftar pada tahap tes kelulusan.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student: StudentRegistration, idx: number) => {
                  const rowSchema = getNormalizedSchema(student.unit);
                  const rowName = resolveStudentNameFromSchema(student, rowSchema);
                  const guardian = resolveGuardianSummaryFromSchema(student, rowSchema);
                  return (
                  <tr
                    key={student.id}
                    className={`hover:bg-emerald-50/30 transition-colors ${
                      idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                      {student.registrationNumber}
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {rowName}
                      {guardian.name && (
                        <div className="text-[11px] text-slate-400 font-normal">
                          Wali: {guardian.name}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <UnitBadge unit={student.unit} />
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800 tabular-nums">
                      {student.testScore !== undefined ? (
                        <span
                          className={`text-sm ${
                            student.testScore >= 75
                              ? 'text-emerald-600'
                              : 'text-red-600'
                          }`}
                        >
                          {student.testScore} / 100
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal italic">
                          Belum dinilai
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {student.status === 'lulus' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Lulus</span>
                        </span>
                      ) : student.status === 'tidak_lulus' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Tidak Lulus</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          Menunggu Penilaian
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {student.testPublished ? (
                        <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                          <Send className="w-3 h-3" /> Dipublish
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Draft
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {canEdit ? (
                        <button
                          onClick={() => handleOpenSetModal(student)}
                          className="px-3.5 py-1.5 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.98]"
                        >
                          Set Lulus / Nilai
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-[11px] font-semibold">
                          Lihat-Saja
                        </span>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Responsive Pagination Component */}
        <Pagination
          currentPage={currentPage}
          totalItems={eligibleStudents.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>

      {/* Modal Set Lulus */}
      {activeStudent && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Penetapan Kelulusan: ${resolveStudentNameFromSchema(activeStudent, getNormalizedSchema(activeStudent.unit))}`}
          description={`Nomor Pendaftaran: ${activeStudent.registrationNumber} · Unit ${activeStudent.unit}`}
          icon={<GraduationCap className="w-6 h-6 text-emerald-600" />}
          confirmLabel="Simpan Keputusan"
          onConfirm={handleSaveResult}
        >
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Keputusan Hasil Seleksi *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setResultStatus('lulus')}
                  className={`py-3 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    resultStatus === 'lulus'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/30'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Dinyatakan LULUS</span>
                </button>

                <button
                  type="button"
                  onClick={() => setResultStatus('tidak_lulus')}
                  className={`py-3 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    resultStatus === 'tidak_lulus'
                      ? 'bg-red-50 border-red-500 text-red-800 ring-2 ring-red-500/30'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span>TIDAK LULUS</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nilai Akhir Tes (Skala 0 - 100) *
              </label>
              <PlainNumberInput
                max={100}
                value={score}
                onChange={(val) => setScore(val)}
                placeholder="0 - 100"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Standar kelulusan rata-rata (passing grade) Yayasan Ar-Risalah adalah 75.
              </p>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={publishAnnounce}
                  onChange={(e) => setPublishAnnounce(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-800">
                  Publish pengumuman ini secara langsung ke akun wali siswa
                </span>
              </label>
              <p className="text-[11px] text-slate-500 ml-6 mt-0.5">
                Bila dicentang, wali siswa dapat langsung melihat Surat Keputusan Kelulusan dan tagihan Daftar Ulang di aplikasi HP.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
