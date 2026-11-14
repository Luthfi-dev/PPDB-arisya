import React, { useEffect, useMemo, useState } from 'react';
import {
  Power,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FormInput,
  FileEdit,
  Coins,
  Calendar,
  PhoneCall,
  MessageCircle,
  CalendarRange,
  ArrowRight,
  Lock,
  Unlock,
  Save,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { UnitQuotaFee } from '../../../types/ppdb';
import { hasMenuAccess, isMasterUser } from '../../../utils/rbac';

interface ReadinessCheckItem {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  targetMenu: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DEFAULT_CLOSED_NOTICE =
  'Mohon maaf, pendaftaran untuk unit ini belum dibuka. Silakan pantau informasi resmi dari panitia PPDB.';

export const AktivasiPendaftaranView: React.FC = () => {
  const {
    units,
    formSchemas,
    letterConfigs,
    schedules,
    unitContacts,
    groupLinks,
    academicYears,
    currentUser,
    roles,
    refreshFormSchemas,
    refreshAllData,
    updateUnitRegistrationStatus,
    reorderUnits,
    setDesktopActiveMenu,
    showToast,
  } = usePPDB();

  const [noticeDrafts, setNoticeDrafts] = useState<Record<string, string>>({});
  const [savingUnitId, setSavingUnitId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  // Ensure checklist reads fresh Form Builder & DB data
  useEffect(() => {
    refreshFormSchemas();
  }, [refreshFormSchemas]);

  // Sync draft closedNotice state with loaded units
  useEffect(() => {
    setNoticeDrafts((prev) => {
      const next = { ...prev };
      units.forEach((u) => {
        if (next[u.id] === undefined) {
          next[u.id] = u.closedNotice || DEFAULT_CLOSED_NOTICE;
        }
      });
      return next;
    });
  }, [units]);

  const isMasterOrYayasan =
    isMasterUser(currentUser) ||
    currentUser?.schoolId === 'MASTER' ||
    (currentUser?.role || '').toLowerCase().includes('yayasan');

  const visibleUnits = useMemo(() => {
    if (isMasterOrYayasan) return units;
    return units.filter((u) => u.id === currentUser?.schoolId);
  }, [units, isMasterOrYayasan, currentUser?.schoolId]);

  const canReorderUnits = isMasterOrYayasan && visibleUnits.length > 1;

  const handleMoveUnitOrder = async (index: number, direction: 'up' | 'down') => {
    if (!canReorderUnits || isReordering) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= units.length) return;
    const nextOrder = [...units];
    const [moved] = nextOrder.splice(index, 1);
    nextOrder.splice(targetIdx, 0, moved);
    setIsReordering(true);
    try {
      await reorderUnits(nextOrder.map((u) => u.id));
    } finally {
      setIsReordering(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshFormSchemas(), refreshAllData()]);
      showToast('Status pengecekan kesiapan unit diperbarui dari database.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const evaluateReadiness = (unit: UnitQuotaFee): ReadinessCheckItem[] => {
    const schema = formSchemas.find((s) => s.unitId === unit.id);
    const sectionCount = schema?.sections?.length || 0;
    const fieldCount =
      schema?.sections?.reduce((acc, sec) => acc + (sec.fields?.length || 0), 0) || 0;
    const isFormReady = sectionCount > 0 && fieldCount > 0;

    const letter = letterConfigs.find((l) => l.unitId === unit.id);
    const isLetterReady = Boolean(
      letter &&
        letter.committeeChairName?.trim() &&
        (letter.letterHeaderTitle?.trim() || letter.cardTitle?.trim())
    );

    const remainingQuota = Math.max(0, (unit.totalQuota || 0) - (unit.filledQuota || 0));
    const isQuotaReady = (unit.totalQuota || 0) > 0 && remainingQuota > 0;

    const unitSchedules = schedules.filter((s) => s.unit === unit.id);
    const isScheduleReady = unitSchedules.length > 0;

    const contact = unitContacts.find((c) => c.unitId === unit.id);
    const isContactReady = Boolean(
      contact && contact.contactPerson?.trim() && (contact.whatsapp?.trim() || contact.phone?.trim())
    );

    const group =
      groupLinks.find((g) => g.unitId === unit.id && g.groupUrl?.trim()) ||
      groupLinks.find((g) => g.unitId === 'ALL' && g.groupUrl?.trim());
    const isGroupReady = Boolean(group && group.groupUrl?.trim());

    const activeYear = academicYears.find((y) => y.isActive);
    const isYearReady = Boolean(activeYear);

    return [
      {
        id: 'form_builder',
        label: 'Form Builder Dinamis',
        ok: isFormReady,
        detail: isFormReady
          ? `${sectionCount} bagian, ${fieldCount} pertanyaan formulir siap`
          : 'Belum ada bagian atau pertanyaan formulir untuk unit ini',
        targetMenu: 'form_builder',
        icon: FormInput,
      },
      {
        id: 'kelola_surat',
        label: 'Data Surat & Kartu PPDB',
        ok: isLetterReady,
        detail: isLetterReady
          ? `Ketua Panitia: ${letter?.committeeChairName}`
          : 'Nama Ketua Panitia atau judul surat/kartu unit belum lengkap',
        targetMenu: 'kelola_surat',
        icon: FileEdit,
      },
      {
        id: 'kuota_biaya',
        label: 'Kuota & Tarif Biaya',
        ok: isQuotaReady,
        detail: isQuotaReady
          ? `Kuota ${unit.totalQuota} kursi (sisa ${remainingQuota}), Formulir Rp ${(
              unit.formFee || 0
            ).toLocaleString('id-ID')}`
          : unit.totalQuota <= 0
          ? 'Kuota daya tampung belum diatur (> 0)'
          : 'Sisa kuota unit sudah penuh (0 kursi tersisa)',
        targetMenu: 'kuota_biaya',
        icon: Coins,
      },
      {
        id: 'jadwal',
        label: 'Jadwal Tes & Observasi',
        ok: isScheduleReady,
        detail: isScheduleReady
          ? `${unitSchedules.length} sesi jadwal tes tersedia`
          : 'Belum ada jadwal tes seleksi untuk unit ini',
        targetMenu: 'jadwal',
        icon: Calendar,
      },
      {
        id: 'kelola_kontak',
        label: 'Kontak Panitia Unit',
        ok: isContactReady,
        detail: isContactReady
          ? `${contact?.contactPerson} (${contact?.whatsapp || contact?.phone})`
          : 'Narahubung / nomor WhatsApp panitia unit belum diisi',
        targetMenu: 'kelola_kontak',
        icon: PhoneCall,
      },
      {
        id: 'kelola_grup',
        label: 'Link Grup Calon Siswa',
        ok: isGroupReady,
        detail: isGroupReady
          ? `${group?.groupName || 'Grup WhatsApp'} tersedia`
          : 'Tautan grup WhatsApp calon siswa/wali belum diisi',
        targetMenu: 'kelola_grup',
        icon: MessageCircle,
      },
      {
        id: 'tahun_ajaran',
        label: 'Periode Tahun Ajaran Aktif',
        ok: isYearReady,
        detail: isYearReady
          ? `Tahun ajaran aktif: ${activeYear?.year}`
          : 'Belum ada periode tahun ajaran yang ditandai aktif',
        targetMenu: 'tahun_ajaran',
        icon: CalendarRange,
      },
    ];
  };

  const handleToggleUnit = async (unit: UnitQuotaFee, targetOpen: boolean) => {
    setSavingUnitId(unit.id);
    const notice = (noticeDrafts[unit.id] ?? unit.closedNotice ?? DEFAULT_CLOSED_NOTICE).trim();
    try {
      await updateUnitRegistrationStatus(unit.id, targetOpen, notice || DEFAULT_CLOSED_NOTICE);
    } finally {
      setSavingUnitId(null);
    }
  };

  const handleSaveNoticeOnly = async (unit: UnitQuotaFee) => {
    setSavingUnitId(unit.id);
    const notice = (noticeDrafts[unit.id] ?? DEFAULT_CLOSED_NOTICE).trim();
    try {
      await updateUnitRegistrationStatus(
        unit.id,
        unit.isOpen !== false,
        notice || DEFAULT_CLOSED_NOTICE
      );
    } finally {
      setSavingUnitId(null);
    }
  };

  const activeCount = visibleUnits.filter((u) => u.isOpen !== false).length;
  const closedCount = visibleUnits.length - activeCount;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Banner Header */}
      <div className="bg-white rounded-2xl border border-emerald-100 shadow-xs p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
            <Power className="w-3.5 h-3.5 text-emerald-700" />
            <span>Kontrol Aktivasi Pendaftaran Unit Sekolah</span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
            Aktivasi Pendaftaran & Pengecekan Kesiapan Unit
          </h2>
          <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
            Aktifkan atau nonaktifkan pendaftaran untuk setiap unit sekolah. Unit yang nonaktif
            akan tampil abu-abu dengan keterangan <strong>Belum Dibuka</strong> dan tidak bisa
            diklik oleh calon pendaftar. Daftar pengecekan di bawah berfungsi sebagai pengingat
            kelengkapan sebelum pendaftaran dibuka—tombol aktivasi tetap dapat dijalankan kapan saja.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
            <span className="text-slate-500 block text-[10px] font-semibold uppercase">
              Unit Dibuka
            </span>
            <span className="font-extrabold text-emerald-800 text-sm">{activeCount} Unit</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs">
            <span className="text-slate-500 block text-[10px] font-semibold uppercase">
              Belum Dibuka
            </span>
            <span className="font-extrabold text-slate-700 text-sm">{closedCount} Unit</span>
          </div>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Segarkan Cek</span>
          </button>
        </div>
      </div>

      {/* Urutan Posisi Unit Sekolah (Admin Yayasan & Master Admin) */}
      {canReorderUnits && (
        <div className="bg-white rounded-2xl border border-emerald-100 shadow-xs p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
              <ArrowUpDown className="w-4 h-4 text-emerald-700" />
              <span>Atur Urutan Posisi Unit Sekolah</span>
            </div>
            <span className="text-[11px] text-slate-500">
              Gunakan tombol naik/turun untuk memindahkan posisi urutan unit sekolah.
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {visibleUnits.map((u, idx) => (
              <div
                key={`reorder-act-${u.id}`}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-md bg-emerald-700 text-white font-mono font-extrabold text-[11px] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-slate-800 truncate">{u.shortName}</span>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">({u.id})</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0 || isReordering}
                    onClick={() => handleMoveUnitOrder(idx, 'up')}
                    className="p-1 rounded-lg bg-white hover:bg-emerald-50 border border-slate-200 text-slate-700 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                    title="Pindah ke posisi atas"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === visibleUnits.length - 1 || isReordering}
                    onClick={() => handleMoveUnitOrder(idx, 'down')}
                    className="p-1 rounded-lg bg-white hover:bg-emerald-50 border border-slate-200 text-slate-700 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                    title="Pindah ke posisi bawah"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unit Cards Grid */}
      {visibleUnits.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
          Tidak ada unit sekolah yang sesuai dengan cakupan akun Anda.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {visibleUnits.map((unit, idx) => {
            const isOpen = unit.isOpen !== false;
            const checks = evaluateReadiness(unit);
            const passedCount = checks.filter((c) => c.ok).length;
            const allReady = passedCount === checks.length;
            const isBusy = savingUnitId === unit.id;
            const draftNotice = noticeDrafts[unit.id] ?? unit.closedNotice ?? DEFAULT_CLOSED_NOTICE;

            return (
              <div
                key={unit.id}
                className={`rounded-2xl border-2 shadow-sm overflow-hidden flex flex-col justify-between transition-all ${
                  isOpen
                    ? 'bg-white border-emerald-200'
                    : 'bg-slate-50/90 border-slate-200'
                }`}
              >
                {/* Card Header */}
                <div
                  className={`p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isOpen
                      ? 'bg-emerald-50/50 border-emerald-100'
                      : 'bg-slate-100/80 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-300 text-slate-700 font-mono font-extrabold text-[11px]">
                        Urutan #{idx + 1}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-lg font-mono font-extrabold text-xs ${
                          isOpen ? 'bg-[#14532d] text-white' : 'bg-slate-500 text-white'
                        }`}
                      >
                        {unit.id}
                      </span>
                      {isOpen ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-extrabold">
                          <Unlock className="w-3 h-3" />
                          <span>PENDAFTARAN AKTIF / DIBUKA</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-extrabold">
                          <Lock className="w-3 h-3" />
                          <span>BELUM DIBUKA (NON-AKTIF)</span>
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 mt-2">{unit.name}</h3>
                    <p className="text-[11px] text-slate-500">
                      Pendaftar terdaftar: <strong>{unit.filledQuota}</strong> / {unit.totalQuota}{' '}
                      kursi
                    </p>
                  </div>

                  <div className="shrink-0 flex flex-wrap items-center gap-2 text-left sm:text-right">
                    {canReorderUnits && (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0 || isReordering}
                          onClick={() => handleMoveUnitOrder(idx, 'up')}
                          className="p-1.5 rounded-xl bg-white hover:bg-emerald-50 border border-slate-200 text-slate-700 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                          title="Pindahkan posisi unit ke atas"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === visibleUnits.length - 1 || isReordering}
                          onClick={() => handleMoveUnitOrder(idx, 'down')}
                          className="p-1.5 rounded-xl bg-white hover:bg-emerald-50 border border-slate-200 text-slate-700 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                          title="Pindahkan posisi unit ke bawah"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border ${
                        allReady
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {allReady ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      )}
                      <span>
                        {passedCount} / {checks.length} Kesiapan Siap
                      </span>
                    </span>
                  </div>
                </div>

                {/* Checklist Kesiapan (Reminder Only - Non Blocking) */}
                <div className="p-5 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Pengecekan Persiapan Unit (Pengingat)
                    </h4>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {allReady ? 'Semua siap!' : 'Lengkapi item bertanda silang merah'}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {checks.map((item) => {
                      const ItemIcon = item.icon;
                      const canJump = hasMenuAccess(item.targetMenu, currentUser, roles);
                      return (
                        <div
                          key={item.id}
                          className={`px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs ${
                            item.ok ? 'bg-white' : 'bg-rose-50/40'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            {item.ok ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <ItemIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span
                                  className={`font-bold ${
                                    item.ok ? 'text-slate-800' : 'text-rose-900'
                                  }`}
                                >
                                  {item.label}
                                </span>
                              </div>
                              <p
                                className={`text-[11px] mt-0.5 break-words ${
                                  item.ok ? 'text-slate-500' : 'text-rose-700 font-medium'
                                }`}
                              >
                                {item.detail}
                              </p>
                            </div>
                          </div>

                          {canJump && (
                            <button
                              type="button"
                              onClick={() => setDesktopActiveMenu(item.targetMenu)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 inline-flex items-center gap-1 border transition-colors cursor-pointer ${
                                item.ok
                                  ? 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                                  : 'bg-rose-100 hover:bg-rose-200 text-rose-800 border-rose-200'
                              }`}
                            >
                              <span>{item.ok ? 'Lihat' : 'Lengkapi'}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {!allReady && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        Ada <strong>{checks.length - passedCount}</strong> item persiapan yang belum
                        lengkap. Daftar ini hanya sebagai pengingat agar pendaftaran berjalan lancar—Anda{' '}
                        <strong>tetap bisa mengaktifkan pendaftaran</strong> sekarang jika diperlukan.
                      </span>
                    </div>
                  )}
                </div>

                {/* Activation Action Footer */}
                <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Keterangan saat status unit Belum Dibuka:
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={draftNotice}
                        onChange={(e) =>
                          setNoticeDrafts((prev) => ({
                            ...prev,
                            [unit.id]: e.target.value,
                          }))
                        }
                        placeholder={DEFAULT_CLOSED_NOTICE}
                        className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveNoticeOnly(unit)}
                        disabled={isBusy}
                        className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Simpan Pesan</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <span className="text-[11px] text-slate-500">
                      Status publik di Landing Page & Formulir Wali:{' '}
                      <strong className={isOpen ? 'text-emerald-700' : 'text-slate-700'}>
                        {isOpen ? 'Dapat Diklik (Dibuka)' : 'Nonaktif / Abu-abu (Belum Dibuka)'}
                      </strong>
                    </span>

                    {isOpen ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleUnit(unit, false)}
                        className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-xs font-extrabold shadow-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        <Lock className="w-4 h-4" />
                        <span>{isBusy ? 'Menyimpan...' : 'Nonaktifkan (Belum Dibuka)'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleUnit(unit, true)}
                        className="px-4 py-2.5 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        <Power className="w-4 h-4" />
                        <span>{isBusy ? 'Mengaktifkan...' : 'Aktifkan Pendaftaran'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
