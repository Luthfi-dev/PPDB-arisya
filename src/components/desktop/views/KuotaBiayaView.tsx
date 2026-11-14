import React, { useState } from 'react';
import {
  Coins,
  Pencil,
  Eye,
  Users,
  Power,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Plus,
  Building2,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { UnitQuotaFee } from '../../../types/ppdb';
import { UnitBadge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { hasActionPermission, isMasterUser } from '../../../utils/rbac';
import { CurrencyInput, PlainNumberInput } from '../../common/FormattedNumberInputs';

export const KuotaBiayaView: React.FC = () => {
  const {
    units,
    createUnit,
    updateUnitQuotaFee,
    updateUnitOfflineCount,
    reorderUnits,
    currentUser,
    roles,
    showToast,
  } = usePPDB();

  const canEdit = hasActionPermission(currentUser, 'Kuota & Biaya', 'edit', roles);
  const roleLower = (currentUser?.role || '').toLowerCase();
  const isMasterOrYayasan =
    isMasterUser(currentUser) ||
    roleLower.includes('super admin') ||
    roleLower.includes('admin yayasan') ||
    currentUser?.schoolId === 'MASTER';
  const canCreateUnit = isMasterOrYayasan && canEdit;
  const canReorder = isMasterOrYayasan && canEdit && units.length > 1;
  const [isReordering, setIsReordering] = useState(false);

  const visibleUnits = isMasterOrYayasan
    ? units
    : units.filter((u) => !currentUser?.schoolId || u.id === currentUser.schoolId);

  const handleMoveUnit = async (index: number, direction: 'up' | 'down') => {
    if (!canReorder || isReordering) return;
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

  // Edit Unit Modal State
  const [selectedUnit, setSelectedUnit] = useState<UnitQuotaFee | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [quota, setQuota] = useState(150);
  const [formFee, setFormFee] = useState(250000);
  const [reRegFee, setReRegFee] = useState(3500000);
  const [isOpen, setIsOpen] = useState(true);
  const [closedNotice, setClosedNotice] = useState('');

  // Update Offline Counter Modal State (numeric counter only, accumulates into sisa kuota)
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [offlineUnitId, setOfflineUnitId] = useState<string>(() => visibleUnits[0]?.id || units[0]?.id || 'TK01');
  const [offlineCountInput, setOfflineCountInput] = useState<number>(0);
  const [isSavingOffline, setIsSavingOffline] = useState(false);

  // Add New Unit Modal State (Master Admin / Admin Yayasan)
  const [isAddUnitModalOpen, setIsAddUnitModalOpen] = useState(false);
  const [newUnitId, setNewUnitId] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitShortName, setNewUnitShortName] = useState('');
  const [newUnitQuota, setNewUnitQuota] = useState(100);
  const [newUnitOfflineCount, setNewUnitOfflineCount] = useState(0);
  const [newUnitFormFee, setNewUnitFormFee] = useState(250000);
  const [newUnitReRegFee, setNewUnitReRegFee] = useState(3500000);
  const [newUnitFacilitiesText, setNewUnitFacilitiesText] = useState('Kurikulum Terpadu & Tahfidz Al-Qur\'an\nLingkungan Belajar Islami & Asri');
  const [newUnitIsOpen, setNewUnitIsOpen] = useState(true);
  const [isCreatingUnit, setIsCreatingUnit] = useState(false);

  const handleOpenEdit = (unit: UnitQuotaFee) => {
    if (!canEdit || !isMasterOrYayasan) return;
    setSelectedUnit(unit);
    setQuota(unit.totalQuota);
    setFormFee(unit.formFee);
    setReRegFee(unit.reRegFee);
    setIsOpen(unit.isOpen !== false);
    setClosedNotice(
      unit.closedNotice ||
        'Pendaftaran calon siswa baru untuk unit ini sedang ditutup atau belum dibuka. Silakan hubungi panitia PPDB Yayasan Ar-Risalah Aceh.'
    );
    setIsEditOpen(true);
  };

  const handleSave = async () => {
    if (!selectedUnit || !canEdit) return;
    if (!Number.isFinite(quota) || quota < 1) {
      showToast('Kapasitas kuota unit minimal 1 siswa.', 'error');
      return;
    }
    const ok = await updateUnitQuotaFee(selectedUnit.id, Math.floor(quota), formFee, reRegFee, isOpen, closedNotice);
    if (ok) {
      setIsEditOpen(false);
      setSelectedUnit(null);
    }
  };

  const handleToggleUnitStatusDirect = async (unit: UnitQuotaFee) => {
    if (!canEdit || !isMasterOrYayasan) return;
    const newStatus = unit.isOpen === false ? true : false;
    await updateUnitQuotaFee(
      unit.id,
      unit.totalQuota,
      unit.formFee,
      unit.reRegFee,
      newStatus,
      unit.closedNotice ||
        'Pendaftaran calon siswa baru untuk unit ini sedang ditutup atau belum dibuka. Silakan hubungi panitia PPDB Yayasan Ar-Risalah Aceh.'
    );
  };

  const handleOpenOfflineCounterModal = (targetUnit?: UnitQuotaFee) => {
    const chosen = targetUnit || visibleUnits[0] || units[0];
    if (!chosen) return;
    setOfflineUnitId(chosen.id);
    setOfflineCountInput(chosen.offlineCount ?? 0);
    setIsOfflineModalOpen(true);
  };

  const handleSelectOfflineUnit = (unitId: string) => {
    setOfflineUnitId(unitId);
    const found = units.find((u) => u.id === unitId);
    setOfflineCountInput(found?.offlineCount ?? 0);
  };

  const handleSaveOfflineCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!Number.isFinite(offlineCountInput) || offlineCountInput < 0) {
      showToast('Jumlah pendaftar offline harus angka >= 0.', 'error');
      return;
    }
    setIsSavingOffline(true);
    try {
      const ok = await updateUnitOfflineCount(offlineUnitId, Math.floor(offlineCountInput));
      if (ok) {
        setIsOfflineModalOpen(false);
      }
    } finally {
      setIsSavingOffline(false);
    }
  };

  const handleCreateUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateUnit) return;

    const cleanId = newUnitId.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,10}$/.test(cleanId)) {
      showToast('Kode unit wajib 2-10 huruf kapital/angka tanpa spasi (contoh: KB01, MA01).', 'error');
      return;
    }
    if (cleanId === 'MASTER' || cleanId === 'ALL') {
      showToast('Kode unit tidak boleh menggunakan MASTER atau ALL.', 'error');
      return;
    }
    if (units.some((u) => u.id.toUpperCase() === cleanId)) {
      showToast(`Kode unit "${cleanId}" sudah terdaftar.`, 'error');
      return;
    }
    if (newUnitName.trim().length < 2 || newUnitShortName.trim().length < 2) {
      showToast('Nama resmi unit dan singkatan jenjang wajib diisi.', 'error');
      return;
    }
    if (!Number.isFinite(newUnitQuota) || newUnitQuota < 1) {
      showToast('Kapasitas kuota minimal 1 siswa.', 'error');
      return;
    }

    const facilities = newUnitFacilitiesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    setIsCreatingUnit(true);
    try {
      const ok = await createUnit({
        id: cleanId,
        name: newUnitName.trim(),
        shortName: newUnitShortName.trim(),
        totalQuota: Math.floor(newUnitQuota),
        offlineCount: Math.max(0, Math.floor(newUnitOfflineCount || 0)),
        formFee: Math.max(0, Math.floor(newUnitFormFee || 0)),
        reRegFee: Math.max(0, Math.floor(newUnitReRegFee || 0)),
        isOpen: newUnitIsOpen,
        facilities,
      });
      if (ok) {
        setNewUnitId('');
        setNewUnitName('');
        setNewUnitShortName('');
        setNewUnitQuota(100);
        setNewUnitOfflineCount(0);
        setIsAddUnitModalOpen(false);
      }
    } finally {
      setIsCreatingUnit(false);
    }
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const activeOfflineUnitObj = units.find((u) => u.id === offlineUnitId) || visibleUnits[0] || units[0];
  const activeOfflineOnlineCount = activeOfflineUnitObj
    ? activeOfflineUnitObj.onlineCount ?? Math.max(0, activeOfflineUnitObj.filledQuota - (activeOfflineUnitObj.offlineCount ?? 0))
    : 0;
  const activeOfflineTotalQuota = activeOfflineUnitObj?.totalQuota ?? 0;
  const previewTotalFilled = activeOfflineOnlineCount + Math.max(0, Math.floor(offlineCountInput || 0));
  const previewRemainingOnline = Math.max(0, activeOfflineTotalQuota - previewTotalFilled);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-600" />
            <span>Manajemen Unit Sekolah, Daya Tampung, Kuota Offline &amp; Tarif</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tambah unit sekolah baru, atur urutan tampilan, perbarui angka pendaftar offline (otomatis diakumulasi ke sisa kuota online), serta biaya registrasi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canCreateUnit && (
            <button
              type="button"
              onClick={() => setIsAddUnitModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Unit Baru</span>
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => handleOpenOfflineCounterModal()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              <Users className="w-4 h-4 text-emerald-300" />
              <span>Update Angka Pendaftar Offline</span>
            </button>
          )}

          {!canEdit && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">
              <Eye className="w-4 h-4 text-slate-500" />
              <span>Mode Baca (Lihat Saja)</span>
            </div>
          )}
        </div>
      </div>

      {/* Unit Reorder Quick Bar (Master Admin & Admin Yayasan) */}
      {canReorder && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <ArrowUpDown className="w-4 h-4 text-emerald-600" />
              <span>Urutan Tampilan Unit Sekolah (Master &amp; Admin Yayasan)</span>
            </div>
            <span className="text-[11px] text-slate-500">
              Geser ke atas / bawah untuk mengatur posisi urutan {units.length} unit di seluruh portal.
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {units.map((u, idx) => (
              <div
                key={`order-${u.id}`}
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
                    onClick={() => handleMoveUnit(idx, 'up')}
                    className="p-1 rounded-lg bg-white hover:bg-emerald-50 border border-slate-200 text-slate-700 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                    title="Geser posisi unit ke atas"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === units.length - 1 || isReordering}
                    onClick={() => handleMoveUnit(idx, 'down')}
                    className="p-1 rounded-lg bg-white hover:bg-emerald-50 border border-slate-200 text-slate-700 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                    title="Geser posisi unit ke bawah"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dynamic Unit Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visibleUnits.map((unit, idx) => {
          const offlineCount = Math.max(0, Number(unit.offlineCount) || 0);
          const onlineCount =
            typeof unit.onlineCount === 'number'
              ? unit.onlineCount
              : Math.max(0, unit.filledQuota - offlineCount);
          const totalFilled = unit.filledQuota;
          const fillPercentage = unit.totalQuota > 0 ? Math.round((totalFilled / unit.totalQuota) * 100) : 0;
          const remaining = Math.max(0, unit.totalQuota - totalFilled);
          const unitIsOpen = unit.isOpen !== false;

          return (
            <div
              key={unit.id}
              className={`bg-white p-6 rounded-2xl shadow-sm border transition-shadow relative flex flex-col justify-between ${
                unitIsOpen ? 'border-emerald-100 hover:shadow-md' : 'border-rose-200 bg-rose-50/20'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-mono font-extrabold text-slate-700">
                        #{idx + 1}
                      </span>
                      <UnitBadge unit={unit.id} />

                      {/* Registration Status Badge */}
                      <button
                        type="button"
                        onClick={() => handleToggleUnitStatusDirect(unit)}
                        disabled={!canEdit || !isMasterOrYayasan}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold transition-colors ${
                          canEdit && isMasterOrYayasan ? 'cursor-pointer' : 'cursor-default'
                        } ${
                          unitIsOpen
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        }`}
                        title={
                          canEdit && isMasterOrYayasan
                            ? 'Klik untuk mengubah status Buka / Tutup pendaftaran'
                            : 'Status aktivasi unit'
                        }
                      >
                        <Power className="w-3 h-3" />
                        <span>{unitIsOpen ? 'Pendaftaran AKTIF / BUKA' : 'Pendaftaran DITUTUP'}</span>
                      </button>
                    </div>

                    <h4 className="text-lg font-bold text-slate-900 mt-2">
                      {unit.name}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {canReorder && (
                      <div className="flex items-center gap-1 mr-1">
                        <button
                          type="button"
                          disabled={idx === 0 || isReordering}
                          onClick={() => handleMoveUnit(idx, 'up')}
                          className="p-1.5 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 text-slate-700 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                          title="Geser posisi unit ke atas"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === units.length - 1 || isReordering}
                          onClick={() => handleMoveUnit(idx, 'down')}
                          className="p-1.5 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 text-slate-700 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                          title="Geser posisi unit ke bawah"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {canEdit && isMasterOrYayasan && (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(unit)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Closure Notice Warning Box if closed */}
                {!unitIsOpen && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Pendaftaran Unit Ini Sedang Non-Aktif / Ditutup</span>
                    </div>
                    <p className="text-[11px] text-rose-700 leading-tight">
                      Pesan Pemberitahuan untuk Wali: &quot;{unit.closedNotice || 'Pendaftaran siswa baru untuk unit ini sedang ditutup.'}&quot;
                    </p>
                  </div>
                )}

                {/* Quota Progress & Online/Offline Breakdown */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500 font-medium">
                      Total Akumulasi Daya Tampung:
                    </span>
                    <span className="font-bold text-slate-900 text-sm tabular-nums">
                      {totalFilled} / {unit.totalQuota} Kursi ({fillPercentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        remaining === 0 ? 'bg-rose-600' : 'bg-[#16a34a]'
                      }`}
                      style={{ width: `${Math.min(100, fillPercentage)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                    <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/70">
                      <span className="text-slate-400 block text-[10px]">Online DB</span>
                      <span className="font-bold text-slate-800 tabular-nums">{onlineCount} siswa</span>
                    </div>
                    <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/70 flex items-center justify-between gap-1">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Offline</span>
                        <span className="font-bold text-amber-700 tabular-nums">{offlineCount} siswa</span>
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleOpenOfflineCounterModal(unit)}
                          className="p-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer"
                          title="Update angka pendaftar offline"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/70">
                      <span className="text-slate-400 block text-[10px]">Sisa Kuota Online</span>
                      <span className={`font-bold tabular-nums ${remaining === 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {remaining} kursi
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fees Grid */}
                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/60">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                      Biaya Formulir
                    </span>
                    <span className="font-bold text-emerald-800 font-mono text-base tabular-nums mt-0.5 block">
                      {formatRupiah(unit.formFee)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200/60">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                      Biaya Daftar Ulang
                    </span>
                    <span className="font-bold text-teal-800 font-mono text-base tabular-nums mt-0.5 block">
                      {formatRupiah(unit.reRegFee)}
                    </span>
                  </div>
                </div>

                {/* Facilities Badges */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
                    Fasilitas Unggulan Unit:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(unit.facilities || []).map((f, fIdx) => (
                      <span
                        key={fIdx}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Edit Kuota, Biaya & Status Pendaftaran */}
      {selectedUnit && (
        <Modal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          title={`Edit Kuota, Biaya & Status Pendaftaran: ${selectedUnit.name}`}
          description={`Pengaturan daya tampung, biaya masuk, serta aktif/non-aktifkan pendaftaran unit ${selectedUnit.id}`}
          icon={<Coins className="w-6 h-6 text-emerald-600" />}
          confirmLabel="Simpan & Terapkan"
          onConfirm={handleSave}
        >
          <div className="space-y-4 py-2 text-xs">
            {/* Status Toggle Control */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-extrabold text-slate-900 block text-xs">
                    Status Pendaftaran Unit Ini
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Aktifkan untuk membuka pendaftaran, atau matikan untuk menutup sementara.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(!isOpen)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isOpen
                      ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                      : 'bg-rose-600 text-white shadow-sm hover:bg-rose-700'
                  }`}
                >
                  <Power className="w-4 h-4" />
                  <span>{isOpen ? 'Pendaftaran BUKA' : 'Pendaftaran DITUTUP'}</span>
                </button>
              </div>

              {!isOpen && (
                <div>
                  <label className="text-[11px] font-bold text-rose-800 block mb-1">
                    Pesan Pemberitahuan Penutupan Pendaftaran (Tampil saat Wali Klik Unit):
                  </label>
                  <textarea
                    rows={3}
                    value={closedNotice}
                    onChange={(e) => setClosedNotice(e.target.value)}
                    placeholder="Contoh: Pendaftaran gelombang 1 untuk unit SDIT Ar-Risalah telah memenuhi kuota. Pendaftaran gelombang 2 akan dibuka pada tanggal 15 Mei 2026."
                    className="w-full bg-white border border-rose-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Kapasitas / Daya Tampung Siswa (Total Kuota) *
              </label>
              <PlainNumberInput
                max={100000}
                value={quota}
                onChange={(val) => setQuota(val)}
                placeholder="Contoh: 150"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Terisi saat ini: {selectedUnit.filledQuota} siswa ({selectedUnit.onlineCount ?? 0} online + {selectedUnit.offlineCount ?? 0} offline).
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Biaya Formulir Pendaftaran (Rp) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  Rp
                </span>
                <CurrencyInput
                  value={formFee}
                  onChange={(val) => setFormFee(val)}
                  placeholder="Contoh: 250.000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Biaya Daftar Ulang (Rp) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  Rp
                </span>
                <CurrencyInput
                  value={reRegFee}
                  onChange={(val) => setReRegFee(val)}
                  placeholder="Contoh: 3.500.000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Update Angka Pendaftar Offline (Akumulasi Sisa Kuota Online) */}
      {isOfflineModalOpen && (
        <Modal
          isOpen={isOfflineModalOpen}
          onClose={() => setIsOfflineModalOpen(false)}
          title="Perbarui Angka Pendaftar Offline (Akumulasi Kuota)"
          description="Cukup masukkan total angka pendaftar yang datang offline tanpa perlu mengisi biodata siswa. Sisa kuota online dihitung otomatis."
          icon={<Users className="w-6 h-6 text-emerald-700" />}
          maxWidth="md"
          hideFooter
        >
          <form onSubmit={handleSaveOfflineCounter} className="space-y-4 py-1 text-xs">
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
              <span className="font-bold block">Rumus Akumulasi Kuota:</span>
              <span className="text-[11px] text-slate-700">
                Sisa Kuota Online = Total Daya Tampung − (Pendaftar Online + Angka Pendaftar Offline). Dapat diperbarui secara berkala.
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Unit Sekolah *
              </label>
              <select
                value={offlineUnitId}
                onChange={(e) => handleSelectOfflineUnit(e.target.value)}
                disabled={!isMasterOrYayasan}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white disabled:opacity-75"
              >
                {visibleUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.id} - {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Jumlah Total Pendaftar Offline Saat Ini (Angka) *
              </label>
              <PlainNumberInput
                max={100000}
                value={offlineCountInput}
                onChange={(val) => setOfflineCountInput(Math.max(0, val))}
                placeholder="0"
                className="w-full bg-white border border-emerald-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              />
            </div>

            {/* Live Preview Calculation */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Daya Tampung Unit:</span>
                <span className="font-bold font-mono text-slate-900">{activeOfflineTotalQuota} kursi</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pendaftar Online (Database):</span>
                <span className="font-bold font-mono text-slate-900">{activeOfflineOnlineCount} siswa</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pendaftar Offline (Diinput):</span>
                <span className="font-bold font-mono text-amber-700">{Math.max(0, Math.floor(offlineCountInput || 0))} siswa</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-slate-200">
                <span className="font-bold text-slate-800">Sisa Kuota Online Tersedia:</span>
                <span className={`font-extrabold font-mono text-sm ${previewRemainingOnline === 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {previewRemainingOnline} kursi
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsOfflineModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSavingOffline}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-700/20 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSavingOffline ? 'Menyimpan...' : 'Simpan Angka Offline'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Tambah Unit Sekolah Baru */}
      {isAddUnitModalOpen && (
        <Modal
          isOpen={isAddUnitModalOpen}
          onClose={() => setIsAddUnitModalOpen(false)}
          title="Tambah Unit Sekolah Baru"
          description="Menambahkan jenjang/unit baru akan otomatis menyiapkan Form Builder, Kontak Layanan, Grup WA, dan Pengaturan Surat untuk unit tersebut."
          icon={<Building2 className="w-6 h-6 text-emerald-700" />}
          maxWidth="lg"
          hideFooter
        >
          <form onSubmit={handleCreateUnitSubmit} className="space-y-4 py-1 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Kode Unit (Huruf Kapital / Angka) *
                </label>
                <input
                  type="text"
                  value={newUnitId}
                  onChange={(e) => setNewUnitId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="Contoh: KB01 atau MA01"
                  maxLength={10}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Singkatan Jenjang *
                </label>
                <input
                  type="text"
                  value={newUnitShortName}
                  onChange={(e) => setNewUnitShortName(e.target.value)}
                  placeholder="Contoh: KBIT / MAIT"
                  maxLength={20}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nama Lengkap Resmi Unit Sekolah *
              </label>
              <input
                type="text"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                placeholder="Contoh: KBIT Ar-Risalah Aceh atau MAIT Ar-Risalah Aceh"
                maxLength={120}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Kapasitas Total Kuota *
                </label>
                <PlainNumberInput
                  max={10000}
                  value={newUnitQuota}
                  onChange={(val) => setNewUnitQuota(val)}
                  required
                  placeholder="Contoh: 100"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Pendaftar Offline Awal (Opsional)
                </label>
                <PlainNumberInput
                  max={10000}
                  value={newUnitOfflineCount}
                  onChange={(val) => setNewUnitOfflineCount(Math.max(0, val))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Biaya Formulir Pendaftaran (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Rp
                  </span>
                  <CurrencyInput
                    value={newUnitFormFee}
                    onChange={(val) => setNewUnitFormFee(Math.max(0, val))}
                    placeholder="Contoh: 250.000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Biaya Daftar Ulang (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Rp
                  </span>
                  <CurrencyInput
                    value={newUnitReRegFee}
                    onChange={(val) => setNewUnitReRegFee(Math.max(0, val))}
                    placeholder="Contoh: 3.500.000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Fasilitas Unggulan (Satu baris per poin)
              </label>
              <textarea
                rows={3}
                value={newUnitFacilitiesText}
                onChange={(e) => setNewUnitFacilitiesText(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-700">Status Pendaftaran Langsung Dibuka?</span>
              <button
                type="button"
                onClick={() => setNewUnitIsOpen(!newUnitIsOpen)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  newUnitIsOpen ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                }`}
              >
                {newUnitIsOpen ? 'Ya, Dibuka' : 'Tutup Sementara'}
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddUnitModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isCreatingUnit}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-700/20 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isCreatingUnit ? 'Menyimpan...' : 'Simpan Unit Baru'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
