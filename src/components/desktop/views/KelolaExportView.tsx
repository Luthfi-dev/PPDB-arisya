import React, { useState, useMemo } from 'react';
import {
  Sliders,
  CheckCircle2,
  Save,
  RotateCcw,
  ShieldCheck,
  Table,
  FileSpreadsheet,
  FileText,
  Info,
  Check,
  Eye,
  Lock,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { ExportFieldConfig } from '../../../types/ppdb';
import { isSuperAdmin } from '../../../utils/rbac';
import {
  ensureCoreNameFieldInSections,
  getLockedNameFieldFromSchema,
  getSchemaFileFields,
  getSchemaNonFileFields,
} from '../../../utils/studentFieldResolver';

// Master Available Fields per Module (non-schema modules; Pendaftar & Verifikasi are augmented live from Form Builder)
export const MODULE_FIELD_DEFINITIONS: Record<string, { label: string; fields: string[] }> = {
  Pendaftar: {
    label: 'Data Pendaftar Siswa',
    fields: [
      'No',
      'No. Registrasi',
      'Nama Lengkap',
      'Unit',
      'Data Formulir (Ringkasan Form Builder)',
      'Status Pendaftaran',
      'Tanggal Daftar',
      'Nilai Tes',
    ],
  },
  Verifikasi: {
    label: 'Verifikasi Berkas Dokumen',
    fields: [
      'No',
      'No. Registrasi',
      'Nama Lengkap',
      'Unit',
      'Data Isian & Berkas Form Builder',
      'Tanggal Daftar',
      'Status Verifikasi',
      'Catatan Verifikator',
    ],
  },
  Jadwal: {
    label: 'Jadwal Tes Seleksi',
    fields: [
      'No',
      'Judul Seleksi',
      'Unit',
      'Tanggal',
      'Waktu Mulai',
      'Waktu Selesai',
      'Ruangan',
      'Penguji',
      'Kuota',
      'Terisi',
    ],
  },
  Kelulusan: {
    label: 'Penetapan Hasil Kelulusan',
    fields: [
      'No. Pendaftaran',
      'Nama Siswa',
      'Unit',
      'Nama Wali',
      'Nilai Tes (0-100)',
      'Status Hasil',
      'Publikasi',
    ],
  },
  Pembayaran: {
    label: 'Verifikasi Pembayaran & Bukti Transfer',
    fields: [
      'ID Transaksi',
      'No. Pendaftaran',
      'Nama Siswa',
      'Unit',
      'Jenis Pembayaran',
      'Nominal (Rp)',
      'Status',
      'Tanggal Bayar',
      'Verifikator',
    ],
  },
  Laporan: {
    label: 'Laporan Keuangan & Mutasi',
    fields: [
      'ID Transaksi',
      'No. Pendaftaran',
      'Nama Siswa',
      'Unit',
      'Jenis Pembayaran',
      'Nominal (Rp)',
      'Status',
      'Tanggal Bayar',
      'Verifikator',
    ],
  },
  Users: {
    label: 'Kelola Pengguna Staf',
    fields: [
      'No',
      'Nama Lengkap',
      'Email',
      'No. Telepon',
      'Unit Tugas',
      'Role / Jabatan',
      'Status Akun',
      'Terakhir Masuk',
    ],
  },
  'Audit Log': {
    label: 'Security Audit Log',
    fields: [
      'No',
      'Waktu (WIB)',
      'Pengguna / Email',
      'Unit Sekolah',
      'Kategori Tindakan',
      'Rincian Aktivitas',
      'Alamat IP',
    ],
  },
};

export const KelolaExportView: React.FC = () => {
  const { currentUser, roles, units, formSchemas, exportConfigs, updateExportConfig, showToast } = usePPDB();

  const [selectedModule, setSelectedModule] = useState<string>('Pendaftar');
  const [selectedRole, setSelectedRole] = useState<string>('ALL'); // 'ALL' = Default Umum

  const isSuper = isSuperAdmin(currentUser);

  // Available roles for selection (synchronized with live roles and active units)
  const availableRoles = useMemo(() => {
    const list = roles.map((r) => r.name);
    const standard = [
      'Super Admin Yayasan',
      'Admin Yayasan',
      ...units.map((u) => `Admin Unit ${u.shortName}`),
      'Verifikator Berkas',
      'Bendahara Keuangan',
    ];
    return Array.from(new Set([...list, ...standard]));
  }, [roles, units]);

  // Dynamic definitions combining base metadata with active Form Builder fields
  const dynamicModuleDefinitions = useMemo<Record<string, { label: string; fields: string[] }>>(() => {
    const nameLabels = new Set<string>();
    const nonFileLabels = new Set<string>();
    const fileLabels = new Set<string>();

    formSchemas.forEach((raw) => {
      const schema = {
        ...raw,
        sections: ensureCoreNameFieldInSections(raw.sections, raw.unitId),
      };
      const nameField = getLockedNameFieldFromSchema(schema);
      if (nameField?.label) nameLabels.add(nameField.label);
      getSchemaNonFileFields(schema, { excludeLockedName: true }).forEach((f) => {
        if (f.label) nonFileLabels.add(f.label);
      });
      getSchemaFileFields(schema).forEach((f) => {
        if (f.label) fileLabels.add(f.label);
      });
    });

    const pendaftarFields = Array.from(
      new Set([
        'No',
        'No. Registrasi',
        'Nama Lengkap',
        ...Array.from(nameLabels),
        'Unit',
        ...Array.from(nonFileLabels),
        'Data Formulir (Ringkasan Form Builder)',
        'Status Pendaftaran',
        'Tanggal Daftar',
        'Nilai Tes',
      ])
    );

    const verifikasiFields = Array.from(
      new Set([
        'No',
        'No. Registrasi',
        'Nama Lengkap',
        ...Array.from(nameLabels),
        'Unit',
        ...Array.from(nonFileLabels),
        ...Array.from(fileLabels),
        'Data Isian & Berkas Form Builder',
        'Tanggal Daftar',
        'Status Verifikasi',
        'Catatan Verifikator',
      ])
    );

    return {
      ...MODULE_FIELD_DEFINITIONS,
      Pendaftar: {
        label: MODULE_FIELD_DEFINITIONS.Pendaftar.label,
        fields: pendaftarFields,
      },
      Verifikasi: {
        label: MODULE_FIELD_DEFINITIONS.Verifikasi.label,
        fields: verifikasiFields,
      },
    };
  }, [formSchemas]);

  // Current active configuration for selected module and role
  const moduleDef = dynamicModuleDefinitions[selectedModule] || dynamicModuleDefinitions['Pendaftar'];
  const allFields = moduleDef.fields;

  // Specific rule for selected role
  const specificRule = exportConfigs.find(
    (c) => c.moduleName === selectedModule && c.roleId === selectedRole
  );

  // Default rule for module
  const defaultRule = exportConfigs.find(
    (c) => c.moduleName === selectedModule && c.roleId === 'ALL'
  );

  // Is using fallback to Default Umum?
  const isFallingBack = selectedRole !== 'ALL' && !specificRule;

  // State of currently checked fields
  const [selectedFields, setSelectedFields] = useState<string[]>(() => {
    if (selectedRole === 'ALL') {
      return defaultRule ? defaultRule.allowedHeaders : allFields;
    }
    if (specificRule) {
      return specificRule.allowedHeaders;
    }
    return defaultRule ? defaultRule.allowedHeaders : allFields;
  });

  // When module or role selector changes, reload fields state
  React.useEffect(() => {
    if (selectedRole === 'ALL') {
      setSelectedFields(defaultRule ? defaultRule.allowedHeaders : allFields);
    } else if (specificRule) {
      setSelectedFields(specificRule.allowedHeaders);
    } else {
      setSelectedFields(defaultRule ? defaultRule.allowedHeaders : allFields);
    }
  }, [selectedModule, selectedRole, defaultRule, specificRule, allFields]);

  const handleToggleField = (field: string) => {
    setSelectedFields((prev) => {
      if (prev.includes(field)) {
        // Prevent removing 'No' or having 0 fields
        if (prev.length <= 1) {
          showToast('Minimal 1 field/kolom harus tetap dipilih untuk ekspor.', 'error');
          return prev;
        }
        return prev.filter((f) => f !== field);
      } else {
        // Maintain original definition order
        return allFields.filter((f) => prev.includes(f) || f === field);
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedFields([...allFields]);
  };

  const handleDeselectAll = () => {
    // Keep 'No' or first field
    setSelectedFields([allFields[0] || 'No']);
  };

  const handleResetToDefault = () => {
    if (defaultRule && selectedRole !== 'ALL') {
      setSelectedFields([...defaultRule.allowedHeaders]);
      showToast(`Field di-reset mengikuti aturan Default Umum (${defaultRule.allowedHeaders.length} kolom)`);
    } else {
      setSelectedFields([...allFields]);
      showToast('Field di-reset ke seluruh kolom standar pabrik.');
    }
  };

  const handleSaveConfig = async () => {
    if (!isSuper) {
      showToast('Akses ditolak: Hanya Super Admin Master yang berhak mengubah aturan ekspor data.', 'error');
      return;
    }

    if (selectedFields.length === 0) {
      showToast('Pilih minimal 1 kolom field.', 'error');
      return;
    }

    const payload: ExportFieldConfig = {
      id: `${selectedModule}_${selectedRole}`,
      moduleName: selectedModule,
      roleId: selectedRole,
      allowedHeaders: selectedFields,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || 'Super Admin Master',
    };

    await updateExportConfig(payload);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#14532d] via-emerald-800 to-teal-800 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-200 text-xs font-semibold border border-white/20">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>Master Data Export Governance</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Kelola Ekspor Data Tabel & Izin Field Role
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
            Atur kolom atau field apa saja yang disertakan saat pengguna mengekspor tabel ke Excel atau PDF. Sembunyikan field rahasia/sensitif per role staf atau tetapkan aturan default umum.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-950/60 p-3 rounded-2xl border border-emerald-700/60 shrink-0">
          <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
          <div className="text-left text-xs">
            <span className="font-bold text-white block">Hak Akses Khusus</span>
            <span className="text-[11px] text-emerald-300">Super Admin Yayasan (Master)</span>
          </div>
        </div>
      </div>

      {/* Priority Logic Info Box */}
      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-3">
        <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <strong className="font-bold">Prinsip Kerja & Aturan Prioritas:</strong>
          <p className="text-slate-700">
            1. Jika <strong>Role tertentu</strong> dipilih dan disimpan, maka saat pengguna dengan role tersebut mengekspor, <em>aturan role tersebut yang dipakai</em> (aturan umum diabaikan).<br />
            2. Jika pengguna memiliki role yang <strong>belum pernah ditentukan field khususnya</strong>, maka sistem otomatis memakai konfigurasi <strong>Default Umum</strong>.<br />
            3. Jika memilih role <em>&quot;Default Umum (Semua Role)&quot;</em>, aturan ini menjadi baseline universal untuk seluruh tabel terkait.
          </p>
        </div>
      </div>

      {/* Control Panel: Select Module & Role */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Module Selector */}
        <div className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-sm space-y-3">
          <label className="block text-xs font-bold text-slate-800 flex items-center gap-2">
            <Table className="w-4 h-4 text-emerald-600" />
            <span>1. Pilih Tabel / Modul Data PPDB:</span>
          </label>
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 cursor-pointer"
          >
            {Object.keys(MODULE_FIELD_DEFINITIONS).map((modKey) => (
              <option key={modKey} value={modKey}>
                Modul: {MODULE_FIELD_DEFINITIONS[modKey].label} ({modKey})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500">
            Pilih modul tabel yang ingin Anda atur field keluarannya saat staf mengekspor ke Excel/PDF.
          </p>
        </div>

        {/* Role Selector */}
        <div className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              <span>2. Pilih Role Pengguna:</span>
            </label>
            {isFallingBack ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                Memakai Default Umum
              </span>
            ) : selectedRole === 'ALL' ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#14532d] border border-emerald-300">
                Aturan Default Umum
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                Aturan Khusus Role Ini
              </span>
            )}
          </div>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 cursor-pointer"
          >
            <option value="ALL">🌟 Default Umum (Berlaku untuk Semua Role Tanpa Override)</option>
            {availableRoles.map((r) => (
              <option key={r} value={r}>
                Role: {r}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500">
            {selectedRole === 'ALL'
              ? 'Konfigurasi ini berlaku untuk semua user kecuali jika role tersebut telah diatur secara khusus.'
              : `Mengatur kolom spesifik yang diizinkan untuk pengguna dengan role "${selectedRole}".`}
          </p>
        </div>
      </div>

      {/* Field Selection Checklist Card */}
      <div className="bg-white rounded-3xl p-6 border border-emerald-100 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Daftar Kolom / Field yang Disertakan dalam Ekspor</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Centang kolom yang diizinkan muncul pada dokumen Excel & PDF. Kolom yang tidak dicentang akan disembunyikan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-emerald-50 text-[#14532d] border border-emerald-200">
              {selectedFields.length} dari {allFields.length} Kolom Terpilih
            </span>
          </div>
        </div>

        {/* Quick Select Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            Pilih Semua ({allFields.length})
          </button>
          <button
            type="button"
            onClick={handleDeselectAll}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            Hapus Semua
          </button>
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors border border-emerald-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset ke Aturan Default</span>
          </button>
        </div>

        {/* Fields Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
          {allFields.map((field) => {
            const isChecked = selectedFields.includes(field);

            return (
              <label
                key={field}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                  isChecked
                    ? 'bg-emerald-50/70 border-emerald-500 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleField(field)}
                    className="w-4 h-4 rounded text-[#16a34a] focus:ring-[#16a34a] border-slate-300 cursor-pointer"
                  />
                  <span className={`text-xs truncate ${isChecked ? 'font-bold text-emerald-950' : 'text-slate-600'}`}>
                    {field}
                  </span>
                </div>

                {isChecked && (
                  <span className="w-4 h-4 rounded-full bg-[#16a34a] text-white flex items-center justify-center text-[10px] shrink-0">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </label>
            );
          })}
        </div>

        {/* Live Preview Table of Export Format */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-emerald-600" />
              <span>Pratinjau Kolom Header Hasil Ekspor ({selectedFields.length} Kolom):</span>
            </h4>
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <span className="flex items-center gap-1 font-semibold text-emerald-700">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel (.csv)
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-semibold text-red-600">
                <FileText className="w-3.5 h-3.5" /> PDF A4
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/60 p-2">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-[#14532d] text-white">
                  {selectedFields.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-bold border-r border-emerald-800 last:border-0 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white text-slate-600">
                  {selectedFields.map((h, i) => (
                    <td key={i} className="px-3 py-2 text-slate-400 italic border-r border-slate-100 last:border-0 whitespace-nowrap">
                      [Data {h}]
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Save Bar */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Target Simpan:{' '}
            <strong className="text-slate-800">
              Modul {selectedModule} &rarr; {selectedRole === 'ALL' ? 'Default Umum' : `Role ${selectedRole}`}
            </strong>
          </div>

          <button
            type="button"
            onClick={handleSaveConfig}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-700/20 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Aturan Ekspor Sekarang</span>
          </button>
        </div>
      </div>
    </div>
  );
};
