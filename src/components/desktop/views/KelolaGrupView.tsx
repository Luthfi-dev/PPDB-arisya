import React, { useState } from 'react';
import {
  MessageCircle,
  Link as LinkIcon,
  Save,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck,
  Eye,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { GroupLinkConfig } from '../../../types/ppdb';
import { getActiveAcademicYearLabel } from '../../../utils/studentFieldResolver';

export const KelolaGrupView: React.FC = () => {
  const { groupLinks, updateGroupLink, units, academicYears, showToast } = usePPDB();
  const activeAcademicYearLabel = getActiveAcademicYearLabel(academicYears);

  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');

  // Find currently selected group config
  const currentConfig = groupLinks.find((g) => g.unitId === selectedUnit) || {
    unitId: selectedUnit,
    groupUrl: 'https://chat.whatsapp.com/GrupResmiPPDB',
    groupName: `Grup WhatsApp PPDB ${selectedUnit === 'ALL' ? 'Yayasan Ar-Risalah' : selectedUnit}`,
    visibilityRule: 'always',
  };

  const [groupUrl, setGroupUrl] = useState(currentConfig.groupUrl);
  const [groupName, setGroupName] = useState(currentConfig.groupName);
  const [visibilityRule, setVisibilityRule] = useState<'always' | 'after_data' | 'after_payment'>(
    currentConfig.visibilityRule || 'always'
  );

  React.useEffect(() => {
    const found = groupLinks.find((g) => g.unitId === selectedUnit);
    if (found) {
      setGroupUrl(found.groupUrl);
      setGroupName(found.groupName);
      setVisibilityRule(found.visibilityRule);
    } else {
      setGroupUrl('https://chat.whatsapp.com/GrupResmiPPDB');
      setGroupName(`Grup WhatsApp PPDB ${selectedUnit === 'ALL' ? 'Yayasan Ar-Risalah' : selectedUnit}`);
      setVisibilityRule('always');
    }
  }, [selectedUnit, groupLinks]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupUrl.trim()) {
      showToast('Tautan link grup WhatsApp / Telegram wajib diisi.', 'error');
      return;
    }

    const payload: GroupLinkConfig = {
      unitId: selectedUnit,
      groupUrl: groupUrl.trim(),
      groupName: groupName.trim(),
      visibilityRule,
    };

    await updateGroupLink(payload);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#14532d] via-emerald-800 to-teal-800 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-200 text-xs font-semibold border border-white/20">
            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Manajemen Komunitas & Grup Informasi Calon Siswa</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Kelola Link Grup WhatsApp & Aturan Visibilitas
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
            Atur link tautan grup WhatsApp/Telegram calon siswa dan tentukan kapan tombol &quot;Gabung ke Grup&quot; muncul di beranda portal wali santri.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-950/60 p-3 rounded-2xl border border-emerald-700/60 shrink-0">
          <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
          <div className="text-left text-xs">
            <span className="font-bold text-white block">Aturan Otomatis</span>
            <span className="text-[11px] text-emerald-300">Sinkron ke Portal Wali</span>
          </div>
        </div>
      </div>

      {/* Grid: Form and Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-emerald-100 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-emerald-600" />
              <span>Formulir Pengaturan Link & Trigger</span>
            </h3>
          </div>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pilih Target Unit Sekolah
              </label>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] rounded-2xl px-3.5 py-2.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 cursor-pointer"
              >
                <option value="ALL">🌐 Grup Umum Seluruh Yayasan (Universal)</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.id} - {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Tampilan Grup (Judul Card di Akun Wali)
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={`Contoh: Grup WhatsApp Resmi Calon Siswa & Wali ${activeAcademicYearLabel}`}
                required
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] rounded-2xl px-3.5 py-2.5 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tautan / Link Undangan Grup (WhatsApp / Telegram)
              </label>
              <input
                type="url"
                value={groupUrl}
                onChange={(e) => setGroupUrl(e.target.value)}
                placeholder="https://chat.whatsapp.com/KodeGrupResmi"
                required
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] rounded-2xl px-3.5 py-2.5 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20"
              />
            </div>

            {/* Visibility Trigger Rule */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-bold text-slate-800">
                Kapan Tombol &quot;Gabung ke Grup&quot; Muncul di Halaman Akun Wali?
              </label>

              <div className="space-y-2">
                {[
                  {
                    key: 'always',
                    title: 'Langsung Muncul dari Awal Login',
                    desc: 'Wali langsung melihat tombol bergabung sejak pertama kali login ke akunnya, bahkan sebelum mengisi data.',
                    icon: Clock,
                  },
                  {
                    key: 'after_data',
                    title: 'Hanya Muncul Setelah Lengkap Mengisi Data Formulir',
                    desc: 'Tombol baru aktif setelah seluruh biodata ananda dan berkas persyaratan pendaftaran terisi lengkap.',
                    icon: FileCheck,
                  },
                  {
                    key: 'after_payment',
                    title: 'Hanya Muncul Setelah Pembayaran Terverifikasi (LUNAS)',
                    desc: 'Tombol terkunci dan baru aktif setelah bendahara memverifikasi pembayaran biaya formulir/pendaftaran ananda lunas.',
                    icon: CreditCard,
                  },
                ].map((opt) => {
                  const isSelected = visibilityRule === opt.key;
                  const Icon = opt.icon;

                  return (
                    <label
                      key={opt.key}
                      onClick={() => setVisibilityRule(opt.key as any)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? 'bg-emerald-50/70 border-emerald-500 shadow-2xs ring-1 ring-emerald-500/20'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="visibilityRule"
                        checked={isSelected}
                        onChange={() => setVisibilityRule(opt.key as any)}
                        className="mt-0.5 w-4 h-4 text-[#16a34a] focus:ring-[#16a34a] border-slate-300 cursor-pointer"
                      />
                      <div className="overflow-hidden space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-700' : 'text-slate-400'}`} />
                          <span className={`text-xs font-bold ${isSelected ? 'text-emerald-950' : 'text-slate-700'}`}>
                            {opt.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{opt.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-700/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Pengaturan Link Grup</span>
              </button>
            </div>
          </form>
        </div>

        {/* Preview Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-emerald-100 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-600" />
              <span>Simulasi Pratinjau Tampilan di Akun Wali:</span>
            </h4>

            {/* Simulated Parent Portal Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#14532d] via-emerald-900 to-[#14532d] text-white space-y-3 shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-white leading-tight">{groupName}</h5>
                  <p className="text-[10px] text-emerald-300">PPDB Ar-Risalah {activeAcademicYearLabel}</p>
                </div>
              </div>

              <p className="text-[11px] text-emerald-100/90 leading-relaxed">
                Bergabunglah ke grup resmi calon siswa & wali untuk mendapatkan info pengumuman ujian, persiapan observasi, dan koordinasi dengan panitia.
              </p>

              {visibilityRule === 'always' ? (
                <a
                  href={groupUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Gabung ke Grup WhatsApp Sekarang</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : visibilityRule === 'after_data' ? (
                <div className="p-2.5 rounded-xl bg-amber-950/70 border border-amber-600/50 text-amber-200 text-[11px] space-y-1">
                  <span className="font-bold block">🔒 Tombol Terkunci (Aturan Isi Formulir):</span>
                  <span>Tombol bergabung aktif otomatis begitu biodata ananda terisi lengkap.</span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-amber-950/70 border border-amber-600/50 text-amber-200 text-[11px] space-y-1">
                  <span className="font-bold block">🔒 Tombol Terkunci (Aturan Pembayaran Lunas):</span>
                  <span>Tombol bergabung aktif otomatis setelah bukti pembayaran diverifikasi lunas oleh bendahara.</span>
                </div>
              )}
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <span className="font-bold text-slate-800 block">Status Visibilitas Aktif:</span>
              <p>
                {visibilityRule === 'always' && '✅ Tombol selalu tampil terbuka di beranda portal wali santri.'}
                {visibilityRule === 'after_data' && '📋 Tombol hanya aktif setelah data pendaftaran anak selesai diinput.'}
                {visibilityRule === 'after_payment' && '💳 Tombol hanya aktif setelah status pembayaran formulir menjadi "Lunas".'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
