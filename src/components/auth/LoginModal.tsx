import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  LogIn,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  UserPlus,
  Phone,
  QrCode,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { usePPDB } from '../../context/PPDBContext';
import { TurnstileWidget } from '../common/TurnstileWidget';

import { setCsrfToken, apiFetch } from '../../utils/auth';
import { getActiveAcademicYearLabel } from '../../utils/studentFieldResolver';

export const LoginModal: React.FC = () => {
  const {
    currentUser,
    loginModalOpen,
    setLoginModalOpen,
    loginModalTab,
    setActiveView,
    setRegisterWizardOpen,
    pendingRegisterUnit,
    setPendingRegisterUnit,
    units,
    academicYears,
    login,
    registerWaliAccount,
    showToast,
    cloudflareConfig,
    landingConfig,
    setForgotPasswordSentModal,
  } = usePPDB();

  const activeAcademicYearLabel = getActiveAcademicYearLabel(academicYears);
  const sampleRegYear = activeAcademicYearLabel.split('/')[0] || String(new Date().getFullYear());

  const modalBodyRef = useRef<HTMLDivElement | null>(null);
  const [authTab, setAuthTab] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [waliRequiredWarning, setWaliRequiredWarning] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Forgot & Reset Password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetTargetEmail, setResetTargetEmail] = useState('');
  const [isResetTokenValid, setIsResetTokenValid] = useState(false);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [isCheckingResetToken, setIsCheckingResetToken] = useState(false);

  const extractResetTokenFromUrl = (): string => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const qTok = searchParams.get('resetToken');
      if (qTok) return qTok.trim();
      const hash = window.location.hash || '';
      const hMatch = hash.match(/token=([^&]+)/);
      if (hMatch && hMatch[1]) return decodeURIComponent(hMatch[1]).trim();
    } catch (e) {}
    return '';
  };

  const clearResetTokenFromUrl = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('resetToken');
      if (url.hash.includes('reset-password')) {
        url.hash = '';
      }
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    } catch (e) {}
  };

  // Sync tab whenever modal opens or URL has resetToken
  useEffect(() => {
    if (!loginModalOpen) return;
    setErrorMessage('');
    setSuccessMessage('');
    setWaliRequiredWarning(false);

    const urlToken = extractResetTokenFromUrl();
    if (urlToken) {
      setAuthTab('reset');
      setResetToken(urlToken);
      setIsResetTokenValid(false);
      setIsCheckingResetToken(true);
      fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(urlToken)}`, { cache: 'no-store' })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.valid) {
            setErrorMessage(data.error || 'Tautan reset kata sandi tidak valid atau telah kedaluwarsa.');
            setResetTargetEmail('');
            setIsResetTokenValid(false);
          } else {
            setResetTargetEmail(data.emailMasked || data.email || 'Akun Terdaftar');
            setIsResetTokenValid(true);
          }
        })
        .catch(() => {
          setErrorMessage('Gagal memvalidasi tautan reset kata sandi ke server.');
          setIsResetTokenValid(false);
        })
        .finally(() => {
          setIsCheckingResetToken(false);
        });
      return;
    }

    setAuthTab(loginModalTab || 'login');
  }, [loginModalOpen, loginModalTab]);

  // Logo state
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [landingConfig?.logoUrl]);

  const logoSrc = landingConfig?.logoUrl || '/uploads/logo.png';
  const fallbackInitial = landingConfig?.appName ? landingConfig.appName.charAt(0).toUpperCase() : 'P';

  // Turnstile security state
  const [loginTurnstileToken, setLoginTurnstileToken] = useState('');
  const [regTurnstileToken, setRegTurnstileToken] = useState('');
  const [forgotTurnstileToken, setForgotTurnstileToken] = useState('');
  const [turnstileResetCounter, setTurnstileResetCounter] = useState(0);

  const isTurnstileActive = Boolean(cloudflareConfig?.enabled && cloudflareConfig?.siteKey);

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  if (!loginModalOpen) return null;

  const resetTurnstileWidgets = () => {
    setLoginTurnstileToken('');
    setRegTurnstileToken('');
    setForgotTurnstileToken('');
    setTurnstileResetCounter((c) => c + 1);
  };

  const handleRegisterWali = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (isTurnstileActive && !regTurnstileToken) {
      setErrorMessage('Verifikasi keamanan Cloudflare Turnstile wajib diselesaikan terlebih dahulu.');
      return;
    }

    if (!regName.trim() || !regEmail.trim() || !regPhone.trim() || !regPassword.trim()) {
      setErrorMessage('Semua bidang wajib diisi untuk membuat akun wali.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage('Kata sandi minimal 6 karakter demi keamanan akun.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await registerWaliAccount({
        name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim(),
        password: regPassword.trim(),
        turnstileToken: regTurnstileToken || undefined,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Gagal mendaftarkan akun wali.');
        resetTurnstileWidgets();
      } else {
        setLoginModalOpen(false);
        setActiveView('app');
        setRegisterWizardOpen(true);
        showToast('Akun Wali berhasil dibuat! Silakan lanjutkan mengisi data calon siswa (ananda).', 'success');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem.');
      resetTurnstileWidgets();
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (isTurnstileActive && !loginTurnstileToken) {
      setErrorMessage('Verifikasi keamanan Cloudflare Turnstile wajib diselesaikan sebelum masuk.');
      return;
    }

    const cleanIdent = identifier.trim();

    if (!cleanIdent) {
      setErrorMessage('Silakan masukkan Email, No. WhatsApp, atau No. Pendaftaran Siswa.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Silakan masukkan kata sandi atau PIN keamanan Anda.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: cleanIdent,
          password: password.trim(),
          turnstileToken: loginTurnstileToken || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.user) {
        if (data.csrfToken) {
          setCsrfToken(data.csrfToken);
        }
        login(data.user, data.csrfToken);
        return;
      } else {
        setErrorMessage(data.error || 'Identitas akun atau kata sandi tidak cocok dengan data pendaftaran.');
        resetTurnstileWidgets();
        return;
      }
    } catch (err) {
      setErrorMessage('Gagal menghubungi server database PPDB. Silakan pastikan server backend aktif.');
      resetTurnstileWidgets();
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (isTurnstileActive && !forgotTurnstileToken) {
      setErrorMessage('Verifikasi keamanan Cloudflare Turnstile wajib diselesaikan terlebih dahulu.');
      return;
    }

    const cleanEmail = forgotEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Masukkan alamat email akun yang valid.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          turnstileToken: forgotTurnstileToken || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorMessage(data.error || 'Gagal memproses permintaan reset kata sandi.');
        resetTurnstileWidgets();
      } else {
        setForgotEmail('');
        setErrorMessage('');
        setSuccessMessage('');
        resetTurnstileWidgets();
        setLoginModalOpen(false);
        setForgotPasswordSentModal({
          email: cleanEmail,
          message: data.message,
        });
      }
    } catch (err) {
      setErrorMessage('Gagal terhubung ke server untuk mengirim permintaan reset kata sandi.');
      resetTurnstileWidgets();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!resetToken) {
      setErrorMessage('Token reset kata sandi tidak ditemukan.');
      return;
    }
    if (resetNewPassword.length < 8) {
      setErrorMessage('Kata sandi baru minimal 8 karakter untuk keamanan akun.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setErrorMessage('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken,
          newPassword: resetNewPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setErrorMessage(data.error || 'Gagal mengatur ulang kata sandi.');
        return;
      }
      clearResetTokenFromUrl();
      setResetToken('');
      setResetNewPassword('');
      setResetConfirmPassword('');
      showToast('Kata sandi berhasil diperbarui! Silakan masuk menggunakan kata sandi baru Anda.', 'success');
      setAuthTab('login');
      setSuccessMessage('Kata sandi berhasil diperbarui. Silakan masuk dengan kata sandi baru Anda.');
    } catch (err) {
      setErrorMessage('Gagal terhubung ke server saat mengatur ulang kata sandi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDaftarSiswaBaruClick = () => {
    if (!currentUser) {
      setAuthTab('register');
      setErrorMessage('');
      setSuccessMessage('');
      setWaliRequiredWarning(true);
      showToast(
        'Untuk mendaftarkan siswa, Anda wajib membuat Akun Wali terlebih dahulu. Pendaftaran siswa dapat dilakukan di dalam dashboard.',
        'error'
      );
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setLoginModalOpen(false);
    setRegisterWizardOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-emerald-100 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Header: Unified Islamic Green Branding */}
        <div className="bg-gradient-to-r from-[#14532d] via-emerald-900 to-[#14532d] text-white p-5 sm:p-6 relative">
          <button
            onClick={() => {
              if (authTab === 'reset') clearResetTokenFromUrl();
              setLoginModalOpen(false);
              setPendingRegisterUnit(null);
            }}
            aria-label="Tutup Jendela"
            className="absolute top-4 right-4 p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white text-[#14532d] flex items-center justify-center font-black text-xl shadow-md shrink-0 border border-emerald-200 overflow-hidden p-0.5">
              {logoSrc && !logoError ? (
                <img
                  src={logoSrc}
                  alt="Logo"
                  decoding="async"
                  className="w-full h-full object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span className="text-xl font-black text-[#14532d] tracking-tight">
                  {fallbackInitial}
                </span>
              )}
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight text-white truncate">
                  Portal PPDB Terpadu
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-800/80 text-[10px] text-emerald-200 font-semibold border border-emerald-700/60">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  SSL 256-bit
                </span>
              </div>
              <p className="text-xs text-emerald-200 font-medium truncate">
                {landingConfig?.appTagline || 'Yayasan Ar-Risalah Aceh'} • Tahun Ajaran {activeAcademicYearLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher: Masuk vs Daftar Akun Wali */}
        {(authTab === 'login' || authTab === 'register') && (
          <div className="flex border-b border-emerald-100 bg-emerald-50/50 p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setAuthTab('login');
                setErrorMessage('');
                setSuccessMessage('');
                setWaliRequiredWarning(false);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-2xl text-xs font-bold transition-all ${
                authTab === 'login'
                  ? 'bg-white text-[#14532d] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Masuk Portal</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthTab('register');
                setErrorMessage('');
                setSuccessMessage('');
                setWaliRequiredWarning(false);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-2xl text-xs font-bold transition-all ${
                authTab === 'register'
                  ? 'bg-white text-[#14532d] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Buat Akun Wali</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div ref={modalBodyRef} className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* QR Code Deep Link Notification */}
          {pendingRegisterUnit && (authTab === 'login' || authTab === 'register') && (() => {
            const targetUnitInfo = units.find((u) => u.id === pendingRegisterUnit);
            return (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs flex items-start gap-2.5 shadow-2xs animate-in fade-in">
                <QrCode className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-emerald-900">
                    Shortcut Pendaftaran Unit: {targetUnitInfo?.name || pendingRegisterUnit} ({pendingRegisterUnit})
                  </p>
                  <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                    Silakan buat akun wali terlebih dahulu (atau masuk jika sudah memiliki akun) untuk langsung diarahkan ke formulir pendaftaran unit <strong>{pendingRegisterUnit}</strong>.
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Wali Account Required Warning */}
          {waliRequiredWarning && authTab === 'register' && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2.5 animate-in fade-in shadow-2xs">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div className="leading-relaxed">
                <p className="font-extrabold text-amber-900">
                  Akun Wali Diperlukan Terlebih Dahulu
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Untuk mendaftarkan calon siswa, Anda harus memiliki <strong>Akun Wali</strong> terlebih dahulu. Setelah membuat akun dan masuk ke dashboard, pendaftaran siswa dapat dilakukan langsung di dalam dashboard.
                </p>
              </div>
            </div>
          )}

          {/* Success Alert */}
          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span className="font-medium leading-relaxed">{successMessage}</span>
            </div>
          )}

          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span className="font-medium leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {authTab === 'forgot' ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  <span>Lupa Kata Sandi Akun</span>
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('login');
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Kembali ke Login</span>
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Masukkan alamat email akun Anda. Jika terdaftar dan aktif, sistem akan mengirimkan tautan reset kata sandi sekali pakai (berlaku 15 menit).
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Alamat Email Terdaftar <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Contoh: nama@email.com"
                    required
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] focus:bg-white rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 transition-all"
                  />
                </div>
              </div>

              {isTurnstileActive && (
                <TurnstileWidget
                  key={`forgot-${turnstileResetCounter}`}
                  siteKey={cloudflareConfig!.siteKey}
                  onVerify={(tok) => setForgotTurnstileToken(tok)}
                  onReset={() => setForgotTurnstileToken('')}
                  action="forgot_password"
                />
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-700/20 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? <span>Memproses permintaan...</span> : <span>Kirim Tautan Reset ke Email</span>}
              </button>
            </form>
          ) : authTab === 'reset' ? (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  <span>Atur Ulang Kata Sandi Baru</span>
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    clearResetTokenFromUrl();
                    setAuthTab('login');
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Ke Login</span>
                </button>
              </div>

              {isCheckingResetToken ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 text-center">
                  Memverifikasi keabsahan token reset kata sandi...
                </div>
              ) : (
                <>
                  {resetTargetEmail && (
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                      Mengatur ulang kata sandi untuk akun: <strong className="font-mono">{resetTargetEmail}</strong>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Kata Sandi Baru (Min. 8 karakter) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="Minimal 8 karakter"
                        required
                        minLength={8}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] focus:bg-white rounded-2xl pl-10 pr-10 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Konfirmasi Kata Sandi Baru <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={resetConfirmPassword}
                        onChange={(e) => setResetConfirmPassword(e.target.value)}
                        placeholder="Ulangi kata sandi baru"
                        required
                        minLength={8}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] focus:bg-white rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !isResetTokenValid}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-700/20 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
                  >
                    {isLoading ? <span>Menyimpan kata sandi...</span> : <span>Simpan Kata Sandi Baru</span>}
                  </button>
                </>
              )}
            </form>
          ) : authTab === 'register' ? (
            /* Form Pendaftaran Akun Wali */
            <form onSubmit={handleRegisterWali} className="space-y-3.5">
              <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed">
                <strong>Alur Pendaftaran Praktis:</strong> Buat 1 akun wali terlebih dahulu, kemudian di dalam portal Anda dapat mendaftarkan satu atau beberapa calon siswa (TK/SD/SMP/SMA) sekaligus dengan mudah.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Orang Tua / Wali <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Contoh: Rahmat Hidayat, S.T."
                    required
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] focus:bg-white rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Email Aktif <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="Contoh: wali.siswa@gmail.com"
                    required
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] focus:bg-white rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 transition-all"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Kartu pendaftaran & nomor registrasi resmi akan dikirimkan ke email ini setelah diverifikasi.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor WhatsApp Aktif <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="Contoh: 081269001122"
                    required
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] focus:bg-white rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kata Sandi Baru <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    required
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] focus:bg-white rounded-2xl pl-10 pr-10 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Cloudflare Turnstile Verification (Only rendered when active in Master Settings) */}
              {isTurnstileActive && (
                <TurnstileWidget
                  key={`reg-${turnstileResetCounter}`}
                  siteKey={cloudflareConfig!.siteKey}
                  onVerify={(tok) => setRegTurnstileToken(tok)}
                  onReset={() => setRegTurnstileToken('')}
                  action="register"
                />
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-700/20 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer mt-2"
              >
                {isLoading ? (
                  <span>Mendaftarkan akun...</span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Daftar & Masuk ke Portal Wali</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-slate-500">
                  Sudah memiliki akun wali?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('login');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="font-bold text-emerald-700 hover:underline"
                  >
                    Masuk di sini
                  </button>
                </span>
              </div>
            </form>
          ) : (
            /* Form Tunggal Terpadu Login */
            <form onSubmit={handleManualLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email / No. WhatsApp / No. Pendaftaran Siswa
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={`Contoh: PPDB-${sampleRegYear}-TK01-001 / 081269001122 / admin@...`}
                    autoComplete="username"
                    required
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] focus:bg-white rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Wali siswa dapat menggunakan Email, No. Pendaftaran, atau WhatsApp yang terdaftar.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Kata Sandi / PIN Keamanan
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('forgot');
                      setErrorMessage('');
                      setSuccessMessage('');
                      if (identifier.includes('@')) setForgotEmail(identifier.trim());
                    }}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 hover:underline font-semibold cursor-pointer"
                  >
                    Lupa kata sandi?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi atau PIN"
                    autoComplete="current-password"
                    required
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#16a34a] focus:bg-white rounded-2xl pl-10 pr-10 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Cloudflare Turnstile Verification (Only rendered when active in Master Settings) */}
              {isTurnstileActive && (
                <TurnstileWidget
                  key={`login-${turnstileResetCounter}`}
                  siteKey={cloudflareConfig!.siteKey}
                  onVerify={(tok) => setLoginTurnstileToken(tok)}
                  onReset={() => setLoginTurnstileToken('')}
                  action="login"
                />
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-700/20 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <span>Memverifikasi kredensial...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Masuk ke Dashboard Saya</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* New Register Link (redirects to Buat Akun Wali when not logged in) */}
          {authTab !== 'register' && (
            <div className="text-center pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Belum mendaftarkan calon siswa?{' '}
                <button
                  type="button"
                  onClick={handleDaftarSiswaBaruClick}
                  className="font-bold text-[#16a34a] hover:text-emerald-700 underline cursor-pointer"
                >
                  Daftar Siswa Baru Sekarang
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
