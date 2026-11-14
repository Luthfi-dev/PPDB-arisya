import React, { useState, useRef } from 'react';
import {
  Home,
  Users,
  Wallet,
  User,
  Plus,
  School,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronRight,
  Upload,
  Phone,
  MapPin,
  ExternalLink,
  Laptop,
  Globe,
  Award,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
  CheckSquare,
  Coins,
  CalendarCheck,
  FileSpreadsheet,
  LogOut,
  ArrowUp,
  Lock,
  Eye,
  RefreshCw,
  Printer,
} from 'lucide-react';
import { usePPDB } from '../../context/PPDBContext';
import { UnitBadge, StatusBadge, PaymentBadge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { StudentRegistration, PaymentRecord } from '../../types/ppdb';
import { RegistrationWizard } from './RegistrationWizard';
import { PendaftarView } from '../desktop/views/PendaftarView';
import { VerifikasiView } from '../desktop/views/VerifikasiView';
import { JadwalTesView } from '../desktop/views/JadwalTesView';
import { KelulusanView } from '../desktop/views/KelulusanView';
import { PembayaranView } from '../desktop/views/PembayaranView';
import { LaporanView } from '../desktop/views/LaporanView';
import { KuotaBiayaView } from '../desktop/views/KuotaBiayaView';
import { StatusSistemView } from '../desktop/views/StatusSistemView';
import { hasActionPermission } from '../../utils/rbac';
import {
  ensureCoreNameFieldInSections,
  formatCardFieldDisplayValue,
  getActiveAcademicYearLabel,
  isPdfDocumentUrl,
  resolveFormFieldValue,
  resolveStudentNameFromSchema,
  resolveStudentPhotoUrl,
  resolveVerificationDocumentsForStudent,
} from '../../utils/studentFieldResolver';
import { computeStudentPaymentTypeSummary, formatRupiah } from '../../utils/paymentHelpers';
import { PaymentReceiptModal } from '../common/PaymentReceiptModal';
import { ReceiptData } from '../../utils/receiptGenerator';
import { CurrencyInput } from '../common/FormattedNumberInputs';
import { DeveloperFooter } from '../common/DeveloperFooter';

export const MobileApp: React.FC = () => {
  const {
    students,
    units,
    academicYears,
    landingConfig,
    unitContacts,
    formSchemas,
    payments,
    schedules,
    refreshSchedules,
    mobileActiveTab,
    setMobileActiveTab,
    setActiveView,
    currentUser,
    roles,
    logout,
    setLoginModalOpen,
    openLoginModal,
    addPaymentProof,
    pendingRegisterUnit,
    setPendingRegisterUnit,
    bankAccounts,
    refreshBankAccounts,
    refreshPayments,
    showToast,
  } = usePPDB();

  React.useEffect(() => {
    if (mobileActiveTab === 'pembayaran') {
      refreshBankAccounts();
      refreshPayments();
    }
  }, [mobileActiveTab, refreshBankAccounts, refreshPayments]);

  const activeAcademicYearLabel = getActiveAcademicYearLabel(academicYears);
  const masterContact = unitContacts.find((c) => c.unitId === 'MASTER') || unitContacts[0];

  const getNormalizedSchema = (unitId: string) => {
    const found = formSchemas.find((s) => s.unitId === unitId);
    if (!found) return undefined;
    return {
      ...found,
      sections: ensureCoreNameFieldInSections(found.sections, found.unitId),
    };
  };

  const resolvePayStudentName = (pay: PaymentRecord) => {
    const stu = students.find((s) => s.id === pay.registrationId || s.registrationNumber === pay.registrationNumber);
    if (!stu) return pay.studentName;
    return resolveStudentNameFromSchema(stu, getNormalizedSchema(stu.unit)) || pay.studentName;
  };

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const handleStartRegistration = (unitId?: string) => {
    if (unitId) {
      const targetUnit = units.find((u) => u.id === unitId);
      if (targetUnit && targetUnit.isOpen === false) {
        showToast(
          targetUnit.closedNotice || `Pendaftaran ${targetUnit.shortName} belum dibuka.`,
          'error'
        );
        return;
      }
      if (targetUnit && targetUnit.totalQuota - targetUnit.filledQuota <= 0) {
        showToast(
          `Kuota pendaftaran ${targetUnit.shortName} telah penuh (${targetUnit.filledQuota}/${targetUnit.totalQuota}).`,
          'error'
        );
        return;
      }
      setPendingRegisterUnit(unitId);
    } else {
      setPendingRegisterUnit(null);
    }

    if (!currentUser) {
      openLoginModal('register');
      showToast('Silakan buat akun orang tua / wali terlebih dahulu untuk mendaftarkan ananda.', 'success');
    } else {
      setIsWizardOpen(true);
    }
  };
  const [selectedChild, setSelectedChild] = useState<StudentRegistration | null>(null);
  const [isChildDetailOpen, setIsChildDetailOpen] = useState(false);
  const [mobileAdminSubTab, setMobileAdminSubTab] = useState<'pendaftar' | 'verifikasi' | 'jadwal' | 'kelulusan' | 'pembayaran' | 'kuota' | 'status'>('pendaftar');

  // Upload Payment Proof modal
  const [uploadTarget, setUploadTarget] = useState<{
    registrationId: string;
    studentName: string;
    unit: string;
    type: 'Formulir' | 'Daftar Ulang';
    replacePaymentId?: string;
    suggestedAmount: number;
  } | null>(null);
  const [mobileUploadAmount, setMobileUploadAmount] = useState<number>(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [mobileProofDataUrl, setMobileProofDataUrl] = useState('');
  const [mobileProofFileName, setMobileProofFileName] = useState('');
  const [copiedBankId, setCopiedBankId] = useState<string | null>(null);
  const [selectedMobileBankId, setSelectedMobileBankId] = useState<string>('');
  const [previewMobileProofUrl, setPreviewMobileProofUrl] = useState<string | null>(null);
  const [activeReceiptData, setActiveReceiptData] = useState<ReceiptData | null>(null);
  const mobileProofFileInputRef = useRef<HTMLInputElement | null>(null);

  const activeBankAccounts = React.useMemo(
    () =>
      bankAccounts
        .filter((b) => b.isActive)
        .sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1)),
    [bankAccounts]
  );
  const activeSelectedMobileBank =
    activeBankAccounts.find((b) => b.id === selectedMobileBankId) || activeBankAccounts[0] || null;

  // Success celebration modal after registration
  const [justRegisteredName, setJustRegisteredName] = useState<string | null>(null);

  const handleCopyBankNumber = (bankId: string, accountNumber: string, bankLabel: string) => {
    navigator.clipboard.writeText(accountNumber.replace(/\s+/g, ''));
    setCopiedBankId(bankId);
    showToast(`Nomor rekening ${bankLabel} disalin`);
    setTimeout(() => setCopiedBankId((prev) => (prev === bankId ? null : prev)), 2000);
  };

  const handleOpenUploadProof = (
    registrationId: string,
    studentName: string,
    unit: string,
    type: 'Formulir' | 'Daftar Ulang',
    suggestedAmount: number,
    replacePaymentId?: string,
    autoPickFile?: boolean
  ) => {
    setUploadTarget({
      registrationId,
      studentName,
      unit,
      type,
      suggestedAmount,
      replacePaymentId,
    });
    setMobileUploadAmount(suggestedAmount);
    setMobileProofDataUrl('');
    setMobileProofFileName('');
    setSelectedMobileBankId('');
    setIsUploadModalOpen(true);
    refreshBankAccounts();
    if (autoPickFile) {
      mobileProofFileInputRef.current?.click();
    }
  };

  const handleSelectMobileProofFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran file maksimal 5 MB.', 'error');
      inputEl.value = '';
      return;
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedExts.includes(ext) || (file.type && !allowedMimes.includes(file.type.toLowerCase()))) {
      showToast('Format file harus JPG, PNG, WEBP, atau PDF.', 'error');
      inputEl.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setMobileProofDataUrl(ev.target.result as string);
        setMobileProofFileName(file.name);
        showToast('Bukti transfer siap dikirim.');
      }
    };
    reader.onerror = () => showToast('Gagal membaca file.', 'error');
    reader.readAsDataURL(file);
    inputEl.value = '';
  };

  const handleConfirmUploadProof = async () => {
    if (!uploadTarget) return;
    if (!mobileProofDataUrl) {
      showToast('Harap pilih file struk transfer terlebih dahulu.', 'error');
      return;
    }
    if (!Number.isFinite(mobileUploadAmount) || mobileUploadAmount < 1000) {
      showToast('Nominal transfer minimal Rp 1.000.', 'error');
      return;
    }
    const ok = await addPaymentProof(
      uploadTarget.registrationId,
      mobileProofDataUrl,
      mobileUploadAmount,
      uploadTarget.type,
      activeSelectedMobileBank?.id,
      uploadTarget.replacePaymentId
    );
    if (ok) {
      await refreshPayments();
      setIsUploadModalOpen(false);
      setUploadTarget(null);
      setMobileProofDataUrl('');
      setMobileProofFileName('');
    }
  };

  // Helper for 5-step status calculation
  const getStepLevel = (student: StudentRegistration) => {
    if (student.status === 'terdaftar') return 5;
    if (student.status === 'lulus') return 4;
    if (student.status === 'tes') return 3;
    if (student.status === 'verifikasi') return 2;
    return 1;
  };

  const getStepLabel = (step: number) => {
    switch (step) {
      case 1:
        return 'Pendaftaran';
      case 2:
        return 'Verifikasi';
      case 3:
        return 'Tes Seleksi';
      case 4:
        return 'Kelulusan';
      case 5:
        return 'Daftar Ulang';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#f0fdf4] text-slate-800 flex flex-col justify-between pb-[68px] select-none">
      {/* 1. Mobile Fixed Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-3.5 sm:px-4 py-3 border-b border-emerald-100 flex items-center justify-between shadow-xs w-full max-w-full">
        <button
          type="button"
          onClick={() => setActiveView('landing')}
          title="Ke Halaman Utama PPDB"
          className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-85 active:scale-[0.98] transition-all cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-[#16a34a] text-white flex items-center justify-center font-extrabold text-sm shadow-sm shrink-0">
            A
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-extrabold text-slate-900 tracking-tight leading-tight truncate">
              {landingConfig?.appName || 'PPDB Ar-Risalah'}
            </h1>
            <p className="text-[10px] text-emerald-700 font-semibold leading-none truncate">
              {landingConfig?.appTagline || 'Yayasan Ar-Risalah Aceh'}
            </p>
          </div>
        </button>

        {/* Database & Auth Controls */}
        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-[10px] font-bold text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            MySQL Ready
          </span>

          {currentUser ? (
            <button
              onClick={logout}
              title="Keluar dari Akun"
              className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setLoginModalOpen(true)}
              className="px-2.5 py-1 rounded-xl bg-[#16a34a] text-white text-[11px] font-bold"
            >
              Masuk
            </button>
          )}
        </div>
      </header>

      {/* 2. Middle Scrollable Content */}
      <main className="flex-1 px-2 pt-2 pb-1 sm:px-3 sm:pt-3 sm:pb-1 max-w-lg mx-auto w-full min-w-0 flex flex-col justify-between gap-3 overflow-x-hidden">
        <div className="space-y-3 min-w-0">
        {/* TAB 1: BERANDA */}
        {mobileActiveTab === 'beranda' && (
          <div className="space-y-3 animate-in fade-in">
            {/* Hero Welcome Card with Campus Photo */}
            <div className="relative rounded-xl overflow-hidden shadow-sm text-white border border-emerald-800/40">
              <img
                src="/src/assets/images/campus_arrisalah_aceh_1792900903501.jpg"
                alt="Kampus Ar-Risalah Aceh"
                className="w-full h-36 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/60 to-transparent p-3 flex flex-col justify-end">
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-[#16a34a] text-white uppercase tracking-wider w-fit mb-1">
                  T.A {activeAcademicYearLabel}
                </span>
                <h2 className="text-sm font-bold leading-tight">
                  {landingConfig?.heroTitle || 'Penerimaan Siswa Baru Ar-Risalah Aceh'}
                </h2>
                <p className="text-[10px] text-emerald-100/90 mt-0.5 line-clamp-2">
                  {landingConfig?.heroSubtitle || 'Membina generasi shalih, berakhlak mulia, hafidz Al-Qur\'an, dan unggul akademis.'}
                </p>
              </div>
            </div>

            {/* Quick Status Pill */}
            <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 leading-tight">
                    Pendaftaran Online Tahun Ajaran {activeAcademicYearLabel}
                  </h4>
                  <p className="text-[9px] text-slate-500">
                    {units.filter((u) => u.isOpen !== false && u.totalQuota - u.filledQuota > 0).length} dari {units.length} unit aktif membuka pendaftaran
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleStartRegistration()}
                className="px-2.5 py-1.5 rounded-lg bg-[#16a34a] text-white text-[10px] font-bold shadow-xs hover:bg-emerald-700"
              >
                Daftar
              </button>
            </div>

            {/* Dynamic School Units Grid */}
            <div>
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">
                  Pilihan Unit Pendidikan
                </h3>
                <span className="text-[10px] text-emerald-700 font-semibold">
                  {units.length} Jenjang
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {units.map((unit) => {
                  const remaining = Math.max(0, unit.totalQuota - unit.filledQuota);
                  const isOpen = unit.isOpen !== false;
                  const isAvailable = isOpen && remaining > 0;
                  return (
                    <button
                      type="button"
                      key={unit.id}
                      disabled={!isAvailable}
                      onClick={() => isAvailable && handleStartRegistration(unit.id)}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isAvailable
                          ? 'bg-white border-emerald-100 shadow-xs hover:border-emerald-300 cursor-pointer'
                          : 'bg-slate-100 border-slate-200 text-slate-400 opacity-80 cursor-not-allowed'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <UnitBadge unit={unit.id} />
                          {!isOpen ? (
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 text-[9px] font-extrabold inline-flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Belum Dibuka</span>
                            </span>
                          ) : remaining <= 0 ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-extrabold inline-flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Penuh</span>
                            </span>
                          ) : null}
                        </div>
                        <h4 className={`text-[11px] font-bold mt-1 leading-tight ${isAvailable ? 'text-slate-900' : 'text-slate-500'}`}>
                          {unit.shortName}
                        </h4>
                      </div>

                      <div className="mt-2 pt-1 border-t border-slate-200/70 flex items-center justify-between text-[10px]">
                        {isAvailable ? (
                          <>
                            <span className="text-emerald-700 font-bold tabular-nums">
                              Sisa {remaining}
                            </span>
                            <ChevronRight className="w-3 h-3 text-slate-400" />
                          </>
                        ) : (
                          <>
                            <span className="text-slate-500 font-semibold">
                              {!isOpen ? 'Belum Dibuka' : 'Kuota Penuh'}
                            </span>
                            <Lock className="w-3 h-3 text-slate-400" />
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Alur Singkat Dinamis */}
            {landingConfig?.flowSteps && landingConfig.flowSteps.length > 0 && (
              <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs space-y-2">
                <h4 className="text-[11px] font-bold text-slate-900">
                  Alur Mudah Pendaftaran PPDB
                </h4>
                <div className="space-y-1.5 text-[10px]">
                  {landingConfig.flowSteps.map((fs) => (
                    <div key={fs.step} className="flex items-center gap-1.5 text-slate-700">
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-100 text-emerald-800 text-[8px] font-bold flex items-center justify-center shrink-0">
                        {fs.step}
                      </span>
                      <span>{fs.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ANAK SAYA */}
        {mobileActiveTab === 'anak' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Data Siswa Terdaftar
                </h3>
                <p className="text-xs text-slate-500">
                  Pantau perkembangan tahapan pendaftaran anak Anda.
                </p>
              </div>
              <button
                onClick={() => setIsWizardOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#16a34a] text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah</span>
              </button>
            </div>

            {students.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-emerald-100 text-center space-y-3">
                <Users className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">
                  Belum Ada Siswa Terdaftar
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Daftarkan putra/putri Anda sekarang dengan menekan tombol di bawah.
                </p>
                <button
                  onClick={() => setIsWizardOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-[#16a34a] text-white text-xs font-bold shadow-sm"
                >
                  Daftarkan Siswa Sekarang
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {students.map((student) => {
                  const currentLevel = getStepLevel(student);
                  const rowSchema = getNormalizedSchema(student.unit);
                  const displayName = resolveStudentNameFromSchema(student, rowSchema);
                  const photoUrl = resolveStudentPhotoUrl(student, rowSchema);

                  return (
                    <div
                      key={student.id}
                      className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm space-y-3.5 hover:shadow-md transition-shadow"
                    >
                      {/* Top Header of Card */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={displayName}
                              className="w-12 h-12 rounded-full object-cover border-2 border-emerald-200 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-emerald-700 text-white flex items-center justify-center font-extrabold text-base border-2 border-emerald-200 shrink-0">
                              {(displayName && displayName !== '-' ? displayName : 'S').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 leading-tight">
                              {displayName}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <UnitBadge unit={student.unit} />
                              <span className="text-[11px] font-mono text-slate-400">
                                {student.registrationNumber}
                              </span>
                            </div>
                          </div>
                        </div>

                        <StatusBadge status={student.status} />
                      </div>

                      {/* 5-Step Progress Bar with Bulat-Bulat Hijau */}
                      <div className="pt-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Tahapan Proses PPDB:
                          </span>
                          <span className="text-[11px] font-bold text-emerald-800">
                            {getStepLabel(currentLevel)}
                          </span>
                        </div>

                        {/* Step circles */}
                        <div className="flex items-center justify-between relative px-2">
                          <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1 bg-slate-200 -z-0" />
                          <div
                            className="absolute left-4 top-1/2 -translate-y-1/2 h-1 bg-[#16a34a] -z-0 transition-all duration-500"
                            style={{
                              width: `${((currentLevel - 1) / 4) * 85}%`,
                            }}
                          />

                          {[1, 2, 3, 4, 5].map((sNum) => {
                            const isDone = currentLevel >= sNum;
                            return (
                              <div
                                key={sNum}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10 transition-colors ${
                                  isDone
                                    ? 'bg-[#16a34a] text-white ring-2 ring-emerald-100'
                                    : 'bg-white border-2 border-slate-300 text-slate-400'
                                }`}
                              >
                                {isDone ? '✓' : sNum}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Detail Button */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          Daftar: {student.registeredAt.split(' ')[0]}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedChild(student);
                            setIsChildDetailOpen(true);
                            refreshSchedules();
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#14532d] text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <span>Detail Pendaftaran</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PEMBAYARAN */}
        {mobileActiveTab === 'pembayaran' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="px-1">
              <h3 className="text-base font-bold text-slate-900">
                Informasi & Tagihan Pembayaran
              </h3>
              <p className="text-xs text-slate-500">
                Kelola status pembayaran biaya formulir dan daftar ulang siswa.
              </p>
            </div>

            {/* Rekening Bank Resmi Yayasan (Multi-Bank) */}
            {activeBankAccounts.length > 0 ? (
              <div className="space-y-3">
                {activeBankAccounts.map((bank) => (
                  <div
                    key={bank.id}
                    className="p-4 rounded-2xl bg-[#14532d] text-white shadow-md relative overflow-hidden space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                        {bank.isPrimary ? 'Rekening Utama Pembayaran PPDB' : 'Rekening Alternatif PPDB'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-800 font-bold shrink-0">
                        {bank.bankCode || 'BANK'}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-bold">{bank.bankName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xl font-bold tracking-wider text-emerald-100 break-all">
                          {bank.accountNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyBankNumber(bank.id, bank.accountNumber, bank.bankCode || bank.bankName)
                          }
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
                          title="Salin No Rekening"
                        >
                          {copiedBankId === bank.id ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-emerald-200 mt-0.5">
                        a.n. {bank.accountHolder}
                        {bank.branch ? ` · ${bank.branch}` : ''}
                      </p>
                    </div>

                    <p className="text-[10px] text-emerald-300/80 pt-1 border-t border-emerald-800">
                      {bank.notes || 'Cantumkan Nomor Pendaftaran pada berita transfer untuk kemudahan verifikasi.'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                Belum ada rekening bank yayasan yang aktif. Hubungi panitia PPDB untuk informasi rekening.
              </div>
            )}

            {/* List Tagihan (Dikelompokkan per Siswa & Jenis Tagihan beserta Historis Bukti) */}
            <div className="space-y-3">
              {(() => {
                const groupMap = new Map<string, PaymentRecord>();
                payments.forEach((p) => {
                  const key = `${p.registrationId}__${p.type}`;
                  if (!groupMap.has(key)) groupMap.set(key, p);
                });
                const groups = Array.from(groupMap.entries());

                if (groups.length === 0) {
                  return (
                    <div className="bg-white p-6 rounded-2xl border border-emerald-100 text-center text-xs text-slate-500">
                      Belum ada tagihan pembayaran untuk siswa terdaftar.
                    </div>
                  );
                }

                return groups.map(([key, rep]) => {
                  const targetUnit = units.find((u) => u.id === rep.unit);
                  const summary = computeStudentPaymentTypeSummary(payments, rep.registrationId, rep.type, targetUnit);
                  const displayName = resolvePayStudentName(rep);

                  return (
                    <div
                      key={key}
                      className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs space-y-3.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <UnitBadge unit={rep.unit} />
                            <span className="text-xs font-bold text-slate-900">
                              {rep.type}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-700 break-words">
                            {displayName}
                          </p>
                          <p className="text-[11px] font-mono text-slate-400">
                            {rep.registrationNumber}
                          </p>
                        </div>

                        <PaymentBadge status={summary.overallStatus} />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px]">
                        <div className="flex items-center justify-between sm:block gap-2">
                          <span className="text-slate-500 sm:block">Tarif Resmi</span>
                          <span className="font-mono font-bold text-slate-900">{formatRupiah(summary.targetFee)}</span>
                        </div>
                        <div className="flex items-center justify-between sm:block gap-2">
                          <span className="text-slate-500 sm:block">Terkirim</span>
                          <span className="font-mono font-bold text-emerald-700">{formatRupiah(summary.submittedValidAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between sm:block gap-2">
                          <span className="text-slate-500 sm:block">Sisa Kurang</span>
                          <span className={`font-mono font-bold ${summary.remainingAmount > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {formatRupiah(summary.remainingAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Historis Bukti Transfer */}
                      {summary.uploadedRecords.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Historis Bukti ({summary.uploadedRecords.length})
                          </p>
                          {summary.uploadedRecords.map((rec, idx) => (
                            <div
                              key={rec.id}
                              className={`p-3 rounded-xl border text-[11px] space-y-2 ${
                                rec.status === 'ditolak'
                                  ? 'bg-rose-50/50 border-rose-200'
                                  : 'bg-slate-50/80 border-slate-200'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewMobileProofUrl(rec.proofUrl)}
                                    className="w-10 h-10 rounded-lg border border-slate-200 overflow-hidden bg-white shrink-0 flex items-center justify-center cursor-pointer"
                                  >
                                    {isPdfDocumentUrl(rec.proofUrl) ? (
                                      <span className="text-[9px] font-extrabold text-rose-700">PDF</span>
                                    ) : (
                                      <img src={rec.proofUrl} alt={`Bukti #${idx + 1}`} className="w-full h-full object-cover" />
                                    )}
                                  </button>
                                  <div className="min-w-0 flex-1 space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-slate-900">#{idx + 1}</span>
                                      <span className="font-mono font-bold text-emerald-800">{formatRupiah(rec.amount)}</span>
                                      <PaymentBadge status={rec.status} />
                                    </div>
                                    <p className="text-[10px] text-slate-500 break-words">{rec.bankAccount} · {rec.date}</p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 sm:border-t-0 sm:pt-0 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewMobileProofUrl(rec.proofUrl)}
                                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                                    title="Lihat struk"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Lihat Struk</span>
                                  </button>
                                  {rec.status === 'lunas' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveReceiptData({
                                          paymentId: rec.id,
                                          registrationNumber: rep.registrationNumber,
                                          studentName: displayName,
                                          unitId: rep.unit,
                                          unitName: targetUnit?.name || rep.unit,
                                          unitShortName: targetUnit?.shortName || rep.unit,
                                          paymentType: rec.type,
                                          amount: rec.amount,
                                          totalApprovedForBill: rec.amount,
                                          date: rec.date,
                                          bankAccount: rec.bankAccount || 'Rekening Resmi Yayasan',
                                          verificationNotes: rec.verificationNotes,
                                          verifiedBy: rec.verifiedBy,
                                          academicYear: activeAcademicYearLabel,
                                          receiptSig: rec.receiptSig,
                                          appName: landingConfig?.appName,
                                          logoUrl: landingConfig?.logoUrl,
                                        });
                                      }}
                                      className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                                    >
                                      <Printer className="w-3.5 h-3.5" />
                                      <span>Cetak Resi</span>
                                    </button>
                                  )}
                                  {rec.status === 'ditolak' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenUploadProof(
                                          rep.registrationId,
                                          displayName,
                                          rep.unit,
                                          rep.type,
                                          rec.amount > 0 ? rec.amount : summary.remainingAmount || summary.targetFee,
                                          rec.id,
                                          true
                                        )
                                      }
                                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                                    >
                                      <Upload className="w-3.5 h-3.5" />
                                      <span>Upload Ulang</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                              {rec.verificationNotes && (
                                <p
                                  className={`text-[11px] font-semibold border rounded-lg px-2.5 py-1.5 break-words leading-relaxed flex items-start gap-1.5 ${
                                    rec.status === 'lunas'
                                      ? 'text-emerald-900 bg-emerald-50 border-emerald-200'
                                      : rec.status === 'ditolak'
                                      ? 'text-rose-800 bg-rose-50 border-rose-200'
                                      : 'text-slate-700 bg-slate-50 border-slate-200'
                                  }`}
                                >
                                  {rec.status === 'lunas' ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
                                  ) : (
                                    <AlertCircle
                                      className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                                        rec.status === 'ditolak' ? 'text-rose-600' : 'text-slate-500'
                                      }`}
                                    />
                                  )}
                                  <span className="min-w-0">
                                    <strong>Catatan Admin:</strong> {rec.verificationNotes}
                                  </span>
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <span className="text-[11px] text-slate-500 leading-snug">
                          {summary.uploadedRecords.length === 0
                            ? 'Belum ada bukti terkirim'
                            : summary.remainingAmount > 0
                            ? 'Bisa ditambah dengan transfer bank lain'
                            : 'Nominal tagihan terpenuhi'}
                        </span>

                        {(summary.uploadedRecords.length === 0 ||
                          summary.remainingAmount > 0 ||
                          summary.overallStatus === 'ditolak') && (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenUploadProof(
                                rep.registrationId,
                                displayName,
                                rep.unit,
                                rep.type,
                                summary.remainingAmount > 0 ? summary.remainingAmount : summary.targetFee
                              )
                            }
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 whitespace-normal text-center cursor-pointer shrink-0"
                          >
                            <Upload className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {summary.uploadedRecords.length > 0 ? 'Tambah Bukti' : 'Unggah Bukti'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* TAB 4: PROFIL */}
        {mobileActiveTab === 'profil' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Parent Profile Card */}
            <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-extrabold text-xl border-2 border-emerald-300">
                  {(currentUser?.name || 'W').charAt(0)}
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    {currentUser?.name || 'Wali Siswa Ar-Risalah'}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono">
                    {currentUser?.phone || 'Akun Pendaftaran Siswa'}
                  </p>
                  <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {currentUser?.role || 'Wali Siswa'}
                  </span>
                </div>
              </div>

              {currentUser && (
                <button
                  type="button"
                  onClick={logout}
                  title="Keluar Akun"
                  className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Menu Options */}
            <div className="bg-white rounded-2xl border border-emerald-100 shadow-xs divide-y divide-slate-100 text-xs">
              {(masterContact?.whatsapp || landingConfig?.contact?.whatsapp) && (
                <a
                  href={`https://wa.me/${(masterContact?.whatsapp || landingConfig?.contact?.whatsapp || '').replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-slate-800">
                      Bantuan Layanan WhatsApp PPDB ({masterContact?.phone || landingConfig?.contact?.whatsapp})
                    </span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </a>
              )}

              <a
                href="https://arrisalahaceh.or.id"
                target="_blank"
                rel="noreferrer"
                className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-slate-800">
                    Website Resmi Yayasan Ar-Risalah
                  </span>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400" />
              </a>

              {currentUser?.role !== 'Wali Siswa' && (
                <div
                  onClick={() => setMobileActiveTab('admin')}
                  className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Laptop className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-slate-800">
                      Buka Panel Kelola & Verifikasi Admin
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              )}

              {currentUser && (
                <div
                  onClick={logout}
                  className="p-3.5 flex items-center justify-between hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer font-bold"
                >
                  <div className="flex items-center gap-3">
                    <LogOut className="w-4 h-4 text-rose-600" />
                    <span>Keluar dari Akun (Logout)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-rose-400" />
                </div>
              )}
            </div>

            {/* Yayasan Address Card */}
            <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs space-y-2 text-xs">
              <h5 className="font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>Sekretariat {masterContact?.unitName || 'Yayasan Ar-Risalah Aceh'}</span>
              </h5>
              <p className="text-slate-600 leading-relaxed">
                {landingConfig?.contact?.address || masterContact?.address || '-'}
              </p>
              <p className="text-slate-400 font-mono text-[11px]">
                Email: {landingConfig?.contact?.email || masterContact?.email || '-'} · WA: {landingConfig?.contact?.whatsapp || masterContact?.phone || '-'}
              </p>
            </div>
          </div>
        )}

        {/* TAB 5: ADMIN MANAGEMENT (MOBILE / TABLET TOUCH VIEW) */}
        {mobileActiveTab === 'admin' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <span>Panel Pengurus PPDB</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Akses operasional verifikasi, seleksi, dan keuangan dari smartphone.
                  </p>
                </div>
              </div>

              {/* Horizontal Scroll Subtab */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'pendaftar', label: 'Pendaftar', module: 'Pendaftar' },
                  { id: 'verifikasi', label: 'Verifikasi', module: 'Verifikasi' },
                  { id: 'jadwal', label: 'Jadwal Tes', module: 'Jadwal' },
                  { id: 'kelulusan', label: 'Kelulusan', module: 'Kelulusan' },
                  { id: 'pembayaran', label: 'Keuangan', module: 'Pembayaran' },
                  { id: 'kuota', label: 'Kuota & Biaya', module: 'Kuota & Biaya' },
                  { id: 'status', label: 'Status MySQL', module: 'Status Sistem' },
                ]
                  .filter((st) => hasActionPermission(currentUser, st.module, 'view', roles))
                  .map((st) => (
                    <button
                      key={st.id}
                      onClick={() => setMobileAdminSubTab(st.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                        mobileAdminSubTab === st.id
                          ? 'bg-[#16a34a] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
              </div>
            </div>

            {/* Sub-view Render with Horizontal Scroll Containment */}
            <div className="pt-1 w-full max-w-full overflow-x-auto min-w-0 scrollbar-thin">
              {mobileAdminSubTab === 'pendaftar' && <PendaftarView />}
              {mobileAdminSubTab === 'verifikasi' && <VerifikasiView />}
              {mobileAdminSubTab === 'jadwal' && <JadwalTesView />}
              {mobileAdminSubTab === 'kelulusan' && <KelulusanView />}
              {mobileAdminSubTab === 'pembayaran' && <PembayaranView />}
              {mobileAdminSubTab === 'kuota' && <KuotaBiayaView />}
              {mobileAdminSubTab === 'status' && <StatusSistemView />}
            </div>
          </div>
        )}
        </div>

        <DeveloperFooter variant="light" className="pt-3 pb-1" />
      </main>

      {/* Scroll-to-Top Button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-24 left-4 z-40 p-3 rounded-full bg-emerald-700 text-white shadow-lg hover:bg-emerald-800 transition-all"
        title="Kembali ke Atas"
      >
        <ArrowUp className="w-5 h-5" />
      </button>

      {/* Floating Action Button (FAB) Daftarkan Anak */}
      <button
        onClick={() => handleStartRegistration()}
        className="fixed bottom-20 right-4 z-40 px-4 py-3 rounded-2xl bg-[#16a34a] hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-800/25 flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
      >
        <Plus className="w-5 h-5" />
        <span>Daftarkan Anak</span>
      </button>

      {/* 4. Fixed Bottom Navigation Bar (Adaptive to Role) */}
      {(() => {
        const navTabs =
          currentUser?.role === 'Wali Siswa'
            ? [
                { id: 'beranda', label: 'Beranda', icon: Home },
                { id: 'anak', label: 'Anak Saya', icon: Users },
                { id: 'pembayaran', label: 'Bayar', icon: Wallet },
                { id: 'profil', label: 'Profil', icon: User },
              ]
            : [
                { id: 'beranda', label: 'Beranda', icon: Home },
                { id: 'anak', label: 'Anak Saya', icon: Users },
                { id: 'pembayaran', label: 'Bayar', icon: Wallet },
                { id: 'admin', label: 'Admin', icon: ShieldCheck },
                { id: 'profil', label: 'Profil', icon: User },
              ];

        return (
          <nav
            className={`fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-emerald-100 grid ${
              navTabs.length === 4 ? 'grid-cols-4' : 'grid-cols-5'
            } items-center h-16 shadow-lg`}
          >
            {navTabs.map((tab) => {
              const isActive = mobileActiveTab === tab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  onClick={() => setMobileActiveTab(tab.id as any)}
                  className="flex flex-col items-center justify-center h-full transition-colors select-none"
                >
                  <Icon
                    className={`w-5 h-5 transition-transform ${
                      isActive
                        ? 'text-[#16a34a] scale-110'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  />
                  <span
                    className={`text-[10px] font-bold mt-1 tracking-tight ${
                      isActive ? 'text-[#16a34a]' : 'text-slate-400'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>
        );
      })()}

      {/* Wizard Modal 5-Step Pendaftaran */}
      {isWizardOpen && (
        <RegistrationWizard
          initialUnit={pendingRegisterUnit || undefined}
          onClose={() => {
            setIsWizardOpen(false);
            setPendingRegisterUnit(null);
          }}
          onSuccess={(name) => {
            setIsWizardOpen(false);
            setPendingRegisterUnit(null);
            setJustRegisteredName(name);
            setMobileActiveTab('anak');
          }}
        />
      )}

      {/* Modal Detail Siswa Wali */}
      {selectedChild && (() => {
        const childSchema = getNormalizedSchema(selectedChild.unit);
        const childName = resolveStudentNameFromSchema(selectedChild, childSchema);
        const childPhoto = resolveStudentPhotoUrl(selectedChild, childSchema);
        const { uploadedSlots } = resolveVerificationDocumentsForStudent(selectedChild, childSchema);
        const nonFileSections = (childSchema?.sections || [])
          .map((sec) => ({
            ...sec,
            nonFileFields: (sec.fields || []).filter((f) => f.type !== 'file'),
          }))
          .filter((sec) => sec.nonFileFields.length > 0);

        return (
        <Modal
          isOpen={isChildDetailOpen}
          onClose={() => setIsChildDetailOpen(false)}
          title={`Data Pendaftaran: ${childName}`}
          description={`Nomor Pendaftaran: ${selectedChild.registrationNumber}`}
          maxWidth="md"
          hideFooter
        >
          <div className="space-y-4 py-2 text-xs">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              {childPhoto ? (
                <img
                  src={childPhoto}
                  alt={childName}
                  className="w-12 h-12 rounded-full object-cover border border-emerald-200 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-emerald-700 text-white flex items-center justify-center font-extrabold text-base border border-emerald-200 shrink-0">
                  {(childName && childName !== '-' ? childName : 'S').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  {childName}
                </h4>
                <p className="text-slate-500 font-mono">
                  {selectedChild.unit} · {selectedChild.registrationNumber}
                </p>
                <div className="mt-1">
                  <StatusBadge status={selectedChild.status} />
                </div>
              </div>
            </div>

            {/* Test Schedule if available */}
            {(() => {
              const targetUnitKey = (selectedChild.unit || '').trim().toUpperCase();
              const unitSchedules = schedules
                .filter((s) => (s.unit || '').trim().toUpperCase() === targetUnitKey)
                .slice()
                .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
              const activeSch = selectedChild.testScheduleId
                ? schedules.find((s) => s.id === selectedChild.testScheduleId) || unitSchedules[0]
                : unitSchedules[0];
              if (!activeSch && selectedChild.status !== 'tes' && unitSchedules.length === 0) return null;
              return (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2 text-blue-900">
                  <h5 className="font-bold text-xs flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      {activeSch
                        ? activeSch.title
                        : 'Jadwal Tes Seleksi & Observasi'}
                    </span>
                  </h5>
                  {unitSchedules.length > 0 ? (
                    <div className="space-y-2">
                      {unitSchedules.map((sch) => (
                        <div key={sch.id} className="p-2 rounded-lg bg-white/80 border border-blue-100 space-y-0.5">
                          <p className="text-[11px] font-bold text-blue-950">{sch.title}</p>
                          <p className="text-[11px] text-blue-800">
                            Tanggal: <strong>{sch.date}</strong> ({sch.startTime} - {sch.endTime} WIB)
                          </p>
                          <p className="text-[11px] text-blue-800">
                            Ruangan: {sch.room} · Penguji: {sch.examiner}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-blue-800">
                      Jadwal tes unit {selectedChild.unit} belum ditetapkan oleh panitia.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Graduation announcement if available */}
            {selectedChild.status === 'lulus' && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-emerald-900">
                <h5 className="font-bold text-xs flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Selamat! Calon Siswa Dinyatakan LULUS</span>
                </h5>
                <p className="text-[11px] text-emerald-800">
                  Nilai Seleksi: <strong>{selectedChild.testScore || 88} / 100</strong>
                </p>
                <p className="text-[11px] text-emerald-700">
                  Silakan lanjutkan pembayaran biaya Daftar Ulang di menu Pembayaran.
                </p>
              </div>
            )}

            {/* Dynamic Form Builder Sections */}
            {nonFileSections.length > 0 ? (
              <div className="space-y-2.5">
                {nonFileSections.map((sec) => (
                  <div key={sec.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <p className="font-bold text-slate-900 text-[11px] border-b border-slate-200 pb-1">
                      {sec.title}
                    </p>
                    {sec.nonFileFields.map((f) => {
                      const val = formatCardFieldDisplayValue(resolveFormFieldValue(selectedChild, f), f);
                      return (
                        <div key={f.id} className="flex justify-between gap-3">
                          <span className="text-slate-500">{f.label}:</span>
                          <span className="font-semibold text-slate-800 text-right break-words max-w-[180px]">
                            {val}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Nama Siswa:</span>
                  <span className="font-semibold text-slate-800">{childName}</span>
                </div>
              </div>
            )}

            {/* Uploaded Documents ONLY when present */}
            {uploadedSlots.length > 0 && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <p className="font-bold text-slate-900 text-[11px]">
                  Berkas Terlampir ({uploadedSlots.length})
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {uploadedSlots.map((doc) => (
                    <div key={doc.key} className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                      <p className="text-[10px] font-bold text-slate-700 truncate mb-1">{doc.label}</p>
                      {isPdfDocumentUrl(doc.url) ? (
                        <span className="inline-block px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                          PDF Terlampir
                        </span>
                      ) : (
                        <img
                          src={doc.url}
                          alt={doc.label}
                          className="w-full h-16 object-cover rounded"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setIsChildDetailOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-200 text-slate-700 font-bold"
            >
              Tutup
            </button>
          </div>
        </Modal>
        );
      })()}

      {/* Modal Upload Bukti Transfer */}
      {uploadTarget && (
        <Modal
          isOpen={isUploadModalOpen}
          onClose={() => {
            setIsUploadModalOpen(false);
            setMobileProofDataUrl('');
            setMobileProofFileName('');
            setUploadTarget(null);
          }}
          title={uploadTarget.replacePaymentId ? 'Upload Ulang Bukti Transfer' : 'Unggah Bukti Transfer'}
          description={`Tagihan: ${uploadTarget.type} untuk ${uploadTarget.studentName}`}
          confirmLabel={uploadTarget.replacePaymentId ? 'Kirim Upload Ulang' : 'Kirim Bukti Pembayaran'}
          confirmDisabled={!mobileProofDataUrl}
          onConfirm={handleConfirmUploadProof}
        >
          <div className="space-y-4 py-1 text-xs">
            {uploadTarget.replacePaymentId && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-semibold leading-relaxed">
                Bukti lama yang ditolak akan otomatis ditimpa dengan gambar/PDF baru dan dihapus dari penyimpanan server.
              </div>
            )}

            {activeBankAccounts.length > 1 && (
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Bank Tujuan Transfer untuk Struk Ini</label>
                <div className="flex flex-wrap gap-2">
                  {activeBankAccounts.map((bank) => (
                    <button
                      type="button"
                      key={bank.id}
                      onClick={() => setSelectedMobileBankId(bank.id)}
                      className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer ${
                        activeSelectedMobileBank?.id === bank.id
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {bank.bankCode || bank.bankName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeSelectedMobileBank && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                <p className="font-bold">Transfer ke {activeSelectedMobileBank.bankName}:</p>
                <p className="font-mono text-sm font-extrabold break-all">{activeSelectedMobileBank.accountNumber}</p>
                <p className="text-[11px] text-emerald-700 break-words">a.n. {activeSelectedMobileBank.accountHolder}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">Nominal Transfer pada Struk Ini (Rp) *</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  Rp
                </span>
                <CurrencyInput
                  max={500000000}
                  value={mobileUploadAmount}
                  onChange={(val) => setMobileUploadAmount(val)}
                  placeholder="Contoh: 300.000"
                  className="w-full p-3 pl-10 rounded-xl border border-slate-300 bg-white font-mono text-xs font-bold"
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Jika membayar bertahap/beda bank, masukkan nominal sesuai yang tertulis pada struk ini.
              </p>
            </div>

            <button
              type="button"
              onClick={() => mobileProofFileInputRef.current?.click()}
              className="w-full block border-2 border-dashed border-emerald-300 rounded-2xl p-5 text-center bg-slate-50 space-y-2 cursor-pointer hover:bg-emerald-50/40 transition-colors"
            >
              <Upload className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="font-bold text-slate-800">
                {mobileProofDataUrl ? 'Pilih Ulang Foto Struk / Screenshot m-Banking' : 'Pilih Foto Struk / Screenshot m-Banking *'}
              </p>
              <p className="text-[11px] text-slate-400">
                Format JPG, PNG, WEBP, atau PDF (Maksimal 5 MB)
              </p>
            </button>

            {uploadTarget.replacePaymentId && mobileProofDataUrl && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-[11px] text-emerald-900 font-semibold leading-relaxed flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  Gambar baru sudah terpilih! Periksa nominal di atas, lalu tekan <strong>Kirim Upload Ulang</strong> di bawah.
                </span>
              </div>
            )}

            {mobileProofDataUrl && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center gap-3">
                {mobileProofDataUrl.startsWith('data:application/pdf') ? (
                  <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                    PDF
                  </div>
                ) : (
                  <img
                    src={mobileProofDataUrl}
                    alt="Preview"
                    className="w-10 h-10 rounded-lg object-cover border border-emerald-300 shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-emerald-950 truncate">{mobileProofFileName || 'Bukti Terlampir'}</p>
                  <span className="text-[10px] text-emerald-700 block break-words">
                    Nominal: {formatRupiah(mobileUploadAmount)} · Siap dikirim ke bendahara
                  </span>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal Preview Bukti Mobile */}
      {previewMobileProofUrl && (
        <Modal
          isOpen={Boolean(previewMobileProofUrl)}
          onClose={() => setPreviewMobileProofUrl(null)}
          title="Pratinjau Bukti Pembayaran"
          maxWidth="lg"
          hideFooter
        >
          <div className="flex items-center justify-center bg-slate-100 rounded-xl p-2 max-h-[65vh] overflow-hidden">
            {isPdfDocumentUrl(previewMobileProofUrl) ? (
              <iframe src={previewMobileProofUrl} title="Bukti PDF" className="w-full h-[55vh] rounded-lg bg-white" />
            ) : (
              <img src={previewMobileProofUrl} alt="Bukti Transfer" className="max-h-[58vh] w-auto object-contain rounded-lg" />
            )}
          </div>
        </Modal>
      )}

      {/* Success Celebration Modal */}
      {justRegisteredName && (
        <Modal
          isOpen={!!justRegisteredName}
          onClose={() => setJustRegisteredName(null)}
          title="Pendaftaran Berhasil Dikirim!"
          description={`Alhamdulillah, data pendaftaran ananda ${justRegisteredName} telah berhasil dicatat ke sistem PPDB Yayasan Ar-Risalah Aceh.`}
          icon={<CheckCircle2 className="w-8 h-8 text-emerald-600" />}
          confirmLabel="Lihat Status Siswa"
          onConfirm={() => setJustRegisteredName(null)}
          hideFooter={false}
        >
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800">
            Tim verifikator berkas akan memeriksa kelengkapan dokumen ananda dalam waktu 1x24 jam kerja.
          </div>
        </Modal>
      )}
      {/* Persistent hidden file input so Upload Ulang immediately opens device gallery/file picker */}
      <input
        ref={mobileProofFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.pdf"
        className="hidden"
        onChange={handleSelectMobileProofFile}
      />

      <PaymentReceiptModal
        receipt={activeReceiptData}
        onClose={() => setActiveReceiptData(null)}
        onToast={showToast}
      />
    </div>
  );
};
