import React, { useState } from 'react';
import {
  Landmark,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Check,
  Star,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { BankAccountConfig } from '../../../types/ppdb';
import { Modal } from '../../common/Modal';
import { canManageBankAccounts } from '../../../utils/rbac';

const BANK_PRESETS: { bankName: string; bankCode: string }[] = [
  { bankName: 'Bank Syariah Indonesia (BSI)', bankCode: 'BSI' },
  { bankName: 'Bank Aceh Syariah', bankCode: 'BANK ACEH' },
  { bankName: 'Bank Rakyat Indonesia (BRI)', bankCode: 'BRI' },
  { bankName: 'Bank Mandiri', bankCode: 'MANDIRI' },
  { bankName: 'Bank Negara Indonesia (BNI)', bankCode: 'BNI' },
  { bankName: 'Bank Central Asia (BCA)', bankCode: 'BCA' },
  { bankName: 'Bank Muamalat Indonesia', bankCode: 'MUAMALAT' },
];

interface BankFormState {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  notes: string;
  isActive: boolean;
  isPrimary: boolean;
}

const emptyFormState = (defaultHolder = 'Yayasan Ar-Risalah Aceh'): BankFormState => ({
  bankName: '',
  bankCode: '',
  accountNumber: '',
  accountHolder: defaultHolder,
  branch: '',
  notes: '',
  isActive: true,
  isPrimary: false,
});

export const RekeningYayasanView: React.FC = () => {
  const {
    bankAccounts,
    addBankAccount,
    updateBankAccount,
    deleteBankAccount,
    currentUser,
    landingConfig,
    showToast,
  } = usePPDB();

  const canManage = canManageBankAccounts(currentUser);
  const defaultHolder = landingConfig?.appTagline || 'Yayasan Ar-Risalah Aceh';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccountConfig | null>(null);
  const [formState, setFormState] = useState<BankFormState>(emptyFormState(defaultHolder));
  const [isSaving, setIsSaving] = useState(false);

  const [accountToDelete, setAccountToDelete] = useState<BankAccountConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeCount = bankAccounts.filter((b) => b.isActive).length;
  const primaryAccount = bankAccounts.find((b) => b.isPrimary && b.isActive) || bankAccounts.find((b) => b.isActive);

  const handleOpenAdd = () => {
    setEditingAccount(null);
    setFormState({
      ...emptyFormState(defaultHolder),
      isPrimary: bankAccounts.length === 0,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (acc: BankAccountConfig) => {
    setEditingAccount(acc);
    setFormState({
      bankName: acc.bankName || '',
      bankCode: acc.bankCode || '',
      accountNumber: acc.accountNumber || '',
      accountHolder: acc.accountHolder || defaultHolder,
      branch: acc.branch || '',
      notes: acc.notes || '',
      isActive: Boolean(acc.isActive),
      isPrimary: Boolean(acc.isPrimary),
    });
    setIsModalOpen(true);
  };

  const handleCopyNumber = (acc: BankAccountConfig) => {
    navigator.clipboard.writeText(acc.accountNumber.replace(/\s+/g, ''));
    setCopiedId(acc.id);
    showToast(`Nomor rekening ${acc.bankCode || acc.bankName} disalin.`);
    setTimeout(() => setCopiedId((prev) => (prev === acc.id ? null : prev)), 2000);
  };

  const handleSave = async () => {
    if (!canManage || isSaving) return;

    const cleanName = formState.bankName.trim();
    const cleanNum = formState.accountNumber.trim();
    const cleanHolder = formState.accountHolder.trim();

    if (cleanName.length < 2) {
      showToast('Nama bank wajib diisi minimal 2 karakter.', 'error');
      return;
    }
    if (!/^[0-9\s-]{5,30}$/.test(cleanNum) || cleanNum.replace(/\D/g, '').length < 5) {
      showToast('Nomor rekening wajib berupa angka (minimal 5 digit).', 'error');
      return;
    }
    if (cleanHolder.length < 2) {
      showToast('Nama pemilik rekening (Atas Nama) wajib diisi.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        bankName: cleanName,
        bankCode:
          formState.bankCode.trim().toUpperCase() ||
          cleanName.split(/\s+/)[0]?.toUpperCase().slice(0, 12) ||
          'BANK',
        accountNumber: cleanNum.replace(/\s+/g, ' '),
        accountHolder: cleanHolder,
        branch: formState.branch.trim(),
        notes: formState.notes.trim(),
        isActive: formState.isPrimary ? true : formState.isActive,
        isPrimary: formState.isPrimary,
      };

      const ok = editingAccount
        ? await updateBankAccount(editingAccount.id, payload)
        : await addBankAccount({ ...payload, sortOrder: bankAccounts.length + 1 });

      if (ok) {
        setIsModalOpen(false);
        setEditingAccount(null);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPrimary = async (acc: BankAccountConfig) => {
    if (!canManage) return;
    await updateBankAccount(acc.id, {
      ...acc,
      isPrimary: true,
      isActive: true,
    });
  };

  const handleToggleActive = async (acc: BankAccountConfig) => {
    if (!canManage) return;
    await updateBankAccount(acc.id, {
      ...acc,
      isActive: !acc.isActive,
      isPrimary: !acc.isActive ? acc.isPrimary : false,
    });
  };

  const handleConfirmDelete = async () => {
    if (!canManage || !accountToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const ok = await deleteBankAccount(accountToDelete.id);
      if (ok) {
        setAccountToDelete(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Manajemen Rekening Bank Yayasan (Multi-Bank)</span>
            </h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800">
              <ShieldCheck className="w-3 h-3" />
              Master &amp; Admin Yayasan
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Tambahkan, ubah, atau aktifkan beberapa rekening bank resmi yayasan. Seluruh rekening yang berstatus{' '}
            <strong className="text-emerald-700">Aktif</strong> otomatis tampil pada formulir pendaftaran, portal wali siswa,
            dan halaman verifikasi pembayaran.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Rekening Bank</span>
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Rekening</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{bankAccounts.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Landmark className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Rekening Aktif</p>
            <p className="text-2xl font-black text-emerald-900 mt-1">{activeCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-900 to-emerald-800 p-4 rounded-2xl text-white shadow-sm flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Rekening Utama (Default)</p>
            <p className="text-sm font-extrabold truncate mt-0.5">
              {primaryAccount ? `${primaryAccount.bankCode} · ${primaryAccount.accountNumber}` : 'Belum ditentukan'}
            </p>
            <p className="text-[11px] text-emerald-200 truncate">
              {primaryAccount ? `a.n. ${primaryAccount.accountHolder}` : 'Tambahkan rekening aktif'}
            </p>
          </div>
          <Star className="w-6 h-6 text-amber-300 fill-amber-300 shrink-0" />
        </div>
      </div>

      {/* Warning if no active accounts */}
      {activeCount === 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Belum Ada Rekening Aktif</p>
            <p className="text-amber-800 mt-0.5">
              Wali siswa tidak akan melihat nomor rekening tujuan transfer sampai minimal satu rekening diaktifkan atau ditambahkan.
            </p>
          </div>
        </div>
      )}

      {/* Bank Accounts Cards Grid */}
      {bankAccounts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-3">
          <Landmark className="w-10 h-10 text-slate-300 mx-auto" />
          <div>
            <h4 className="text-sm font-bold text-slate-800">Belum Ada Rekening Bank Terdaftar</h4>
            <p className="text-xs text-slate-500 mt-1">
              Klik tombol &ldquo;Tambah Rekening Bank&rdquo; untuk menambahkan rekening BSI, Bank Aceh, BRI, Mandiri, atau bank lainnya.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Rekening Pertama</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {bankAccounts.map((acc) => (
            <div
              key={acc.id}
              className={`bg-white rounded-2xl border p-5 shadow-2xs flex flex-col justify-between gap-4 transition-all ${
                acc.isPrimary
                  ? 'border-emerald-400 ring-1 ring-emerald-200'
                  : acc.isActive
                  ? 'border-slate-200 hover:border-emerald-200'
                  : 'border-slate-200 bg-slate-50/70 opacity-80'
              }`}
            >
              <div className="space-y-3">
                {/* Top Meta Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-black tracking-wide shrink-0 ${
                        acc.isActive ? 'bg-[#14532d] text-white' : 'bg-slate-300 text-slate-700'
                      }`}
                    >
                      {acc.bankCode || 'BANK'}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-extrabold text-slate-900 truncate">{acc.bankName}</h4>
                      {acc.branch && (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                          <Building2 className="w-3 h-3 shrink-0" />
                          <span>{acc.branch}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {acc.isPrimary && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        Utama
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                        acc.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {acc.isActive ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Aktif
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" /> Nonaktif
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Account Number Box */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nomor Rekening</p>
                    <p className="font-mono text-lg sm:text-xl font-black text-slate-900 tracking-wider mt-0.5 break-all">
                      {acc.accountNumber}
                    </p>
                    <p className="text-xs font-semibold text-slate-700 mt-0.5">a.n. {acc.accountHolder}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyNumber(acc)}
                    className="px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    title="Salin Nomor Rekening"
                  >
                    {copiedId === acc.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                </div>

                {acc.notes && (
                  <p className="text-[11px] text-slate-600 bg-emerald-50/50 border border-emerald-100 rounded-xl px-3 py-2 leading-relaxed">
                    {acc.notes}
                  </p>
                )}
              </div>

              {/* Actions Footer */}
              {canManage && (
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {!acc.isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(acc)}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Star className="w-3 h-3" />
                        <span>Jadikan Utama</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(acc)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                        acc.isActive
                          ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      {acc.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(acc)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountToDelete(acc)}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Tambah / Edit Rekening */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={editingAccount ? 'Edit Rekening Bank Yayasan' : 'Tambah Rekening Bank Yayasan'}
        description="Isi detail rekening bank resmi yayasan untuk keperluan transfer formulir dan daftar ulang calon siswa."
        confirmLabel={isSaving ? 'Menyimpan...' : editingAccount ? 'Simpan Perubahan' : 'Tambahkan Rekening'}
        confirmDisabled={isSaving}
        onConfirm={handleSave}
      >
        <div className="space-y-4 py-1 text-xs">
          {/* Quick Bank Presets */}
          <div>
            <span className="block text-[11px] font-bold text-slate-500 mb-1.5">Pilih Cepat Bank Populer:</span>
            <div className="flex flex-wrap gap-1.5">
              {BANK_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.bankCode}
                  onClick={() =>
                    setFormState((prev) => ({
                      ...prev,
                      bankName: preset.bankName,
                      bankCode: preset.bankCode,
                    }))
                  }
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                    formState.bankCode === preset.bankCode
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {preset.bankCode}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Nama Bank *</label>
              <input
                type="text"
                value={formState.bankName}
                onChange={(e) => setFormState({ ...formState, bankName: e.target.value })}
                placeholder="Contoh: Bank Syariah Indonesia (BSI)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Singkatan / Kode *</label>
              <input
                type="text"
                maxLength={20}
                value={formState.bankCode}
                onChange={(e) => setFormState({ ...formState, bankCode: e.target.value.toUpperCase() })}
                placeholder="Contoh: BSI"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nomor Rekening *</label>
              <input
                type="text"
                value={formState.accountNumber}
                onChange={(e) => setFormState({ ...formState, accountNumber: e.target.value })}
                placeholder="Contoh: 7109283741"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Atas Nama (Pemilik Rekening) *</label>
              <input
                type="text"
                value={formState.accountHolder}
                onChange={(e) => setFormState({ ...formState, accountHolder: e.target.value })}
                placeholder="Contoh: Yayasan Ar-Risalah Aceh"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Kantor Cabang (Opsional)</label>
            <input
              type="text"
              value={formState.branch}
              onChange={(e) => setFormState({ ...formState, branch: e.target.value })}
              placeholder="Contoh: KC Bireuen / KC Banda Aceh"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Catatan Panduan Transfer (Opsional)</label>
            <textarea
              rows={2}
              value={formState.notes}
              onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
              placeholder="Contoh: Cantumkan Nomor Pendaftaran pada berita transfer."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={formState.isPrimary ? true : formState.isActive}
                disabled={formState.isPrimary}
                onChange={(e) => setFormState({ ...formState, isActive: e.target.checked })}
                className="rounded text-emerald-600 focus:ring-emerald-600"
              />
              <span className="font-semibold text-slate-800">Aktif (Tampilkan ke Wali)</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={formState.isPrimary}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    isPrimary: e.target.checked,
                    isActive: e.target.checked ? true : formState.isActive,
                  })
                }
                className="rounded text-amber-600 focus:ring-amber-600"
              />
              <span className="font-semibold text-amber-900">Jadikan Rekening Utama</span>
            </label>
          </div>
        </div>
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      {accountToDelete && (
        <Modal
          isOpen={Boolean(accountToDelete)}
          onClose={() => !isDeleting && setAccountToDelete(null)}
          title="Hapus Rekening Bank Yayasan"
          description={`Konfirmasi penghapusan rekening ${accountToDelete.bankName}`}
          confirmLabel={isDeleting ? 'Menghapus...' : 'Ya, Hapus Rekening'}
          confirmVariant="danger"
          confirmDisabled={isDeleting}
          onConfirm={handleConfirmDelete}
        >
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
            <p className="font-bold">
              Anda akan menghapus rekening berikut dari daftar tujuan transfer yayasan:
            </p>
            <div className="p-3 rounded-xl bg-white border border-rose-200 font-mono">
              <div className="font-bold text-slate-900">{accountToDelete.bankName}</div>
              <div className="text-sm font-black text-rose-700 mt-0.5">{accountToDelete.accountNumber}</div>
              <div className="text-[11px] font-sans text-slate-600">a.n. {accountToDelete.accountHolder}</div>
            </div>
            <p className="text-[11px] text-rose-700">
              Riwayat transaksi pembayaran lama yang pernah mencatat rekening ini tetap tersimpan pada arsip keuangan.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
};
