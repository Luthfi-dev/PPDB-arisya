import React, { useState } from 'react';
import {
  Mail,
  ShieldCheck,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Server,
  Eye,
  EyeOff,
  HelpCircle,
  ExternalLink,
  Plus,
  Trash2,
  RefreshCw,
  Layers,
  ArrowUp,
  ArrowDown,
  Power,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { isSuperAdmin } from '../../../utils/rbac';
import { SmtpAccount } from '../../../types/ppdb';

export const SmtpConfigView: React.FC = () => {
  const { currentUser, smtpConfig, updateSmtpConfig, testSmtpConnection, showToast } = usePPDB();

  const isSuper = isSuperAdmin(currentUser);

  // Global settings
  const [enabled, setEnabled] = useState(smtpConfig.enabled ?? true);
  const [host, setHost] = useState(smtpConfig.host || 'smtp.gmail.com');
  const [port, setPort] = useState(smtpConfig.port || 465);
  const [secure, setSecure] = useState(smtpConfig.secure ?? true);
  const [senderEmail, setSenderEmail] = useState(smtpConfig.senderEmail || 'ppdb.arrisalah.aceh@gmail.com');
  const [senderName, setSenderName] = useState(smtpConfig.senderName || 'Panitia PPDB Yayasan Ar-Risalah Aceh');
  const [authPassword, setAuthPassword] = useState(smtpConfig.authPassword || '');
  const [showPassword, setShowPassword] = useState(false);

  // Multi-Account Rotation State
  const [accounts, setAccounts] = useState<SmtpAccount[]>(() => {
    if (Array.isArray(smtpConfig.accounts) && smtpConfig.accounts.length > 0) {
      return smtpConfig.accounts;
    }
    return [
      {
        id: 'acc-primary',
        senderEmail: smtpConfig.senderEmail || 'ppdb.arrisalah.aceh@gmail.com',
        senderName: smtpConfig.senderName || 'Panitia PPDB Yayasan Ar-Risalah Aceh',
        authPassword: smtpConfig.authPassword || '',
        host: smtpConfig.host || 'smtp.gmail.com',
        port: smtpConfig.port || 465,
        secure: smtpConfig.secure ?? true,
        isActive: true,
        priority: 1,
      },
    ];
  });

  // Modal for adding new account
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('Panitia PPDB Yayasan Ar-Risalah Aceh');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [testRecipient, setTestRecipient] = useState(currentUser?.email || senderEmail);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Synchronize local form fields whenever smtpConfig changes or loads from server
  React.useEffect(() => {
    if (smtpConfig) {
      setEnabled(smtpConfig.enabled ?? true);
      setHost(smtpConfig.host || 'smtp.gmail.com');
      setPort(smtpConfig.port || 465);
      setSecure(smtpConfig.secure ?? true);
      setSenderEmail(smtpConfig.senderEmail || 'ppdb.arrisalah.aceh@gmail.com');
      setSenderName(smtpConfig.senderName || 'Panitia PPDB Yayasan Ar-Risalah Aceh');
      if (typeof smtpConfig.authPassword === 'string') {
        setAuthPassword(smtpConfig.authPassword);
      }
      if (Array.isArray(smtpConfig.accounts) && smtpConfig.accounts.length > 0) {
        setAccounts(smtpConfig.accounts);
      } else {
        setAccounts([
          {
            id: 'acc-primary',
            senderEmail: smtpConfig.senderEmail || 'ppdb.arrisalah.aceh@gmail.com',
            senderName: smtpConfig.senderName || 'Panitia PPDB Yayasan Ar-Risalah Aceh',
            authPassword: smtpConfig.authPassword || '',
            host: smtpConfig.host || 'smtp.gmail.com',
            port: smtpConfig.port || 465,
            secure: smtpConfig.secure ?? true,
            isActive: true,
            priority: 1,
          },
        ]);
      }
    }
  }, [smtpConfig]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isSuper) {
      showToast('Akses ditolak: Hanya Super Admin Master yang berhak mengubah konfigurasi SMTP.', 'error');
      return;
    }

    // Ensure the primary account in the list reflects the primary form fields if updated
    const updatedAccounts = accounts.map((acc, idx) => {
      if (idx === 0) {
        return {
          ...acc,
          senderEmail: senderEmail.trim(),
          senderName: senderName.trim(),
          authPassword: authPassword.trim() ? authPassword.trim() : acc.authPassword,
          host: host.trim(),
          port: Number(port),
          secure,
        };
      }
      return acc;
    });

    await updateSmtpConfig({
      enabled,
      host: host.trim(),
      port: Number(port),
      secure,
      senderEmail: senderEmail.trim(),
      senderName: senderName.trim(),
      authPassword: authPassword.trim(),
      accounts: updatedAccounts,
    });
  };

  const handleAddAccount = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      showToast('Masukkan alamat Gmail yang valid!', 'error');
      return;
    }
    if (!newPassword.trim()) {
      showToast('Masukkan 16-karakter Sandi Aplikasi Google untuk akun baru!', 'error');
      return;
    }

    const newAcc: SmtpAccount = {
      id: `acc-${Date.now()}`,
      senderEmail: newEmail.trim().toLowerCase(),
      senderName: newName.trim() || senderName,
      authPassword: newPassword.trim(),
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      isActive: true,
      priority: accounts.length + 1,
    };

    const nextAccounts = [...accounts, newAcc];
    const ok = await updateSmtpConfig({
      enabled,
      host: host.trim(),
      port: Number(port),
      secure,
      senderEmail: senderEmail.trim(),
      senderName: senderName.trim(),
      authPassword: authPassword.trim(),
      accounts: nextAccounts,
    });
    if (ok) {
      setAccounts(nextAccounts);
      setIsAddModalOpen(false);
      setNewEmail('');
      setNewPassword('');
    }
  };

  const handleDeleteAccount = async (accId: string) => {
    if (accounts.length <= 1) {
      showToast('Harus menyisakan minimal 1 akun SMTP utama!', 'error');
      return;
    }
    const nextAccounts = accounts.filter((a) => a.id !== accId).map((a, i) => ({ ...a, priority: i + 1 }));
    const ok = await updateSmtpConfig({
      enabled,
      host: host.trim(),
      port: Number(port),
      secure,
      senderEmail: nextAccounts[0]?.senderEmail || senderEmail,
      senderName: nextAccounts[0]?.senderName || senderName,
      authPassword: nextAccounts[0]?.authPassword || authPassword,
      accounts: nextAccounts,
    });
    if (ok) {
      setAccounts(nextAccounts);
    }
  };

  const handleToggleAccountActive = async (accId: string) => {
    const nextAccounts = accounts.map((a) => (a.id === accId ? { ...a, isActive: !a.isActive } : a));
    const ok = await updateSmtpConfig({
      accounts: nextAccounts,
    });
    if (ok) {
      setAccounts(nextAccounts);
    }
  };

  const handleMovePriority = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === accounts.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const next = [...accounts];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;

    const reordered = next.map((a, i) => ({ ...a, priority: i + 1 }));
    const ok = await updateSmtpConfig({
      senderEmail: reordered[0]?.senderEmail || senderEmail,
      senderName: reordered[0]?.senderName || senderName,
      authPassword: reordered[0]?.authPassword || authPassword,
      accounts: reordered,
    });
    if (ok) {
      setAccounts(reordered);
      if (reordered[0]) {
        setSenderEmail(reordered[0].senderEmail);
        setSenderName(reordered[0].senderName);
        if (reordered[0].authPassword) setAuthPassword(reordered[0].authPassword);
      }
    }
  };

  const handleTestSend = async () => {
    if (!isSuper) {
      showToast('Akses ditolak: Hanya Super Admin Master yang berhak menguji SMTP.', 'error');
      return;
    }

    if (!testRecipient.trim()) {
      showToast('Masukkan alamat email penerima pengujian.', 'error');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const result = await testSmtpConnection(testRecipient.trim(), {
      senderEmail: senderEmail.trim(),
      authPassword: authPassword.trim() ? authPassword.trim() : undefined,
    });
    setIsTesting(false);
    setTestResult(result);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#14532d] via-emerald-800 to-teal-800 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-200 text-xs font-semibold border border-white/20">
            <Mail className="w-3.5 h-3.5 text-emerald-400" />
            <span>Master Gateway Pengiriman Email Multi-Akun (Failover)</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Konfigurasi SMTP Google (Multi-Account Rotation)
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
            Kelola koneksi server email Google SMTP dengan rotasi otomatis (failover): jika akun Gmail 1 terkena batasan/gagal, sistem otomatis beralih ke Gmail 2, 3, dst. Kartu pendaftaran dikirimkan langsung lengkap dengan lampiran file PDF resmi.
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

      {/* Multi-Account Pool Card (Rotasi Otomatis) */}
      <div className="bg-white rounded-3xl p-6 border border-emerald-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-600" />
              <span>Pool Akun SMTP Gmail & Rotasi Otomatis (Failover)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Jika pengiriman lewat akun Prioritas 1 gagal (kuota harian habis / koneksi terputus), sistem secara instan mencoba Akun Prioritas 2, 3, dan seterusnya sehingga email kartu pendaftaran selalu terkirim tanpa gagal.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer self-start sm:self-auto shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Akun Gmail Cadangan</span>
          </button>
        </div>

        {/* List of Registered Accounts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map((acc, idx) => (
            <div
              key={acc.id || idx}
              className={`p-4 rounded-2xl border transition-all ${
                acc.isActive
                  ? idx === 0
                    ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20'
                    : 'bg-slate-50/90 border-slate-200'
                  : 'bg-slate-100/60 border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-emerald-700 text-white' : 'bg-slate-300 text-slate-700'
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block truncate max-w-[160px]">
                      {acc.senderEmail}
                    </span>
                    <span className="text-[11px] text-slate-500 block truncate max-w-[160px]">
                      {acc.senderName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* Active Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleAccountActive(acc.id)}
                    title={acc.isActive ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                    className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                      acc.isActive ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>

                  {/* Priority Reordering */}
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMovePriority(idx, 'up')}
                    title="Naikkan Prioritas"
                    className="p-1.5 rounded-lg text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === accounts.length - 1}
                    onClick={() => handleMovePriority(idx, 'down')}
                    title="Turunkan Prioritas"
                    className="p-1.5 rounded-lg text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>

                  {/* Delete button (only if more than 1) */}
                  {accounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAccount(acc.id)}
                      title="Hapus Akun Ini"
                      className="p-1.5 rounded-lg text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      acc.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                  <span className={acc.isActive ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                    {acc.isActive ? (idx === 0 ? 'Utama (Active)' : 'Cadangan Rotasi') : 'Dinonaktifkan'}
                  </span>
                </div>
                <span className="font-mono text-slate-400">Port 465 (SSL)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2 Columns: Left = Primary Configuration Form, Right = Test & Google App Password Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configuration Form (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-emerald-100 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-600" />
              <span>Pengaturan Akun Utama (Prioritas 1)</span>
            </h3>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold">Status Gateway:</span>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  enabled ? 'bg-[#16a34a]' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                SMTP Host Server Google
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="smtp.gmail.com"
                required
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] rounded-2xl px-3.5 py-2.5 font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Gunakan <strong>smtp.gmail.com</strong> untuk akun Google Workspace atau Gmail reguler.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Port SMTP
                </label>
                <select
                  value={port}
                  onChange={(e) => {
                    const p = Number(e.target.value);
                    setPort(p);
                    setSecure(p === 465);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] rounded-2xl px-3.5 py-2.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20"
                >
                  <option value={465}>Port 465 (SSL / Enkripsi Penuh - Direkomendasikan)</option>
                  <option value={587}>Port 587 (TLS / STARTTLS)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Metode Keamanan SSL/TLS
                </label>
                <div className="h-10 flex items-center px-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700">
                  <span className="font-semibold text-emerald-800">
                    {secure ? 'SSL (Secure Socket Layer)' : 'TLS (STARTTLS)'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Email Pengirim Google Utama (Akun Gmail / Workspace)
                </label>
                {currentUser?.email && senderEmail !== currentUser.email && (
                  <button
                    type="button"
                    onClick={() => {
                      setSenderEmail(currentUser.email);
                      showToast(`Email pengirim diubah ke: ${currentUser.email}`);
                    }}
                    className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                  >
                    Gunakan Email Saya ({currentUser.email})
                  </button>
                )}
              </div>
              <input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="nama.akun@gmail.com"
                required
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] rounded-2xl px-3.5 py-2.5 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Akun Gmail asli yang menjadi pengirim utama. Sandi aplikasi di bawah <strong>harus dibuat dari akun Gmail ini</strong>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Tampilan Pengirim (Sender Display Name)
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Panitia PPDB Yayasan Ar-Risalah Aceh"
                required
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] rounded-2xl px-3.5 py-2.5 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Google App Password Akun Utama (16-Karakter Sandi Aplikasi)</span>
                </label>
                {authPassword ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Sandi Tersimpan & Terenkripsi AES-256
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-700 font-semibold">Wajib 16-Karakter Sandi Aplikasi</span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Contoh: abcd efgh ijkl mnop (16 huruf)"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] rounded-2xl pl-4 pr-12 py-2.5 text-slate-800 font-mono text-xs tracking-wider focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Sembunyikan Sandi' : 'Tampilkan Sandi'}
                  className="p-1.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4 text-emerald-700" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                <span>
                  <strong>Penting:</strong> Jangan masukkan sandi login Gmail biasa. Google SMTP mewajibkan Sandi Aplikasi 16-karakter.
                </span>
                {authPassword && (
                  <button
                    type="button"
                    onClick={() => setAuthPassword('')}
                    className="text-[11px] text-rose-600 hover:underline cursor-pointer font-semibold ml-2 shrink-0"
                  >
                    Kosongkan Sandi
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-700/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Seluruh Pengaturan SMTP</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Testing Panel & Setup Instructions (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Test Send Panel */}
          <div className="bg-white rounded-3xl p-6 border border-emerald-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" />
              <span>Uji Koneksi & Kirim Email Percobaan</span>
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed">
              Kirimkan email uji coba ke alamat berikut untuk memastikan server SMTP Google berhasil terhubung dan otorisasi App Password valid serta rotasi akun berfungsi.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Tujuan Uji Coba:
                </label>
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="email.tujuan@gmail.com"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleTestSend}
                disabled={isTesting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {isTesting ? (
                  <span>Menghubungi SMTP Gmail...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Kirim Email Percobaan Sekarang</span>
                  </>
                )}
              </button>

              {/* Test Result Alert */}
              {testResult && (
                <div
                  className={`p-4 rounded-2xl text-xs space-y-2 animate-in fade-in ${
                    testResult.success
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{testResult.success ? 'Koneksi Berhasil!' : 'Koneksi Ditolak (535 Bad Credentials)'}</span>
                  </div>
                  <p className="leading-relaxed">{testResult.message}</p>

                  {!testResult.success && (
                    <div className="pt-2.5 border-t border-rose-200/80 mt-2 space-y-2">
                      <p className="font-bold text-rose-950 text-[11px]">
                        Langkah Pemeriksaan Wajib (Mengapa Google Menolak):
                      </p>
                      <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-rose-900 leading-relaxed">
                        <li>
                          <strong>Akun Pengirim:</strong> Pastikan <em>Email Pengirim Google</em> di sebelah kiri ({senderEmail || 'belum diisi'}) adalah akun Gmail Anda yang sebenarnya (bukan email demo yayasan).
                        </li>
                        <li>
                          <strong>Bukan Password Login:</strong> Google menolak password login Gmail biasa. Anda wajib membuat <em>16-karakter Sandi Aplikasi</em> di halaman keamanan Google.
                        </li>
                        <li>
                          <strong>Verifikasi 2 Langkah:</strong> Akun Google pengirim wajib mengaktifkan 2-Step Verification terlebih dahulu.
                        </li>
                      </ul>
                      <div className="pt-1 flex flex-wrap gap-2">
                        <a
                          href="https://myaccount.google.com/apppasswords"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition-colors shadow-sm"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Buat Sandi Aplikasi di Akun Google Anda</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Guide on Google App Password */}
          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200 space-y-3 text-xs text-slate-700">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-600" />
              <span>Cara Mendapatkan Google App Password 16-Karakter:</span>
            </h4>
            <ol className="list-decimal pl-4 space-y-1.5 text-slate-600 leading-relaxed">
              <li>
                Buka Akun Google di{' '}
                <a
                  href="https://myaccount.google.com/security"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 font-bold underline inline-flex items-center gap-0.5"
                >
                  myaccount.google.com/security <ExternalLink className="w-3 h-3 inline" />
                </a>
              </li>
              <li>Pastikan <strong>Verifikasi 2 Langkah (2-Step Verification)</strong> sudah AKTIF.</li>
              <li>Cari menu <strong>Sandi Aplikasi (App Passwords)</strong>.</li>
              <li>Beri nama aplikasi, contoh: <code>PPDB Ar-Risalah</code>, lalu klik <strong>Buat (Generate)</strong>.</li>
              <li>Google akan memberikan <strong>16 karakter huruf sandi</strong> (tanpa spasi).</li>
              <li>Salin dan masukkan sandi tersebut pada kolom di formulir sebelah kiri atau tambah akun cadangan.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Modal Tambah Akun Gmail Cadangan */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-emerald-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>Tambah Akun Gmail Cadangan</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Daftarkan akun Gmail kedua atau ketiga untuk otomatis mengambil alih pengiriman email jika akun utama mengalami pembatasan kuota Google.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Email Gmail Cadangan
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="admin2.arrisalah@gmail.com"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-600 rounded-xl px-3.5 py-2 font-medium text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Tampilan Pengirim
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Panitia PPDB Yayasan Ar-Risalah Aceh"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-600 rounded-xl px-3.5 py-2 font-medium text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Google App Password 16-Karakter Akun Ini
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="16 karakter huruf dari akun Google ini"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-600 rounded-xl pl-3.5 pr-10 py-2 font-mono text-slate-800 text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="p-1.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddAccount}
                className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer shadow-md"
              >
                Simpan Akun Cadangan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

