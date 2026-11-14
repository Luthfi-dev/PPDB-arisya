import React, { useState } from 'react';
import {
  CheckSquare,
  XCircle,
  CheckCircle2,
  Search,
  AlertCircle,
  FileText,
  Eye,
  Info,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { UnitBadge, StatusBadge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { Pagination } from '../../common/Pagination';
import { StudentRegistration, UnitFormSchema } from '../../../types/ppdb';
import { hasActionPermission } from '../../../utils/rbac';
import { ExportDropdown } from '../../common/ExportDropdown';
import {
  ensureCoreNameFieldInSections,
  formatCardFieldDisplayValue,
  getLockedNameFieldFromSchema,
  getSchemaNonFileFields,
  isPdfDocumentUrl,
  isUploadedDocumentValue,
  resolveFormFieldValue,
  resolveGuardianSummaryFromSchema,
  resolveStudentNameFromSchema,
  resolveVerificationDocumentsForStudent,
} from '../../../utils/studentFieldResolver';

export const VerifikasiView: React.FC = () => {
  const { students, units, formSchemas, activeSchoolId, verifyStudentDocument, currentUser } = usePPDB();

  const canVerify = hasActionPermission(currentUser, 'Verifikasi', 'verify');

  const [search, setSearch] = useState('');
  const [filterUnit, setFilterUnit] = useState<string>(
    activeSchoolId === 'MASTER' ? 'all' : activeSchoolId
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeStudentForAction, setActiveStudentForAction] = useState<StudentRegistration | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');
  const [detailStudent, setDetailStudent] = useState<StudentRegistration | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const getNormalizedSchema = (unitId: string): UnitFormSchema | undefined => {
    const found = formSchemas.find((s) => s.unitId === unitId);
    if (!found) return undefined;
    return {
      ...found,
      sections: ensureCoreNameFieldInSections(found.sections, found.unitId),
    };
  };

  const effectiveUnitFilter = activeSchoolId !== 'MASTER' ? activeSchoolId : filterUnit;
  const activeUnitSchema =
    effectiveUnitFilter !== 'all'
      ? getNormalizedSchema(effectiveUnitFilter)
      : units.length === 1
      ? getNormalizedSchema(units[0].id)
      : undefined;

  const query = search.toLowerCase().trim();

  // Filter students with status === 'verifikasi'
  const verificationList = students.filter((s) => {
    if (s.status !== 'verifikasi') return false;
    if (activeSchoolId !== 'MASTER' && s.unit !== activeSchoolId) return false;
    if (filterUnit !== 'all' && s.unit !== filterUnit) return false;
    if (query) {
      const schema = getNormalizedSchema(s.unit);
      const resolvedName = resolveStudentNameFromSchema(s, schema).toLowerCase();
      const guardian = resolveGuardianSummaryFromSchema(s, schema);
      const dynamicMatch = s.dynamicAnswers
        ? Object.values(s.dynamicAnswers).some((val) => {
            if (typeof val !== 'string' || val.startsWith('data:')) return false;
            return val.toLowerCase().includes(query);
          })
        : false;
      if (
        !resolvedName.includes(query) &&
        !(s.fullName || '').toLowerCase().includes(query) &&
        !(s.registrationNumber || '').toLowerCase().includes(query) &&
        !(guardian.name || '').toLowerCase().includes(query) &&
        !(guardian.phone || '').toLowerCase().includes(query) &&
        !dynamicMatch
      ) {
        return false;
      }
    }
    return true;
  });

  const paginatedList = verificationList.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(verificationList.map((s) => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBatchApprove = async () => {
    const remaining: string[] = [];
    for (const id of selectedIds) {
      const ok = await verifyStudentDocument(id, true, 'Verifikasi data & berkas batch disetujui.');
      if (!ok) remaining.push(id);
    }
    setSelectedIds(remaining);
  };

  const handleSingleApprove = async (student: StudentRegistration) => {
    const ok = await verifyStudentDocument(student.id, true, 'Data formulir & berkas persyaratan lengkap dan valid.');
    if (ok && detailStudent?.id === student.id) {
      setDetailStudent(null);
    }
  };

  const handleOpenReject = (student: StudentRegistration) => {
    setActiveStudentForAction(student);
    setRejectionNote('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!activeStudentForAction) return;
    const ok = await verifyStudentDocument(
      activeStudentForAction.id,
      false,
      rejectionNote || 'Data atau berkas persyaratan belum memenuhi ketentuan unit sekolah.'
    );
    if (ok) {
      setRejectModalOpen(false);
      if (detailStudent?.id === activeStudentForAction.id) {
        setDetailStudent(null);
      }
      setActiveStudentForAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Batch Actions */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 w-full">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Antrean Verifikasi Data &amp; Berkas (Dinamis Form Builder)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Terdapat <span className="font-bold text-emerald-700">{verificationList.length} pendaftar</span> yang menunggu pemeriksaan formulir dan berkas sesuai Form Builder unit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canVerify && selectedIds.length > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 animate-in fade-in w-full sm:w-auto">
              <span className="text-xs text-slate-600 font-semibold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-center">
                {selectedIds.length} terpilih
              </span>
              <button
                onClick={handleBatchApprove}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Approve Semua Terpilih
              </button>
            </div>
          )}

          {(() => {
            const activeUnitNonFileFields = activeUnitSchema
              ? getSchemaNonFileFields(activeUnitSchema, { excludeLockedName: true })
              : [];
            const activeUnitFileFields = activeUnitSchema
              ? resolveVerificationDocumentsForStudent({} as StudentRegistration, activeUnitSchema).schemaFileSlots
              : [];

            const exportHeaders = activeUnitSchema
              ? [
                  'No',
                  'No. Registrasi',
                  getLockedNameFieldFromSchema(activeUnitSchema)?.label || 'Nama Lengkap',
                  'Unit',
                  ...activeUnitNonFileFields.map((f) => f.label),
                  ...activeUnitFileFields.map((f) => f.label),
                  'Tanggal Daftar',
                  'Status Verifikasi',
                  'Catatan Verifikator',
                ]
              : [
                  'No',
                  'No. Registrasi',
                  'Nama Lengkap',
                  'Unit',
                  'Data Isian & Berkas Form Builder',
                  'Tanggal Daftar',
                  'Status Verifikasi',
                  'Catatan Verifikator',
                ];

            const exportRows = verificationList.map((s, idx) => {
              const schema = getNormalizedSchema(s.unit);
              const resolvedName = resolveStudentNameFromSchema(s, schema);
              const { allSlots } = resolveVerificationDocumentsForStudent(s, schema);

              if (activeUnitSchema) {
                return [
                  idx + 1,
                  s.registrationNumber,
                  resolvedName,
                  s.unit,
                  ...activeUnitNonFileFields.map((f) =>
                    formatCardFieldDisplayValue(resolveFormFieldValue(s, f), f)
                  ),
                  ...activeUnitFileFields.map((slot) => {
                    const match = allSlots.find((a) => a.key === slot.key);
                    return match?.url ? 'Terunggah' : 'Kosong';
                  }),
                  s.registeredAt,
                  'Menunggu Verifikasi',
                  s.verificationNotes || '-',
                ];
              }

              const rowNonFile = getSchemaNonFileFields(schema, { excludeLockedName: true });
              const answersText = rowNonFile
                .map((f) => `${f.label}: ${formatCardFieldDisplayValue(resolveFormFieldValue(s, f), f)}`)
                .join(' | ');
              const docsText =
                allSlots.length > 0
                  ? allSlots.map((slot) => `${slot.label}: ${slot.url ? 'Ada' : 'Kosong'}`).join(', ')
                  : '';
              const combinedSummary = [answersText, docsText].filter(Boolean).join(' || ') || '-';

              return [
                idx + 1,
                s.registrationNumber,
                resolvedName,
                s.unit,
                combinedSummary,
                s.registeredAt,
                'Menunggu Verifikasi',
                s.verificationNotes || '-',
              ];
            });

            return (
              <ExportDropdown
                moduleName="Verifikasi"
                title="Daftar Antrean Verifikasi Calon Siswa"
                filename="Antrean_Verifikasi_PPDB"
                headers={exportHeaders}
                rows={exportRows}
              />
            );
          })()}
        </div>
      </div>

      {/* Search & Unit Filter Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-emerald-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
        <div className="flex-1 w-full relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari nama siswa, no pendaftaran, atau jawaban formulir..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white transition-all"
          />
        </div>

        {activeSchoolId === 'MASTER' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium hidden sm:inline">Unit:</span>
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
          </div>
        )}
      </div>

      {/* Main List */}
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
        {verificationList.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800">
              {search || filterUnit !== 'all'
                ? 'Tidak Ada Antrean Verifikasi yang Cocok'
                : 'Semua Pendaftar Sudah Terverifikasi!'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {search || filterUnit !== 'all'
                ? 'Coba ubah kata kunci pencarian atau filter unit sekolah.'
                : 'Tidak ada antrean pendaftar yang menunggu verifikasi saat ini.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.length === verificationList.length &&
                        verificationList.length > 0
                      }
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Calon Siswa</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4">Berkas &amp; Isian Form Builder</th>
                  <th className="py-3 px-4">Waktu Daftar</th>
                  <th className="py-3 px-4 text-center">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedList.map((student) => {
                  const isChecked = selectedIds.includes(student.id);
                  const rowSchema = getNormalizedSchema(student.unit);
                  const displayName = resolveStudentNameFromSchema(student, rowSchema);
                  const guardian = resolveGuardianSummaryFromSchema(student, rowSchema);
                  const rowNonFileFields = getSchemaNonFileFields(rowSchema, { excludeLockedName: true });
                  const { allSlots } = resolveVerificationDocumentsForStudent(student, rowSchema);

                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-emerald-50/30 transition-colors ${
                        isChecked ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      <td className="py-4 px-4">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelect(student.id)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">{displayName}</span>
                          {student.isOffline && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Offline
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {student.registrationNumber}
                        </div>
                        {(guardian.name || guardian.phone) && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {guardian.name || 'Wali'} {guardian.phone ? `(${guardian.phone})` : ''}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <UnitBadge unit={student.unit} />
                      </td>

                      <td className="py-4 px-4">
                        <div className="space-y-2 max-w-[360px]">
                          {rowNonFileFields.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {rowNonFileFields.slice(0, 4).map((f) => {
                                const val = formatCardFieldDisplayValue(
                                  resolveFormFieldValue(student, f),
                                  f
                                );
                                return (
                                  <div
                                    key={f.id}
                                    className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] truncate"
                                    title={`${f.label}: ${val}`}
                                  >
                                    <span className="text-slate-400 font-medium">{f.label}: </span>
                                    <span className={val === '-' ? 'text-slate-400 italic' : 'text-slate-800 font-semibold'}>
                                      {val}
                                    </span>
                                  </div>
                                );
                              })}
                              {rowNonFileFields.length > 4 && (
                                <span className="text-[10px] text-emerald-700 font-semibold col-span-full">
                                  +{rowNonFileFields.length - 4} kolom formulir lainnya (klik Detail)
                                </span>
                              )}
                            </div>
                          )}

                          {allSlots.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                              {allSlots.map((docSlot) =>
                                docSlot.url ? (
                                  <button
                                    type="button"
                                    key={docSlot.key}
                                    onClick={() => setZoomImage(docSlot.url)}
                                    className="w-16 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer relative group flex items-center justify-center shrink-0"
                                    title={`Pratinjau ${docSlot.label}`}
                                  >
                                    {isPdfDocumentUrl(docSlot.url) ? (
                                      <FileText className="w-5 h-5 text-rose-600" />
                                    ) : (
                                      <img
                                        src={docSlot.url}
                                        alt={docSlot.label}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                      />
                                    )}
                                    <span className="absolute bottom-0 inset-x-0 bg-black/65 px-1 py-0.5 text-[8px] text-white text-center font-bold truncate">
                                      {docSlot.label}
                                    </span>
                                  </button>
                                ) : (
                                  <div
                                    key={docSlot.key}
                                    className="w-16 h-14 px-1 rounded-lg bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center justify-center text-[8px] text-slate-500 shrink-0 text-center"
                                    title={`${docSlot.label} belum diunggah`}
                                  >
                                    <span className="font-bold line-clamp-2 leading-tight">{docSlot.label}</span>
                                    <span className="text-amber-600 font-semibold mt-0.5">Kosong</span>
                                  </div>
                                )
                              )}
                            </div>
                          )}

                          {rowNonFileFields.length === 0 && allSlots.length === 0 && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
                              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Hanya kolom nama utama di Form Builder unit ini</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-slate-500 font-mono text-[11px] tabular-nums">
                        {student.registeredAt}
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailStudent(student)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition-colors cursor-pointer"
                            title="Lihat Seluruh Isian Form Builder & Berkas"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </button>

                          {canVerify ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSingleApprove(student)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenReject(student)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs border border-red-200 transition-colors cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </>
                          ) : (
                            <span className="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-[11px] font-semibold">
                              Lihat-Saja
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalItems={verificationList.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>

      {/* Modal Detail Formulir & Berkas (Dinamis Sesuai Form Builder) */}
      {detailStudent && (() => {
        const detailSchema = getNormalizedSchema(detailStudent.unit);
        const detailName = resolveStudentNameFromSchema(detailStudent, detailSchema);
        const { uploadedSlots } = resolveVerificationDocumentsForStudent(detailStudent, detailSchema);

        const knownFieldIds = new Set<string>();
        const knownFieldLabelsLower = new Set<string>();
        if (detailSchema && Array.isArray(detailSchema.sections)) {
          detailSchema.sections.forEach((sec) => {
            (sec.fields || []).forEach((f) => {
              knownFieldIds.add(f.id);
              if (f.label) knownFieldLabelsLower.add(f.label.trim().toLowerCase());
            });
          });
        }

        const nonFileSections = (detailSchema?.sections || [])
          .map((sec) => ({
            ...sec,
            nonFileFields: (sec.fields || []).filter((f) => f.type !== 'file'),
          }))
          .filter((sec) => sec.nonFileFields.length > 0);

        const extraNonFileEntries = Object.entries(detailStudent.dynamicAnswers || {}).filter(([k, v]) => {
          if (knownFieldIds.has(k) || knownFieldLabelsLower.has(k.trim().toLowerCase())) return false;
          if (v === undefined || v === null || typeof v === 'object') return false;
          const strVal = String(v).trim();
          if (!strVal || isUploadedDocumentValue(strVal)) return false;
          return true;
        });

        return (
          <Modal
            isOpen={Boolean(detailStudent)}
            onClose={() => setDetailStudent(null)}
            title={`Verifikasi Detail: ${detailName}`}
            description={`Nomor Pendaftaran: ${detailStudent.registrationNumber} · Unit ${detailStudent.unit}`}
            maxWidth="3xl"
            hideFooter
          >
            <div className="space-y-5 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/70 text-xs">
                <div>
                  <p className="text-slate-400 font-semibold uppercase text-[10px]">No. Pendaftaran</p>
                  <p className="font-mono font-bold text-slate-900 mt-0.5">{detailStudent.registrationNumber}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-semibold uppercase text-[10px]">
                    {getLockedNameFieldFromSchema(detailSchema)?.label || 'Nama Calon Siswa'}
                  </p>
                  <p className="font-bold text-slate-900 mt-0.5">{detailName}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-semibold uppercase text-[10px]">Unit Sekolah</p>
                  <div className="mt-1">
                    <UnitBadge unit={detailStudent.unit} />
                  </div>
                </div>
                <div>
                  <p className="text-slate-400 font-semibold uppercase text-[10px]">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={detailStudent.status} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  Data Formulir Pendaftaran (Sesuai Form Builder Unit {detailStudent.unit})
                </h4>

                {nonFileSections.length > 0 ? (
                  <div className="space-y-3">
                    {nonFileSections.map((sec) => (
                      <div key={sec.id} className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-2.5">
                        <div>
                          <h6 className="text-xs font-extrabold text-emerald-950">{sec.title}</h6>
                          {sec.description && (
                            <p className="text-[11px] text-slate-500 mt-0.5">{sec.description}</p>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                          {sec.nonFileFields.map((f) => {
                            const rawVal = resolveFormFieldValue(detailStudent, f);
                            const displayVal = formatCardFieldDisplayValue(rawVal, f);
                            return (
                              <div key={f.id} className="p-2.5 rounded-xl bg-white border border-emerald-100">
                                <span className="text-slate-500 block text-[11px] font-semibold">
                                  {f.label}
                                </span>
                                <span
                                  className={`mt-0.5 block break-words ${
                                    displayVal === '-' ? 'text-slate-400 italic' : 'font-bold text-slate-900'
                                  }`}
                                >
                                  {displayVal}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    Belum ada seksi pertanyaan non-file pada Form Builder unit {detailStudent.unit}.
                  </div>
                )}

                {extraNonFileEntries.length > 0 && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                      Data Tambahan Formulir
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {extraNonFileEntries.map(([k, v]) => (
                        <div key={k} className="p-2.5 rounded-xl bg-white border border-slate-200">
                          <span className="text-slate-500 block text-[11px] font-semibold">{k}:</span>
                          <span className="font-bold text-slate-900 break-words">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Hanya tampil jika ada dokumen terunggah */}
              {uploadedSlots.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                    Dokumen Berkas Terunggah ({uploadedSlots.length} Berkas)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {uploadedSlots.map((doc) => {
                      const isPdf = isPdfDocumentUrl(doc.url);
                      return (
                        <div
                          key={doc.key}
                          className="border border-slate-200 rounded-xl p-3 bg-white hover:border-emerald-300 transition-colors"
                        >
                          <p className="text-[11px] font-bold text-slate-700 mb-2 truncate" title={doc.label}>
                            {doc.label}
                          </p>
                          <div
                            onClick={() => setZoomImage(doc.url)}
                            className="h-28 bg-slate-100 rounded-lg overflow-hidden cursor-pointer relative group flex items-center justify-center"
                          >
                            {isPdf ? (
                              <div className="flex flex-col items-center justify-center gap-1.5 text-emerald-800 p-3 text-center">
                                <FileText className="w-8 h-8 text-emerald-600" />
                                <span className="text-[11px] font-bold">Dokumen PDF</span>
                              </div>
                            ) : (
                              <img
                                src={doc.url}
                                alt={doc.label}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            )}
                            <span className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity">
                              {isPdf ? 'Klik Buka PDF' : 'Klik Zoom'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {canVerify && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleOpenReject(detailStudent)}
                    className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold border border-red-200 transition-colors cursor-pointer"
                  >
                    Tolak / Minta Perbaikan
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSingleApprove(detailStudent)}
                    className="px-4 py-2 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                  >
                    Approve &amp; Lanjut Tahap Tes
                  </button>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* Lightbox Modal Zoom */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setZoomImage(null)}
        >
          <div className="max-w-2xl w-full bg-white p-3 rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {isPdfDocumentUrl(zoomImage) ? (
              <iframe
                src={zoomImage}
                title="Zoom Berkas PDF"
                className="w-full h-[75vh] rounded-xl border border-slate-200"
              />
            ) : (
              <img
                src={zoomImage}
                alt="Zoom Berkas"
                className="w-full max-h-[80vh] object-contain rounded-xl"
              />
            )}
            <p
              onClick={() => setZoomImage(null)}
              className="text-center text-xs text-slate-500 mt-2 font-medium cursor-pointer hover:text-slate-800"
            >
              Klik di sini untuk menutup pratinjau berkas
            </p>
          </div>
        </div>
      )}

      {/* Modal Alasan Penolakan Berkas */}
      {activeStudentForAction && (() => {
        const rejectSchema = getNormalizedSchema(activeStudentForAction.unit);
        const rejectStudentName = resolveStudentNameFromSchema(activeStudentForAction, rejectSchema);
        return (
          <Modal
            isOpen={rejectModalOpen}
            onClose={() => setRejectModalOpen(false)}
            title="Tolak Verifikasi Pendaftaran"
            description={`Tuliskan alasan penolakan atau perbaikan yang diperlukan untuk calon siswa ${rejectStudentName} (${activeStudentForAction.registrationNumber}). Pesan ini akan dikirimkan kepada orang tua/wali.`}
            icon={<AlertCircle className="w-6 h-6 text-red-600" />}
            confirmLabel="Simpan & Tolak"
            confirmVariant="danger"
            onConfirm={handleConfirmReject}
          >
            <div className="space-y-3 py-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Catatan Verifikasi (Wajib Diisi):
              </label>
              <textarea
                rows={4}
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                placeholder="Contoh: Data isian formulir atau lampiran berkas belum jelas/sesuai. Harap periksa dan lengkapi kembali."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white"
              />
            </div>
          </Modal>
        );
      })()}
    </div>
  );
};
