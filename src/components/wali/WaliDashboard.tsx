import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  GraduationCap,
  Calendar,
  CreditCard,
  Printer,
  Plus,
  LogOut,
  Upload,
  AlertCircle,
  Copy,
  Check,
  Eye,
  MessageCircle,
  MailCheck,
  FileText,
  ExternalLink,
  Menu,
  X,
  Phone,
  PhoneCall,
  Edit3,
  CheckCircle2,
  KeyRound,
  Mail,
  Send,
  RefreshCw,
  Download,
  Trash2,
  Info,
  Layers,
  Clock,
  MapPin,
  UserCheck,
} from 'lucide-react';
import { usePPDB } from '../../context/PPDBContext';
import { UnitBadge, StatusBadge, PaymentBadge } from '../common/Badge';
import { Modal } from '../common/Modal';
import QRCode from 'qrcode';
import { FormField, FormSection, StudentRegistration } from '../../types/ppdb';
import { generateStudentCardPdf } from '../../utils/exportUtils';
import {
  ensureCoreNameFieldInSections,
  formatCardFieldDisplayValue,
  getActiveAcademicYearLabel,
  isPdfDocumentUrl,
  isUploadedDocumentValue,
  resolveFormFieldValue as resolveSharedFormFieldValue,
  resolveGuardianSummaryFromSchema,
  resolveStudentNameFromSchema,
  resolveStudentPhotoUrl,
  resolveVerificationDocumentsForStudent,
  getCardBiodataRows,
} from '../../utils/studentFieldResolver';
import { computeStudentPaymentTypeSummary, formatRupiah } from '../../utils/paymentHelpers';
import { PaymentReceiptModal } from '../common/PaymentReceiptModal';
import { ReceiptData } from '../../utils/receiptGenerator';
import { CurrencyInput } from '../common/FormattedNumberInputs';
import { DeveloperFooter } from '../common/DeveloperFooter';

