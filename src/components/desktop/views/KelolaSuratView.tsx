import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileEdit,
  Save,
  Building2,
  ShieldCheck,
  Award,
  Printer,
  Sparkles,
  ListChecks,
  Search,
  X,
  Plus,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import QRCode from 'qrcode';
import { usePPDB } from '../../../context/PPDBContext';
import { SchoolId, LetterConfig, LetterCardFieldConfig } from '../../../types/ppdb';
import { isSuperAdmin, isMasterUser } from '../../../utils/rbac';
import { getActiveAcademicYearLabel, getDefaultCardFieldsFromSchema } from '../../../utils/studentFieldResolver';

interface SearchableFormFieldOption {
  fieldId: string;
  label: string;
  sectionTitle: string;
  fieldType: string;
  unitId: string;
}

export const KelolaSuratView: React.FC = () => {
  const {
    letterConfigs,
    updateLetterConfig,
    formSchemas,
    refreshFormSchemas,
    units,
    academicYears,
    landingConfig,
    currentUser,
    activeSchoolId,
    showToast,
  } = usePPDB();

  const activeAcademicYearLabel = getActiveAcademicYearLabel(academicYears);
  const sampleRegYear = activeAcademicYearLabel.split('/')[0] || String(new Date().getFullYear());
  const todayFormatted = useMemo(
    () =>
      new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    []
  );

  const isSuper = isSuperAdmin(currentUser);
  const isMaster = isMasterUser(currentUser);
  const canManageAllUnits = isSuper || isMaster || currentUser?.schoolId === 'MASTER';

  const unitTabs: Array<{ id: SchoolId | 'MASTER'; label: string; sub: string }> = useMemo(() => {
    const subMap: Record<string, string> = {
      TK01: 'Jenjang Taman Kanak-Kanak',
      SD01: 'Jenjang Sekolah Dasar',
      SMP01: 'Jenjang Menengah Pertama',
      SMA01: 'Jenjang Menengah Atas',
    };
    return [
      { id: 'MASTER', label: 'Default Yayasan', sub: 'Induk Semua Unit' },
      ...units.map((u) => ({
        id: u.id as SchoolId,
        label: u.shortName,
        sub: subMap[u.id] || u.name,
      })),
    ];
  }, [units]);

  const visibleUnitTabs = useMemo(() => {
    if (canManageAllUnits) return unitTabs;
    const targetUnit =
      currentUser?.schoolId && currentUser.schoolId !== 'MASTER'
        ? currentUser.schoolId
        : activeSchoolId && activeSchoolId !== 'MASTER'
        ? activeSchoolId
        : (units[0]?.id || 'TK01');
    return unitTabs.filter((t) => t.id === targetUnit);
  }, [canManageAllUnits, currentUser?.schoolId, activeSchoolId, unitTabs, units]);

  const [selectedUnit, setSelectedUnit] = useState<SchoolId | 'MASTER'>(() => {
    if (!canManageAllUnits) {
      if (currentUser?.schoolId && currentUser.schoolId !== 'MASTER') return currentUser.schoolId;
      if (activeSchoolId && activeSchoolId !== 'MASTER') return activeSchoolId;
    }
    if (activeSchoolId && activeSchoolId !== 'MASTER') {
      return activeSchoolId;
    }
    return 'MASTER';
  });

  // Enforce locked unit tab for Admin Unit
  useEffect(() => {
    if (!canManageAllUnits && visibleUnitTabs.length > 0) {
      const allowedId = visibleUnitTabs[0].id;
      if (selectedUnit !== allowedId) {
        setSelectedUnit(allowedId);
      }
    }
  }, [canManageAllUnits, visibleUnitTabs, selectedUnit]);

  // Refresh latest Form Builder schemas from MySQL whenever screen opens or unit switches
  useEffect(() => {
    refreshFormSchemas().catch(() => {});
  }, [refreshFormSchemas, selectedUnit]);

  const exactUnitConfig = useMemo(
    () => letterConfigs.find((l) => l.unitId === selectedUnit),
    [selectedUnit, letterConfigs]
  );

  const currentConfig = useMemo(() => {
    return (
      exactUnitConfig ||
      letterConfigs.find((l) => l.unitId === 'MASTER') || {
        unitId: selectedUnit,
        unitName: selectedUnit === 'MASTER' ? 'Default Yayasan Master' : `Unit ${selectedUnit}`,
        committeeChairName: 'Ustadz Dr. Rahmat Hidayat, M.A',
        committeeChairNip: 'NIPY. 19850412 201001 1 002',
        committeeRoleTitle: 'Ketua Panitia PPDB',
        letterHeaderTitle: 'PANITIA PENERIMAAN PESERTA DIDIK BARU (PPDB)',
        cardTitle: 'KARTU TANDA PESERTA UJIAN & OBSERVASI PPDB',
        issueLocation: 'Bireuen',
        issueDate: '',
        examInstructions: [
          '1. Peserta wajib hadir 15 menit sebelum pelaksanaan ujian seleksi dimulai.',
          '2. Membawa Kartu Tanda Peserta ini (cetak fisik) dan alat tulis secukupnya.',
          '3. Berpakaian sopan, rapi, dan menutup aurat (busana muslim/muslimah).',
          '4. Orang tua/wali santri wajib mendampingi ananda saat sesi wawancara orang tua.',
        ],
        stampNote: 'Dokumen ini diterbitkan sah secara elektronik oleh Panitia PPDB Ar-Risalah Aceh.',
      }
    );
  }, [selectedUnit, exactUnitConfig, letterConfigs]);

  // Available Form Builder fields for the selected unit (synced live with Form Builder)
  const availableFormFields: SearchableFormFieldOption[] = useMemo(() => {
    const targetSchemas =
      selectedUnit === 'MASTER'
        ? formSchemas
        : formSchemas.filter((s) => s.unitId === selectedUnit);

    const list: SearchableFormFieldOption[] = [];
    const seen = new Set<string>();
    for (const schema of targetSchemas) {
      if (!Array.isArray(schema.sections)) continue;
      for (const sec of schema.sections) {
        if (!Array.isArray(sec.fields)) continue;
        for (const f of sec.fields) {
          const dedupKey = selectedUnit === 'MASTER' ? `${schema.unitId}::${f.id}` : f.id;
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);
          list.push({
            fieldId: f.id,
            label: f.label,
            sectionTitle: sec.title,
            fieldType: f.type,
            unitId: schema.unitId,
          });
        }
      }
    }
    return list;
  }, [formSchemas, selectedUnit]);

  const validFieldIdSet = useMemo(
    () => new Set(availableFormFields.map((f) => f.fieldId)),
    [availableFormFields]
  );

  // Form states
  const [committeeChairName, setCommitteeChairName] = useState('');
  const [committeeChairNip, setCommitteeChairNip] = useState('');
  const [committeeRoleTitle, setCommitteeRoleTitle] = useState('');
  const [letterHeaderTitle, setLetterHeaderTitle] = useState('');
  const [cardTitle, setCardTitle] = useState('');
  const [issueLocation, setIssueLocation] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [stampNote, setStampNote] = useState('');
  const [inst1, setInst1] = useState('');
  const [inst2, setInst2] = useState('');
  const [inst3, setInst3] = useState('');
  const [inst4, setInst4] = useState('');

  // Dynamic card biodata fields state
  const [cardFields, setCardFields] = useState<LetterCardFieldConfig[]>([]);
  const [fieldSearchQuery, setFieldSearchQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [previewQrDataUrl, setPreviewQrDataUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentConfig) {
      setCommitteeChairName(currentConfig.committeeChairName || '');
      setCommitteeChairNip(currentConfig.committeeChairNip || '');
      setCommitteeRoleTitle(currentConfig.committeeRoleTitle || 'Ketua Panitia PPDB');
      setLetterHeaderTitle(currentConfig.letterHeaderTitle || 'PANITIA PENERIMAAN PESERTA DIDIK BARU (PPDB)');
      setCardTitle(currentConfig.cardTitle || 'KARTU TANDA PESERTA UJIAN & OBSERVASI PPDB');
      setIssueLocation(currentConfig.issueLocation || 'Bireuen');
      setIssueDate(currentConfig.issueDate || todayFormatted);
      setStampNote(currentConfig.stampNote || 'Dokumen sah Panitia PPDB Yayasan Ar-Risalah.');

      const insts = currentConfig.examInstructions || [];
      setInst1(insts[0] || '1. Peserta wajib hadir 15 menit sebelum pelaksanaan ujian seleksi dimulai.');
      setInst2(insts[1] || '2. Membawa Kartu Tanda Peserta ini (cetak fisik) dan alat tulis secukupnya.');
      setInst3(insts[2] || '3. Berpakaian sopan, rapi, dan menutup aurat (busana muslim/muslimah).');
      setInst4(insts[3] || '4. Orang tua/wali santri wajib mendampingi ananda saat sesi wawancara orang tua.');
    }

    if (exactUnitConfig && Array.isArray(exactUnitConfig.cardFields)) {
      setCardFields(exactUnitConfig.cardFields);
    } else if (selectedUnit !== 'MASTER') {
      const unitSchema = formSchemas.find((s) => s.unitId === selectedUnit) || null;
      setCardFields(getDefaultCardFieldsFromSchema(unitSchema));
    } else if (currentConfig && Array.isArray(currentConfig.cardFields)) {
      setCardFields(currentConfig.cardFields);
    } else {
      setCardFields([]);
    }
    setFieldSearchQuery('');
    setIsSearchDropdownOpen(false);
  }, [currentConfig, exactUnitConfig, selectedUnit, formSchemas]);

  // Close autocomplete dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Local QR generator for Live Preview
  useEffect(() => {
    let cancelled = false;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ppdb.arrisalahaceh.or.id';
    const verifyUrl = `${baseUrl}/#verify-ttd?reg=${encodeURIComponent(`PPDB-${sampleRegYear}-${selectedUnit}-088`)}`;
    QRCode.toDataURL(verifyUrl, {
      width: 120,
      margin: 1,
      color: { dark: '#14532d', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setPreviewQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [selectedUnit, sampleRegYear]);

  const filteredSearchOptions = useMemo(() => {
    const q = fieldSearchQuery.trim().toLowerCase();
    if (!q) return availableFormFields;
    return availableFormFields.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.sectionTitle.toLowerCase().includes(q) ||
        opt.fieldId.toLowerCase().includes(q)
    );
  }, [availableFormFields, fieldSearchQuery]);

  const selectedFieldIdSet = useMemo(
    () => new Set(cardFields.map((cf) => cf.fieldId)),
    [cardFields]
  );

  const handleSelectFormField = (opt: SearchableFormFieldOption) => {
    if (selectedFieldIdSet.has(opt.fieldId)) {
      showToast(`Kolom "${opt.label}" sudah ada di daftar kartu cetak.`, 'error');
      setFieldSearchQuery('');
      setIsSearchDropdownOpen(false);
      return;
    }
    setCardFields((prev) => [
      ...prev,
      {
        fieldId: opt.fieldId,
        label: opt.label,
        sectionTitle: opt.sectionTitle,
      },
    ]);
    setFieldSearchQuery('');
    setIsSearchDropdownOpen(false);
  };

  const handleRemoveCardField = (fieldId: string) => {
    setCardFields((prev) => prev.filter((item) => item.fieldId !== fieldId));
  };

  const handleMoveCardField = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= cardFields.length) return;
    setCardFields((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
  };

  const handleSyncFromFormBuilder = () => {
    if (selectedUnit === 'MASTER') {
      const uniqueById = new Map<string, LetterCardFieldConfig>();
      for (const opt of availableFormFields) {
        if (opt.fieldType === 'file') continue;
        if (!uniqueById.has(opt.fieldId)) {
          uniqueById.set(opt.fieldId, {
            fieldId: opt.fieldId,
            label: opt.label,
            sectionTitle: opt.sectionTitle,
          });
        }
      }
      setCardFields(Array.from(uniqueById.values()));
    } else {
      const unitSchema = formSchemas.find((s) => s.unitId === selectedUnit) || null;
      setCardFields(getDefaultCardFieldsFromSchema(unitSchema));
    }
    showToast(`Daftar kolom biodata disesuaikan dengan Form Builder unit ${selectedUnit}.`, 'success');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!committeeChairName.trim()) {
      showToast('Nama Ketua Panitia PPDB wajib diisi!', 'error');
      return;
    }

    const payload: LetterConfig = {
      unitId: selectedUnit as any,
      unitName:
        selectedUnit === 'MASTER'
          ? 'Default Semua Unit (Yayasan Master)'
          : unitTabs.find((t) => t.id === selectedUnit)?.label || `Unit ${selectedUnit}`,
      committeeChairName: committeeChairName.trim(),
      committeeChairNip: committeeChairNip.trim(),
      committeeRoleTitle: committeeRoleTitle.trim(),
      letterHeaderTitle: letterHeaderTitle.trim(),
      cardTitle: cardTitle.trim(),
      issueLocation: issueLocation.trim(),
      issueDate: issueDate.trim(),
      examInstructions: [inst1.trim(), inst2.trim(), inst3.trim(), inst4.trim()].filter(Boolean),
      stampNote: stampNote.trim(),
      cardFields: cardFields.map((cf) => ({
        fieldId: cf.fieldId,
        label: cf.label,
        ...(cf.sectionTitle ? { sectionTitle: cf.sectionTitle } : {}),
      })),
    };

    setIsSaving(true);
    try {
      await updateLetterConfig(payload);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#14532d] via-emerald-800 to-teal-800 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-200 text-xs font-semibold border border-white/20">
            <FileEdit className="w-3.5 h-3.5 text-emerald-400" />
            <span>Format Surat &amp; Kartu Peserta PPDB Per Unit</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Kelola Penandatangan Surat &amp; Kartu Ujian
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
            Sesuaikan penandatangan surat, tata tertib, serta kolom biodata dari Form Builder yang ditampilkan pada Kartu Peserta Ujian (Print Langsung, Download PDF, dan Lampiran Email).
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-950/60 p-3 rounded-2xl border border-emerald-700/60 shrink-0">
          <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
          <div className="text-left text-xs">
            <span className="font-bold text-white block">Pengaturan Resmi</span>
            <span className="text-[11px] text-emerald-300">Sinkronisasi Form Builder &amp; Cetak</span>
          </div>
        </div>
      </div>

      {/* Unit Tabs Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {visibleUnitTabs.map((tab) => {
          const isActive = selectedUnit === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedUnit(tab.id)}
              className={`px-4 py-2.5 rounded-2xl text-left transition-all cursor-pointer shrink-0 flex flex-col ${
                isActive
                  ? 'bg-emerald-800 text-white shadow-md shadow-emerald-800/20 font-bold border border-emerald-700'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <span className="text-xs font-extrabold flex items-center gap-1.5">
                <Building2 className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-300' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </span>
              <span className={`text-[10px] ${isActive ? 'text-emerald-200' : 'text-slate-500'}`}>{tab.sub}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Grid: Left Form, Right Live Card Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Column (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-emerald-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" />
                <span>Pengaturan Surat &amp; Kartu: {unitTabs.find((t) => t.id === selectedUnit)?.label}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Semua perubahan berlaku otomatis untuk Print Langsung, Unduh PDF, dan Kirim PDF ke Email.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
              Unit ID: {selectedUnit}
            </span>
          </div>

          <form onSubmit={handleSave} className="space-y-5 text-xs">
            {/* Section 0: Dynamic Card Fields Selector (Synced with Form Builder) */}
            <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Search className="w-4 h-4 text-sky-700" />
                    <span>Data Biodata dari Form Builder di Kartu Hasil Cetak</span>
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Ketik nama kolom Form Builder unit <strong>{selectedUnit}</strong> (mis. <span className="font-semibold">nis</span>, <span className="font-semibold">ayah</span>, <span className="font-semibold">sekolah</span>) lalu pilih untuk menambahkan baris ke kartu cetak.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSyncFromFormBuilder}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-sky-100 text-sky-800 border border-sky-300 font-bold text-[11px] transition-colors cursor-pointer"
                  title="Isi otomatis dengan seluruh kolom non-file Form Builder unit ini"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Muat Semua Field Unit</span>
                </button>
              </div>

              {/* Autocomplete Search Box */}
              <div ref={searchWrapperRef} className="relative">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    value={fieldSearchQuery}
                    onFocus={() => setIsSearchDropdownOpen(true)}
                    onChange={(e) => {
                      setFieldSearchQuery(e.target.value);
                      setIsSearchDropdownOpen(true);
                    }}
                    placeholder={`Cari label Form Builder unit ${selectedUnit} (contoh: nis, nama, hafalan)...`}
                    className="w-full bg-white border border-sky-300 focus:border-sky-600 rounded-xl pl-9 pr-8 py-2.5 text-slate-800 font-semibold focus:outline-none shadow-2xs"
                  />
                  {fieldSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setFieldSearchQuery('')}
                      className="absolute right-2.5 p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                      aria-label="Bersihkan pencarian"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Search Results Dropdown */}
                {isSearchDropdownOpen && (
                  <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {availableFormFields.length === 0 ? (
                      <div className="p-3.5 text-center text-slate-500 text-xs flex items-center justify-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Belum ada field pada Form Builder untuk unit {selectedUnit}.</span>
                      </div>
                    ) : filteredSearchOptions.length === 0 ? (
                      <div className="p-3.5 text-center text-slate-500 text-xs flex items-center justify-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>
                          Tidak ditemukan label <strong>"{fieldSearchQuery.trim()}"</strong> di Form Builder unit {selectedUnit}.
                        </span>
                      </div>
                    ) : (
                      filteredSearchOptions.map((opt) => {
                        const alreadySelected = selectedFieldIdSet.has(opt.fieldId);
                        return (
                          <button
                            key={`${opt.unitId}-${opt.fieldId}`}
                            type="button"
                            onClick={() => handleSelectFormField(opt)}
                            className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              alreadySelected ? 'bg-emerald-50/60 text-slate-500' : 'hover:bg-sky-50 text-slate-800'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-xs truncate">{opt.label}</p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {selectedUnit === 'MASTER' ? `[${opt.unitId}] ` : ''}Bagian: {opt.sectionTitle} · Tipe: {opt.fieldType}
                              </p>
                            </div>
                            {alreadySelected ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                                Sudah dipilih
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-600 text-white text-[10px] font-bold shrink-0">
                                <Plus className="w-3 h-3" />
                                Pilih
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Selected Card Rows Table */}
              <div className="rounded-xl border border-sky-200 bg-white overflow-hidden">
                <div className="bg-sky-800 text-white px-3 py-2 grid grid-cols-12 text-[11px] font-bold">
                  <span className="col-span-5">Label Data (Form Builder)</span>
                  <span className="col-span-5">Keterangan di Kartu</span>
                  <span className="col-span-2 text-right">Aksi</span>
                </div>

                {cardFields.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-xs">
                    Belum ada kolom data yang dipilih. Ketik di kolom pencarian di atas untuk memilih field dari Form Builder unit {selectedUnit}.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {cardFields.map((cf, idx) => {
                      const stillInFormBuilder = validFieldIdSet.has(cf.fieldId);
                      return (
                        <div
                          key={cf.fieldId}
                          className="px-3 py-2 grid grid-cols-12 items-center gap-2 hover:bg-slate-50 transition-colors"
                        >
                          <div className="col-span-5 min-w-0">
                            <p className="font-bold text-slate-800 text-xs truncate">{cf.label}</p>
                            {cf.sectionTitle && (
                              <p className="text-[10px] text-slate-400 truncate">{cf.sectionTitle}</p>
                            )}
                            {!stillInFormBuilder && availableFormFields.length > 0 && (
                              <p className="text-[10px] text-amber-600 font-semibold">
                                Field sudah dihapus/diubah di Form Builder
                              </p>
                            )}
                          </div>

                          <div className="col-span-5">
                            <span className="inline-block text-[11px] text-emerald-700 font-medium italic bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                              (akan terisi otomatis)
                            </span>
                          </div>

                          <div className="col-span-2 flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveCardField(idx, 'up')}
                              disabled={idx === 0}
                              title="Geser ke atas"
                              className="p-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveCardField(idx, 'down')}
                              disabled={idx === cardFields.length - 1}
                              title="Geser ke bawah"
                              className="p-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveCardField(cf.fieldId)}
                              title={`Hapus baris "${cf.label}"`}
                              aria-label={`Hapus baris ${cf.label}`}
                              className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Section 1: Ketua Panitia & Pengesahan */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-700" />
                <span>Informasi Ketua Panitia PPDB (Penandatangan Surat)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Lengkap Ketua Panitia &amp; Gelar: <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={committeeChairName}
                    onChange={(e) => setCommitteeChairName(e.target.value)}
                    placeholder="Contoh: Ustadz Dr. Rahmat Hidayat, M.A"
                    required
                    className="w-full bg-white border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jabatan Penandatangan (Role Title):
                  </label>
                  <input
                    type="text"
                    value={committeeRoleTitle}
                    onChange={(e) => setCommitteeRoleTitle(e.target.value)}
                    placeholder="Contoh: Ketua Panitia PPDB TKIT Ar-Risalah"
                    className="w-full bg-white border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">NIP / NIPY Ketua Panitia:</label>
                  <input
                    type="text"
                    value={committeeChairNip}
                    onChange={(e) => setCommitteeChairNip(e.target.value)}
                    placeholder="Contoh: NIPY. 19850412 201001 1 002"
                    className="w-full bg-white border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-slate-800 font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kota Tempat Penetapan:</label>
                  <input
                    type="text"
                    value={issueLocation}
                    onChange={(e) => setIssueLocation(e.target.value)}
                    placeholder="Contoh: Bireuen"
                    className="w-full bg-white border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Penetapan Surat:</label>
                  <input
                    type="text"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    placeholder={`Contoh: ${todayFormatted}`}
                    className="w-full bg-white border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Judul Kop & Kartu Ujian */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-emerald-600" />
                <span>Judul Kop Surat &amp; Baris Kartu Peserta Ujian</span>
              </h4>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Judul Sub-Header Kop Surat (Di bawah Nama Yayasan):
                  </label>
                  <input
                    type="text"
                    value={letterHeaderTitle}
                    onChange={(e) => setLetterHeaderTitle(e.target.value)}
                    placeholder="PANITIA PENERIMAAN PESERTA DIDIK BARU (PPDB)"
                    className="w-full bg-white border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-slate-800 font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Judul Banner Kartu Ujian &amp; Observasi:
                  </label>
                  <input
                    type="text"
                    value={cardTitle}
                    onChange={(e) => setCardTitle(e.target.value)}
                    placeholder="KARTU TANDA PESERTA UJIAN & OBSERVASI PPDB"
                    className="w-full bg-white border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-slate-800 font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Stempel / Legalitas Digital:</label>
                  <input
                    type="text"
                    value={stampNote}
                    onChange={(e) => setStampNote(e.target.value)}
                    placeholder="Dokumen ini diterbitkan sah secara elektronik oleh Panitia PPDB Ar-Risalah Aceh."
                    className="w-full bg-white border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Tata Tertib Peserta Ujian */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <ListChecks className="w-4 h-4 text-amber-600" />
                <span>Tata Tertib &amp; Instruksi Peserta Ujian pada Kartu (4 Poin Utama)</span>
              </h4>

              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Poin 1:</label>
                  <input
                    type="text"
                    value={inst1}
                    onChange={(e) => setInst1(e.target.value)}
                    placeholder="1. Peserta wajib hadir 15 menit sebelum pelaksanaan ujian seleksi dimulai."
                    className="w-full bg-white border border-amber-300 focus:border-amber-600 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Poin 2:</label>
                  <input
                    type="text"
                    value={inst2}
                    onChange={(e) => setInst2(e.target.value)}
                    placeholder="2. Membawa Kartu Tanda Peserta ini (cetak fisik) dan alat tulis secukupnya."
                    className="w-full bg-white border border-amber-300 focus:border-amber-600 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Poin 3:</label>
                  <input
                    type="text"
                    value={inst3}
                    onChange={(e) => setInst3(e.target.value)}
                    placeholder="3. Berpakaian sopan, rapi, dan menutup aurat (busana muslim/muslimah)."
                    className="w-full bg-white border border-amber-300 focus:border-amber-600 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Poin 4:</label>
                  <input
                    type="text"
                    value={inst4}
                    onChange={(e) => setInst4(e.target.value)}
                    placeholder="4. Orang tua/wali santri wajib mendampingi ananda saat sesi wawancara orang tua."
                    className="w-full bg-white border border-amber-300 focus:border-amber-600 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-bold shadow-md shadow-emerald-800/20 active:scale-95 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Surat & Kartu Unit'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Live Card Preview Column (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-emerald-100 shadow-sm space-y-4 sticky top-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Pratinjau Langsung Kartu Ujian (Live Preview)</span>
              </span>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Unit {selectedUnit}
              </span>
            </div>

            {/* Simulated Printed Card Frame */}
            <div className="p-4 bg-white border-2 border-emerald-700 rounded-2xl shadow-sm text-slate-800 font-sans space-y-3 text-[11px] leading-tight">
              {/* Kop Header */}
              <div className="text-center pb-2 border-b-2 border-emerald-700 space-y-0.5">
                <h5 className="font-extrabold text-emerald-950 text-sm tracking-wide">YAYASAN AR-RISALAH ACEH</h5>
                <p className="font-bold text-[10px] text-slate-800 uppercase tracking-tight">
                  {letterHeaderTitle || 'PANITIA PENERIMAAN PESERTA DIDIK BARU (PPDB)'}
                </p>
                <p className="text-[9px] text-slate-500">
                  Tahun Ajaran {activeAcademicYearLabel} · {issueLocation || landingConfig?.contact?.address || 'Aceh'}
                </p>
              </div>

              {/* Title Banner */}
              <div className="bg-emerald-50 p-2 rounded-xl text-center border border-emerald-200">
                <p className="font-black text-emerald-900 text-[11px]">
                  {cardTitle || 'KARTU TANDA PESERTA UJIAN & OBSERVASI PPDB'}
                </p>
                <p className="text-[9px] text-emerald-700 font-medium">Unit Pilihan: {selectedUnit}</p>
              </div>

              {/* Reg Number Sample */}
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">No. Registrasi</span>
                  <span className="font-mono text-xs font-black text-emerald-900">PPDB-{sampleRegYear}-{selectedUnit}-088</span>
                </div>
                <span className="text-[9px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                  Status: Terverifikasi
                </span>
              </div>

              {/* Dynamic Biodata Calon Siswa Preview Table */}
              <div className="rounded-xl overflow-hidden border border-slate-200">
                <div className="bg-[#16a34a] text-white font-bold text-[10px] px-2.5 py-1.5 grid grid-cols-12">
                  <span className="col-span-5">Biodata Calon Siswa</span>
                  <span className="col-span-7">Keterangan</span>
                </div>
                <div className="divide-y divide-slate-100 bg-white text-[10px]">
                  {cardFields.length === 0 ? (
                    <div className="px-2.5 py-2 text-slate-400 italic">
                      Belum ada baris data dipilih dari Form Builder.
                    </div>
                  ) : (
                    cardFields.map((cf) => (
                      <div key={cf.fieldId} className="px-2.5 py-1 grid grid-cols-12 gap-1.5">
                        <span className="col-span-5 font-semibold text-slate-600 truncate">{cf.label}</span>
                        <span className="col-span-7 font-semibold text-emerald-700 italic">
                          : (akan terisi otomatis)
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Schedule Sample */}
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-[9px] text-slate-700 space-y-0.5">
                <p className="font-bold text-emerald-900 uppercase">Jadwal &amp; Lokasi Ujian Seleksi:</p>
                <p>• Tanggal &amp; Waktu : Mengikuti jadwal gelombang observasi unit</p>
                <p>• Ruangan / Tempat : Kampus Terpadu Yayasan Ar-Risalah Aceh</p>
              </div>

              {/* Instructions Sample */}
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-[9px] text-slate-600 space-y-0.5">
                <p className="font-bold text-emerald-900 uppercase">Tata Tertib Peserta:</p>
                <p className="truncate">• {inst1 || '1. Peserta wajib hadir 15 menit sebelum tes.'}</p>
                <p className="truncate">• {inst2 || '2. Membawa Kartu Peserta ini.'}</p>
              </div>

              {/* Signature Section Preview */}
              <div className="pt-3 border-t border-slate-200 flex justify-between items-end text-[9.5px]">
                <div className="text-center w-28">
                  <p className="text-slate-500">Orang Tua / Wali,</p>
                  <div className="h-8" />
                  <p className="font-bold text-slate-900 underline">( Nama Wali Siswa )</p>
                </div>

                <div className="text-center w-36 space-y-0.5">
                  <p className="text-slate-500">
                    {issueLocation || 'Bireuen'}, {issueDate || todayFormatted}
                  </p>
                  <p className="font-semibold text-slate-700">{committeeRoleTitle || 'Ketua Panitia PPDB'},</p>

                  <div className="my-1 flex flex-col items-center justify-center">
                    <div className="p-0.5 bg-white rounded border border-emerald-300 shadow-2xs inline-block">
                      {previewQrDataUrl ? (
                        <img
                          src={previewQrDataUrl}
                          alt="QR Preview"
                          className="w-10 h-10 object-contain"
                        />
                      ) : (
                        <div className="w-10 h-10 flex items-center justify-center text-[8px] text-slate-400">
                          QR TTD
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="font-extrabold text-slate-900 underline">{committeeChairName || 'Ustadz Dr. Rahmat Hidayat, M.A'}</p>
                  {committeeChairNip && <p className="text-[8.5px] font-mono text-slate-500">{committeeChairNip}</p>}
                </div>
              </div>

              <div className="pt-2 text-center text-[8px] text-slate-400 border-t border-slate-100">
                {stampNote || 'Dokumen resmi terbitan Panitia PPDB Ar-Risalah Aceh.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
