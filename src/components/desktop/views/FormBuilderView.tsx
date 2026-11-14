import React, { useState, useEffect } from 'react';
import {
  FormInput,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Smartphone,
  Save,
  CheckCircle2,
  Layers,
  FileUp,
  ListFilter,
  Type,
  Hash,
  Calendar,
  AlignLeft,
  Lock,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { FormField, FormSection, UnitFormSchema } from '../../../types/ppdb';
import { Modal } from '../../common/Modal';
import { isMasterUser, hasActionPermission } from '../../../utils/rbac';
import { ensureCoreNameFieldInSections, isLockedNameField } from '../../../utils/studentFieldResolver';

export const FormBuilderView: React.FC = () => {
  const { formSchemas, updateFormSchema, refreshFormSchemas, units, showToast, currentUser, roles, addAuditLog } = usePPDB();

  const getUnitLabel = (unitId: string) =>
    units.find((u) => u.id === unitId)?.shortName || unitId;

  const isMaster = isMasterUser(currentUser);
  const canEdit = hasActionPermission(currentUser, 'Form Builder', 'edit', roles);
  const userAssignedUnit = (
    !isMaster && currentUser?.schoolId && currentUser.schoolId !== 'MASTER'
      ? currentUser.schoolId
      : (units[0]?.id || 'TK01')
  );

  // Strictly bind initial unit to user's assigned school if not master
  const [activeUnit, setActiveUnit] = useState<string>(userAssignedUnit);

  // Enforce unit isolation: unit admin is locked to their school
  useEffect(() => {
    if (!isMaster && activeUnit !== userAssignedUnit) {
      setActiveUnit(userAssignedUnit);
    }
  }, [isMaster, userAssignedUnit, activeUnit]);

  // Always fetch fresh schemas from server/MySQL on Form Builder mount
  useEffect(() => {
    refreshFormSchemas();
  }, [refreshFormSchemas]);

  // Load current schema or fallback with locked Section 1 Name field
  const currentSchema = formSchemas.find((s) => s.unitId === activeUnit) || {
    unitId: activeUnit,
    sections: ensureCoreNameFieldInSections([], activeUnit),
  };

  const [sections, setSections] = useState<FormSection[]>(() =>
    ensureCoreNameFieldInSections(currentSchema.sections, activeUnit)
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [pendingSwitchUnit, setPendingSwitchUnit] = useState<string | null>(null);

  // Sync sections whenever activeUnit changes OR server formSchemas finishes loading/refreshing (unless actively editing unsaved changes)
  const prevUnitRef = React.useRef<string>(activeUnit);
  useEffect(() => {
    const unitChanged = prevUnitRef.current !== activeUnit;
    if (unitChanged) {
      prevUnitRef.current = activeUnit;
    }

    if (unitChanged || !hasUnsavedChanges) {
      const found = formSchemas.find((s) => s.unitId === activeUnit);
      if (found && Array.isArray(found.sections)) {
        setSections(ensureCoreNameFieldInSections(found.sections, activeUnit));
        if (unitChanged) setHasUnsavedChanges(false);
      }
    }
  }, [activeUnit, formSchemas, hasUnsavedChanges]);

  const applyUnitSwitch = (unit: string) => {
    setHasUnsavedChanges(false);
    setActiveUnit(unit);
    const found = formSchemas.find((s) => s.unitId === unit);
    if (found && Array.isArray(found.sections)) {
      setSections(ensureCoreNameFieldInSections(found.sections, unit));
    } else {
      setSections(
        ensureCoreNameFieldInSections(
          [
            {
              id: `sec-${Date.now()}`,
              title: `Data Pendaftaran ${getUnitLabel(unit)}`,
              fields: [],
            },
          ],
          unit
        )
      );
    }
  };

  // Middleware-guarded unit switcher
  const handleSwitchUnit = (unit: string) => {
    if (!isMaster && unit !== userAssignedUnit) {
      showToast(
        `Akses Ditolak: Anda adalah Admin Unit ${userAssignedUnit}. Anda tidak memiliki wewenang untuk melihat atau mengubah formulir unit ${unit}.`,
        'error'
      );
      addAuditLog(
        'unauthorized_access' as any,
        userAssignedUnit,
        `Mencoba beralih ke form builder unit ${unit} oleh ${currentUser?.email}`
      );
      return;
    }

    if (unit === activeUnit) return;
    if (hasUnsavedChanges) {
      setPendingSwitchUnit(unit);
      return;
    }

    applyUnitSwitch(unit);
  };

  const updateSectionsDirty = (next: FormSection[]) => {
    setSections(next);
    setHasUnsavedChanges(true);
  };

  const handleAddSection = () => {
    if (!canEdit) return;
    const newSection: FormSection = {
      id: `sec-${Date.now()}`,
      title: 'Section Baru',
      fields: [],
    };
    updateSectionsDirty([...sections, newSection]);
    showToast('Section baru ditambahkan — klik "Simpan Form" untuk menyimpan ke database');
  };

  const handleUpdateSectionTitle = (secId: string, title: string) => {
    if (!canEdit) return;
    updateSectionsDirty(
      sections.map((s) => (s.id === secId ? { ...s, title } : s))
    );
  };

  const handleUpdateSectionDescription = (secId: string, description: string) => {
    if (!canEdit) return;
    updateSectionsDirty(
      sections.map((s) => (s.id === secId ? { ...s, description } : s))
    );
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    if (!canEdit) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;
    if (index === 0 || targetIndex === 0) {
      showToast('Section 1 berisi field wajib Nama Calon Siswa dan harus tetap menjadi langkah pertama.', 'error');
      return;
    }
    const newSections = [...sections];
    const temp = newSections[index];
    newSections[index] = newSections[targetIndex];
    newSections[targetIndex] = temp;
    updateSectionsDirty(newSections);
    showToast(`Urutan section & langkah ${direction === 'up' ? 'dinaikkan' : 'diturunkan'}`);
  };

  const [sectionToDelete, setSectionToDelete] = useState<FormSection | null>(null);
  const [isDeleteSectionModalOpen, setIsDeleteSectionModalOpen] = useState(false);

  const isMasterOrYayasan =
    isMaster ||
    currentUser?.role === 'admin_yayasan' ||
    (currentUser?.role || '').toLowerCase().includes('yayasan');

  const handleRequestDeleteSection = (sec: FormSection) => {
    if (!canEdit) {
      showToast('Akses Ditolak: Akun Anda hanya memiliki hak lihat (Read-Only) pada Form Builder.', 'error');
      return;
    }

    if ((sec.fields || []).some((f) => isLockedNameField(f))) {
      showToast(
        'Section pertama berisi field wajib Nama Calon Siswa sehingga tidak dapat dihapus.',
        'error'
      );
      return;
    }

    // Check if section was already saved in DB schema
    const savedSchema = formSchemas.find((s) => s.unitId === activeUnit);
    const isSavedInDb = savedSchema?.sections?.some((s) => s.id === sec.id);

    if (isSavedInDb && !isMasterOrYayasan) {
      showToast(
        'Akses Ditolak: Seksi formulir yang sudah tersimpan di database tidak dapat dihapus oleh Admin Unit. Penghapusan hanya dapat dilakukan oleh Admin Yayasan atau Master Admin demi keamanan data.',
        'error'
      );
      addAuditLog(
        'unauthorized_access' as any,
        activeUnit,
        `Mencoba menghapus seksi formulir tersimpan (${sec.title}) tanpa wewenang yayasan oleh ${currentUser?.email}`
      );
      return;
    }

    setSectionToDelete(sec);
    setIsDeleteSectionModalOpen(true);
  };

  const handleConfirmDeleteSection = () => {
    if (!sectionToDelete) return;
    updateSectionsDirty(sections.filter((s) => s.id !== sectionToDelete.id));
    showToast(`Seksi "${sectionToDelete.title}" dihapus dari editor — klik "Simpan Form" untuk menerapkan permanen`, 'success');
    setIsDeleteSectionModalOpen(false);
    setSectionToDelete(null);
  };

  const handleAddField = (secId: string) => {
    if (!canEdit) return;
    const newField: FormField = {
      id: `f-${Date.now()}`,
      label: 'Pertanyaan / Label Baru',
      type: 'text',
      required: true,
      helpText: '',
      options: ['Pilihan 1', 'Pilihan 2'],
      fileConfig: { allowedTypes: ['PDF', 'JPG', 'PNG'], maxSizeMB: 5 },
    };

    updateSectionsDirty(
      sections.map((s) =>
        s.id === secId ? { ...s, fields: [...s.fields, newField] } : s
      )
    );
  };

  const handleUpdateField = (secId: string, fieldId: string, updates: Partial<FormField>) => {
    if (!canEdit) return;
    updateSectionsDirty(
      sections.map((sec) => {
        if (sec.id !== secId) return sec;
        return {
          ...sec,
          fields: sec.fields.map((f) => {
            if (f.id !== fieldId) return f;
            if (isLockedNameField(f)) {
              // Locked Name field: label & helpText remain editable; type & required stay locked
              return {
                ...f,
                label: updates.label !== undefined ? updates.label : f.label,
                helpText: updates.helpText !== undefined ? updates.helpText : f.helpText,
                type: 'text',
                required: true,
                systemKey: 'fullName',
                locked: true,
              };
            }
            const nextField: FormField = { ...f, ...updates };
            if (nextField.type === 'dropdown' && (!nextField.options || nextField.options.length === 0)) {
              nextField.options = ['Pilihan 1', 'Pilihan 2'];
            }
            return nextField;
          }),
        };
      })
    );
  };

  const handleDeleteField = (secId: string, fieldId: string) => {
    if (!canEdit) return;
    const secTarget = sections.find((s) => s.id === secId);
    const fieldTarget = secTarget?.fields.find((f) => f.id === fieldId);
    if (fieldTarget && isLockedNameField(fieldTarget)) {
      showToast(
        'Field Nama bersifat wajib sistem (labelnya dapat diedit, tetapi field tidak dapat dihapus).',
        'error'
      );
      return;
    }
    updateSectionsDirty(
      sections.map((sec) => {
        if (sec.id !== secId) return sec;
        return {
          ...sec,
          fields: sec.fields.filter((f) => f.id !== fieldId),
        };
      })
    );
  };

  const handleMoveField = (secId: string, index: number, direction: 'up' | 'down') => {
    if (!canEdit) return;
    updateSectionsDirty(
      sections.map((sec) => {
        if (sec.id !== secId) return sec;
        const newFields = [...sec.fields];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newFields.length) return sec;
        if (
          (isLockedNameField(newFields[index]) || isLockedNameField(newFields[targetIndex])) &&
          (index === 0 || targetIndex === 0)
        ) {
          showToast('Field Nama harus tetap berada di urutan pertama Section 1.', 'error');
          return sec;
        }
        const temp = newFields[index];
        newFields[index] = newFields[targetIndex];
        newFields[targetIndex] = temp;
        return { ...sec, fields: newFields };
      })
    );
  };

  const handleSaveAll = async () => {
    if (!canEdit) {
      showToast('Akses Ditolak: Anda hanya memiliki izin lihat pada Form Builder.', 'error');
      return;
    }

    if (!isMaster && activeUnit !== userAssignedUnit) {
      showToast(
        `Pelanggaran Batas Unit: Anda (${userAssignedUnit}) tidak memiliki hak untuk menyimpan formulir unit ${activeUnit}.`,
        'error'
      );
      addAuditLog(
        'unauthorized_access' as any,
        userAssignedUnit,
        `Percobaan simpan form builder unit ${activeUnit} oleh ${currentUser?.email}`
      );
      return;
    }

    for (const sec of sections) {
      if (!sec.title || !sec.title.trim()) {
        showToast('Setiap section wajib memiliki judul sebelum disimpan.', 'error');
        return;
      }
      for (const f of sec.fields) {
        if (!f.label || !f.label.trim()) {
          showToast(`Setiap pertanyaan di "${sec.title}" wajib memiliki label sebelum disimpan.`, 'error');
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const updatedSchema: UnitFormSchema = {
        unitId: activeUnit,
        sections,
      };
      const ok = await updateFormSchema(activeUnit, updatedSchema);
      if (ok) {
        setHasUnsavedChanges(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Unit Selector Header - Protected by Middleware */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 flex flex-wrap items-center justify-between gap-4">
        {isMaster ? (
          <div className="flex flex-wrap items-center gap-2">
            {(units.length > 0 ? units.map((u) => u.id) : [userAssignedUnit]).map((unit) => (
              <button
                key={unit}
                onClick={() => handleSwitchUnit(unit)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeUnit === unit
                    ? 'bg-[#16a34a] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Form {unit} ({getUnitLabel(unit)})
              </button>
            ))}
            <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-300">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Mode Master Yayasan
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-[#14532d] font-bold text-xs border border-emerald-300 shadow-xs">
              <Lock className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Unit Terkunci: Form {getUnitLabel(userAssignedUnit)} ({userAssignedUnit})</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-800 font-semibold bg-emerald-50/70 px-3 py-1.5 rounded-lg border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Isolasi Unit Aktif: Hak akses eksklusif hanya untuk unit Anda</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-300 text-[11px] font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Belum Disimpan</span>
            </span>
          )}

          <button
            onClick={() => setIsPreviewModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Smartphone className="w-4 h-4 text-slate-500" />
            <span>Pratinjau HP</span>
          </button>

          {canEdit ? (
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-white text-xs font-bold shadow-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 ${
                hasUnsavedChanges
                  ? 'bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-300'
                  : 'bg-[#16a34a] hover:bg-emerald-700'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : `Simpan Form ${activeUnit}`}</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
              <Lock className="w-3.5 h-3.5" />
              <span>Mode Lihat Saja</span>
            </span>
          )}
        </div>
      </div>

      {hasUnsavedChanges && canEdit && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Ada perubahan pada Form Builder {activeUnit} yang belum disimpan ke database. Klik{' '}
              <strong>Simpan Form {activeUnit}</strong> agar langsung sinkron dengan formulir pendaftaran calon siswa.
            </span>
          </div>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer transition-colors"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Sekarang'}
          </button>
        </div>
      )}

      {/* 2-Column Split: Form Editor Left & Live Mobile Frame Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Editor Left */}
        <div className="lg:col-span-8 space-y-5">
          {sections.map((section, sIdx) => (
            <div
              key={section.id}
              className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 relative group"
            >
              {/* Section Header with Step Indicator & Controls */}
              <div className="border-b border-slate-100 pb-3 mb-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      Section {sIdx + 1} · Langkah {sIdx + 1} di Pendaftaran Wali
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      ({section.fields.length} field)
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveSection(sIdx, 'up')}
                      disabled={sIdx <= 1}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      title={sIdx === 1 ? 'Section 1 terkunci sebagai langkah pertama' : 'Pindahkan Section & Langkah ke Atas'}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveSection(sIdx, 'down')}
                      disabled={sIdx === 0 || sIdx === sections.length - 1}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      title={sIdx === 0 ? 'Section 1 terkunci sebagai langkah pertama' : 'Pindahkan Section & Langkah ke Bawah'}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    {section.fields.some((f) => isLockedNameField(f)) ? (
                      <span
                        className="p-1.5 rounded-lg text-emerald-700 bg-emerald-50 border border-emerald-200 ml-1 inline-flex items-center gap-1 text-[10px] font-bold"
                        title="Section 1 berisi field wajib Nama Calon Siswa sehingga tidak dapat dihapus"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Section Inti</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRequestDeleteSection(section)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer ml-1"
                        title="Hapus Section Ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => handleUpdateSectionTitle(section.id, e.target.value)}
                    className="w-full text-base font-bold text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-[#16a34a] focus:outline-none py-1"
                    placeholder="Judul Section (Akan Menjadi Nama Langkah di Form Wali)..."
                  />
                  <input
                    type="text"
                    value={section.description || ''}
                    onChange={(e) => handleUpdateSectionDescription(section.id, e.target.value)}
                    className="w-full text-xs text-slate-500 border-b border-transparent hover:border-slate-200 focus:border-[#16a34a] focus:outline-none py-0.5"
                    placeholder="Petunjuk / deskripsi singkat untuk langkah ini (opsional)..."
                  />
                </div>
              </div>

              {/* Fields List */}
              <div className="space-y-4">
                {section.fields.map((field, fIdx) => {
                  const isLockedName = isLockedNameField(field);
                  return (
                  <div
                    key={field.id}
                    className={`p-4 rounded-xl border space-y-3 ${
                      isLockedName
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    {isLockedName && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-emerald-200/60">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-[10px] font-extrabold uppercase tracking-wide border border-emerald-300">
                          <Lock className="w-3 h-3 text-emerald-700" />
                          <span>Field Inti Wajib (Nama di List Pendaftar)</span>
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-800">
                          Label dapat diedit · Field tidak dapat dihapus
                        </span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1">
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                          {isLockedName ? 'Label Pertanyaan Nama (Bisa Diedit):' : 'Label Pertanyaan:'}
                        </label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) =>
                            handleUpdateField(section.id, field.id, {
                              label: e.target.value,
                            })
                          }
                          disabled={!canEdit}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
                        />
                      </div>

                      {/* Field Type Select */}
                      <div className="w-36">
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                          Tipe Field:
                        </label>
                        <select
                          value={field.type}
                          disabled={!canEdit || isLockedName}
                          onChange={(e) =>
                            handleUpdateField(section.id, field.id, {
                              type: e.target.value as any,
                            })
                          }
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#16a34a] disabled:bg-slate-100 disabled:text-slate-500"
                        >
                          <option value="text">Teks Singkat</option>
                          <option value="number">Angka / Angka</option>
                          <option value="date">Tanggal</option>
                          <option value="dropdown">Pilihan Dropdown</option>
                          <option value="file">Upload File / Berkas</option>
                          <option value="textarea">Teks Panjang (Textarea)</option>
                        </select>
                      </div>

                      {/* Reorder and Delete */}
                      <div className="flex items-center gap-1 pt-6">
                        <button
                          type="button"
                          onClick={() => handleMoveField(section.id, fIdx, 'up')}
                          disabled={fIdx === 0 || (sIdx === 0 && fIdx === 1 && isLockedNameField(section.fields[0]))}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveField(section.id, fIdx, 'down')}
                          disabled={isLockedName || fIdx === section.fields.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        {isLockedName ? (
                          <span
                            className="p-1 text-emerald-700 cursor-not-allowed"
                            title="Field Nama tidak dapat dihapus (label dapat diedit)"
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteField(section.id, field.id)}
                            className="p-1 text-slate-400 hover:text-red-600"
                            title="Hapus Field Ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Help text & Wajib Switch */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-t border-slate-200/50">
                      <div className="flex-1 min-w-[200px]">
                        <input
                          type="text"
                          value={field.helpText || ''}
                          onChange={(e) =>
                            handleUpdateField(section.id, field.id, {
                              helpText: e.target.value,
                            })
                          }
                          disabled={!canEdit}
                          placeholder="Teks petunjuk kecil untuk wali..."
                          className="w-full bg-transparent text-[11px] text-slate-500 border-b border-transparent hover:border-slate-300 focus:outline-none focus:border-[#16a34a]"
                        />
                      </div>

                      {/* Switch Wajib */}
                      <label className={`flex items-center gap-2 select-none ${isLockedName ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                        <span className="text-xs text-slate-600 font-medium">
                          {isLockedName ? 'Wajib Diisi (Terkunci):' : 'Wajib Diisi:'}
                        </span>
                        <div
                          onClick={() => {
                            if (isLockedName) return;
                            handleUpdateField(section.id, field.id, {
                              required: !field.required,
                            });
                          }}
                          className={`w-9 h-5 flex items-center rounded-full p-1 transition-colors ${
                            field.required ? 'bg-[#16a34a]' : 'bg-slate-300'
                          } ${isLockedName ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div
                            className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${
                              field.required ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </label>
                    </div>

                    {/* Dropdown Options Editor */}
                    {field.type === 'dropdown' && (
                      <div className="pt-2 pl-2 border-l-2 border-emerald-400 space-y-2">
                        <p className="text-[11px] font-bold text-slate-700">
                          Opsi Pilihan Dropdown:
                        </p>
                        <div className="space-y-1.5">
                          {(field.options || []).map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <span className="text-xs text-slate-400 font-mono">
                                •
                              </span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...(field.options || [])];
                                  newOpts[oIdx] = e.target.value;
                                  handleUpdateField(section.id, field.id, {
                                    options: newOpts,
                                  });
                                }}
                                className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 flex-1"
                              />
                              <button
                                onClick={() => {
                                  const newOpts = (field.options || []).filter(
                                    (_, i) => i !== oIdx
                                  );
                                  handleUpdateField(section.id, field.id, {
                                    options: newOpts,
                                  });
                                }}
                                className="text-slate-400 hover:text-red-500"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            const newOpts = [
                              ...(field.options || []),
                              `Opsi ${(field.options?.length || 0) + 1}`,
                            ];
                            handleUpdateField(section.id, field.id, {
                              options: newOpts,
                            });
                          }}
                          className="text-[11px] text-emerald-700 font-bold hover:underline"
                        >
                          + Tambah Opsi
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}

                {/* Add Field Button */}
                <button
                  onClick={() => handleAddField(section.id)}
                  className="w-full py-2.5 rounded-xl border border-dashed border-emerald-300 text-xs font-semibold text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Field Pertanyaan</span>
                </button>
              </div>
            </div>
          ))}

          {/* Add Section Button */}
          <button
            onClick={handleAddSection}
            className="w-full py-3 rounded-2xl bg-white border-2 border-dashed border-slate-200 hover:border-emerald-400 text-xs font-bold text-slate-600 hover:text-[#16a34a] transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Layers className="w-4 h-4" />
            <span>Tambah Section Baru</span>
          </button>
        </div>

        {/* Live Phone Preview Right */}
        <div className="lg:col-span-4 sticky top-24 hidden lg:block">
          <div className="bg-slate-900 p-3 rounded-[36px] shadow-2xl border-4 border-slate-800 max-w-[320px] mx-auto">
            {/* Phone Screen */}
            <div className="bg-[#f0fdf4] rounded-[28px] overflow-hidden min-h-[580px] max-h-[580px] flex flex-col border border-emerald-900/20">
              {/* Speaker notch */}
              <div className="h-5 bg-white flex items-center justify-center">
                <div className="w-16 h-1.5 bg-slate-300 rounded-full" />
              </div>

              {/* Phone Header */}
              <div className="bg-white px-3 py-2 border-b border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#16a34a] flex items-center justify-center text-white text-[9px] font-bold">
                    A
                  </div>
                  <span className="text-[11px] font-bold text-slate-800">
                    Formulir {activeUnit}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {sections.length + 1} Langkah
                </span>
              </div>

              {/* Dynamic Stepper Bar in Preview */}
              <div className="bg-white px-2 py-1.5 border-b border-slate-100 flex items-center gap-1 overflow-x-auto scrollbar-none">
                {sections.map((sec, idx) => (
                  <div key={sec.id} className="flex items-center gap-1 shrink-0">
                    <span className="w-4 h-4 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[8px] font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-[8px] font-semibold text-slate-700 max-w-[50px] truncate">
                      {sec.title}
                    </span>
                    <span className="text-[8px] text-slate-300">›</span>
                  </div>
                ))}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="w-4 h-4 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center text-[8px] font-bold">
                    {sections.length + 1}
                  </span>
                  <span className="text-[8px] font-semibold text-slate-500">
                    Bayar
                  </span>
                </div>
              </div>

              {/* Phone Scroll Content */}
              <div className="p-3 overflow-y-auto flex-1 space-y-3 text-xs">
                {sections.map((sec, sIdx) => (
                  <div
                    key={sec.id}
                    className="bg-white p-3 rounded-xl shadow-xs border border-emerald-100/70 space-y-2.5"
                  >
                    <div className="border-b border-slate-100 pb-1">
                      <span className="text-[8px] font-extrabold text-emerald-700 uppercase tracking-wider block">
                        Langkah {sIdx + 1} di Form Wali
                      </span>
                      <h5 className="font-bold text-[11px] text-emerald-950">
                        {sec.title}
                      </h5>
                      {sec.description && (
                        <p className="text-[9px] text-slate-400">{sec.description}</p>
                      )}
                    </div>
                    {sec.fields.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">
                        Belum ada field di section ini
                      </p>
                    ) : (
                      sec.fields.map((f) => (
                        <div key={f.id} className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-700 block">
                            {f.label}{' '}
                            {f.required && (
                              <span className="text-red-500">*</span>
                            )}
                          </label>
                          {f.type === 'dropdown' ? (
                            <select className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10px]">
                              {(f.options || []).map((o, i) => (
                                <option key={i}>{o}</option>
                              ))}
                            </select>
                          ) : f.type === 'file' ? (
                            <div className="border border-dashed border-slate-300 rounded p-1.5 text-center text-[9px] text-slate-500 bg-slate-50">
                              Upload berkas (PDF/JPG)
                            </div>
                          ) : f.type === 'textarea' ? (
                            <div className="w-full bg-slate-50 border border-slate-200 rounded h-10 p-1 text-[9px] text-slate-400">
                              Teks panjang...
                            </div>
                          ) : (
                            <input
                              type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                              disabled
                              placeholder="..."
                              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[10px]"
                            />
                          )}
                          {f.helpText && (
                            <span className="text-[9px] text-slate-400 block">
                              {f.helpText}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal HP Preview for mobile / button click */}
      <Modal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title={`Pratinjau Formulir HP (${activeUnit})`}
        description="Simulasi tampilan formulir yang akan dilihat dan diisi oleh wali siswa."
        maxWidth="sm"
        hideFooter
      >
        <div className="space-y-4 py-2">
          {sections.map((sec) => (
            <div
              key={sec.id}
              className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3"
            >
              <h4 className="font-bold text-xs text-emerald-900 border-b border-slate-200 pb-1.5">
                {sec.title}
              </h4>
              {sec.fields.map((f) => (
                <div key={f.id} className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block">
                    {f.label}{' '}
                    {f.required && <span className="text-red-500">*</span>}
                  </label>
                  {f.type === 'dropdown' ? (
                    <select className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs">
                      {(f.options || []).map((o, i) => (
                        <option key={i}>{o}</option>
                      ))}
                    </select>
                  ) : f.type === 'file' ? (
                    <div className="border-2 border-dashed border-emerald-300 rounded-xl p-3 text-center text-xs text-slate-500 bg-white">
                      Pilih file {f.fileConfig?.allowedTypes?.join(', ') || 'PDF/JPG/PNG'} (Maks {f.fileConfig?.maxSizeMB || 5} MB)
                    </div>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      rows={2}
                      disabled
                      placeholder="..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                    />
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                      disabled
                      placeholder="..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                    />
                  )}
                  {f.helpText && (
                    <p className="text-[10px] text-slate-400">{f.helpText}</p>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Modal>

      {/* Modal Confirmation Hapus Section */}
      {sectionToDelete && (
        <Modal
          isOpen={isDeleteSectionModalOpen}
          onClose={() => setIsDeleteSectionModalOpen(false)}
          title="Hapus Seksi Formulir?"
          description={`Apakah Anda yakin ingin menghapus seksi "${sectionToDelete.title}" beserta ${sectionToDelete.fields.length} bidang pertanyaan di dalamnya?`}
          confirmLabel="Ya, Hapus Seksi"
          confirmVariant="danger"
          onConfirm={handleConfirmDeleteSection}
        >
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
            <p className="font-bold">Konfirmasi Keamanan Hapus Data:</p>
            <p>
              Penghapusan seksi akan menghilangkan bidang pertanyaan ini dari formulir pendaftaran unit{' '}
              <strong>{activeUnit}</strong>.
            </p>
          </div>
        </Modal>
      )}

      {/* Modal Confirmation Switch Unit with Unsaved Changes */}
      {pendingSwitchUnit && (
        <Modal
          isOpen={Boolean(pendingSwitchUnit)}
          onClose={() => setPendingSwitchUnit(null)}
          title="Perubahan Belum Disimpan"
          description={`Anda memiliki perubahan di Form ${activeUnit} yang belum disimpan. Pindah ke Form ${pendingSwitchUnit} akan membuang perubahan yang belum disimpan.`}
          confirmLabel="Ya, Pindah & Abaikan Perubahan"
          confirmVariant="danger"
          onConfirm={() => {
            const target = pendingSwitchUnit;
            setPendingSwitchUnit(null);
            applyUnitSwitch(target);
          }}
        >
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
            Klik <strong>Batal</strong> jika Anda ingin menyimpan perubahan Form <strong>{activeUnit}</strong> terlebih dahulu.
          </div>
        </Modal>
      )}
    </div>
  );
};