export const WaliDashboard: React.FC = () => {
  const {
    currentUser,
    students,
    payments,
    schedules,
    units,
    academicYears,
    formSchemas,
    refreshFormSchemas,
    refreshSchedules,
    refreshStudentById,
    refreshBankAccounts,
    refreshPayments,
    logout,
    setActiveView,
    setRegisterWizardOpen,
    addPaymentProof,
    updateStudent,
    showToast,
    groupLinks,
    unitContacts,
    letterConfigs,
    landingConfig,
    bankAccounts,
    sendEmailVerificationOtp,
    verifyEmailVerificationOtp,
    sendRegistrationEmailIfVerified,
    updateUser,
  } = usePPDB();

  const activeBankAccounts = React.useMemo(
    () =>
      bankAccounts
        .filter((b) => b.isActive)
        .sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1)),
    [bankAccounts]
  );
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const activeSelectedBank =
    activeBankAccounts.find((b) => b.id === selectedBankId) || activeBankAccounts[0] || null;

  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [landingConfig?.logoUrl]);

  const logoSrc = landingConfig?.logoUrl || '/uploads/1794360625078_my_new_logo.png';
  const fallbackInitial = landingConfig?.appName ? landingConfig.appName.charAt(0).toUpperCase() : 'P';

  // Multi-anak: Filter & SORT so NEWEST registered child is ALWAYS AT THE VERY TOP
  const myStudents = students
    .filter((s) => {
      if (!currentUser) return false;
      if (s.parentUserId && s.parentUserId === currentUser.id) return true;
      if (currentUser.childrenIds && currentUser.childrenIds.includes(s.id)) return true;
      if (currentUser.studentId && s.id === currentUser.studentId) return true;
      if (currentUser.studentRegistrationNumber && s.registrationNumber === currentUser.studentRegistrationNumber) return true;

      return false;
    })
    .sort((a, b) => {
      // Sort descending by timestamp in ID or registeredAt date
      const getTs = (s: StudentRegistration) => {
        const match = s.id.match(/\d+/);
        if (match) return parseInt(match[0], 10);
        if (s.registeredAt) return new Date(s.registeredAt).getTime();
        return 0;
      };
      return getTs(b) - getTs(a);
    });

  // Always keep Form Builder schemas, test schedules, bank accounts, and payments synced with backend/MySQL
  useEffect(() => {
    refreshFormSchemas();
    refreshSchedules();
    refreshBankAccounts();
    refreshPayments();
  }, [refreshFormSchemas, refreshSchedules, refreshBankAccounts, refreshPayments]);

  const [copiedBank, setCopiedBank] = useState(false);
  const [selectedDetailStudent, setSelectedDetailStudent] = useState<StudentRegistration | null>(null);
  const [selectedEditStudent, setSelectedEditStudent] = useState<StudentRegistration | null>(null);
  const [editStudentForm, setEditStudentForm] = useState<Record<string, any>>({});
  const [savingEditStudent, setSavingEditStudent] = useState(false);
  const dirtyEditFieldsRef = React.useRef<Set<string>>(new Set());
  const activeEditStudentIdRef = React.useRef<string | null>(null);
  const [selectedPrintStudent, setSelectedPrintStudent] = useState<StudentRegistration | null>(null);
  const [printQrDataUrl, setPrintQrDataUrl] = useState<string>('');
  const [confirmEmailSendStudent, setConfirmEmailSendStudent] = useState<StudentRegistration | null>(null);
  const [sendingEmailCard, setSendingEmailCard] = useState(false);
  const [selectedPaymentStudent, setSelectedPaymentStudent] = useState<StudentRegistration | null>(null);
  const [selectedScheduleStudent, setSelectedScheduleStudent] = useState<StudentRegistration | null>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [activeReceiptData, setActiveReceiptData] = useState<ReceiptData | null>(null);

  const openReceiptForPayment = (
    student: StudentRegistration,
    paymentRec: {
      id: string;
      type: 'Formulir' | 'Daftar Ulang';
      amount: number;
      date: string;
      bankAccount: string;
      verificationNotes?: string;
      verifiedBy?: string;
      receiptSig?: string;
    },
    lunasTranches?: Array<{ id: string; amount: number; date: string; bankAccount: string }>
  ) => {
    const targetUnit = units.find((u) => u.id === student.unit);
    const resolvedName = resolveStudentNameFromSchema(
      student,
      getNormalizedUnitSchema(student.unit)
    );
    const totalApproved =
      lunasTranches && lunasTranches.length > 0
        ? lunasTranches.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
        : paymentRec.amount;

    setActiveReceiptData({
      paymentId: paymentRec.id,
      registrationNumber: student.registrationNumber,
      studentName: resolvedName || student.fullName,
      unitId: student.unit,
      unitName: targetUnit?.name || student.unit,
      unitShortName: targetUnit?.shortName || student.unit,
      paymentType: paymentRec.type,
      amount: paymentRec.amount,
      totalApprovedForBill: totalApproved,
      date: paymentRec.date,
      bankAccount: paymentRec.bankAccount || 'Rekening Resmi Yayasan',
      verificationNotes: paymentRec.verificationNotes,
      verifiedBy: paymentRec.verifiedBy,
      academicYear: getActiveAcademicYearLabel(academicYears),
      receiptSig: paymentRec.receiptSig,
      appName: landingConfig?.appName,
      logoUrl: landingConfig?.logoUrl,
      tranches: lunasTranches,
    });
  };

  useEffect(() => {
    let cancelled = false;
    if (!selectedPrintStudent) {
      setPrintQrDataUrl('');
      return;
    }
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ppdb.arrisalahaceh.or.id';
    const verifyUrl = `${baseUrl}/#verify-ttd?reg=${encodeURIComponent(selectedPrintStudent.registrationNumber || '')}`;
    QRCode.toDataURL(verifyUrl, {
      width: 160,
      margin: 1,
      color: { dark: '#14532d', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setPrintQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPrintQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPrintStudent]);

  const setEditFieldValue = (fieldId: string, value: any) => {
    dirtyEditFieldsRef.current.add(fieldId);
    setEditStudentForm((prev) => ({ ...prev, [fieldId]: value }));
  };

  const getNormalizedUnitSchema = (unitId: string) => {
    const found = formSchemas.find((s) => s.unitId === unitId);
    if (!found) return undefined;
    return {
      ...found,
      sections: ensureCoreNameFieldInSections(found.sections, found.unitId),
    };
  };

  // Resolve value for any Form Builder field from current dynamicAnswers, legacy keys, dropdown options, or DB summary columns
  const resolveFormFieldValue = (student: StudentRegistration, f: FormField): any =>
    resolveSharedFormFieldValue(student, f);

  // Build dynamic initial answers for a student strictly aligned with Form Builder sections
  const buildDynamicEditState = (student: StudentRegistration, sections: FormSection[]): Record<string, any> => {
    const baseAnswers: Record<string, any> = { ...(student.dynamicAnswers || {}) };
    sections.forEach((sec) => {
      sec.fields.forEach((f) => {
        const resolved = resolveFormFieldValue(student, f);
        if (resolved !== undefined && resolved !== null && String(resolved) !== '') {
          baseAnswers[f.id] = resolved;
        } else if (baseAnswers[f.id] === undefined) {
          baseAnswers[f.id] = '';
        }
      });
    });
    return baseAnswers;
  };

  const openEditStudentModal = async (student: StudentRegistration) => {
    activeEditStudentIdRef.current = student.id;
    dirtyEditFieldsRef.current = new Set();
    setSelectedEditStudent(student);
    const currentSchema = getNormalizedUnitSchema(student.unit);
    setEditStudentForm(buildDynamicEditState(student, currentSchema?.sections || []));

    const [freshSchemas, freshStudent] = await Promise.all([
      refreshFormSchemas(),
      refreshStudentById(student.id),
    ]);

    if (activeEditStudentIdRef.current !== student.id) return;

    const latestStudent = freshStudent || student;
    if (freshStudent) {
      setSelectedEditStudent(freshStudent);
    }
    const rawTargetSchema = (freshSchemas || formSchemas).find((s) => s.unitId === latestStudent.unit);
    const targetSections = ensureCoreNameFieldInSections(rawTargetSchema?.sections, latestStudent.unit);
    const rebuilt = buildDynamicEditState(latestStudent, targetSections);
    setEditStudentForm((prev) => {
      const merged = { ...rebuilt };
      dirtyEditFieldsRef.current.forEach((dirtyKey) => {
        if (prev[dirtyKey] !== undefined) {
          merged[dirtyKey] = prev[dirtyKey];
        }
      });
      return merged;
    });
  };

  const validateAndReadFile = (
    file: File,
    fieldLabel: string,
    fileConfig?: { allowedTypes: string[]; maxSizeMB: number },
    onDataUrl?: (dataUrl: string) => void
  ) => {
    const maxMB = fileConfig?.maxSizeMB || 5;
    const maxBytes = maxMB * 1024 * 1024;
    if (file.size > maxBytes) {
      showToast(`Ukuran file "${fieldLabel}" melebihi batas ${maxMB}MB`, 'error');
      return;
    }

    const allowedExtensions = (fileConfig?.allowedTypes && fileConfig.allowedTypes.length > 0
      ? fileConfig.allowedTypes
      : ['PDF', 'JPG', 'JPEG', 'PNG', 'WEBP']
    ).map((t) => t.toLowerCase().replace(/^\./, ''));
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    const isExtAllowed =
      allowedExtensions.includes(ext) ||
      (ext === 'jpeg' && allowedExtensions.includes('jpg')) ||
      (ext === 'jpg' && allowedExtensions.includes('jpeg'));
    const isMimeAllowed = !file.type || allowedMimes.includes(file.type.toLowerCase());

    if (!isExtAllowed || !isMimeAllowed) {
      showToast(
        `Format file "${fieldLabel}" tidak diizinkan. Gunakan ${allowedExtensions.map((x) => x.toUpperCase()).join(', ')}.`,
        'error'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && onDataUrl) {
        onDataUrl(event.target.result as string);
      }
    };
    reader.onerror = () => {
      showToast(`Gagal membaca file "${fieldLabel}"`, 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleEditFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldId: string,
    fieldLabel: string,
    fileConfig?: { allowedTypes: string[]; maxSizeMB: number }
  ) => {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    if (!file) return;

    validateAndReadFile(file, fieldLabel, fileConfig, (dataUrl) => {
      setEditFieldValue(fieldId, dataUrl);
      showToast(`Dokumen "${fieldLabel}" siap disimpan!`);
    });
    inputEl.value = '';
  };

  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditStudent) return;

    const unitSchema = getNormalizedUnitSchema(selectedEditStudent.unit);
    const sections = unitSchema?.sections || ensureCoreNameFieldInSections([], selectedEditStudent.unit);

    // Validate dynamically using the exact same rules as RegistrationWizard
    for (const sec of sections) {
      for (const field of sec.fields) {
        const val = editStudentForm[field.id];

        if (field.required) {
          if (val === undefined || val === null || String(val).trim() === '') {
            showToast(`Wajib diisi: "${field.label}"`, 'error');
            return;
          }
        }

        const isNisn =
          field.label.toLowerCase().includes('nisn') || field.id.toLowerCase().includes('nisn');
        if (isNisn && val && String(val).trim().length > 0) {
          const clean = String(val).replace(/\D/g, '');
          if (clean.length !== 10) {
            showToast(`Field "${field.label}" harus berupa 10 digit angka atau kosongkan bila belum ada`, 'error');
            return;
          }
        }

        const isPhone =
          field.label.toLowerCase().includes('whatsapp') ||
          field.label.toLowerCase().includes('hp') ||
          field.id.toLowerCase().includes('phone');
        if (isPhone && val && String(val).trim().length > 0) {
          const clean = String(val).replace(/\D/g, '');
          if (clean.length < 9) {
            showToast(`Nomor "${field.label}" minimal 9 digit angka`, 'error');
            return;
          }
        }
      }
    }

    const extractDynamicVal = (regex: RegExp, excludeRegex?: RegExp): string | undefined => {
      for (const sec of sections) {
        for (const f of sec.fields) {
          if (f.type === 'file') continue;
          const val = editStudentForm[f.id];
          if (val === undefined || val === null || String(val).trim() === '') continue;
          if (excludeRegex && (excludeRegex.test(f.label) || excludeRegex.test(f.id))) continue;
          if (regex.test(f.id) || regex.test(f.label)) {
            return String(val).trim();
          }
        }
      }
      return undefined;
    };

    const nextDocuments: Record<string, string> = { ...(selectedEditStudent.documents || {}) };
    sections.forEach((sec) => {
      sec.fields.forEach((f) => {
        if (f.type !== 'file') return;
        const val = editStudentForm[f.id];
        if (isUploadedDocumentValue(val)) {
          nextDocuments[f.id] = val.trim();
        } else {
          nextDocuments[f.id] = '';
        }
      });
    });

    const excludeSchoolOrParent = /tk|paud|sd|smp|sma|sekolah|asal|ayah|ibu|wali|orang.?tua|panggilan/i;
    const extractedFullName = extractDynamicVal(/fullname|nama.?lengkap|nama.?santri|nama.?calon|nama.?anak|nama.?peserta/i, excludeSchoolOrParent);
    const extractedNisn = extractDynamicVal(/nisn/i);
    const extractedGender = extractDynamicVal(/gender|jenis.?kelamin/i);
    const extractedBirthPlace = extractDynamicVal(/birthplace|tempat.?lahir/i);
    const extractedBirthDate = extractDynamicVal(/birthdate|tanggal.?lahir/i);
    const extractedAddress = extractDynamicVal(/address|alamat/i);
    const extractedSchoolOrigin = extractDynamicVal(/schoolorigin|sekolah.?asal|asal.?sekolah|nama.?tk|paud|nama.?sekolah|npsn.?sd.?asal/i);
    const extractedParentName = extractDynamicVal(/parentname|nama.?orang.?tua|nama.?wali|nama.?ayah/i);
    const extractedParentPhone = extractDynamicVal(/parentphone|whatsapp|nomor.?hp|telepon/i);
    const extractedParentJob = extractDynamicVal(/parentjob|pekerjaan/i);
    const extractedParentIncome = extractDynamicVal(/parentincome|penghasilan/i);

    const updatePayload: Partial<StudentRegistration> = {
      dynamicAnswers: { ...editStudentForm },
      documents: nextDocuments,
    };
    if (extractedFullName) updatePayload.fullName = extractedFullName;
    if (extractedNisn !== undefined) updatePayload.nisn = extractedNisn.replace(/\D/g, '');
    if (extractedGender) updatePayload.gender = extractedGender as 'Laki-laki' | 'Perempuan';
    if (extractedBirthPlace) updatePayload.birthPlace = extractedBirthPlace;
    if (extractedBirthDate) updatePayload.birthDate = extractedBirthDate;
    if (extractedAddress) updatePayload.address = extractedAddress;
    if (extractedSchoolOrigin) updatePayload.schoolOrigin = extractedSchoolOrigin;
    if (extractedParentName) updatePayload.parentName = extractedParentName;
    if (extractedParentPhone) updatePayload.parentPhone = extractedParentPhone;
    if (extractedParentJob) updatePayload.parentJob = extractedParentJob;
    if (extractedParentIncome) updatePayload.parentIncome = extractedParentIncome;

    setSavingEditStudent(true);
    try {
      const ok = await updateStudent(selectedEditStudent.id, updatePayload);
      if (!ok) return;
      setSelectedEditStudent(null);
      if (selectedDetailStudent && selectedDetailStudent.id === selectedEditStudent.id) {
        setSelectedDetailStudent((prev) => (prev ? { ...prev, ...updatePayload } : null));
      }
    } finally {
      setSavingEditStudent(false);
    }
  };

  // Profile Modal & Hamburger Drawer State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editName, setEditName] = useState(currentUser?.name || '');
  const [editPhone, setEditPhone] = useState(currentUser?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Sync edit form state whenever currentUser updates
  useEffect(() => {
    if (currentUser) {
      setEditName(currentUser.name || '');
      setEditPhone(currentUser.phone || '');
    }
  }, [currentUser]);

  const getUnitContact = (unitId: string) => {
    const fallbackContact = landingConfig?.contact;
    return unitContacts.find((c) => c.unitId === unitId) || unitContacts.find((c) => c.unitId === 'MASTER') || {
      unitId: 'MASTER',
      unitName: landingConfig?.appName || 'Sekretariat PPDB',
      contactPerson: 'Sekretariat PPDB',
      phone: fallbackContact?.phone || fallbackContact?.whatsapp || '',
      whatsapp: fallbackContact?.whatsapp || fallbackContact?.phone || '',
      email: fallbackContact?.email || '',
      officeHours: 'Senin - Sabtu (08:00 - 16:00 WIB)',
      address: fallbackContact?.address || '',
    };
  };

  // Form Payment Upload State inside modal
  const [paymentType, setPaymentType] = useState<'Formulir' | 'Daftar Ulang'>('Formulir');
  const [uploadAmount, setUploadAmount] = useState(0);
  const [proofFileData, setProofFileData] = useState<string>('');
  const [proofFileName, setProofFileName] = useState<string>('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [replacingPaymentId, setReplacingPaymentId] = useState<string | null>(null);
  const [paymentUploadNotice, setPaymentUploadNotice] = useState<string | null>(null);
  const uploadFormRef = useRef<HTMLFormElement | null>(null);
  const uploadSubmitSectionRef = useRef<HTMLDivElement | null>(null);
  const proofFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSavingProfile(true);
    try {
      const ok = await updateUser(currentUser.id, {
        name: editName,
        phone: editPhone,
      });
      if (!ok) return;
      setIsProfileModalOpen(false);
    } finally {
      setSavingProfile(false);
    }
  };

  // Email verification & OTP state
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [otpStep, setOtpStep] = useState<'request' | 'input'>('request');
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Timer cooldown pengiriman ulang OTP
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const openVerifyEmailModal = () => {
    setOtpError(null);
    setOtpCode('');
    setIsVerifyModalOpen(true);
  };

  const handleSendOtp = async () => {
    setIsSendingOtp(true);
    setOtpError(null);
    try {
      const res = await sendEmailVerificationOtp();
      if (res.success) {
        setOtpStep('input');
        setOtpCooldown(res.cooldownSeconds || 60);
        showToast(res.message || 'Kode OTP telah dikirim ke email Anda.');
      } else {
        setOtpError(res.error || 'Gagal mengirim kode OTP.');
        showToast(res.error || 'Gagal mengirim kode OTP.', 'error');
      }
    } catch (e: any) {
      setOtpError('Terjadi kesalahan koneksi saat mengirim kode OTP.');
      showToast('Gagal mengirim kode OTP.', 'error');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = otpCode.trim();
    if (!clean || clean.length !== 6) {
      setOtpError('Harap masukkan 6 digit kode OTP verifikasi.');
      return;
    }
    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      const res = await verifyEmailVerificationOtp(clean);
      if (res.success) {
        showToast('Alhamdulillah, email Anda berhasil diverifikasi secara resmi!');
        setIsVerifyModalOpen(false);
        setOtpStep('request');
        setOtpCode('');
      } else {
        setOtpError(res.error || 'Kode OTP tidak sesuai.');
      }
    } catch (e: any) {
      setOtpError('Gagal memverifikasi kode OTP.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSendCardToEmail = (student: StudentRegistration) => {
    if (!currentUser?.emailVerified) {
      openVerifyEmailModal();
      return;
    }
    setConfirmEmailSendStudent(student);
  };

  const handleConfirmSendCardToEmail = async () => {
    if (!confirmEmailSendStudent || !currentUser || sendingEmailCard) return;
    setSendingEmailCard(true);
    try {
      const res = await sendRegistrationEmailIfVerified(confirmEmailSendStudent.id);
      if (res.sent) {
        const studentDisplayName = resolveStudentNameFromSchema(
          confirmEmailSendStudent,
          getNormalizedUnitSchema(confirmEmailSendStudent.unit)
        );
        showToast(`Kartu pendaftaran ananda ${studentDisplayName} berhasil dikirim ke ${currentUser.email}!`);
        setConfirmEmailSendStudent(null);
      } else {
        showToast(res.message || 'Gagal mengirim email.', 'error');
      }
    } catch (err: any) {
      showToast('Terjadi gangguan saat pengiriman email.', 'error');
    } finally {
      setSendingEmailCard(false);
    }
  };

  const handleCopyAccount = (accountNumber?: string, bankLabel?: string) => {
    const targetNum = (accountNumber || activeSelectedBank?.accountNumber || '').replace(/\s+/g, '');
    if (!targetNum) {
      showToast('Nomor rekening belum tersedia.', 'error');
      return;
    }
    navigator.clipboard.writeText(targetNum);
    setCopiedBank(true);
    showToast(`Nomor rekening ${bankLabel || activeSelectedBank?.bankCode || 'Yayasan'} berhasil disalin!`);
    setTimeout(() => setCopiedBank(false), 2500);
  };

  const handleSelectProofFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    if (!file) return;
    validateAndReadFile(
      file,
      'Bukti Transfer Pembayaran',
      { allowedTypes: ['JPG', 'JPEG', 'PNG', 'WEBP', 'PDF'], maxSizeMB: 5 },
      (dataUrl) => {
        setProofFileData(dataUrl);
        setProofFileName(file.name);
        showToast('Struk transfer baru siap dikirim.');
        requestAnimationFrame(() => {
          uploadSubmitSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }
    );
    inputEl.value = '';
  };

  const handleUploadProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentStudent) return;
    if (!proofFileData) {
      showToast('Harap pilih / lampirkan file bukti transfer (JPG, PNG, WEBP, atau PDF maks 5MB) terlebih dahulu.', 'error');
      return;
    }
    if (!Number.isFinite(uploadAmount) || uploadAmount < 1000) {
      showToast('Nominal transfer minimal Rp 1.000.', 'error');
      return;
    }
    setIsUploadingProof(true);
    try {
      const ok = await addPaymentProof(
        selectedPaymentStudent.id,
        proofFileData,
        uploadAmount,
        paymentType,
        activeSelectedBank?.id,
        replacingPaymentId || undefined
      );
      if (ok) {
        const freshPayments = await refreshPayments();
        const latestList = freshPayments || payments;
        const targetUnit = units.find((u) => u.id === selectedPaymentStudent.unit);
        const afterSummary = computeStudentPaymentTypeSummary(
          latestList,
          selectedPaymentStudent.id,
          paymentType,
          targetUnit
        );
        setProofFileData('');
        setProofFileName('');
        setReplacingPaymentId(null);

        if (afterSummary.remainingAmount > 0) {
          setUploadAmount(afterSummary.remainingAmount);
          setPaymentUploadNotice(
            `Bukti transfer Rp ${uploadAmount.toLocaleString('id-ID')} tersimpan! Sisa kekurangan ${formatRupiah(afterSummary.remainingAmount)} dapat langsung diunggah sebagai bukti transfer tambahan (bisa menggunakan rekening bank berbeda).`
          );
        } else {
          setPaymentUploadNotice(
            `Alhamdulillah, bukti transfer berhasil dikirim. Total terkirim sudah memenuhi tarif resmi (${formatRupiah(afterSummary.targetFee)}) dan menunggu/sudah diverifikasi bendahara.`
          );
          setUploadAmount(0);
        }
      }
    } finally {
      setIsUploadingProof(false);
    }
  };

  // Helper to get group config for a specific child unit
  const getChildGroupConfig = (unitId: string) => {
    return groupLinks.find((g) => g.unitId === unitId) || groupLinks.find((g) => g.unitId === 'ALL');
  };

  const isChildGroupVisible = (student: StudentRegistration) => {
    const group = getChildGroupConfig(student.unit);
    if (!group || !group.groupUrl || !group.groupUrl.trim()) return false;
    if (group.visibilityRule === 'always') return true;
    if (group.visibilityRule === 'after_data') return true;
    if (group.visibilityRule === 'after_payment') {
      const targetUnit = units.find((u) => u.id === student.unit);
      const formSummary = computeStudentPaymentTypeSummary(payments, student.id, 'Formulir', targetUnit);
      const reRegSummary = computeStudentPaymentTypeSummary(payments, student.id, 'Daftar Ulang', targetUnit);
      return formSummary.overallStatus === 'lunas' || reRegSummary.overallStatus === 'lunas';
    }
    return false;
  };

  const userInitial = currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'W';

  return (
    <div className="min-h-screen w-full bg-slate-50/80 text-slate-800 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Sleek Header Wali Siswa */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          {/* Brand Logo & Title (Click to Landing) */}
          <button
            type="button"
            onClick={() => setActiveView('landing')}
            title="Ke Halaman Utama PPDB"
            className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-85 active:scale-[0.99] transition-all cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center font-extrabold text-sm shadow-xs shrink-0 border border-emerald-200 overflow-hidden p-0.5">
              {logoSrc && !logoError ? (
                <img
                  src={logoSrc}
                  alt="Logo"
                  className="w-full h-full object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span className="text-sm font-black text-[#14532d] tracking-tight">
                  {fallbackInitial}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight leading-none truncate">
                {landingConfig?.appName || 'Portal Wali Siswa'}
              </h1>
              <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                {currentUser?.name || 'PPDB Ar-Risalah Aceh'}
              </p>
            </div>
          </button>

          {/* Right Controls: Profile Pill, Hamburger Menu, and Logout Icon Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Clickable Profile Pill */}
            <button
              type="button"
              onClick={() => {
                setEditName(currentUser?.name || '');
                setEditPhone(currentUser?.phone || '');
                setIsProfileModalOpen(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200/90 transition-all cursor-pointer text-left active:scale-95"
              title="Kelola Profil Akun Wali"
            >
              <div className="w-6 h-6 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {userInitial}
              </div>
              <span className="hidden sm:inline-block text-xs font-bold text-slate-800 max-w-[120px] truncate">
                {currentUser?.name || 'Profil'}
              </span>
            </button>

            {/* Garis 3 (Hamburger Menu Button) */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 rounded-xl text-slate-700 hover:text-emerald-800 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              title="Menu Navigasi"
            >
              <Menu className="w-4.5 h-4.5" />
            </button>

            {/* Logout Icon Button */}
            <button
              type="button"
              onClick={logout}
              title="Keluar Akun (Logout)"
              className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border border-rose-200/80 transition-all cursor-pointer active:scale-95"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hamburger Drawer Menu Modal */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-2xs animate-in fade-in">
          <div className="w-full max-w-xs bg-white h-full shadow-2xl p-5 flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-sm">
                    A
                  </div>
                  <span className="font-extrabold text-sm text-slate-900">Menu Wali</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Info Card in Drawer */}
              <div
                onClick={() => {
                  setIsDrawerOpen(false);
                  setIsProfileModalOpen(true);
                }}
                className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-center gap-3 cursor-pointer hover:bg-emerald-100/80 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-extrabold text-base">
                  {userInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-extrabold text-xs text-slate-900 truncate">
                    {currentUser?.name || 'Wali Santri'}
                  </h4>
                  <p className="text-[10px] text-slate-500 truncate">{currentUser?.email}</p>
                  <span className="mt-1 inline-block text-[9px] font-bold text-emerald-800 bg-white border border-emerald-300 px-2 py-0.5 rounded-md">
                    Atur Profil Wali →
                  </span>
                </div>
              </div>

              {/* Menu Links */}
              <div className="space-y-1 text-xs font-bold text-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    setRegisterWizardOpen(true);
                  }}
                  className="w-full p-3 rounded-xl hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-emerald-700" />
                  <span>Daftarkan Anak Baru</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                  className="w-full p-3 rounded-xl hover:bg-slate-100 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
                >
                  <User className="w-4 h-4 text-slate-600" />
                  <span>Profil & Verifikasi Email</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    setIsContactModalOpen(true);
                  }}
                  className="w-full p-3 rounded-xl hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
                >
                  <PhoneCall className="w-4 h-4 text-emerald-700" />
                  <span>Hubungi Kami (Kontak Panitia)</span>
                </button>
              </div>
            </div>

            {/* Logout Button at bottom of Drawer */}
            <button
              type="button"
              onClick={() => {
                setIsDrawerOpen(false);
                logout();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar Akun (Logout)</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 pb-2 flex flex-col gap-6">
        {/* Email Verification Warning Banner if not verified */}
        {!currentUser?.emailVerified && (
          <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-extrabold text-amber-950 text-xs">Verifikasi Alamat Email Kontak Wali</h4>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  Email <span className="font-mono font-bold text-amber-900">{currentUser?.email || '-'}</span> belum diverifikasi. Verifikasi akun untuk menerima otomatis kartu ujian & kwitansi via email.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openVerifyEmailModal}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 cursor-pointer shadow-2xs transition-all active:scale-95"
            >
              Verifikasi Sekarang
            </button>
          </div>
        )}

        {/* SECTION 1: EMPTY STATE IF 0 CHILDREN */}
        {myStudents.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center space-y-5 border border-slate-200/80 shadow-2xs">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-200 shadow-inner">
              <GraduationCap className="w-8 h-8 text-emerald-700" />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                Ahlan wa Sahlan, {currentUser?.name || 'Wali Siswa'}!
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Belum ada santri atau calon siswa yang terdaftar di akun Anda. Silakan klik tombol di bawah untuk mendaftarkan putra/putri Anda ke unit {units.length > 0 ? units.map((u) => u.shortName).join(', ') : 'pendidikan Yayasan Ar-Risalah Aceh'}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRegisterWizardOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold shadow-md shadow-emerald-800/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>Daftarkan Ananda Sekarang</span>
            </button>
          </div>
        ) : (
          /* SECTION 2: GRID KARTU ANAK ("SATU KARTU PER ANAK") */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  Daftar Calon Siswa Terdaftar ({myStudents.length} Anak)
                </h2>
                <p className="text-xs text-slate-500">
                  Anak yang baru didaftarkan otomatis muncul paling atas dalam kartu terpisah.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRegisterWizardOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0 self-start sm:self-auto active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Daftarkan Ananda</span>
              </button>
            </div>

            {/* Grid of Child Cards (Newest registered child is ALWAYS AT INDEX 0) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {myStudents.map((child, index) => {
                const childUnit = units.find((u) => u.id === child.unit) || units[0];
                const formulirSummary = computeStudentPaymentTypeSummary(payments, child.id, 'Formulir', childUnit);
                const reRegSummary = computeStudentPaymentTypeSummary(payments, child.id, 'Daftar Ulang', childUnit);
                const primarySummary =
                  reRegSummary.uploadedRecords.length > 0 && formulirSummary.overallStatus === 'lunas'
                    ? reRegSummary
                    : formulirSummary;
                const totalUploadedProofs = formulirSummary.uploadedRecords.length + reRegSummary.uploadedRecords.length;
                const rejectedRecord = primarySummary.uploadedRecords.find((r) => r.status === 'ditolak');
                const rejectedNote = rejectedRecord?.verificationNotes;
                const groupConfig = getChildGroupConfig(child.unit);
                const hasGroup = isChildGroupVisible(child);
                const isNewest = index === 0;

                const childSchema = getNormalizedUnitSchema(child.unit);
                const childDisplayName = resolveStudentNameFromSchema(child, childSchema);
                const childPhoto = resolveStudentPhotoUrl(child, childSchema);

                // Initial for avatar fallback
                const initial = childDisplayName && childDisplayName !== '-' ? childDisplayName.charAt(0).toUpperCase() : 'S';

                return (
                  <div
                    key={child.id}
                    className={`bg-white rounded-3xl p-5 border shadow-2xs space-y-4 flex flex-col justify-between hover:shadow-md transition-all duration-200 relative ${
                      isNewest ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200/90'
                    }`}
                  >
                    {/* Newest Badge Tag for recent registration */}
                    {isNewest && myStudents.length > 1 && (
                      <div className="absolute -top-3 right-5 bg-emerald-700 text-white text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs">
                        Pendaftaran Terbaru
                      </div>
                    )}

                    <div className="space-y-3.5">
                      {/* Card Header: Child Avatar + Name + Badges */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex items-center justify-center font-extrabold text-lg overflow-hidden border border-emerald-300 shadow-2xs shrink-0">
                            {childPhoto ? (
                              <img src={childPhoto} alt={childDisplayName} className="w-full h-full object-cover" />
                            ) : (
                              <span>{initial}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug truncate">
                              {childDisplayName}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                {child.registrationNumber}
                              </span>
                            </div>
                          </div>
                        </div>
                        <UnitBadge unit={child.unit} />
                      </div>

                      {/* Info Strip */}
                      <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5 text-xs">
                        <div className="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 text-slate-600">
                          <span className="font-medium">Jenjang Sekolah:</span>
                          <span className="font-bold text-slate-900 text-right">{childUnit.name}</span>
                        </div>
                        <div className="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 text-slate-600">
                          <span className="font-medium">Status Seleksi:</span>
                          <StatusBadge status={child.status || 'verifikasi'} />
                        </div>
                        <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                          <div className="flex flex-wrap justify-between items-center text-slate-600 gap-2">
                            <span className="font-medium">
                              Pembayaran ({primarySummary.type}):
                            </span>
                            {primarySummary.uploadedRecords.length > 0 ? (
                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                {totalUploadedProofs > 1 && (
                                  <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md">
                                    {totalUploadedProofs} Bukti
                                  </span>
                                )}
                                <PaymentBadge status={primarySummary.overallStatus} />
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                                Belum Bayar Formulir
                              </span>
                            )}
                          </div>
                          {primarySummary.uploadedRecords.length > 0 && primarySummary.remainingAmount > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5 text-amber-900 font-semibold">
                              <span>Terkirim {formatRupiah(primarySummary.submittedValidAmount)}</span>
                              <span className="font-bold">Kurang {formatRupiah(primarySummary.remainingAmount)}</span>
                            </div>
                          )}
                          {primarySummary.overallStatus === 'lunas' && (() => {
                            const lunasRecords = primarySummary.uploadedRecords.filter((r) => r.status === 'lunas');
                            const latestLunas = lunasRecords[lunasRecords.length - 1];
                            if (!latestLunas) return null;
                            return (
                              <button
                                type="button"
                                onClick={() =>
                                  openReceiptForPayment(
                                    child,
                                    latestLunas,
                                    lunasRecords.map((r) => ({
                                      id: r.id,
                                      amount: r.amount,
                                      date: r.date,
                                      bankAccount: r.bankAccount,
                                    }))
                                  )
                                }
                                className="w-full py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer active:scale-95"
                              >
                                <Printer className="w-3.5 h-3.5 shrink-0" />
                                <span>Cetak Resi Lunas ({primarySummary.type})</span>
                              </button>
                            );
                          })()}
                          {(rejectedNote || rejectedRecord) && (
                            <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 space-y-2">
                              {rejectedNote && (
                                <p className="text-[11px] text-rose-800 font-semibold leading-relaxed break-words">
                                  Catatan Admin: {rejectedNote}
                                </p>
                              )}
                              {rejectedRecord && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPaymentType(primarySummary.type);
                                    setReplacingPaymentId(rejectedRecord.id);
                                    setProofFileData('');
                                    setProofFileName('');
                                    setSelectedBankId('');
                                    setPaymentUploadNotice(null);
                                    setUploadAmount(
                                      rejectedRecord.amount > 0
                                        ? rejectedRecord.amount
                                        : primarySummary.remainingAmount || primarySummary.targetFee
                                    );
                                    setSelectedPaymentStudent(child);
                                    refreshBankAccounts();
                                    refreshPayments();
                                    proofFileInputRef.current?.click();
                                    requestAnimationFrame(() => {
                                      uploadFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    });
                                  }}
                                  className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold inline-flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer active:scale-95"
                                >
                                  <Upload className="w-3.5 h-3.5 shrink-0" />
                                  <span>Upload Ulang Bukti Ditolak</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {(() => {
                          const childUnitKey = (child.unit || '').trim().toUpperCase();
                          const childUnitSchedules = schedules
                            .filter((s) => (s.unit || '').trim().toUpperCase() === childUnitKey)
                            .slice()
                            .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
                          const primarySch = child.testScheduleId
                            ? schedules.find((s) => s.id === child.testScheduleId) || childUnitSchedules[0]
                            : childUnitSchedules[0];

                          return (
                            <div className="flex justify-between items-center text-slate-600 pt-1.5 border-t border-slate-200/60 gap-2">
                              <span className="font-medium shrink-0">Jadwal Tes Unit:</span>
                              {primarySch ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setSelectedScheduleStudent(child);
                                    setIsLoadingSchedule(true);
                                    try {
                                      await Promise.all([refreshSchedules(), refreshStudentById(child.id)]);
                                    } finally {
                                      setIsLoadingSchedule(false);
                                    }
                                  }}
                                  className="text-right font-bold text-blue-700 hover:text-blue-900 underline decoration-blue-300 underline-offset-2 truncate cursor-pointer"
                                  title="Klik untuk melihat detail jadwal tes"
                                >
                                  {primarySch.date} ({primarySch.startTime} WIB)
                                  {childUnitSchedules.length > 1 ? ` · +${childUnitSchedules.length - 1} sesi` : ''}
                                </button>
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-400">
                                  Belum dijadwalkan
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* WhatsApp Group Link Specific to THIS Child's School Unit - Only render when visibility rule requirements are met */}
                      {hasGroup && groupConfig && Boolean(groupConfig.groupUrl) && (
                        <div className="p-3 rounded-2xl bg-emerald-50/90 border border-emerald-200 flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <MessageCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                            <span className="font-bold text-emerald-950 truncate text-[11px]">
                              {groupConfig.groupName}
                            </span>
                          </div>

                          <a
                            href={groupConfig.groupUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] shrink-0 transition-colors inline-flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                          >
                            <span>Gabung WA</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      {/* Unit Panitia Contact Card */}
                      {(() => {
                        const contact = getUnitContact(child.unit);
                        return (
                          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-slate-800 text-[11px]">
                                Kontak Panitia {child.unit}
                              </span>
                              <a
                                href={`https://wa.me/${(contact.whatsapp || landingConfig?.contact?.whatsapp || '').replace(/[^0-9]/g, '')}?text=Assalamu%2rayaikum%20Panitia%20PPDB%20${encodeURIComponent(contact.unitName)},%20saya%20Wali%20dari%20${encodeURIComponent(childDisplayName)}...`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold inline-flex items-center gap-1 transition-all"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>WhatsApp</span>
                              </a>
                            </div>
                            <div>
                              <p className="font-extrabold text-slate-900 text-xs">{contact.contactPerson}</p>
                              <p className="font-mono font-bold text-emerald-700 text-xs">{contact.phone}</p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Card Actions Toolbar */}
                    <div className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-bold">
                      <button
                        type="button"
                        onClick={async () => {
                          setSelectedDetailStudent(child);
                          const [, fresh] = await Promise.all([
                            refreshFormSchemas(),
                            refreshStudentById(child.id),
                          ]);
                          if (fresh) {
                            setSelectedDetailStudent((curr) => (curr && curr.id === fresh.id ? fresh : curr));
                          }
                        }}
                        className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 inline-flex items-center justify-center gap-1.5 text-center whitespace-normal leading-tight min-h-[42px] transition-all cursor-pointer active:scale-95"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span>Detail &amp; Form</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditStudentModal(child)}
                        className="py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center justify-center gap-1.5 text-center whitespace-normal leading-tight min-h-[42px] transition-all cursor-pointer active:scale-95"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>Edit Data</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPrintStudent(child)}
                        className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white inline-flex items-center justify-center gap-1.5 text-center whitespace-normal leading-tight min-h-[42px] transition-all cursor-pointer active:scale-95 shadow-2xs"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Cetak Kartu</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const defaultType: 'Formulir' | 'Daftar Ulang' =
                            formulirSummary.overallStatus === 'lunas' &&
                            (child.status === 'lulus' || child.status === 'terdaftar' || reRegSummary.uploadedRecords.length > 0)
                              ? 'Daftar Ulang'
                              : 'Formulir';
                          const initSummary = defaultType === 'Daftar Ulang' ? reRegSummary : formulirSummary;
                          setPaymentType(defaultType);
                          setUploadAmount(
                            initSummary.remainingAmount > 0
                              ? initSummary.remainingAmount
                              : initSummary.uploadedRecords.length === 0
                              ? initSummary.targetFee
                              : 0
                          );
                          setProofFileData('');
                          setProofFileName('');
                          setSelectedBankId('');
                          setReplacingPaymentId(null);
                          setPaymentUploadNotice(null);
                          setSelectedPaymentStudent(child);
                          refreshBankAccounts();
                          refreshPayments();
                        }}
                        className="py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white inline-flex items-center justify-center gap-1.5 text-center whitespace-normal leading-tight min-h-[42px] transition-all cursor-pointer active:scale-95 shadow-2xs"
                      >
                        <CreditCard className="w-3.5 h-3.5 shrink-0" />
                        <span>Bayar / Struk</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setSelectedScheduleStudent(child);
                          setIsLoadingSchedule(true);
                          try {
                            const [, fresh] = await Promise.all([
                              refreshSchedules(),
                              refreshStudentById(child.id),
                            ]);
                            if (fresh) {
                              setSelectedScheduleStudent((curr) =>
                                curr && curr.id === fresh.id ? fresh : curr
                              );
                            }
                          } finally {
                            setIsLoadingSchedule(false);
                          }
                        }}
                        className="col-span-2 sm:col-span-1 py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 inline-flex items-center justify-center gap-1.5 text-center whitespace-normal leading-tight min-h-[42px] transition-all cursor-pointer active:scale-95"
                      >
                        <Calendar className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                        <span>Jadwal Tes</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hubungi Kami Card (Matching child card layout/size exactly) */}
        <div className="max-w-6xl mx-auto w-full pt-2 pb-0">
          <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 rounded-3xl p-5 border border-emerald-800/40 shadow-2xs space-y-4 flex flex-col justify-between text-white">
            <div className="space-y-1">
              <h3 className="text-base font-extrabold tracking-tight">
                {landingConfig?.helpTitle || 'Perlu Bantuan / Kendala Pendaftaran?'}
              </h3>
              <p className="text-xs text-emerald-200 leading-relaxed">
                {landingConfig?.helpSubtitle || 'Tim panitia PPDB Yayasan Ar-Risalah Aceh siap membantu Anda setiap Senin - Sabtu pukul 08:00 - 16:00 WIB.'}
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setIsContactModalOpen(true)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white text-emerald-950 font-extrabold text-xs shadow-md hover:bg-emerald-50 transition-all cursor-pointer active:scale-95 inline-flex items-center justify-center gap-2"
              >
                <PhoneCall className="w-4 h-4 text-emerald-700" />
                <span>Hubungi Kami (Daftar Kontak)</span>
              </button>
            </div>
          </div>
        </div>

        <DeveloperFooter variant="light" className="mt-auto pt-4 pb-1" />
      </main>

      {/* MODAL PROFIL AKUN WALI (Spacious, Clean & Professional Redesign) */}
      {isProfileModalOpen && (
        <Modal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          title="Pengaturan Profil Akun Wali Siswa"
          maxWidth="lg"
          hideFooter
        >
          <form onSubmit={handleSaveProfile} className="space-y-6 text-xs text-slate-700 p-1">
            {/* Header User Banner */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 text-white font-black text-2xl flex items-center justify-center border-2 border-white/30 backdrop-blur-md shadow-inner shrink-0">
                  {userInitial}
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-white tracking-tight">{currentUser?.name}</h4>
                  <p className="text-xs text-emerald-200 font-mono mt-0.5">{currentUser?.email}</p>
                  <p className="text-[11px] text-emerald-300 font-medium mt-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>User ID: <strong className="font-mono">{currentUser?.id}</strong></span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-white/20 text-white border border-white/30 backdrop-blur-md">
                  {currentUser?.role || 'Wali Santri'}
                </span>
                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500/30 text-emerald-100 border border-emerald-400/40">
                  {myStudents.length} Anak Terdaftar
                </span>
              </div>
            </div>

            {/* Content Cards Grid */}
            <div className="space-y-5">
              {/* Section 1: Email Verification Status */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MailCheck className="w-4 h-4 text-emerald-700" />
                    <h5 className="font-extrabold text-slate-900 text-xs">Status Verifikasi Email Kontak</h5>
                  </div>
                  {currentUser?.emailVerified ? (
                    <span className="px-3 py-1 rounded-xl bg-emerald-100 text-emerald-900 font-bold text-[11px] inline-flex items-center gap-1 border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Terverifikasi</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 font-bold text-[11px] border border-amber-300">
                      Belum Diverifikasi
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-mono font-bold text-slate-900">{currentUser?.email}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Verifikasi email digunakan untuk pengiriman otomatis kartu ujian & kwitansi pembayaran.
                    </p>
                  </div>
                  {!currentUser?.emailVerified && (
                    <button
                      type="button"
                      onClick={openVerifyEmailModal}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 cursor-pointer shadow-2xs transition-colors"
                    >
                      Verifikasi Sekarang
                    </button>
                  )}
                </div>
              </div>

              {/* Section 2: Edit Form Information */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200/90 space-y-4 shadow-2xs">
                <h5 className="font-extrabold text-slate-900 text-xs border-b border-slate-100 pb-2 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-emerald-700" />
                  <span>Ubah Data Informasi Wali Siswa</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-800 block text-xs">
                      Nama Lengkap Wali Siswa *
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      placeholder="Nama lengkap sesuai KTP/KK..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50/70 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-800 block text-xs">
                      Nomor WhatsApp / Kontak Aktif *
                    </label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      required
                      placeholder="081234567890"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50/70 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Footer Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsProfileModalOpen(false);
                  logout();
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 font-bold text-xs inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar Akun (Logout)</span>
              </button>

              <div className="w-full sm:w-auto flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="w-1/2 sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-1/2 sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer shadow-md shadow-emerald-800/15 transition-all active:scale-95 disabled:opacity-50"
                >
                  {savingProfile ? 'Menyimpan...' : 'Simpan Profil'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 1: DETAIL FORMULIR & BERKAS ANAK */}
      {selectedDetailStudent && (() => {
        const detailSchema = getNormalizedUnitSchema(selectedDetailStudent.unit);
        const detailName = resolveStudentNameFromSchema(selectedDetailStudent, detailSchema);
        const { allSlots } = resolveVerificationDocumentsForStudent(selectedDetailStudent, detailSchema);
        const nonFileSections = (detailSchema?.sections || [])
          .map((sec) => ({
            ...sec,
            nonFileFields: (sec.fields || []).filter((f) => f.type !== 'file'),
          }))
          .filter((sec) => sec.nonFileFields.length > 0);

        return (
        <Modal
          isOpen={Boolean(selectedDetailStudent)}
          onClose={() => setSelectedDetailStudent(null)}
          title={`Detail Formulir & Berkas: ${detailName}`}
          maxWidth="lg"
          hideFooter
        >
          <div className="space-y-5 text-xs text-slate-800">
            {/* Child Header with Edit Action */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <h4 className="font-extrabold text-base text-slate-900">{detailName}</h4>
                <p className="text-xs text-slate-500 font-mono">No. Reg: {selectedDetailStudent.registrationNumber}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedDetailStudent;
                    setSelectedDetailStudent(null);
                    openEditStudentModal(target);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Ubah Data Siswa</span>
                </button>
                <UnitBadge unit={selectedDetailStudent.unit} />
              </div>
            </div>

            {/* Dynamic Form Builder Sections & Non-File Fields */}
            {nonFileSections.length > 0 ? (
              <div className="space-y-4">
                {nonFileSections.map((section) => (
                  <div key={section.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <h5 className="font-extrabold text-slate-900 text-xs border-b border-slate-200 pb-1.5 flex items-center justify-between gap-2">
                      <span>{section.title}</span>
                      {section.description && <span className="text-[10px] text-slate-500 font-normal">{section.description}</span>}
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      {section.nonFileFields.map((field) => {
                        const val = resolveFormFieldValue(selectedDetailStudent, field);
                        const displayVal = formatCardFieldDisplayValue(val, field);

                        return (
                          <div key={field.id} className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                            <span className="text-slate-500 block text-[11px] font-semibold">{field.label}:</span>
                            <span className="font-bold text-slate-900 break-words">{displayVal}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 space-y-1.5">
                <Info className="w-6 h-6 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-700">Belum Ada Struktur Form Builder untuk Unit {selectedDetailStudent.unit}</p>
                <p className="text-[11px] text-slate-400">
                  Seluruh kolom detail mengikuti konfigurasi Form Builder unit sekolah yang bersangkutan.
                </p>
              </div>
            )}

            {/* Dynamic Documents List: Strictly rendered only when Form Builder defines file fields OR uploaded docs exist */}
            {allSlots.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <h5 className="font-bold text-slate-900 text-xs">Dokumen &amp; Berkas Persyaratan (Sesuai Form Builder)</h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {allSlots.map((slot) => (
                    <div key={slot.key} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <span className="font-bold text-slate-800 text-xs block truncate" title={slot.label}>
                        {slot.label}
                      </span>
                      <div className="flex items-center justify-between gap-1">
                        {slot.url ? (
                          <button
                            type="button"
                            onClick={() => setPreviewDocUrl(slot.url)}
                            className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-emerald-50 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Pratinjau</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">Belum diunggah</span>
                        )}

                        {slot.fromSchema && (
                          <label className="p-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 cursor-pointer" title="Unggah / Perbarui">
                            <Upload className="w-3.5 h-3.5" />
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(e) => {
                                const inputEl = e.target;
                                const file = inputEl.files?.[0];
                                if (!file) return;
                                validateAndReadFile(file, slot.label, slot.fileConfig, async (dataUrl) => {
                                  const updatedAnswers = {
                                    ...(selectedDetailStudent.dynamicAnswers || {}),
                                    [slot.key]: dataUrl,
                                  };
                                  const updatedDocs = {
                                    ...(selectedDetailStudent.documents || {}),
                                    [slot.key]: dataUrl,
                                  };
                                  const ok = await updateStudent(selectedDetailStudent.id, {
                                    dynamicAnswers: updatedAnswers,
                                    documents: updatedDocs,
                                  });
                                  if (ok) {
                                    setSelectedDetailStudent((prev) =>
                                      prev
                                        ? { ...prev, dynamicAnswers: updatedAnswers, documents: updatedDocs }
                                        : null
                                    );
                                  }
                                });
                                inputEl.value = '';
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  const target = selectedDetailStudent;
                  setSelectedDetailStudent(null);
                  openEditStudentModal(target);
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Ubah / Edit Data Siswa</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDetailStudent(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
        );
      })()}

      {/* MODAL 2: CETAK KARTU UJIAN ANAK (100% IDENTIK DENGAN PDF BIASA & PDF EMAIL) */}
      {selectedPrintStudent && (() => {
        const printStudentSchema = getNormalizedUnitSchema(selectedPrintStudent.unit);
        const printStudentName = resolveStudentNameFromSchema(selectedPrintStudent, printStudentSchema);
        const printGuardian = resolveGuardianSummaryFromSchema(selectedPrintStudent, printStudentSchema);
        const activeAcademicYearLabel = getActiveAcademicYearLabel(academicYears);

        return (
        <Modal
          isOpen={Boolean(selectedPrintStudent)}
          onClose={() => setSelectedPrintStudent(null)}
          title={`Kartu Peserta Ujian: ${printStudentName}`}
          maxWidth="2xl"
          hideFooter
        >
          {(() => {
            const printUnitKey = (selectedPrintStudent.unit || '').trim().toUpperCase();
            const testSch = selectedPrintStudent.testScheduleId
              ? schedules.find((s) => s.id === selectedPrintStudent.testScheduleId) ||
                schedules.find((s) => (s.unit || '').trim().toUpperCase() === printUnitKey) ||
                null
              : schedules.find((s) => (s.unit || '').trim().toUpperCase() === printUnitKey) || null;
            const letterConf =
              letterConfigs.find((l) => l.unitId === selectedPrintStudent.unit) ||
              letterConfigs.find((l) => l.unitId === 'MASTER') ||
              null;
            const masterUnitContact = unitContacts.find((c) => c.unitId === 'MASTER');

            const addressText =
              landingConfig?.contact?.address ||
              masterUnitContact?.address ||
              '-';
            const phoneText =
              landingConfig?.contact?.phone ||
              landingConfig?.contact?.whatsapp ||
              masterUnitContact?.phone ||
              '-';
            const emailText =
              landingConfig?.contact?.email ||
              masterUnitContact?.email ||
              '-';

            const headerTitleText =
              letterConf?.letterHeaderTitle || 'PANITIA PENERIMAAN PESERTA DIDIK BARU (PPDB)';
            const cardTitleText =
              letterConf?.cardTitle || 'KARTU TANDA PESERTA UJIAN & OBSERVASI PPDB';
            const chairName = letterConf?.committeeChairName || 'Ketua Panitia PPDB';
            const chairRole = letterConf?.committeeRoleTitle || 'Ketua Panitia PPDB';
            const chairNip = letterConf?.committeeChairNip || '';
            const issueLoc = letterConf?.issueLocation || 'Bireuen';
            const issueDateStr =
              letterConf?.issueDate ||
              new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            const instructions: string[] =
              Array.isArray(letterConf?.examInstructions) && letterConf.examInstructions.length > 0
                ? letterConf.examInstructions
                : [
                    '1. Peserta wajib hadir 15 menit sebelum pelaksanaan ujian seleksi dimulai.',
                    '2. Membawa Kartu Tanda Peserta ini (cetak fisik) dan alat tulis secukupnya.',
                    '3. Berpakaian sopan, rapi, dan menutup aurat (busana muslim/muslimah).',
                    '4. Orang tua/wali santri wajib mendampingi ananda saat sesi wawancara orang tua.',
                  ];

            const unitSchema = formSchemas.find((s) => s.unitId === selectedPrintStudent.unit) || null;
            const computedRows = getCardBiodataRows(selectedPrintStudent, letterConfigs, unitSchema);
            const studentRows: [string, string][] =
              computedRows.length > 0
                ? computedRows
                : [['Data Biodata', ': Belum ada kolom biodata dipilih pada Pengaturan Surat unit']];

            return (
              <div className="space-y-4">
                <div
                  className="bg-white text-slate-800 border border-slate-200 rounded-2xl overflow-hidden shadow-2xs"
                  id="print-area"
                >
                  {/* 1. Top Decorative Green Bar */}
                  <div className="h-2.5 bg-[#14532d]" />
                  <div className="h-1 bg-[#16a34a]" />

                  <div className="p-4 sm:p-6 space-y-4 text-xs">
                    {/* 2. Kop Surat Yayasan */}
                    <div className="text-center space-y-0.5 pb-3 border-b-2 border-[#16a34a]">
                      <h4 className="font-black text-base sm:text-lg text-[#14532d] uppercase tracking-wide">
                        YAYASAN AR-RISALAH ACEH
                      </h4>
                      <p className="font-extrabold text-[11px] sm:text-xs text-slate-800 uppercase">
                        {headerTitleText}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Tahun Ajaran {activeAcademicYearLabel} · Jenjang {units.length > 0 ? units.map((u) => u.shortName).join(', ') : 'Semua Jenjang'}
                      </p>
                      <p className="text-[10px] text-slate-600">
                        {addressText} | Telp/WA: {phoneText}
                      </p>
                    </div>

                    {/* 3. Title Card Header Box */}
                    <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl py-2.5 px-3 text-center space-y-0.5">
                      <p className="font-extrabold text-xs sm:text-sm text-[#14532d] uppercase">
                        {cardTitleText}
                      </p>
                      <p className="text-[11px] text-[#166534] font-medium">
                        Unit Pilihan: {selectedPrintStudent.unit} · Dokumen Resmi Verifikasi Peserta
                      </p>
                    </div>

                    {/* 4. Registration Number Highlight Box */}
                    <div className="bg-white border-2 border-[#16a34a] rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          NOMOR REGISTRASI PENDAFTARAN RESMI
                        </span>
                        <span className="font-mono font-black text-base sm:text-lg text-[#14532d]">
                          {selectedPrintStudent.registrationNumber}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {selectedPrintStudent.registeredAt
                          ? `Terdaftar: ${selectedPrintStudent.registeredAt} WIB`
                          : 'Status: Berkas Lengkap'}
                      </span>
                    </div>

                    {/* 5. Biodata Calon Siswa Table */}
                    <div className="rounded-xl overflow-hidden border border-slate-200">
                      <div className="bg-[#16a34a] text-white font-bold text-xs px-3.5 py-2 grid grid-cols-12">
                        <span className="col-span-5">Biodata Calon Siswa</span>
                        <span className="col-span-7">Keterangan</span>
                      </div>
                      <div className="divide-y divide-slate-100 bg-white">
                        {studentRows.map(([label, val], idx) => (
                          <div key={idx} className="px-3.5 py-1.5 grid grid-cols-12 gap-2 text-[11px] sm:text-xs">
                            <span className="col-span-5 font-bold text-slate-600">{label}</span>
                            <span className="col-span-7 font-bold text-slate-900 break-words">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 6. Schedule Details Box */}
                    <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                      <h5 className="font-extrabold text-[11px] sm:text-xs text-[#14532d] uppercase">
                        JADWAL &amp; LOKASI UJIAN SELEKSI / OBSERVASI
                      </h5>
                      {testSch ? (
                        <div className="space-y-0.5 text-[11px] text-slate-700">
                          <p>
                            • Tanggal &amp; Waktu : {testSch.date} (Pukul {testSch.startTime} - {testSch.endTime} WIB)
                          </p>
                          <p>
                            • Ruangan / Tempat : {testSch.room} (Kampus Yayasan Ar-Risalah Aceh)
                          </p>
                          {testSch.examiner && <p>• Tim Penguji : {testSch.examiner}</p>}
                        </div>
                      ) : (
                        <div className="space-y-0.5 text-[11px] text-slate-700">
                          <p>
                            • Tanggal &amp; Waktu : Mengikuti jadwal gelombang observasi unit (dapat dicek berkala di portal)
                          </p>
                          <p>• Ruangan / Tempat : Kampus Terpadu Yayasan Ar-Risalah Aceh</p>
                        </div>
                      )}
                    </div>

                    {/* 7. Tata Tertib Peserta Ujian */}
                    <div className="space-y-1 px-1">
                      <h5 className="font-extrabold text-[11px] text-[#14532d] uppercase">
                        TATA TERTIB PESERTA UJIAN:
                      </h5>
                      <div className="space-y-0.5 text-[10.5px] text-slate-600 leading-relaxed">
                        {instructions.slice(0, 4).map((inst, idx) => (
                          <p key={idx}>{inst}</p>
                        ))}
                      </div>
                    </div>

                    {/* 8. Signature Block */}
                    <div className="pt-3 flex justify-between items-end text-center text-[11px] px-2">
                      <div className="w-5/12">
                        <p className="text-slate-500">Mengetahui,</p>
                        <p className="font-bold text-slate-800">Orang Tua / Wali Siswa,</p>
                        <div className="h-14" />
                        <p className="font-bold text-slate-900">
                          ( {printGuardian.name || currentUser?.name || 'Wali Siswa'} )
                        </p>
                      </div>
                      <div className="w-6/12">
                        <p className="text-slate-500">
                          {issueLoc}, {issueDateStr}
                        </p>
                        <p className="font-bold text-slate-800">{chairRole},</p>
                        <div className="my-1.5 flex items-center justify-center">
                          {printQrDataUrl ? (
                            <img
                              src={printQrDataUrl}
                              alt="QR Verifikasi Kartu"
                              className="w-16 h-16 object-contain border border-emerald-200 rounded-md p-0.5 bg-white"
                            />
                          ) : (
                            <div className="w-16 h-16 border border-slate-200 rounded-md flex items-center justify-center text-[9px] text-slate-400">
                              QR TTD
                            </div>
                          )}
                        </div>
                        <p className="font-bold text-slate-900">( {chairName} )</p>
                        {chairNip && <p className="text-[10px] font-mono text-slate-500">{chairNip}</p>}
                      </div>
                    </div>
                  </div>

                  {/* 9. Footer Note */}
                  <div className="bg-[#f0fdf4] border-t border-[#bbf7d0] py-2 px-4 text-center text-[10px] text-[#166534] font-medium">
                    Sekretariat: {addressText} · Email: {emailText}
                  </div>
                </div>

                {/* Single Row Action Buttons */}
                <div className="flex flex-row items-center justify-end gap-2 pt-2 print-hidden">
                  <button
                    type="button"
                    onClick={async () => {
                      await generateStudentCardPdf({
                        student: selectedPrintStudent,
                        schedule: testSch,
                        landingConfig,
                        letterConfigs,
                        formSchemas,
                        academicYearLabel: activeAcademicYearLabel,
                        units,
                        download: true,
                      });
                      showToast(
                        `Kartu pendaftaran ${printStudentName} berhasil diunduh dalam format PDF!`,
                        'success'
                      );
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  >
                    <Download className="w-4 h-4 text-emerald-200" />
                    <span>Unduh File PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendCardToEmail(selectedPrintStudent)}
                    className="px-3.5 py-2.5 rounded-xl bg-emerald-50 text-emerald-900 font-bold text-xs border border-emerald-300 hover:bg-emerald-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <MailCheck className="w-4 h-4 text-emerald-700" />
                    <span>Kirim ke Email (PDF)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    title="Cetak Print Kartu Ujian Langsung"
                    className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-xs flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                  >
                    <Printer className="w-4.5 h-4.5 text-emerald-400" />
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
        );
      })()}

      {/* MODAL KONFIRMASI KIRIM PDF KARTU UJIAN KE EMAIL */}
      {confirmEmailSendStudent && (
        <Modal
          isOpen={Boolean(confirmEmailSendStudent)}
          onClose={() => !sendingEmailCard && setConfirmEmailSendStudent(null)}
          title="Konfirmasi Kirim PDF ke Email"
          maxWidth="md"
          hideFooter
        >
          <div className="space-y-4 text-xs text-slate-700">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-700 text-white shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <p className="font-extrabold text-emerald-950 text-sm">
                    Kirim Kartu Tanda Peserta (PDF)?
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    Dokumen resmi kartu peserta ujian ananda{' '}
                    <strong className="text-slate-900">
                      {resolveStudentNameFromSchema(
                        confirmEmailSendStudent,
                        getNormalizedUnitSchema(confirmEmailSendStudent.unit)
                      )}
                    </strong>{' '}
                    (<span className="font-mono">{confirmEmailSendStudent.registrationNumber}</span>) akan dikirimkan ke alamat email berikut:
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-emerald-200/90 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 font-semibold">Nama Akun / Penerima:</span>
                  <span className="font-bold text-slate-900 text-right">{currentUser?.name || 'Wali Siswa'}</span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500 font-semibold">Alamat Email Tujuan:</span>
                  <span className="font-mono font-extrabold text-emerald-800 break-all text-right">
                    {currentUser?.email || '-'}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Jika sudah sesuai dan setuju untuk dikirimkan ke email tersebut, klik <strong>Kirim</strong>. Jika tidak, klik <strong>Batal</strong>.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={sendingEmailCard}
                onClick={() => setConfirmEmailSendStudent(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={sendingEmailCard}
                onClick={handleConfirmSendCardToEmail}
                className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {sendingEmailCard ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Kirim ke Email</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Hidden persistent file input so clicking Upload Ulang anywhere opens device picker immediately */}
      <input
        ref={proofFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.pdf"
        className="hidden"
        onChange={handleSelectProofFile}
      />

      {/* MODAL 3: PEMBAYARAN, HISTORIS & MULTI-UPLOAD STRUK */}
      {selectedPaymentStudent && (() => {
        const targetUnit = units.find((u) => u.id === selectedPaymentStudent.unit);
        const formulirSummary = computeStudentPaymentTypeSummary(
          payments,
          selectedPaymentStudent.id,
          'Formulir',
          targetUnit
        );
        const reRegSummary = computeStudentPaymentTypeSummary(
          payments,
          selectedPaymentStudent.id,
          'Daftar Ulang',
          targetUnit
        );
        const activeSummary = paymentType === 'Daftar Ulang' ? reRegSummary : formulirSummary;
        const canPayReReg =
          selectedPaymentStudent.status === 'lulus' ||
          selectedPaymentStudent.status === 'terdaftar' ||
          reRegSummary.uploadedRecords.length > 0;
        const replacingRecord = replacingPaymentId
          ? activeSummary.uploadedRecords.find((r) => r.id === replacingPaymentId) || null
          : null;

        const handleSelectBillType = (nextType: 'Formulir' | 'Daftar Ulang') => {
          setPaymentType(nextType);
          setReplacingPaymentId(null);
          setPaymentUploadNotice(null);
          const nextSummary = nextType === 'Daftar Ulang' ? reRegSummary : formulirSummary;
          setUploadAmount(
            nextSummary.remainingAmount > 0
              ? nextSummary.remainingAmount
              : nextSummary.uploadedRecords.length === 0
              ? nextSummary.targetFee
              : 0
          );
        };

        return (
        <Modal
          isOpen={Boolean(selectedPaymentStudent)}
          onClose={() => {
            setProofFileData('');
            setProofFileName('');
            setReplacingPaymentId(null);
            setPaymentUploadNotice(null);
            setSelectedPaymentStudent(null);
          }}
          title={`Pembayaran PPDB: ${resolveStudentNameFromSchema(
            selectedPaymentStudent,
            getNormalizedUnitSchema(selectedPaymentStudent.unit)
          )}`}
          description={`No. Reg ${selectedPaymentStudent.registrationNumber} · Jenjang ${targetUnit?.shortName || selectedPaymentStudent.unit}`}
          maxWidth="xl"
          hideFooter
        >
          <div className="space-y-5 text-xs">
            {/* Post-submit notice banner */}
            {paymentUploadNotice && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <p className="text-[11px] font-semibold leading-relaxed flex-1 break-words">{paymentUploadNotice}</p>
                <button
                  type="button"
                  onClick={() => setPaymentUploadNotice(null)}
                  className="text-emerald-700 hover:text-emerald-900 font-bold text-xs px-1.5 py-0.5 rounded-lg cursor-pointer shrink-0"
                >
                  ✕
                </button>
              </div>
            )}

            {/* 1. Pilih Tagihan */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="font-extrabold text-slate-800 text-xs">
                  1. Pilih Tagihan yang Ingin Dibayar / Dicek
                </label>
                <span className="text-[10px] text-slate-500 leading-snug">
                  Tarif resmi ditetapkan Admin pada Kuota &amp; Biaya unit {targetUnit?.shortName || selectedPaymentStudent.unit}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    key: 'Formulir' as const,
                    title: 'Biaya Formulir Pendaftaran',
                    subtitle: 'Untuk aktivasi berkas & jadwal tes',
                    summary: formulirSummary,
                    available: true,
                  },
                  {
                    key: 'Daftar Ulang' as const,
                    title: 'Biaya Daftar Ulang / Uang Pangkal',
                    subtitle: canPayReReg
                      ? 'Setelah dinyatakan lulus seleksi'
                      : 'Terbuka otomatis setelah status Lulus',
                    summary: reRegSummary,
                    available: canPayReReg,
                  },
                ].map((opt) => {
                  const isSel = paymentType === opt.key;
                  const s = opt.summary;
                  return (
                    <button
                      type="button"
                      key={opt.key}
                      onClick={() => handleSelectBillType(opt.key)}
                      className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-2 ${
                        isSel
                          ? 'bg-emerald-50/90 border-emerald-600 ring-2 ring-emerald-500/20 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-slate-900 text-xs leading-snug">{opt.title}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{opt.subtitle}</p>
                        </div>
                        {s.uploadedRecords.length > 0 ? (
                          <PaymentBadge status={s.overallStatus} />
                        ) : (
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border shrink-0 ${
                              opt.available
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {opt.available ? 'Belum Bayar' : 'Menunggu Lulus'}
                          </span>
                        )}
                      </div>
                      <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                        <span className="text-slate-500">
                          Tarif: <strong className="font-mono text-slate-800">{formatRupiah(s.targetFee)}</strong>
                        </span>
                        {s.remainingAmount > 0 ? (
                          <span className="font-mono font-bold text-rose-700">
                            Kurang {formatRupiah(s.remainingAmount)}
                          </span>
                        ) : s.targetFee > 0 && s.approvedAmount >= s.targetFee ? (
                          <span className="font-bold text-emerald-700">Lunas</span>
                        ) : s.verifyingAmount > 0 ? (
                          <span className="font-bold text-amber-700">{s.uploadedRecords.length} Bukti Dicek</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Ringkasan & Historis Bukti Pembayaran Sebelumnya (hanya tampil jika sudah ada pembayaran pada tagihan dipilih) */}
            {activeSummary.uploadedRecords.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Historis Pembayaran ({paymentType})</span>
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    {activeSummary.overallStatus === 'lunas' && (() => {
                      const lunasRecords = activeSummary.uploadedRecords.filter((r) => r.status === 'lunas');
                      const latestLunas = lunasRecords[lunasRecords.length - 1];
                      if (!latestLunas) return null;
                      return (
                        <button
                          type="button"
                          onClick={() =>
                            openReceiptForPayment(
                              selectedPaymentStudent,
                              latestLunas,
                              lunasRecords.map((r) => ({
                                id: r.id,
                                amount: r.amount,
                                date: r.date,
                                bankAccount: r.bankAccount,
                              }))
                            )
                          }
                          className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Cetak Resi Lunas</span>
                        </button>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() => refreshPayments()}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Segarkan Status</span>
                    </button>
                  </div>
                </div>

                {/* 3-Metric Ringkasan (Stack cleanly on mobile, 3 cols on tablet/desktop) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between sm:block gap-2">
                    <span className="text-[11px] text-slate-500 sm:block">Tarif Resmi</span>
                    <span className="font-mono font-extrabold text-slate-900 text-xs sm:mt-0.5 sm:block">
                      {formatRupiah(activeSummary.targetFee)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between sm:block gap-2">
                    <span className="text-[11px] text-slate-500 sm:block">Sudah Terkirim</span>
                    <span className="font-mono font-extrabold text-emerald-700 text-xs sm:mt-0.5 sm:block">
                      {formatRupiah(activeSummary.submittedValidAmount)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between sm:block gap-2">
                    <span className="text-[11px] text-slate-500 sm:block">Sisa Kekurangan</span>
                    <span
                      className={`font-mono font-extrabold text-xs sm:mt-0.5 sm:block ${
                        activeSummary.remainingAmount > 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatRupiah(activeSummary.remainingAmount)}
                    </span>
                  </div>
                </div>

                {/* Daftar Historis Struk yang Pernah Diupload */}
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-0.5">
                  {activeSummary.uploadedRecords.map((rec, idx) => {
                    const isReplacingThis = replacingPaymentId === rec.id;
                    const isPdf = isPdfDocumentUrl(rec.proofUrl);
                    return (
                      <div
                        key={rec.id}
                        className={`p-3 sm:p-3.5 rounded-2xl bg-white border space-y-2.5 transition-colors ${
                          isReplacingThis
                            ? 'border-amber-500 ring-2 ring-amber-400/20'
                            : rec.status === 'ditolak'
                            ? 'border-rose-200 bg-rose-50/30'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start sm:items-center gap-3 min-w-0">
                            <button
                              type="button"
                              onClick={() => setPreviewDocUrl(rec.proofUrl)}
                              className="w-12 h-12 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 cursor-pointer hover:border-emerald-500"
                              title="Klik untuk memperbesar struk"
                            >
                              {isPdf ? (
                                <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100 w-full h-full flex items-center justify-center">
                                  PDF
                                </span>
                              ) : (
                                <img
                                  src={rec.proofUrl}
                                  alt={`Bukti #${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </button>
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-slate-900 text-xs">
                                  Bukti #{idx + 1}
                                </span>
                                <span className="font-mono font-bold text-emerald-800 text-xs">
                                  {formatRupiah(rec.amount)}
                                </span>
                                <PaymentBadge status={rec.status} />
                              </div>
                              <p className="text-[11px] text-slate-500 break-words leading-snug">
                                {rec.bankAccount || 'Rekening Yayasan'} · {rec.date}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 sm:border-t-0 sm:pt-0 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPreviewDocUrl(rec.proofUrl)}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Lihat Struk</span>
                            </button>
                            {rec.status === 'lunas' && (
                              <button
                                type="button"
                                onClick={() => openReceiptForPayment(selectedPaymentStudent, rec)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Cetak Resi</span>
                              </button>
                            )}
                            {rec.status === 'ditolak' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReplacingPaymentId(rec.id);
                                  setProofFileData('');
                                  setProofFileName('');
                                  setUploadAmount(rec.amount > 0 ? rec.amount : activeSummary.remainingAmount);
                                  setPaymentUploadNotice(null);
                                  proofFileInputRef.current?.click();
                                  requestAnimationFrame(() => {
                                    uploadFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  });
                                }}
                                className={`px-3 py-1.5 rounded-xl text-white text-[11px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs cursor-pointer ${
                                  isReplacingThis
                                    ? 'bg-amber-600 ring-2 ring-amber-400/50'
                                    : 'bg-amber-500 hover:bg-amber-600'
                                }`}
                              >
                                <Upload className="w-3.5 h-3.5" />
                                <span>{isReplacingThis ? 'Pilih Gambar Baru...' : 'Upload Ulang'}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {rec.verificationNotes && (
                          <div
                            className={`p-2.5 rounded-xl text-[11px] font-semibold flex items-start gap-2 leading-relaxed break-words ${
                              rec.status === 'lunas'
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                                : rec.status === 'ditolak'
                                ? 'bg-rose-50 border border-rose-200 text-rose-900'
                                : 'bg-slate-50 border border-slate-200 text-slate-700'
                            }`}
                          >
                            {rec.status === 'lunas' ? (
                              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                            ) : (
                              <AlertCircle
                                className={`w-4 h-4 shrink-0 mt-0.5 ${
                                  rec.status === 'ditolak' ? 'text-rose-600' : 'text-slate-500'
                                }`}
                              />
                            )}
                            <span className="min-w-0">
                              <strong>Keterangan Admin:</strong> {rec.verificationNotes}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Form Upload Bukti Transfer (Baru / Bank Lain / Upload Ulang Struk Ditolak) */}
            <form ref={uploadFormRef} onSubmit={handleUploadProofSubmit} className="space-y-4 pt-3 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-extrabold text-slate-900 text-xs">
                  {replacingRecord
                    ? '2. Upload Ulang Bukti Transfer (Timpa Struk Lama)'
                    : activeSummary.uploadedRecords.length > 0
                    ? '2. Tambah Bukti Transfer Baru (Multi-Bank / Pelunasan)'
                    : '2. Kirim Bukti Transfer'}
                </h4>
                {replacingRecord && (
                  <button
                    type="button"
                    onClick={() => {
                      setReplacingPaymentId(null);
                      setUploadAmount(
                        activeSummary.remainingAmount > 0 ? activeSummary.remainingAmount : activeSummary.targetFee
                      );
                    }}
                    className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
                  >
                    Batal Upload Ulang (Kirim sebagai Bukti Baru)
                  </button>
                )}
              </div>

              {replacingRecord && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-semibold leading-relaxed">
                  Mode Upload Ulang aktif untuk bukti lama ({formatRupiah(replacingRecord.amount)} · {replacingRecord.bankAccount}). File struk lama yang ditolak akan otomatis ditimpa dan dihapus dari server.
                </div>
              )}

              {activeBankAccounts.length > 1 && (
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">Pilih Bank Tujuan Transfer untuk Struk Ini</label>
                  <div className="flex flex-wrap gap-2">
                    {activeBankAccounts.map((bank) => {
                      const isSel = activeSelectedBank?.id === bank.id;
                      return (
                        <button
                          type="button"
                          key={bank.id}
                          onClick={() => setSelectedBankId(bank.id)}
                          className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer ${
                            isSel
                              ? 'bg-emerald-800 text-white border-emerald-800 shadow-2xs'
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

              {activeSelectedBank ? (
                <div className="bg-gradient-to-br from-emerald-900 to-emerald-800 text-white p-4 rounded-2xl space-y-2">
                  <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-wide">{activeSelectedBank.bankName}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <span className="font-mono text-lg sm:text-xl font-black tracking-wider break-all">
                      {activeSelectedBank.accountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyAccount(activeSelectedBank.accountNumber, activeSelectedBank.bankCode || activeSelectedBank.bankName)}
                      className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold backdrop-blur-md transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                    >
                      {copiedBank ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedBank ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-200 break-words">
                    a.n. {activeSelectedBank.accountHolder}
                    {activeSelectedBank.branch ? ` · ${activeSelectedBank.branch}` : ''}
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  Rekening bank tujuan transfer belum tersedia. Silakan hubungi panitia PPDB untuk informasi rekening.
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label className="font-bold text-slate-700">
                    Nominal Transfer pada Struk Ini (Rp) *
                  </label>
                  {activeSummary.remainingAmount > 0 && uploadAmount !== activeSummary.remainingAmount && (
                    <button
                      type="button"
                      onClick={() => setUploadAmount(activeSummary.remainingAmount)}
                      className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Isi Sisa Kekurangan ({formatRupiah(activeSummary.remainingAmount)})
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Rp
                  </span>
                  <CurrencyInput
                    required
                    max={500000000}
                    value={uploadAmount}
                    onChange={(val) => setUploadAmount(val)}
                    placeholder="Contoh: 300.000"
                    className="w-full p-3 pl-10 rounded-xl border border-slate-300 bg-white font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Masukkan nominal persis yang tertera pada struk ini (contoh: transfer 1 sebesar 300.000 di Bank A, lalu transfer 2 sebesar 50.000 di Bank B).
                </p>
              </div>

              <div ref={uploadSubmitSectionRef} className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => proofFileInputRef.current?.click()}
                  className="w-full block p-5 rounded-2xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 text-center space-y-1.5 bg-slate-50 hover:bg-emerald-50/40 cursor-pointer transition-colors"
                >
                  <Upload className="w-5 h-5 text-emerald-800 mx-auto" />
                  <span className="text-xs font-bold text-slate-700 block">
                    {proofFileData ? 'Pilih Ulang File Struk Transfer' : 'Pilih & Lampirkan Struk Transfer *'}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Format JPG, PNG, WEBP, atau PDF (Maks 5MB)
                  </span>
                </button>

                {replacingRecord && proofFileData && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-[11px] text-emerald-900 font-semibold leading-relaxed flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>
                      Gambar baru sudah terpilih! Periksa pratinjau dan nominal di atas, lalu tekan <strong>Kirim Upload Ulang Struk</strong> di bawah untuk mengganti struk lama.
                    </span>
                  </div>
                )}

                {proofFileData && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {proofFileData.startsWith('data:application/pdf') ? (
                        <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 font-extrabold text-[10px] flex items-center justify-center shrink-0 border border-rose-200">
                          PDF
                        </div>
                      ) : (
                        <img
                          src={proofFileData}
                          alt="Pratinjau Struk"
                          className="w-10 h-10 rounded-lg object-cover border border-emerald-300 shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-emerald-950 text-[11px] truncate">
                          {proofFileName || 'Bukti Transfer Terlampir'}
                        </p>
                        <span className="text-[10px] text-emerald-700 font-semibold block break-words">
                          Nominal: {formatRupiah(uploadAmount)} · {activeSelectedBank?.bankCode || activeSelectedBank?.bankName || 'Yayasan'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewDocUrl(proofFileData)}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-[11px] font-bold hover:bg-emerald-100 cursor-pointer"
                      >
                        Lihat
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProofFileData('');
                          setProofFileName('');
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="Hapus file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setProofFileData('');
                    setProofFileName('');
                    setReplacingPaymentId(null);
                    setPaymentUploadNotice(null);
                    setSelectedPaymentStudent(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-center whitespace-normal leading-tight cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={isUploadingProof || !proofFileData}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-center whitespace-normal leading-tight shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploadingProof
                    ? 'Mengirim...'
                    : replacingRecord
                    ? 'Kirim Upload Ulang Struk'
                    : 'Kirim Bukti Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
        );
      })()}

      {/* MODAL 4: JADWAL TES SELEKSI ANAK */}
      {selectedScheduleStudent && (
        <Modal
          isOpen={Boolean(selectedScheduleStudent)}
          onClose={() => setSelectedScheduleStudent(null)}
          title={`Jadwal Tes Seleksi: ${resolveStudentNameFromSchema(
            selectedScheduleStudent,
            getNormalizedUnitSchema(selectedScheduleStudent.unit)
          )}`}
          maxWidth="lg"
          hideFooter
        >
          {(() => {
            const targetUnitKey = (selectedScheduleStudent.unit || '').trim().toUpperCase();
            const unitSchedules = schedules
              .filter((s) => (s.unit || '').trim().toUpperCase() === targetUnitKey)
              .slice()
              .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));

            const assignedSchedule = selectedScheduleStudent.testScheduleId
              ? schedules.find((s) => s.id === selectedScheduleStudent.testScheduleId) || null
              : null;

            const formatIndoDate = (rawDate: string) => {
              if (!rawDate) return '-';
              const parsed = new Date(`${rawDate}T00:00:00`);
              if (Number.isNaN(parsed.getTime())) return rawDate;
              return parsed.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              });
            };

            return (
              <div className="space-y-4 text-xs text-slate-800">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="font-bold text-emerald-900 text-sm">
                      Pelaksanaan Tes &amp; Observasi ({selectedScheduleStudent.unit})
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Wajib hadir 15 menit sebelum ujian dimulai membawa Kartu Peserta Ujian dan perlengkapan tulis.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsLoadingSchedule(true);
                      try {
                        await Promise.all([
                          refreshSchedules(),
                          refreshStudentById(selectedScheduleStudent.id),
                        ]);
                      } finally {
                        setIsLoadingSchedule(false);
                      }
                    }}
                    disabled={isLoadingSchedule}
                    className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-[11px] inline-flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-60"
                    title="Segarkan Jadwal"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSchedule ? 'animate-spin' : ''}`} />
                    <span>Segarkan</span>
                  </button>
                </div>

                {assignedSchedule && (
                  <div className="p-4 rounded-2xl bg-blue-50/80 border-2 border-blue-300 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-700 text-white text-[10px] font-extrabold uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Jadwal Terpilih untuk Ananda</span>
                      </span>
                      <span className="font-mono text-[10px] font-bold text-blue-800">
                        {assignedSchedule.unit}
                      </span>
                    </div>
                    <h5 className="font-extrabold text-sm text-slate-900">{assignedSchedule.title}</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                        <span className="font-bold">{formatIndoDate(assignedSchedule.date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                        <span className="font-mono font-bold">
                          {assignedSchedule.startTime} - {assignedSchedule.endTime} WIB
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                        <span className="font-semibold">{assignedSchedule.room}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <UserCheck className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                        <span className="font-semibold">{assignedSchedule.examiner}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h5 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                      Daftar Jadwal Tes Unit {selectedScheduleStudent.unit} ({unitSchedules.length} Sesi)
                    </h5>
                    {isLoadingSchedule && (
                      <span className="text-[11px] text-emerald-700 font-semibold">Memuat jadwal...</span>
                    )}
                  </div>

                  {unitSchedules.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5">
                      <Calendar className="w-7 h-7 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-700 text-xs">
                        Belum Ada Jadwal Tes untuk Unit {selectedScheduleStudent.unit}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Jadwal akan tampil otomatis di sini setelah ditetapkan oleh panitia PPDB unit.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[42vh] overflow-y-auto pr-1">
                      {unitSchedules.map((sch) => {
                        const isAssigned = assignedSchedule?.id === sch.id;
                        return (
                          <div
                            key={sch.id}
                            className={`p-3.5 rounded-2xl border space-y-2 transition-all ${
                              isAssigned
                                ? 'bg-emerald-50/70 border-emerald-300'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h6 className="font-extrabold text-slate-900 text-xs leading-snug">
                                  {sch.title}
                                </h6>
                                <span className="text-[10px] font-mono text-slate-500">
                                  Unit {sch.unit} · Kapasitas {sch.filled}/{sch.quota} peserta
                                </span>
                              </div>
                              {isAssigned && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold shrink-0">
                                  Jadwal Ananda
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 text-[11px] text-slate-700">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                <span className="font-semibold">{formatIndoDate(sch.date)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                <span className="font-mono font-bold">
                                  {sch.startTime} - {sch.endTime} WIB
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                <span>{sch.room}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                <span>{sch.examiner}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedScheduleStudent.testScore !== undefined && selectedScheduleStudent.testScore !== null && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-slate-700">Nilai Hasil Ujian Seleksi:</span>
                    <span className="font-mono font-black text-xl text-emerald-800">
                      {selectedScheduleStudent.testScore} / 100
                    </span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedScheduleStudent(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* MODAL PREVIEW DOKUMEN */}
      {previewDocUrl && (
        <Modal
          isOpen={Boolean(previewDocUrl)}
          onClose={() => setPreviewDocUrl(null)}
          title="Pratinjau Dokumen Calon Siswa"
          maxWidth="lg"
          hideFooter
        >
          <div className="space-y-4 text-center">
            {previewDocUrl.startsWith('data:application/pdf') || previewDocUrl.toLowerCase().endsWith('.pdf') ? (
              <div className="space-y-3">
                <iframe
                  src={previewDocUrl}
                  title="Pratinjau Dokumen PDF"
                  className="w-full h-[60vh] rounded-2xl border border-slate-200 bg-slate-50"
                />
                <a
                  href={previewDocUrl}
                  download="dokumen-ppdb.pdf"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs hover:bg-emerald-100"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh PDF</span>
                </a>
              </div>
            ) : (
              <img
                src={previewDocUrl}
                alt="Pratinjau Dokumen"
                className="max-h-[60vh] mx-auto rounded-2xl shadow-sm border border-slate-200 object-contain"
              />
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewDocUrl(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL VERIFIKASI EMAIL WALI */}
      {/* MODAL VERIFIKASI EMAIL WALI DENGAN KODE OTP 6-DIGIT */}
      {isVerifyModalOpen && (
        <Modal
          isOpen={isVerifyModalOpen}
          onClose={() => {
            setIsVerifyModalOpen(false);
            setOtpError(null);
          }}
          title="Verifikasi Email Akun Wali (OTP)"
          maxWidth="md"
          hideFooter
        >
          <div className="space-y-4 text-xs text-slate-700">
            {/* Header Email Box */}
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                  Email Tujuan Verifikasi:
                </span>
                <span className="text-[10px] bg-emerald-200/80 text-emerald-950 font-extrabold px-2 py-0.5 rounded-md">
                  Aktif
                </span>
              </div>
              <p className="font-mono text-sm font-extrabold text-emerald-950 bg-white p-2.5 rounded-xl border border-emerald-200/80 flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="truncate">{currentUser?.email || '-'}</span>
              </p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Kode OTP rahasia 6-digit akan dikirimkan ke email ini untuk memvalidasi kepemilikan akun secara aman.
              </p>
            </div>

            {/* Error Banner */}
            {otpError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="font-semibold leading-relaxed">{otpError}</span>
              </div>
            )}

            {otpStep === 'request' ? (
              /* TAHAP 1: PERMINTAAN KODE OTP */
              <div className="space-y-4 pt-1">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 leading-relaxed space-y-1">
                  <p className="font-bold text-slate-800">Langkah Verifikasi:</p>
                  <ol className="list-decimal pl-4 space-y-0.5">
                    <li>Klik tombol <strong>Kirim Kode OTP</strong> di bawah.</li>
                    <li>Buka inbox atau folder spam email Anda.</li>
                    <li>Masukkan 6 digit angka kode verifikasi yang Anda terima.</li>
                  </ol>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsVerifyModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isSendingOtp}
                    className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95"
                  >
                    {isSendingOtp ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Mengirim Kode OTP...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Kirim Kode OTP ke Email</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* TAHAP 2: INPUT KODE OTP 6-DIGIT */
              <form onSubmit={handleVerifyOtp} className="space-y-4 pt-1">
                <div className="space-y-2 text-center">
                  <label className="block text-xs font-bold text-slate-800">
                    Masukkan 6 Digit Kode OTP:
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    value={otpCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtpCode(val);
                      if (otpError) setOtpError(null);
                    }}
                    placeholder="••••••"
                    className="w-full max-w-xs mx-auto text-center font-mono text-2xl font-black tracking-[0.4em] py-3 px-4 bg-slate-50 border-2 border-emerald-300 focus:border-emerald-600 focus:bg-white rounded-2xl outline-none transition-all shadow-inner"
                  />
                  <p className="text-[11px] text-slate-500">
                    Kode OTP berlaku selama 10 menit.
                  </p>
                </div>

                {/* Cooldown & Resend Link */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <div className="text-slate-500 text-[11px]">
                    Belum menerima kode?
                  </div>
                  {otpCooldown > 0 ? (
                    <span className="text-[11px] font-mono text-slate-400 font-semibold">
                      Kirim ulang dalam ({otpCooldown}s)
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isSendingOtp}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSendingOtp ? 'animate-spin' : ''}`} />
                      <span>Kirim Ulang Kode OTP</span>
                    </button>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep('request');
                      setOtpCode('');
                      setOtpError(null);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifyingOtp || otpCode.trim().length !== 6}
                    className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95"
                  >
                    {isVerifyingOtp ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Memverifikasi...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Verifikasi OTP</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}
      {/* MODAL KONTAK PANITIA (HUBUNGI KAMI) */}
      {isContactModalOpen && (
        <Modal
          isOpen={isContactModalOpen}
          onClose={() => setIsContactModalOpen(false)}
          title="Daftar Kontak Panitia Layanan PPDB"
          maxWidth="lg"
          hideFooter
        >
          <div className="space-y-4 text-xs text-slate-700">
            <p className="text-slate-500">
              Silakan hubungi kontak resmi unit sekolah di bawah ini untuk konsultasi, bantuan pengisian formulir, atau konfirmasi pembayaran:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...unitContacts]
                .sort((a, b) => {
                  if (a.unitId === 'MASTER') return -1;
                  if (b.unitId === 'MASTER') return 1;
                  const idxA = units.findIndex((u) => u.id === a.unitId);
                  const idxB = units.findIndex((u) => u.id === b.unitId);
                  return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
                })
                .map((contact) => {
                const matchedUnit = units.find((u) => u.id === contact.unitId);
                const sectionLabel =
                  contact.unitId === 'MASTER'
                    ? 'Kontak Admin Pusat Yayasan'
                    : `Kontak Admin ${matchedUnit?.shortName || contact.unitId}`;

                return (
                  <div
                    key={contact.unitId}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200 inline-block">
                        {sectionLabel}
                      </span>
                      <h4 className="text-xs font-bold text-slate-700">{contact.unitName}</h4>
                      <p className="text-sm font-extrabold text-slate-900 mt-0.5">{contact.contactPerson}</p>
                      <p className="text-xs font-mono font-bold text-emerald-700">{contact.phone}</p>
                    </div>
                    <div className="pt-2">
                      <a
                        href={`https://wa.me/${(contact.whatsapp || landingConfig?.contact?.whatsapp || '').replace(/[^0-9]/g, '')}?text=Assalamu%2rayaikum%20Panitia%20PPDB%20${encodeURIComponent(contact.unitName)},%20saya%20Wali%20Santri...`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Chat WhatsApp</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsContactModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL EDIT DATA CALON SISWA (100% DINAMIS SESUAI FORM BUILDER UNIT) */}
      {selectedEditStudent && (() => {
        const editSchema = getNormalizedUnitSchema(selectedEditStudent.unit);
        const editDisplayName = resolveStudentNameFromSchema(selectedEditStudent, editSchema);
        return (
        <Modal
          isOpen={Boolean(selectedEditStudent)}
          onClose={() => setSelectedEditStudent(null)}
          title={`Ubah / Edit Data Siswa: ${editDisplayName}`}
          maxWidth="xl"
          hideFooter
        >
          <form onSubmit={handleSaveEditStudent} className="space-y-5 text-xs text-slate-800 p-1">
            {/* Header info banner */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                  Edit Formulir Pendaftaran ({selectedEditStudent.unit})
                </span>
                <span className="font-extrabold text-slate-900 text-sm">{editDisplayName}</span>
                <span className="text-slate-500 font-mono text-xs block mt-0.5">
                  No. Reg: {selectedEditStudent.registrationNumber}
                </span>
              </div>
              <UnitBadge unit={selectedEditStudent.unit} />
            </div>

            {/* Dynamic Form Builder Sections & Fields ONLY (No Static Hardcoded Fields) */}
            {(() => {
              const sections = editSchema?.sections || ensureCoreNameFieldInSections([], selectedEditStudent.unit);

              if (sections.length === 0) {
                return (
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2 text-slate-500">
                    <Layers className="w-7 h-7 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-700 text-xs">
                      Belum ada seksi pertanyaan pada Form Builder untuk unit {selectedEditStudent.unit}.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Silakan hubungi admin unit sekolah apabila formulir pendaftaran unit ini belum dikonfigurasi.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {sections.map((section, sIdx) => (
                    <div key={section.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
                      <div className="border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-extrabold uppercase tracking-wider">
                            Bagian {sIdx + 1} · {selectedEditStudent.unit}
                          </span>
                          <span className="text-[11px] text-slate-500 font-semibold">
                            {section.fields.length} Pertanyaan
                          </span>
                        </div>
                        <h5 className="font-extrabold text-slate-900 text-sm">{section.title}</h5>
                        {section.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5">{section.description}</p>
                        )}
                      </div>

                      {section.fields.length === 0 ? (
                        <div className="text-center py-4 text-slate-400 text-[11px]">
                          <Info className="w-5 h-5 mx-auto mb-1 text-slate-300" />
                          <span>Bagian ini belum memiliki pertanyaan dari admin sekolah.</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {section.fields.map((field) => {
                            const fieldValue = editStudentForm[field.id] ?? '';
                            const isWideField = field.type === 'textarea' || field.type === 'file';

                            return (
                              <div key={field.id} className={`space-y-1.5 ${isWideField ? 'sm:col-span-2' : ''}`}>
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
                                  <p className="text-[11px] text-slate-500 leading-tight">{field.helpText}</p>
                                )}

                                {field.type === 'text' && (
                                  <input
                                    type="text"
                                    value={fieldValue}
                                    onChange={(e) => setEditFieldValue(field.id, e.target.value)}
                                    placeholder={`Masukkan ${field.label.toLowerCase()}...`}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-semibold"
                                  />
                                )}

                                {field.type === 'number' && (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={fieldValue}
                                    onChange={(e) => setEditFieldValue(field.id, e.target.value.replace(/\D/g, ''))}
                                    placeholder="Masukkan angka..."
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-mono font-semibold"
                                  />
                                )}

                                {field.type === 'date' && (
                                  <input
                                    type="date"
                                    value={fieldValue}
                                    onChange={(e) => setEditFieldValue(field.id, e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-semibold"
                                  />
                                )}

                                {field.type === 'dropdown' && (
                                  <select
                                    value={fieldValue}
                                    onChange={(e) => setEditFieldValue(field.id, e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-semibold"
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
                                    onChange={(e) => setEditFieldValue(field.id, e.target.value)}
                                    placeholder={`Tuliskan ${field.label.toLowerCase()} secara lengkap...`}
                                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-semibold resize-none"
                                  />
                                )}

                                {field.type === 'file' && (
                                  <div className="space-y-2 pt-0.5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-white border border-slate-300">
                                      <div className="text-[11px] text-slate-500">
                                        <span>
                                          Format: {field.fileConfig?.allowedTypes.join(', ') || 'PDF, JPG, PNG'} (Maks{' '}
                                          {field.fileConfig?.maxSizeMB || 5}MB)
                                        </span>
                                      </div>

                                      <label className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors shrink-0">
                                        <Upload className="w-3.5 h-3.5" />
                                        <span>{fieldValue ? 'Ganti Berkas' : 'Pilih File / Foto'}</span>
                                        <input
                                          type="file"
                                          accept="image/*,.pdf"
                                          className="hidden"
                                          onChange={(e) =>
                                            handleEditFileUpload(e, field.id, field.label, field.fileConfig)
                                          }
                                        />
                                      </label>
                                    </div>

                                    {fieldValue && (
                                      <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 truncate max-w-[240px]">
                                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                                          <span className="font-bold text-emerald-950 truncate text-[11px]">
                                            Berkas {field.label} Terlampir
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => setPreviewDocUrl(fieldValue)}
                                            className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 font-bold text-[11px] hover:bg-emerald-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>Pratinjau</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setEditFieldValue(field.id, '')}
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
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedEditStudent(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingEditStudent}
                className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-md shadow-emerald-800/15 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {savingEditStudent ? 'Menyimpan...' : 'Simpan Perubahan Data'}
              </button>
            </div>
          </form>
        </Modal>
        );
      })()}

      {/* MODAL RESI PEMBAYARAN LUNAS (PRINT & SIMPAN JPG + QR VALIDASI) */}
      <PaymentReceiptModal
        receipt={activeReceiptData}
        onClose={() => setActiveReceiptData(null)}
        onToast={showToast}
      />
    </div>
  );
};
