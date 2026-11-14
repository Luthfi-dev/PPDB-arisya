import React, { useState } from 'react';
import {
  Search,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle,
  XCircle,
  FileText,
  User,
  Phone,
  MapPin,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { StatusBadge, UnitBadge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { Pagination } from '../../common/Pagination';
import { StudentRegistration, UnitFormSchema, FormField } from '../../../types/ppdb';
import { hasActionPermission } from '../../../utils/rbac';
import { ExportDropdown } from '../../common/ExportDropdown';
import {
  ensureCoreNameFieldInSections,
  formatCardFieldDisplayValue,
  getLockedNameFieldFromSchema,
  getSchemaFileFields,
  isLockedNameField,
  isPdfDocumentUrl,
  isUploadedDocumentValue,
  resolveFormFieldValue,
  resolveGuardianSummaryFromSchema,
  resolveStudentNameFromSchema,
  resolveVerificationDocumentsForStudent,
} from '../../../utils/studentFieldResolver';

export const PendaftarView: React.FC<{ searchQuery?: string }> = ({
  searchQuery = '',
}) => {
  const {
    students,
    units,
    activeSchoolId,
    formSchemas,
    deleteStudent,
    updateStudent,
    verifyStudentDocument,
    currentUser,
  } = usePPDB();

  const canEdit = hasActionPermission(currentUser, 'Pendaftar', 'edit');
  const canDelete = hasActionPermission(currentUser, 'Pendaftar', 'delete');
  const canVerify = hasActionPermission(currentUser, 'Verifikasi', 'verify');

  const [localSearch, setLocalSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterUnit, setFilterUnit] = useState<string>(
    activeSchoolId === 'MASTER' ? 'all' : activeSchoolId
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selected for View Detail Modal
  const [selectedStudent, setSelectedStudent] = useState<StudentRegistration | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Selected for Edit Modal
  const [editingStudent, setEditingStudent] = useState<StudentRegistration | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Selected for Delete Modal
  const [studentToDelete, setStudentToDelete] = useState<StudentRegistration | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const getNormalizedSchema = (unitId: string): UnitFormSchema | undefined => {
    const found = formSchemas.find((s) => s.unitId === unitId);
    if (!found) return undefined;
    return {
      ...found,
      sections: ensureCoreNameFieldInSections(found.sections, found.unitId),
    };
  };

  const getNonFileFieldsFromSchema = (schema?: UnitFormSchema | null): FormField[] => {
    if (!schema || !Array.isArray(schema.sections)) return [];
    const list: FormField[] = [];
    schema.sections.forEach((sec) => {
      (sec.fields || []).forEach((f) => {
        if (f.type !== 'file') list.push(f);
      });
    });
    return list;
  };

  const effectiveUnitFilter = activeSchoolId !== 'MASTER' ? activeSchoolId : filterUnit;
  const activeUnitSchema =
    effectiveUnitFilter !== 'all'
      ? getNormalizedSchema(effectiveUnitFilter)
      : units.length === 1
      ? getNormalizedSchema(units[0].id)
      : undefined;

  const activeNameField = activeUnitSchema ? getLockedNameFieldFromSchema(activeUnitSchema) : undefined;
  const activeExtraListFields = activeUnitSchema
    ? getNonFileFieldsFromSchema(activeUnitSchema)
        .filter((f) => !isLockedNameField(f))
        .slice(0, 3)
    : [];

  const query = (localSearch || searchQuery).toLowerCase().trim();

  const filtered = students.filter((s) => {
    // School filter
    if (activeSchoolId !== 'MASTER' && s.unit !== activeSchoolId) return false;
    if (filterUnit !== 'all' && s.unit !== filterUnit) return false;
    // Status filter
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    // Search across base metadata, resolved Form Builder Name, and dynamicAnswers
    if (query) {
      const unitSchema = getNormalizedSchema(s.unit);
      const resolvedName = resolveStudentNameFromSchema(s, unitSchema).toLowerCase();
      const guardian = resolveGuardianSummaryFromSchema(s, unitSchema);
      const dynamicMatch = s.dynamicAnswers
        ? Object.values(s.dynamicAnswers).some((val) => {
            if (typeof val !== 'string' || val.startsWith('data:')) return false;
            return val.toLowerCase().includes(query);
          })
        : false;
      if (
        !resolvedName.includes(query) &&
        !s.fullName.toLowerCase().includes(query) &&
        !s.registrationNumber.toLowerCase().includes(query) &&
        !(guardian.name || '').toLowerCase().includes(query) &&
        !(s.nisn && s.nisn.toLowerCase().includes(query)) &&
        !dynamicMatch
      ) {
        return false;
      }
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedStudents = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleOpenDetail = (student: StudentRegistration) => {
    setSelectedStudent(student);
    setIsDetailOpen(true);
  };

  const handleOpenEdit = (student: StudentRegistration) => {
    setEditingStudent({
      ...student,
      dynamicAnswers: { ...(student.dynamicAnswers || {}) },
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    const schema = getNormalizedSchema(editingStudent.unit);
    const nameField = getLockedNameFieldFromSchema(schema);
    const nextDyn = { ...(editingStudent.dynamicAnswers || {}) };
    if (nameField) {
      nextDyn[nameField.id] = editingStudent.fullName;
    }
    const ok = await updateStudent(editingStudent.id, {
      ...editingStudent,
      dynamicAnswers: nextDyn,
    });
    if (ok) {
      setIsEditOpen(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    const ok = await deleteStudent(studentToDelete.id);
    if (ok) {
      setIsDeleteOpen(false);
      setStudentToDelete(null);
    }
  };

  return (
    <div className="space-y-5 w-full min-w-0">
      {/* Search and Filters Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-emerald-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 w-full min-w-0">
        <div className="flex-1 w-full relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => {
              setLocalSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari siswa, no pendaftaran, wali, atau NISN..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs flex-1 sm:flex-none">
            <span className="text-slate-500 font-medium hidden sm:inline">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
            >
              <option value="all">Semua Status</option>
              <option value="verifikasi">Verifikasi</option>
              <option value="tes">Tahap Tes</option>
              <option value="lulus">Lulus</option>
              <option value="tidak_lulus">Tidak Lulus</option>
            </select>
          </div>

          {/* Unit Filter (if MASTER) */}
          {activeSchoolId === 'MASTER' && (
            <div className="flex items-center gap-1.5 text-xs flex-1 sm:flex-none">
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

          {/* Export Dropdown Button */}
          {(() => {
            const activeSchemaExtraFields = activeUnitSchema
              ? getNonFileFieldsFromSchema(activeUnitSchema).filter((f) => !isLockedNameField(f))
              : [];

            const formatStatusLabel = (status: string) =>
              status === 'lulus'
                ? 'Lulus'
                : status === 'tes'
                ? 'Tahap Tes'
                : status === 'verifikasi'
                ? 'Verifikasi Berkas'
                : status === 'tidak_lulus'
                ? 'Tidak Lulus'
                : status === 'terdaftar'
                ? 'Terdaftar'
                : status;

            const exportHeaders = activeUnitSchema
              ? [
                  'No',
                  'No. Registrasi',
                  activeNameField?.label || 'Nama Lengkap',
                  'Unit',
                  ...activeSchemaExtraFields.map((f) => f.label),
                  'Status Pendaftaran',
                  'Tanggal Daftar',
                  'Nilai Tes',
                ]
              : [
                  'No',
                  'No. Registrasi',
                  'Nama Lengkap',
                  'Unit',
                  'Data Formulir (Ringkasan Form Builder)',
                  'Status Pendaftaran',
                  'Tanggal Daftar',
                  'Nilai Tes',
                ];

            const exportRows = filtered.map((s, idx) => {
              const rowSchema = getNormalizedSchema(s.unit);
              const resolvedName = resolveStudentNameFromSchema(s, rowSchema);
              if (activeUnitSchema) {
                return [
                  idx + 1,
                  s.registrationNumber,
                  resolvedName,
                  s.unit,
                  ...activeSchemaExtraFields.map((f) =>
                    formatCardFieldDisplayValue(resolveFormFieldValue(s, f), f)
                  ),
                  formatStatusLabel(s.status),
                  s.registeredAt,
                  s.testScore ?? '-',
                ];
              }
              const rowExtraFields = getNonFileFieldsFromSchema(rowSchema).filter((f) => !isLockedNameField(f));
              const summaryText =
                rowExtraFields.length > 0
                  ? rowExtraFields
                      .map((f) => `${f.label}: ${formatCardFieldDisplayValue(resolveFormFieldValue(s, f), f)}`)
                      .join(' | ')
                  : '-';
              return [
                idx + 1,
                s.registrationNumber,
                resolvedName,
                s.unit,
                summaryText,
                formatStatusLabel(s.status),
                s.registeredAt,
                s.testScore ?? '-',
              ];
            });

            return (
              <ExportDropdown
                moduleName="Pendaftar"
                title="Data Calon Siswa Pendaftar PPDB"
                filename="Data_Pendaftar_Ar-Risalah"
                headers={exportHeaders}
                rows={exportRows}
              />
            );
          })()}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">No. Pendaftaran</th>
                <th className="py-3.5 px-4">{activeNameField?.label || 'Nama Calon Siswa'}</th>
                <th className="py-3.5 px-4">Unit</th>
                {activeUnitSchema ? (
                  activeExtraListFields.map((f) => (
                    <th key={f.id} className="py-3.5 px-4 max-w-[180px] truncate" title={f.label}>
                      {f.label}
                    </th>
                  ))
                ) : (
                  <th className="py-3.5 px-4">Data Formulir (Form Builder)</th>
                )}
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Tanggal Daftar</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeUnitSchema ? 6 + activeExtraListFields.length : 7}
                    className="py-12 text-center text-slate-400"
                  >
                    Tidak ditemukan data pendaftar sesuai filter.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student, idx) => {
                  const rowSchema = getNormalizedSchema(student.unit);
                  const displayName = resolveStudentNameFromSchema(student, rowSchema);
                  const rowSummaryFields = getNonFileFieldsFromSchema(rowSchema)
                    .filter((f) => !isLockedNameField(f))
                    .slice(0, 2);

                  return (
                  <tr
                    key={student.id}
                    className={`transition-colors hover:bg-emerald-50/30 ${
                      idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{student.registrationNumber}</span>
                        {student.isOffline && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                            Offline
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>{displayName}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <UnitBadge unit={student.unit} />
                    </td>
                    {activeUnitSchema ? (
                      activeExtraListFields.map((f) => {
                        const val = formatCardFieldDisplayValue(
                          resolveFormFieldValue(student, f),
                          f
                        );
                        return (
                          <td key={f.id} className="py-3.5 px-4 text-slate-600 max-w-[200px] truncate" title={val}>
                            {val}
                          </td>
                        );
                      })
                    ) : (
                      <td className="py-3.5 px-4 text-slate-600 max-w-[260px]">
                        {rowSummaryFields.length > 0 ? (
                          <div className="space-y-0.5">
                            {rowSummaryFields.map((f) => {
                              const val = formatCardFieldDisplayValue(
                                resolveFormFieldValue(student, f),
                                f
                              );
                              return (
                                <div key={f.id} className="text-[11px] truncate" title={`${f.label}: ${val}`}>
                                  <span className="text-slate-400 font-medium">{f.label}:</span>{' '}
                                  <span className="text-slate-700 font-semibold">{val}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>
                    )}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={student.status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono tabular-nums">
                      {student.registeredAt}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Mata Lihat */}
                        <button
                          onClick={() => handleOpenDetail(student)}
                          title="Lihat Detail & Berkas"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Pensil Edit (hanya jika berkemampuan Edit) */}
                        {canEdit && (
                          <button
                            onClick={() => handleOpenEdit(student)}
                            title="Edit Biodata"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {/* Tong Sampah Hapus (hanya jika berkemampuan Delete) */}
                        {canDelete && (
                          <button
                            onClick={() => {
                              setStudentToDelete(student);
                              setIsDeleteOpen(true);
                            }}
                            title="Hapus Pendaftar"
                            className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[8, 15, 25, 50, 100]}
        />
      </div>

      {/* Modal Detail Siswa & Berkas (Dinamis Sesuai Form Builder) */}
      {selectedStudent && (() => {
        const detailSchema = getNormalizedSchema(selectedStudent.unit);
        const detailName = resolveStudentNameFromSchema(selectedStudent, detailSchema);
        const { uploadedSlots: uploadedDocs } = resolveVerificationDocumentsForStudent(
          selectedStudent,
          detailSchema
        );

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

        const extraNonFileEntries = Object.entries(selectedStudent.dynamicAnswers || {}).filter(([k, v]) => {
          if (knownFieldIds.has(k) || knownFieldLabelsLower.has(k.trim().toLowerCase())) return false;
          if (v === undefined || v === null || typeof v === 'object') return false;
          const strVal = String(v).trim();
          if (!strVal || isUploadedDocumentValue(strVal)) return false;
          return true;
        });

        const nonFileSections = (detailSchema?.sections || [])
          .map((sec) => ({
            ...sec,
            nonFileFields: (sec.fields || []).filter((f) => f.type !== 'file'),
          }))
          .filter((sec) => sec.nonFileFields.length > 0);

        return (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={`Detail Calon Siswa: ${detailName}`}
          description={`Nomor Pendaftaran: ${selectedStudent.registrationNumber} · Unit ${selectedStudent.unit}`}
          maxWidth="3xl"
          hideFooter
        >
          <div className="space-y-6 py-2">
            {/* Compact Registration Metadata Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/70 text-xs">
              <div>
                <p className="text-slate-400 font-semibold uppercase text-[10px]">No. Pendaftaran</p>
                <p className="font-mono font-bold text-slate-900 mt-0.5">{selectedStudent.registrationNumber}</p>
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
                  <UnitBadge unit={selectedStudent.unit} />
                </div>
              </div>
              <div>
                <p className="text-slate-400 font-semibold uppercase text-[10px]">Tanggal Daftar</p>
                <p className="font-mono text-slate-800 mt-0.5">{selectedStudent.registeredAt}</p>
              </div>
            </div>

            {/* Data Formulir Dinamis Mengikuti Section & Field Form Builder Unit */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Data Formulir Pendaftaran (Sesuai Form Builder Unit {selectedStudent.unit})
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
                          const rawVal = resolveFormFieldValue(selectedStudent, f);
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
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 text-xs text-slate-600">
                  Belum ada seksi pertanyaan tambahan selain <strong className="text-slate-900">{detailName}</strong> pada Form Builder unit {selectedStudent.unit}.
                </div>
              )}

              {extraNonFileEntries.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Data Tambahan / Riwayat Formulir
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

            {/* Dokumen & Berkas Preview — HANYA ditampilkan apabila ada dokumen terunggah */}
            {uploadedDocs.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Dokumen Berkas Persyaratan ({uploadedDocs.length} Berkas)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {uploadedDocs.map((doc) => {
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
                          onClick={() => setPreviewImage(doc.url)}
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

            {/* Verification Status & Action Buttons */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">Status Saat Ini:</p>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={selectedStudent.status} />
                  {selectedStudent.verificationNotes && (
                    <span
                      className={`text-xs italic font-medium ${
                        selectedStudent.status === 'tes' ||
                        selectedStudent.status === 'lulus' ||
                        selectedStudent.status === 'terdaftar'
                          ? 'text-emerald-700'
                          : selectedStudent.status === 'tidak_lulus'
                          ? 'text-rose-700'
                          : 'text-slate-600'
                      }`}
                    >
                      "{selectedStudent.verificationNotes}"
                    </span>
                  )}
                </div>
              </div>

              {canVerify ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await verifyStudentDocument(selectedStudent.id, false, 'Berkas belum memenuhi syarat.');
                      if (ok) setIsDetailOpen(false);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold border border-red-200 transition-colors"
                  >
                    Tolak Berkas
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await verifyStudentDocument(selectedStudent.id, true, 'Berkas lengkap dan valid.');
                      if (ok) setIsDetailOpen(false);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    Verifikasi & Lanjut Tes
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-center">
                  Akses Verifikasi: Mode Lihat-Saja (Read-Only)
                </div>
              )}
            </div>
          </div>
        </Modal>
        );
      })()}

      {/* Lightbox Preview Gambar / PDF */}
      {previewImage && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] bg-white p-2 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {isPdfDocumentUrl(previewImage) ? (
              <iframe
                src={previewImage}
                title="Dokumen PDF"
                className="w-full h-[75vh] rounded-xl bg-white"
              />
            ) : (
              <img
                src={previewImage}
                alt="Dokumen Zoom"
                className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
              />
            )}
            <div className="flex justify-center py-2">
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Tutup pratinjau dokumen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Siswa (Dinamis Sesuai Form Builder) */}
      {editingStudent && (() => {
        const editSchema = getNormalizedSchema(editingStudent.unit);
        const editNameField = getLockedNameFieldFromSchema(editSchema);
        const editExtraFields = getNonFileFieldsFromSchema(editSchema).filter(
          (f) => !isLockedNameField(f)
        );
        const editFileFields = getSchemaFileFields(editSchema);

        const handleEditFileChange = (fieldId: string, file?: File) => {
          if (!file) return;
          const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
          if (!allowedTypes.includes(file.type) || file.size > 5 * 1024 * 1024) {
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUri = String(reader.result || '');
            if (!dataUri) return;
            setEditingStudent((prev) =>
              prev
                ? {
                    ...prev,
                    documents: { ...(prev.documents || {}), [fieldId]: dataUri },
                    dynamicAnswers: { ...(prev.dynamicAnswers || {}), [fieldId]: dataUri },
                  }
                : prev
            );
          };
          reader.readAsDataURL(file);
        };

        return (
        <Modal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          title="Edit Data Siswa"
          description={`Perbarui data ${editingStudent.registrationNumber} sesuai Form Builder unit ${editingStudent.unit}`}
          maxWidth="2xl"
          confirmLabel="Simpan Perubahan"
          onConfirm={handleSaveEdit}
        >
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {editNameField?.label || 'Nama Lengkap Siswa'}
                </label>
                <input
                  type="text"
                  value={editingStudent.fullName}
                  onChange={(e) => {
                    const val = e.target.value;
                    const nextDyn = { ...(editingStudent.dynamicAnswers || {}) };
                    if (editNameField) nextDyn[editNameField.id] = val;
                    setEditingStudent({ ...editingStudent, fullName: val, dynamicAnswers: nextDyn });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Unit Sekolah
                </label>
                <select
                  value={editingStudent.unit}
                  onChange={(e) =>
                    setEditingStudent({
                      ...editingStudent,
                      unit: e.target.value as any,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.shortName} ({u.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {editExtraFields.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Isian Formulir Unit {editingStudent.unit} (Form Builder)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {editExtraFields.map((field) => {
                    const currentVal =
                      editingStudent.dynamicAnswers?.[field.id] !== undefined
                        ? editingStudent.dynamicAnswers[field.id]
                        : resolveFormFieldValue(editingStudent, field) ?? '';

                    const setDynField = (newVal: any) => {
                      const nextDyn = { ...(editingStudent.dynamicAnswers || {}), [field.id]: newVal };
                      const patch: Partial<StudentRegistration> = { dynamicAnswers: nextDyn };
                      const l = (field.label || '').toLowerCase();
                      const fid = (field.id || '').toLowerCase();
                      if (/nisn/.test(l) || /nisn/.test(fid)) patch.nisn = String(newVal || '').replace(/\D/g, '');
                      else if (/jenis.?kelamin/.test(l) || /gender/.test(fid)) patch.gender = newVal;
                      else if (/alamat/.test(l) || /address/.test(fid)) patch.address = String(newVal || '');
                      else if (/nama.?orang.?tua|nama.?wali|nama.?ayah/.test(l) || /parentname/.test(fid)) patch.parentName = String(newVal || '');
                      else if (/whatsapp|nomor.?hp|telepon/.test(l) || /parentphone/.test(fid)) patch.parentPhone = String(newVal || '');
                      setEditingStudent({ ...editingStudent, ...patch });
                    };

                    return (
                      <div key={field.id} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          {field.label}
                        </label>
                        {field.type === 'dropdown' ? (
                          <select
                            value={String(currentVal || '')}
                            onChange={(e) => setDynField(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                          >
                            <option value="">-- Pilih --</option>
                            {(field.options || []).map((opt, oIdx) => (
                              <option key={oIdx} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : field.type === 'textarea' ? (
                          <textarea
                            rows={2}
                            value={String(currentVal || '')}
                            onChange={(e) => setDynField(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                          />
                        ) : (
                          <input
                            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                            value={String(currentVal || '')}
                            onChange={(e) => setDynField(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {editFileFields.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Lampiran Berkas Unit {editingStudent.unit} (Form Builder)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {editFileFields.map((field) => {
                    const existingUrl = resolveFormFieldValue(editingStudent, field);
                    return (
                      <div key={field.id} className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                        <label className="text-[11px] font-semibold text-slate-700 block">
                          {field.label}
                        </label>
                        {isUploadedDocumentValue(existingUrl) && (
                          <div className="flex items-center justify-between gap-2 text-[11px] bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                            <span className="text-emerald-800 font-semibold truncate">Berkas terpasang</span>
                            <button
                              type="button"
                              onClick={() => {
                                const nextDocs = { ...(editingStudent.documents || {}) };
                                delete nextDocs[field.id];
                                const nextDyn = { ...(editingStudent.dynamicAnswers || {}) };
                                delete nextDyn[field.id];
                                setEditingStudent({ ...editingStudent, documents: nextDocs, dynamicAnswers: nextDyn });
                              }}
                              className="text-rose-600 font-bold hover:underline shrink-0"
                            >
                              Hapus
                            </button>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={(e) => handleEditFileChange(field.id, e.target.files?.[0])}
                          className="w-full text-[11px] text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Modal>
        );
      })()}

      {/* Modal Hapus Pendaftar Confirm */}
      {studentToDelete && (() => {
        const delSchema = getNormalizedSchema(studentToDelete.unit);
        const delName = resolveStudentNameFromSchema(studentToDelete, delSchema);
        return (
        <Modal
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          title="Konfirmasi Hapus Data Pendaftar"
          description={`Pindahkan data siswa ${delName} ke Sampah Master`}
          confirmLabel="Ya, Hapus & Pindahkan ke Sampah"
          confirmVariant="danger"
          onConfirm={handleConfirmDelete}
        >
          <div className="space-y-3">
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-800 space-y-2">
              <div className="flex items-center gap-2 text-rose-900 font-black text-xs uppercase tracking-wide">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>KONFIRMASI PENGHAPUSAN DATA</span>
              </div>
              <p className="leading-relaxed">
                Apakah Anda yakin ingin menghapus data calon siswa{' '}
                <strong className="text-slate-900">{delName}</strong> (No. Registrasi:{' '}
                <strong className="font-mono text-rose-900">{studentToDelete.registrationNumber}</strong>, Unit:{' '}
                <strong>{studentToDelete.unit}</strong>)?
              </p>
              <div className="pt-2 border-t border-rose-200/70 text-[11px] text-rose-700">
                <strong>Dampak Tindakan:</strong> Data pendaftaran tidak akan tampil lagi di daftar aktif dan kuota terpakai unit {studentToDelete.unit} akan dikembalikan 1 kursi. Arsip lengkap data &amp; tagihan tetap disimpan di menu <strong>Sampah / Trash Data (Master Admin)</strong> sehingga dapat dipulihkan sewaktu-waktu.
              </div>
            </div>
          </div>
        </Modal>
        );
      })()}
    </div>
  );
};
