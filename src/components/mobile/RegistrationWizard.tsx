import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  AlertCircle,
  School,
  User,
  Users,
  FileText,
  CreditCard,
  CheckCircle2,
  Eye,
  Trash2,
  RefreshCw,
  Loader2,
  Copy,
  ChevronDown,
  ChevronUp,
  Info,
  Calendar,
  Layers,
  Sparkles,
  GraduationCap,
  AlertTriangle,
  X,
  XCircle,
  Lock,
} from 'lucide-react';
import { usePPDB } from '../../context/PPDBContext';
import { FormField, FormSection, UnitFormSchema, UnitQuotaFee } from '../../types/ppdb';
import { INITIAL_FORM_SCHEMAS } from '../../data/initialData';
import { Modal } from '../common/Modal';
import {
  ensureCoreNameFieldInSections,
  isLockedNameField,
  isUploadedDocumentValue,
} from '../../utils/studentFieldResolver';

interface WizardProps {
  initialUnit?: string;
  onClose: () => void;
  onSuccess: (studentName: string) => void;
}

export const RegistrationWizard: React.FC<WizardProps> = ({
  initialUnit,
  onClose,
  onSuccess,
}) => {
  const {
    units,
    formSchemas,
    refreshFormSchemas,
    addStudent,
    addPaymentProof,
    showToast,
    currentUser,
    sendRegistrationEmailIfVerified,
    bankAccounts,
    refreshBankAccounts,
  } = usePPDB();

  const activeBankAccounts = useMemo(
    () =>
      bankAccounts
        .filter((b) => b.isActive)
        .sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1)),
    [bankAccounts]
  );

  // Unit Selection State - Screen 1: choose school unit if not preselected
  const [selectedUnit, setSelectedUnit] = useState<string>(
    () =>
      initialUnit ||
      (units.find((u) => u.isOpen !== false && u.totalQuota - u.filledQuota > 0)?.id ??
        units[0]?.id ??
        'TK01')
  );
  const [isUnitConfirmed, setIsUnitConfirmed] = useState<boolean>(Boolean(initialUnit));

  // Closed Unit Notice Modal State
  const [closedNoticeModalUnit, setClosedNoticeModalUnit] = useState<UnitQuotaFee | null>(null);

  // Always fetch latest Form Builder schemas and bank accounts from server whenever RegistrationWizard opens or unit changes
  useEffect(() => {
    refreshFormSchemas();
    refreshBankAccounts();
  }, [refreshFormSchemas, refreshBankAccounts, selectedUnit, isUnitConfirmed]);

  // Sync if initialUnit is passed via QR code shortcut, checking closed status & quota full
  useEffect(() => {
    if (initialUnit) {
      const targetUnit = units.find((u) => u.id === initialUnit);
      const isFull = targetUnit ? targetUnit.totalQuota - targetUnit.filledQuota <= 0 : false;
      if (targetUnit && (targetUnit.isOpen === false || isFull)) {
        setSelectedUnit(initialUnit);
        setIsUnitConfirmed(false);
        setClosedNoticeModalUnit(
          isFull && targetUnit.isOpen !== false
            ? {
                ...targetUnit,
                closedNotice: `Mohon maaf, kuota pendaftaran online ${targetUnit.shortName} telah terpenuhi seluruhnya.`,
              }
            : targetUnit
        );
      } else {
        setSelectedUnit(initialUnit);
        setIsUnitConfirmed(true);
      }
    }
  }, [initialUnit, units]);

  // Retrieve current unit configuration
  const unitConfig = useMemo(() => {
    return units.find((u) => u.id === selectedUnit) || units[0];
  }, [units, selectedUnit]);

  // Handle selecting / attempting to enter a unit
  const handleSelectUnit = (unit: UnitQuotaFee) => {
    const remaining = Math.max(0, unit.totalQuota - unit.filledQuota);
    if (unit.isOpen === false || remaining <= 0) {
      setClosedNoticeModalUnit(
        remaining <= 0 && unit.isOpen !== false
          ? {
              ...unit,
              closedNotice: `Mohon maaf, kuota pendaftaran online ${unit.shortName} telah penuh.`,
            }
          : unit
      );
      return;
    }
    if (unit.id !== selectedUnit) {
      setAnswers({});
      setCurrentStep(1);
    }
    setSelectedUnit(unit.id);
    setIsUnitConfirmed(true);
  };

  const activeSchema: UnitFormSchema = useMemo(() => {
    const found = formSchemas.find((s) => s.unitId === selectedUnit);
    if (found && Array.isArray(found.sections)) {
      return {
        ...found,
        sections: ensureCoreNameFieldInSections(found.sections, selectedUnit),
      };
    }
    const initialFound = INITIAL_FORM_SCHEMAS.find((s) => s.unitId === selectedUnit);
    if (initialFound && Array.isArray(initialFound.sections)) {
      return {
        ...initialFound,
        sections: ensureCoreNameFieldInSections(initialFound.sections, selectedUnit),
      };
    }
    return {
      unitId: selectedUnit,
      sections: ensureCoreNameFieldInSections([], selectedUnit),
    };
  }, [formSchemas, selectedUnit]);

  const sections: FormSection[] = activeSchema.sections || [];

  // Steps: Step 1 .. Step N are the dynamic sections. Step N + 1 is "Pembayaran & Konfirmasi"
  const totalSteps = sections.length + 1;
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Keep currentStep within valid bounds if form schema sections change dynamically
  useEffect(() => {
    if (currentStep > totalSteps) {
      setCurrentStep(Math.max(1, totalSteps));
    }
  }, [currentStep, totalSteps]);

  // Dynamic Form Answers state: maps field.id -> answer value (string | dataURL)
  const [answers, setAnswers] = useState<Record<string, any>>({});

  // Payment proof & Bank state for final step
  const [proofDocUrl, setProofDocUrl] = useState<string>('');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [copiedBankId, setCopiedBankId] = useState<string | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);
  const [showReviewAccordion, setShowReviewAccordion] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const activeSelectedBank =
    activeBankAccounts.find((b) => b.id === selectedBankId) || activeBankAccounts[0] || null;

  // Auto-prefill Wali data if currentUser is logged in as parent
  useEffect(() => {
    if (currentUser) {
      setAnswers((prev) => {
        const updated = { ...prev };
        sections.forEach((sec) => {
          sec.fields.forEach((f) => {
            const l = f.label.toLowerCase();
            const id = f.id.toLowerCase();
            if (
              (l.includes('orang tua') || l.includes('wali') || l.includes('ayah') || id.includes('parentname')) &&
              !updated[f.id] &&
              currentUser.name
            ) {
              updated[f.id] = currentUser.name;
            }
            if (
              (l.includes('whatsapp') || l.includes('hp') || l.includes('telepon') || id.includes('parentphone')) &&
              !updated[f.id] &&
              currentUser.phone
            ) {
              updated[f.id] = currentUser.phone;
            }
          });
        });
        return updated;
      });
    }
  }, [currentUser, sections]);

  // Helper for updating answer
  const handleAnswerChange = (fieldId: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  // Generic File Upload Handler using FileReader
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldId: string,
    fieldLabel: string,
    fileConfig?: { allowedTypes: string[]; maxSizeMB: number }
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxBytes = (fileConfig?.maxSizeMB || 5) * 1024 * 1024;
    if (file.size > maxBytes) {
      showToast(`Ukuran file "${fieldLabel}" melebihi batas ${fileConfig?.maxSizeMB || 5}MB`, 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        handleAnswerChange(fieldId, event.target.result as string);
        showToast(`Dokumen "${fieldLabel}" berhasil diunggah!`);
      }
    };
    reader.onerror = () => {
      showToast(`Gagal membaca file "${fieldLabel}"`, 'error');
    };
    reader.readAsDataURL(file);
  };

  // Struk Transfer upload for final step
  const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran struk transfer melebihi 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setProofDocUrl(event.target.result as string);
        showToast('Bukti transfer berhasil dilampirkan!');
      }
    };
    reader.readAsDataURL(file);
  };

  // Step Validation
  const validateCurrentStep = (): boolean => {
    if (currentStep <= sections.length) {
      const currentSection = sections[currentStep - 1];
      if (!currentSection) return true;

      for (const field of currentSection.fields) {
        const val = answers[field.id];

        // Required check
        if (field.required) {
          if (val === undefined || val === null || String(val).trim() === '') {
            showToast(`Wajib diisi: "${field.label}"`, 'error');
            return false;
          }
        }

        // NISN specific format validation
        const isNisn =
          field.label.toLowerCase().includes('nisn') || field.id.toLowerCase().includes('nisn');
        if (isNisn && val && String(val).trim().length > 0) {
          const clean = String(val).replace(/\D/g, '');
          if (clean.length !== 10) {
            showToast(`Field "${field.label}" harus berupa 10 digit angka atau kosongkan bila belum ada`, 'error');
            return false;
          }
        }

        // Phone specific format validation
        const isPhone =
          field.label.toLowerCase().includes('whatsapp') ||
          field.label.toLowerCase().includes('hp') ||
          field.id.toLowerCase().includes('phone');
        if (isPhone && val && String(val).trim().length > 0) {
          const cleanPhone = String(val).replace(/\D/g, '');
          if (cleanPhone.length < 9) {
            showToast(`Nomor "${field.label}" minimal 9 digit angka`, 'error');
            return false;
          }
        }
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      if (currentStep < totalSteps) {
        setCurrentStep((s) => s + 1);
        const el = document.getElementById('wizard-scroll-container');
        if (el) el.scrollTop = 0;
      } else {
        handleSubmitFinal();
      }
    }
  };

  const handlePrev = () => {
    if (!isUnitConfirmed) {
      onClose();
      return;
    }

    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
      const el = document.getElementById('wizard-scroll-container');
      if (el) el.scrollTop = 0;
    } else {
      if (!initialUnit) {
        setIsUnitConfirmed(false);
      } else {
        onClose();
      }
    }
  };

  // Extract helper for mapping dynamic answers
  const extractFieldValue = (regex: RegExp, fallback = '', excludeRegex?: RegExp): string => {
    for (const sec of sections) {
      for (const f of sec.fields) {
        const val = answers[f.id];
        if (!val) continue;
        if (excludeRegex && (excludeRegex.test(f.label) || excludeRegex.test(f.id))) {
          continue;
        }
        if (regex.test(f.id) || regex.test(f.label)) {
          return String(val).trim();
        }
      }
    }
    for (const [key, val] of Object.entries(answers)) {
      if (excludeRegex && excludeRegex.test(key)) continue;
      if (regex.test(key) && val) {
        return String(val).trim();
      }
    }
    return fallback;
  };

  const resolveChildName = (): string => {
    for (const sec of sections) {
      for (const f of sec.fields) {
        if (isLockedNameField(f)) {
          const val = answers[f.id];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            return String(val).trim();
          }
        }
      }
    }
    const excludeSchoolOrParent = /tk|paud|sd|smp|sma|sekolah|asal|ayah|ibu|wali|orang.?tua/i;
    return (
      extractFieldValue(/fullname|nama.?lengkap|nama.?santri|nama.?calon|nama.?anak|nama.?peserta/i, '', excludeSchoolOrParent) ||
      extractFieldValue(/nama.?panggilan/i, '', excludeSchoolOrParent) ||
      extractFieldValue(/nama/i, '', excludeSchoolOrParent) ||
      'Calon Siswa Baru'
    );
  };

  // Submit Final Registration
  const handleSubmitFinal = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const childName = resolveChildName();

      const nisnVal = extractFieldValue(/nisn/i, '');
      const genderVal =
        (extractFieldValue(/gender|jenis.?kelamin/i) as 'Laki-laki' | 'Perempuan') || 'Laki-laki';
      const birthPlaceVal = extractFieldValue(/birthplace|tempat.?lahir/i, '');
      const birthDateVal = extractFieldValue(/birthdate|tanggal.?lahir/i, '');
      const addressVal = extractFieldValue(/address|alamat/i, '');

      const parentNameVal =
        extractFieldValue(/parentname|nama.?orang.?tua|nama.?wali|nama.?ayah|nama.?ibu/i) ||
        currentUser?.name ||
        '';

      const parentPhoneVal =
        extractFieldValue(/parentphone|whatsapp|nomor.?hp|telepon/i) ||
        currentUser?.phone ||
        '';

      const parentJobVal = extractFieldValue(/parentjob|pekerjaan/i, '');
      const parentIncomeVal = extractFieldValue(/parentincome|penghasilan/i, '');

      const documentsMap: Record<string, string> = {};

      sections.forEach((sec) => {
        sec.fields.forEach((f) => {
          if (f.type !== 'file') return;
          const val = answers[f.id];
          if (!isUploadedDocumentValue(val)) return;
          documentsMap[f.id] = val.trim();
        });
      });

      const newStudent = await addStudent({
        fullName: childName,
        nisn: nisnVal ? nisnVal.replace(/\D/g, '') : undefined,
        unit: selectedUnit,
        gender: genderVal,
        birthPlace: birthPlaceVal,
        birthDate: birthDateVal,
        address: addressVal,
        parentName: parentNameVal,
        parentPhone: parentPhoneVal,
        parentJob: parentJobVal,
        parentIncome: parentIncomeVal,
        parentUserId: currentUser?.id,
        documents: documentsMap,
        dynamicAnswers: answers,
      });

      if (proofDocUrl && newStudent?.id) {
        await addPaymentProof(
          newStudent.id,
          proofDocUrl,
          unitConfig.formFee,
          'Formulir',
          activeSelectedBank?.id
        );
      }

      if (newStudent?.id && currentUser?.emailVerified) {
        sendRegistrationEmailIfVerified(newStudent.id).catch(() => {});
      }

      onSuccess(childName);
    } catch (err: any) {
      console.error('[Registration Error]:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleCopyBank = (bankId: string, accountNumber: string, bankLabel: string) => {
    navigator.clipboard.writeText(accountNumber.replace(/\s+/g, ''));
    setCopiedBankId(bankId);
    showToast(`Nomor rekening ${bankLabel} disalin!`);
    setTimeout(() => setCopiedBankId((prev) => (prev === bankId ? null : prev)), 2000);
  };

  const isSectionStep = currentStep <= sections.length;
  const currentSection = isSectionStep ? sections[currentStep - 1] : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 font-['Plus_Jakarta_Sans',sans-serif] animate-in fade-in">
      <div className="bg-slate-50 w-full max-w-2xl h-[100dvh] sm:h-[92vh] sm:max-h-[850px] sm:rounded-3xl flex flex-col justify-between overflow-hidden shadow-2xl border border-slate-200">
        {/* 1. Header Bar */}
        <div className="bg-white px-4 sm:px-6 py-3.5 border-b border-slate-200 flex items-center justify-between shadow-2xs shrink-0">
          <button
            type="button"
            onClick={handlePrev}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>
              {!isUnitConfirmed
                ? 'Batal'
                : currentStep === 1 && initialUnit
                ? 'Tutup'
                : currentStep === 1
                ? 'Ganti Unit'
                : 'Kembali'}
            </span>
          </button>

          <div className="text-center min-w-0 px-2">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight truncate">
              Formulir Pendaftaran Siswa Baru
            </h3>
            <p className="text-[11px] text-emerald-800 font-bold truncate">
              {!isUnitConfirmed
                ? 'Pilih Jenjang / Unit Sekolah Tujuan'
                : isSectionStep
                ? `Langkah ${currentStep} dari ${totalSteps}: ${currentSection?.title}`
                : `Langkah ${totalSteps} dari ${totalSteps}: Pembayaran & Konfirmasi`}
            </p>
          </div>

          <div className="w-14 text-right shrink-0">
            {isUnitConfirmed ? (
              <span className="text-xs font-mono font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                {Math.round((currentStep / totalSteps) * 100)}%
              </span>
            ) : (
              <span className="text-[11px] font-bold text-slate-400">Pilih Unit</span>
            )}
          </div>
        </div>

        {/* 3. Dynamic Stepper Indicator Bar */}
        {isUnitConfirmed && (
          <div className="bg-white px-3 sm:px-6 py-2 border-b border-slate-200 flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none shrink-0">
            {sections.map((sec, idx) => {
              const stepNum = idx + 1;
              const isPassed = currentStep > stepNum;
              const isCurrent = currentStep === stepNum;
              return (
                <div
                  key={sec.id}
                  onClick={() => {
                    if (stepNum < currentStep) setCurrentStep(stepNum);
                  }}
                  className={`flex-1 min-w-[70px] sm:min-w-[90px] flex flex-col items-center gap-1 transition-all ${
                    stepNum < currentStep ? 'cursor-pointer' : ''
                  }`}
                  title={sec.title}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      isPassed
                        ? 'bg-emerald-800 text-white'
                        : isCurrent
                        ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 scale-105'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isPassed ? <Check className="w-3.5 h-3.5" /> : stepNum}
                  </div>
                  <span
                    className={`text-[9px] sm:text-[10px] text-center font-bold tracking-tight line-clamp-1 w-full px-1 ${
                      isCurrent ? 'text-emerald-950 font-extrabold' : 'text-slate-500'
                    }`}
                  >
                    {sec.title}
                  </span>
                </div>
              );
            })}

            {/* Final Step */}
            <div
              onClick={() => {
                if (currentStep === totalSteps) return;
                if (validateCurrentStep()) setCurrentStep(totalSteps);
              }}
              className="flex-1 min-w-[70px] sm:min-w-[90px] flex flex-col items-center gap-1"
              title="Pembayaran & Konfirmasi"
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  currentStep === totalSteps
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 scale-105'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
              </div>
              <span
                className={`text-[9px] sm:text-[10px] text-center font-bold tracking-tight line-clamp-1 w-full px-1 ${
                  currentStep === totalSteps ? 'text-emerald-950 font-extrabold' : 'text-slate-500'
                }`}
              >
                Bayar & Kirim
              </span>
            </div>
          </div>
        )}

        {/* 4. Scrollable Step Content Body */}
        <div
          id="wizard-scroll-container"
          className="flex-1 overflow-y-auto p-4 sm:p-6 w-full space-y-4"
        >
          {/* SCREEN 1: UNIT SELECTION */}
          {!isUnitConfirmed && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-2xs space-y-2 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                  <GraduationCap className="w-4 h-4 text-emerald-700" />
                  <span>Pilih Unit Sekolah Tujuan</span>
                </div>
                <h4 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Pilih Unit Sekolah untuk Daftarkan Ananda
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                  Silakan pilih jenjang pendidikan yang sesuai. Formulir pendaftaran akan disesuaikan secara dinamis dengan pertanyaan yang telah ditetapkan oleh admin sekolah/yayasan untuk unit tersebut.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {units.map((u) => {
                  const isSelected = selectedUnit === u.id;
                  const remainingQuota = Math.max(0, u.totalQuota - u.filledQuota);
                  const isOpen = u.isOpen !== false;
                  const isFull = remainingQuota <= 0;
                  const isAvailable = isOpen && !isFull;

                  return (
                    <button
                      type="button"
                      key={u.id}
                      disabled={!isAvailable}
                      onClick={() => isAvailable && handleSelectUnit(u)}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 text-left relative w-full ${
                        !isAvailable
                          ? 'border-slate-200 bg-slate-100 text-slate-400 opacity-80 cursor-not-allowed'
                          : isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20 cursor-pointer'
                          : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-xs cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-lg font-mono font-extrabold text-xs ${
                                isAvailable ? 'bg-emerald-800 text-white' : 'bg-slate-400 text-white'
                              }`}
                            >
                              {u.id}
                            </span>

                            {/* Open / Full / Closed Status Badge */}
                            {!isOpen ? (
                              <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-extrabold inline-flex items-center gap-1 border border-slate-300">
                                <Lock className="w-3 h-3 text-slate-500" />
                                <span>Belum Dibuka</span>
                              </span>
                            ) : isFull ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold inline-flex items-center gap-1 border border-amber-200">
                                <AlertTriangle className="w-3 h-3 text-amber-700" />
                                <span>Kuota Penuh</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                <span>Dibuka</span>
                              </span>
                            )}
                          </div>
                          <h5 className={`font-extrabold text-sm mt-2 ${isAvailable ? 'text-slate-900' : 'text-slate-500'}`}>
                            {u.name}
                          </h5>
                          <p className={`text-xs mt-0.5 ${isAvailable ? 'text-slate-500' : 'text-slate-400'}`}>
                            {u.shortName} Yayasan Ar-Risalah Aceh
                          </p>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                            !isAvailable
                              ? 'border-slate-300 bg-slate-200 text-slate-500'
                              : isSelected
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {!isAvailable ? (
                            <Lock className="w-2.5 h-2.5" />
                          ) : (
                            isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200/70 flex items-center justify-between text-xs w-full">
                        <span className="text-slate-500">Biaya Formulir:</span>
                        <span className={`font-extrabold font-mono ${isAvailable ? 'text-emerald-800' : 'text-slate-500'}`}>
                          {formatRupiah(u.formFee)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 w-full">
                        <span>
                          Sisa Kuota: <strong className={isAvailable ? 'text-slate-700' : 'text-slate-500'}>{remainingQuota}</strong>
                        </span>
                        <span className={`font-bold ${isAvailable ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {!isOpen ? 'Belum Dibuka' : isFull ? 'Kuota Penuh' : 'Pilih Unit Ini →'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* DYNAMIC SECTION STEP (Steps 1 through sections.length) */}
          {isUnitConfirmed && isSectionStep && currentSection && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-2xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-extrabold uppercase tracking-wider">
                    Langkah {currentStep} · {unitConfig.shortName}
                  </span>
                  <span className="text-slate-400 text-xs">•</span>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    {currentSection.fields.length} Pertanyaan
                  </span>
                </div>
                <h4 className="text-base sm:text-lg font-extrabold text-slate-900">
                  {currentSection.title}
                </h4>
                {currentSection.description && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {currentSection.description}
                  </p>
                )}
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                {currentSection.fields.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    <Info className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    <span>Bagian ini belum memiliki pertanyaan dari admin sekolah. Klik lanjut.</span>
                  </div>
                ) : (
                  currentSection.fields.map((field) => {
                    const fieldValue = answers[field.id] || '';

                    return (
                      <div key={field.id} className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                          <span>
                            {field.label}{' '}
                            {field.required ? (
                              <span className="text-red-500 font-bold">*</span>
                            ) : (
                              <span className="text-slate-400 font-normal text-[10px] ml-1">(Opsional)</span>
                            )}
                          </span>
                        </label>

                        {field.helpText && (
                          <p className="text-[11px] text-slate-500 leading-tight">
                            {field.helpText}
                          </p>
                        )}

                        {field.type === 'text' && (
                          <input
                            type="text"
                            value={fieldValue}
                            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                            placeholder={`Masukkan ${field.label.toLowerCase()}...`}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:bg-white transition-all font-medium"
                          />
                        )}

                        {field.type === 'number' && (
                          <input
                            type="text"
                            inputMode="numeric"
                            value={fieldValue}
                            onChange={(e) => handleAnswerChange(field.id, e.target.value.replace(/\D/g, ''))}
                            placeholder="Masukkan angka..."
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:bg-white transition-all font-mono"
                          />
                        )}

                        {field.type === 'date' && (
                          <input
                            type="date"
                            value={fieldValue}
                            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:bg-white transition-all font-medium"
                          />
                        )}

                        {field.type === 'dropdown' && (
                          <select
                            value={fieldValue}
                            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:bg-white transition-all font-medium"
                          >
                            <option value="">-- Pilih salah satu opsi --</option>
                            {(field.options || []).map((opt, oIdx) => (
                              <option key={oIdx} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        )}

                        {field.type === 'textarea' && (
                          <textarea
                            rows={3}
                            value={fieldValue}
                            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                            placeholder={`Tuliskan ${field.label.toLowerCase()} secara lengkap...`}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:bg-white transition-all font-medium resize-none"
                          />
                        )}

                        {field.type === 'file' && (
                          <div className="space-y-2 pt-1">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                              <div className="text-[11px] text-slate-500">
                                <span>Format: {field.fileConfig?.allowedTypes.join(', ') || 'PDF, JPG, PNG'} (Maks {field.fileConfig?.maxSizeMB || 5}MB)</span>
                              </div>

                              <label className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors shrink-0">
                                <Upload className="w-3.5 h-3.5" />
                                <span>{fieldValue ? 'Ganti Berkas' : 'Pilih File / Foto'}</span>
                                <input
                                  type="file"
                                  accept="image/*,.pdf"
                                  className="hidden"
                                  onChange={(e) =>
                                    handleFileUpload(e, field.id, field.label, field.fileConfig)
                                  }
                                />
                              </label>
                            </div>

                            {fieldValue && (
                              <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between text-xs animate-in fade-in">
                                <div className="flex items-center gap-2 truncate max-w-[240px]">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                                  <span className="font-bold text-emerald-950 truncate text-[11px]">
                                    Berkas {field.label} Terlampir
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewModalUrl(fieldValue)}
                                    className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 font-bold text-[11px] hover:bg-emerald-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Pratinjau</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAnswerChange(field.id, '')}
                                    className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                    title="Hapus file"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* FINAL STEP: PEMBAYARAN FORMULIR & KONFIRMASI */}
          {isUnitConfirmed && currentStep === totalSteps && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h4 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Ringkasan & Pembayaran Formulir ({selectedUnit})
                </h4>
                <p className="text-xs text-slate-500">
                  Periksa kelengkapan data formulir dan lakukan pembayaran registrasi ke rekening resmi yayasan.
                </p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 text-xs">
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                  <span className="text-slate-500">Jenjang Tujuan:</span>
                  <span className="font-extrabold text-emerald-900">
                    {unitConfig.name} ({unitConfig.id})
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                  <span className="text-slate-500">Nama Calon Siswa:</span>
                  <span className="font-bold text-slate-900">
                    {resolveChildName()}
                  </span>
                </div>
                {(() => {
                  const gName = extractFieldValue(/parentname|nama.?orang.?tua|nama.?wali|nama.?ayah|nama.?ibu/i) || currentUser?.name;
                  const gPhone = extractFieldValue(/parentphone|whatsapp|hp|telepon/i) || currentUser?.phone;
                  if (!gName && !gPhone) return null;
                  return (
                    <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                      <span className="text-slate-500">Akun / Kontak Wali:</span>
                      <span className="font-semibold text-slate-800">
                        {gName || '-'}
                        {gPhone ? ` (${gPhone})` : ''}
                      </span>
                    </div>
                  );
                })()}
                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">Biaya Formulir Registrasi:</span>
                  <span className="font-extrabold text-emerald-800 text-base sm:text-lg font-mono tabular-nums">
                    {formatRupiah(unitConfig.formFee)}
                  </span>
                </div>
              </div>

              {/* Accordion: Tinjau Rincian Seluruh Isian */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowReviewAccordion(!showReviewAccordion)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-slate-900">
                      Tinjau Seluruh Jawaban Formulir ({sections.length} Bagian Sesuai Form Builder)
                    </span>
                  </div>
                  {showReviewAccordion ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {showReviewAccordion && (
                  <div className="p-4 pt-0 border-t border-slate-100 space-y-3.5 text-xs">
                    {sections.map((sec, sIdx) => (
                      <div key={sec.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-emerald-950 text-xs">
                            Langkah {sIdx + 1}: {sec.title}
                          </h5>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(sIdx + 1)}
                            className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                          >
                            Ubah Isian
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/50">
                          {sec.fields.map((f) => {
                            const val = answers[f.id];
                            return (
                              <div key={f.id} className="text-[11px]">
                                <span className="text-slate-500 block">{f.label}:</span>
                                <span className="font-semibold text-slate-800 break-words">
                                  {f.type === 'file' ? (
                                    val ? (
                                      <span className="text-emerald-700 font-bold">✓ Dokumen Terlampir</span>
                                    ) : (
                                      <span className="text-slate-400 italic">Belum diunggah</span>
                                    )
                                  ) : val ? (
                                    String(val)
                                  ) : (
                                    <span className="text-slate-400 italic">-</span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rekening Bank Resmi Yayasan (Multi-Bank) */}
              {activeBankAccounts.length > 0 ? (
                <div className="space-y-3">
                  {activeBankAccounts.length > 1 && (
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-2">
                      <span className="text-[11px] font-bold text-slate-700 block">
                        Pilih Rekening Bank Tujuan Transfer ({activeBankAccounts.length} Bank Tersedia):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeBankAccounts.map((bank) => {
                          const isSel = activeSelectedBank?.id === bank.id;
                          return (
                            <button
                              type="button"
                              key={bank.id}
                              onClick={() => setSelectedBankId(bank.id)}
                              className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer ${
                                isSel
                                  ? 'bg-emerald-800 text-white border-emerald-800'
                                  : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              {bank.bankCode || bank.bankName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeSelectedBank && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-900 to-emerald-800 text-white shadow-md space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                          Rekening Resmi · {activeSelectedBank.bankName}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyBank(
                              activeSelectedBank.id,
                              activeSelectedBank.accountNumber,
                              activeSelectedBank.bankCode || activeSelectedBank.bankName
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-emerald-800/80 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer border border-emerald-700 shrink-0"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedBankId === activeSelectedBank.id ? 'Tersalin!' : 'Salin Nomor'}</span>
                        </button>
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-emerald-100">
                          a.n. {activeSelectedBank.accountHolder}
                          {activeSelectedBank.branch ? ` (${activeSelectedBank.branch})` : ''}
                        </h5>
                        <p className="font-mono text-xl sm:text-2xl font-black tracking-wider text-white mt-0.5 break-all">
                          {activeSelectedBank.accountNumber}
                        </p>
                      </div>
                      <p className="text-[11px] text-emerald-200 leading-tight">
                        {activeSelectedBank.notes ||
                          'Transfer dapat dilakukan melalui Mobile Banking, ATM Bersama, Prima, atau transfer antar-bank.'}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  Nomor rekening tujuan transfer belum dikonfigurasi oleh admin yayasan. Anda tetap dapat mengirim formulir dan menghubungi panitia PPDB untuk konfirmasi pembayaran.
                </div>
              )}

              {/* Upload Struk Transfer Pembayaran Formulir */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between gap-2.5">
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">
                      Bukti Transfer Formulir (Opsional)
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      Lampirkan screenshot/foto struk transfer Anda jika sudah melakukan pembayaran
                    </p>
                  </div>
                  <label className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 cursor-pointer inline-flex items-center gap-1.5 transition-colors shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{proofDocUrl ? 'Ganti Struk' : 'Unggah Struk'}</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={handleProofUpload}
                    />
                  </label>
                </div>

                {proofDocUrl && (
                  <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between text-xs mt-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span className="font-bold text-emerald-950 text-[11px]">✓ Struk Transfer Terlampir</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewModalUrl(proofDocUrl)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 font-bold text-[11px] hover:bg-emerald-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Pratinjau</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProofDocUrl('')}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Hapus struk"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 5. Footer Controls Bar */}
        <div className="bg-white px-4 sm:px-6 py-3.5 border-t border-slate-200 flex items-center justify-between shrink-0">
          {!isUnitConfirmed ? (
            <div className="w-full flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={() => {
                  const curr = units.find((u) => u.id === selectedUnit);
                  if (curr) handleSelectUnit(curr);
                }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>Lanjut ke Formulir {selectedUnit}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handlePrev}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
              >
                {currentStep === 1 ? 'Ganti Unit' : 'Sebelumnya'}
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses Pendaftaran...</span>
                  </>
                ) : currentStep < totalSteps ? (
                  <>
                    <span>Lanjut ke Langkah Berikutnya</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Kirim & Selesaikan Pendaftaran</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Notification when unit registration is closed */}
      {closedNoticeModalUnit && (
        <Modal
          isOpen={Boolean(closedNoticeModalUnit)}
          onClose={() => setClosedNoticeModalUnit(null)}
          title={`Pemberitahuan Pendaftaran Unit ${closedNoticeModalUnit.name} Ditutup`}
          description="Status Pendaftaran Non-Aktif / Belum Dibuka"
          icon={<AlertTriangle className="w-6 h-6 text-rose-600" />}
          confirmLabel="Paham & Pilih Unit Lain"
          onConfirm={() => setClosedNoticeModalUnit(null)}
        >
          <div className="space-y-4 py-2 text-xs">
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <XCircle className="w-5 h-5 text-rose-600" />
                <span>Pendaftaran Gelombang Baru Belum Dibuka / Telah Berakhir</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium bg-white p-3 rounded-xl border border-rose-100">
                &quot;{closedNoticeModalUnit.closedNotice || 'Pendaftaran calon siswa baru untuk unit ini sedang ditutup atau belum dibuka. Silakan hubungi panitia PPDB Yayasan Ar-Risalah Aceh.'}&quot;
              </p>
            </div>

            <p className="text-[11px] text-slate-500">
              Silakan pilih unit jenjang pendidikan lain yang masih membuka pendaftaran aktif, atau hubungi Layanan WhatsApp Resmi Panitia PPDB Ar-Risalah Aceh.
            </p>
          </div>
        </Modal>
      )}

      {/* File Document Preview Modal */}
      {previewModalUrl && (
        <Modal
          isOpen={Boolean(previewModalUrl)}
          onClose={() => setPreviewModalUrl(null)}
          title="Pratinjau Dokumen Berkas"
          maxWidth="2xl"
        >
          <div className="p-2 space-y-3">
            <div className="max-h-[60vh] overflow-auto rounded-xl bg-slate-900 flex items-center justify-center p-2">
              {previewModalUrl.startsWith('data:application/pdf') || previewModalUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewModalUrl}
                  title="Pratinjau Dokumen PDF"
                  className="w-full h-[55vh] rounded-lg bg-white"
                />
              ) : (
                <img
                  src={previewModalUrl}
                  alt="Pratinjau Dokumen"
                  className="max-w-full h-auto max-h-[55vh] object-contain rounded-lg"
                />
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewModalUrl(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
