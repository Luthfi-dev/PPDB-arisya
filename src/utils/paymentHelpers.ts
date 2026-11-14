import { PaymentRecord, PaymentStatus, PaymentType, UnitQuotaFee } from '../types/ppdb';

export const formatRupiah = (val: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(val) ? val : 0);
};

export const hasUploadedProof = (pay: PaymentRecord): boolean => {
  return Boolean(pay && typeof pay.proofUrl === 'string' && pay.proofUrl.trim().length > 0);
};

export interface PaymentTypeSummary {
  registrationId: string;
  type: PaymentType;
  records: PaymentRecord[];
  uploadedRecords: PaymentRecord[];
  targetFee: number;
  approvedAmount: number;
  verifyingAmount: number;
  rejectedAmount: number;
  submittedValidAmount: number;
  remainingAmount: number;
  remainingToApproved: number;
  overallStatus: PaymentStatus;
  hasAnyNote: boolean;
  latestNote?: string;
}

const getPaymentSortTs = (p: PaymentRecord): number => {
  const idMatch = (p.id || '').match(/\d{10,}/);
  if (idMatch) {
    const num = parseInt(idMatch[0], 10);
    if (Number.isFinite(num)) return num;
  }
  if (p.date) {
    const parsed = new Date(p.date.replace(' ', 'T')).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

export const computeStudentPaymentTypeSummary = (
  payments: PaymentRecord[],
  registrationId: string,
  type: PaymentType,
  unit?: UnitQuotaFee
): PaymentTypeSummary => {
  const records = payments
    .filter((p) => p.registrationId === registrationId && p.type === type)
    .slice()
    .sort((a, b) => getPaymentSortTs(a) - getPaymentSortTs(b));

  const uploadedRecords = records.filter(hasUploadedProof);

  const unitFee = type === 'Daftar Ulang' ? unit?.reRegFee : unit?.formFee;
  const fallbackFee = records[0]?.amount ?? 0;
  const targetFee = typeof unitFee === 'number' && unitFee >= 0 ? unitFee : fallbackFee;

  const approvedAmount = uploadedRecords
    .filter((p) => p.status === 'lunas')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const verifyingAmount = uploadedRecords
    .filter((p) => p.status === 'verifikasi')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const rejectedAmount = uploadedRecords
    .filter((p) => p.status === 'ditolak')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const submittedValidAmount = approvedAmount + verifyingAmount;
  const remainingAmount = Math.max(0, targetFee - submittedValidAmount);
  const remainingToApproved = Math.max(0, targetFee - approvedAmount);

  let overallStatus: PaymentStatus = 'pending';
  if (uploadedRecords.length === 0) {
    overallStatus = 'pending';
  } else if (uploadedRecords.some((p) => p.status === 'verifikasi')) {
    overallStatus = 'verifikasi';
  } else if (
    uploadedRecords.some((p) => p.status === 'lunas') &&
    !uploadedRecords.some((p) => p.status === 'ditolak') &&
    (targetFee <= 0 || approvedAmount >= targetFee)
  ) {
    overallStatus = 'lunas';
  } else if (uploadedRecords.some((p) => p.status === 'ditolak')) {
    overallStatus = 'ditolak';
  } else if (uploadedRecords.some((p) => p.status === 'lunas')) {
    overallStatus = 'lunas';
  }

  const noted = uploadedRecords
    .filter((p) => p.verificationNotes && p.verificationNotes.trim().length > 0)
    .slice()
    .reverse();

  return {
    registrationId,
    type,
    records,
    uploadedRecords,
    targetFee,
    approvedAmount,
    verifyingAmount,
    rejectedAmount,
    submittedValidAmount,
    remainingAmount,
    remainingToApproved,
    overallStatus,
    hasAnyNote: noted.length > 0,
    latestNote: noted[0]?.verificationNotes,
  };
};
