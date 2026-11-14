import React, { useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Search,
  Eye,
  AlertCircle,
  RefreshCw,
  Printer,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { PaymentBadge, UnitBadge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { Pagination } from '../../common/Pagination';
import { PaymentRecord, PaymentType } from '../../../types/ppdb';
import { hasActionPermission, canManageBankAccounts } from '../../../utils/rbac';
import { ExportDropdown } from '../../common/ExportDropdown';
import {
  ensureCoreNameFieldInSections,
  getActiveAcademicYearLabel,
  resolveStudentNameFromSchema,
} from '../../../utils/studentFieldResolver';
import {
  computeStudentPaymentTypeSummary,
  formatRupiah,
  PaymentTypeSummary,
} from '../../../utils/paymentHelpers';
import { PaymentReceiptModal } from '../../common/PaymentReceiptModal';
import { ReceiptData } from '../../../utils/receiptGenerator';
import { CurrencyInput } from '../../common/FormattedNumberInputs';

interface GroupedPaymentRow {
  key: string;
  registrationId: string;
  registrationNumber: string;
  studentName: string;
  unit: string;
  type: PaymentType;
  latestDate: string;
  summary: PaymentTypeSummary;
}

const REJECT_TEMPLATES = [
  'Foto struk kurang jelas / terpotong. Harap unggah ulang foto struk yang terang dan terbaca.',
  'Nominal transfer belum mencukupi tarif resmi — harap kirim 1 bukti transfer tambahan untuk melunasi sisa tagihan.',
  'Dana belum masuk ke mutasi rekening yayasan. Silakan cek kembali status transaksi bank Anda.',
  'Rekening tujuan pada struk tidak sesuai dengan rekening resmi yayasan.',
];

export const PembayaranView: React.FC = () => {
  const {
    payments,
    students,
    units,
    academicYears,
    landingConfig,
    formSchemas,
    activeSchoolId,
    verifyPayment,
    updatePaymentAmount,
    verifyPaymentGroup,
    refreshPayments,
    currentUser,
    bankAccounts,
    setDesktopActiveMenu,
    showToast,
  } = usePPDB();

  const [activeReceiptData, setActiveReceiptData] = useState<ReceiptData | null>(null);
  const [editedAmounts, setEditedAmounts] = useState<Record<string, number>>({});
  const activeAcademicYearLabel = getActiveAcademicYearLabel(academicYears);

  useEffect(() => {
    refreshPayments();
  }, [refreshPayments]);

  const resolvePayStudentName = (registrationId: string, registrationNumber: string, fallbackName: string) => {
    const stu = students.find((s) => s.id === registrationId || s.registrationNumber === registrationNumber);
    if (!stu) return fallbackName;
    const rawSchema = formSchemas.find((fs) => fs.unitId === stu.unit);
    const schema = rawSchema ? { ...rawSchema, sections: ensureCoreNameFieldInSections(rawSchema.sections, rawSchema.unitId) } : undefined;
    return resolveStudentNameFromSchema(stu, schema) || fallbackName;
  };

  const canVerify = hasActionPermission(currentUser, 'Pembayaran', 'verify');
  const canManageBanks = canManageBankAccounts(currentUser);
  const activeBanks = bankAccounts.filter((b) => b.isActive);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isVerifyingAction, setIsVerifyingAction] = useState(false);

  const [selectedGroupKey, setSelectedGroupKey] = useState<{ registrationId: string; type: PaymentType } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [rejectNotes, setRejectNotes] = useState('');
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectTargetPaymentId, setRejectTargetPaymentId] = useState<string | null>(null);
  const [rejectTargetGroupIds, setRejectTargetGroupIds] = useState<string[]>([]);

  const groupedRows: GroupedPaymentRow[] = useMemo(() => {
    const pairMap = new Map<string, PaymentRecord>();
    for (const p of payments) {
      if (activeSchoolId !== 'MASTER' && p.unit !== activeSchoolId) continue;
      const key = `${p.registrationId}__${p.type}`;
      if (!pairMap.has(key)) {
        pairMap.set(key, p);
      }
    }

    const result: GroupedPaymentRow[] = [];
    pairMap.forEach((rep, key) => {
      const targetUnit = units.find((u) => u.id === rep.unit);
      const summary = computeStudentPaymentTypeSummary(payments, rep.registrationId, rep.type, targetUnit);
      const latestRec =
        summary.uploadedRecords[summary.uploadedRecords.length - 1] ||
        summary.records[summary.records.length - 1] ||
        rep;
      result.push({
        key,
        registrationId: rep.registrationId,
        registrationNumber: rep.registrationNumber,
        studentName: resolvePayStudentName(rep.registrationId, rep.registrationNumber, rep.studentName),
        unit: rep.unit,
        type: rep.type,
        latestDate: latestRec.date,
        summary,
      });
    });

    // Prioritize items waiting verification at top, then newest
    return result.sort((a, b) => {
      const aWait = a.summary.overallStatus === 'verifikasi' ? 0 : 1;
      const bWait = b.summary.overallStatus === 'verifikasi' ? 0 : 1;
      if (aWait !== bWait) return aWait - bWait;
      return (b.latestDate || '').localeCompare(a.latestDate || '');
    });
  }, [payments, activeSchoolId, units, students, formSchemas]);

  const filteredGroups = groupedRows.filter((row) => {
    if (filterType !== 'all' && row.type !== filterType) return false;
    if (filterStatus !== 'all' && row.summary.overallStatus !== filterStatus) return false;
    if (
      search &&
      !row.studentName.toLowerCase().includes(search.toLowerCase()) &&
      !row.registrationNumber.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const filteredRawForExport = payments.filter((p) => {
    if (activeSchoolId !== 'MASTER' && p.unit !== activeSchoolId) return false;
    if (filterType !== 'all' && p.type !== filterType) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (
      search &&
      !resolvePayStudentName(p.registrationId, p.registrationNumber, p.studentName).toLowerCase().includes(search.toLowerCase()) &&
      !p.studentName.toLowerCase().includes(search.toLowerCase()) &&
      !p.registrationNumber.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const paginatedGroups = filteredGroups.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const selectedGroupRow = useMemo(() => {
    if (!selectedGroupKey) return null;
    return (
      groupedRows.find(
        (g) => g.registrationId === selectedGroupKey.registrationId && g.type === selectedGroupKey.type
      ) || null
    );
  }, [groupedRows, selectedGroupKey]);

  const handleOpenGroup = (row: GroupedPaymentRow) => {
    setSelectedGroupKey({ registrationId: row.registrationId, type: row.type });
    const initAmounts: Record<string, number> = {};
    row.summary.uploadedRecords.forEach((r) => {
      initAmounts[r.id] = r.amount;
    });
    setEditedAmounts(initAmounts);
    setIsPreviewOpen(true);
    refreshPayments();
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshPayments();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveSingleRealAmount = async (paymentId: string, originalAmount: number) => {
    const targetAmt = editedAmounts[paymentId] ?? originalAmount;
    if (!Number.isFinite(targetAmt) || targetAmt < 1) {
      showToast('Nominal real harus lebih dari Rp 0.', 'error');
      return;
    }
    setIsVerifyingAction(true);
    try {
      const ok = await updatePaymentAmount(paymentId, targetAmt);
      if (ok) {
        await refreshPayments();
      }
    } finally {
      setIsVerifyingAction(false);
    }
  };

  const handleApproveSingle = async (paymentId: string, originalAmount: number) => {
    const edited = editedAmounts[paymentId];
    const adjusted =
      typeof edited === 'number' && Number.isFinite(edited) && edited > 0 && edited !== originalAmount
        ? edited
        : undefined;
    if (typeof edited === 'number' && edited <= 0) {
      showToast('Nominal real tidak boleh 0 atau kosong.', 'error');
      return;
    }
    setIsVerifyingAction(true);
    try {
      await verifyPayment(paymentId, true, undefined, adjusted);
      await refreshPayments();
    } finally {
      setIsVerifyingAction(false);
    }
  };

  const handleApproveGroup = async () => {
    if (!selectedGroupRow) return;
    const uploaded = selectedGroupRow.summary.uploadedRecords;
    const ids = uploaded.map((r) => r.id);
    if (ids.length === 0) return;

    for (const rec of uploaded) {
      const edited = editedAmounts[rec.id];
      if (typeof edited === 'number' && (!Number.isFinite(edited) || edited <= 0)) {
        showToast('Nominal real tidak boleh 0 atau kosong.', 'error');
        return;
      }
    }

    setIsVerifyingAction(true);
    try {
      // Terapkan penyesuaian nominal real terlebih dahulu jika admin mengubah nominal di modal
      for (const rec of uploaded) {
        const edited = editedAmounts[rec.id];
        if (typeof edited === 'number' && Number.isFinite(edited) && edited > 0 && edited !== rec.amount) {
          const amtOk = await updatePaymentAmount(rec.id, edited);
          if (!amtOk) return;
        }
      }
      const ok = await verifyPaymentGroup(ids, true);
      if (ok) {
        await refreshPayments();
        setIsPreviewOpen(false);
        setSelectedGroupKey(null);
      }
    } finally {
      setIsVerifyingAction(false);
    }
  };

  const handleOpenRejectSingle = (paymentId: string, existingNote?: string) => {
    setRejectTargetPaymentId(paymentId);
    setRejectTargetGroupIds([]);
    setRejectNotes(existingNote || '');
    setIsRejectOpen(true);
  };

  const handleOpenRejectGroup = () => {
    if (!selectedGroupRow) return;
    const targetIds = selectedGroupRow.summary.uploadedRecords
      .filter((r) => r.status !== 'lunas')
      .map((r) => r.id);
    const ids =
      targetIds.length > 0
        ? targetIds
        : selectedGroupRow.summary.uploadedRecords.map((r) => r.id);
    if (ids.length === 0) return;
    setRejectTargetPaymentId(null);
    setRejectTargetGroupIds(ids);
    setRejectNotes(selectedGroupRow.summary.latestNote || '');
    setIsRejectOpen(true);
  };

  const handleConfirmReject = async () => {
    const finalNotes =
      rejectNotes.trim() ||
      'Bukti transfer belum valid atau nominal belum mencukupi tagihan resmi.';
    setIsVerifyingAction(true);
    try {
      let ok = false;
      if (rejectTargetPaymentId) {
        ok = await verifyPayment(rejectTargetPaymentId, false, finalNotes);
      } else if (rejectTargetGroupIds.length > 0) {
        ok = await verifyPaymentGroup(rejectTargetGroupIds, false, finalNotes);
      }
      if (ok) {
        await refreshPayments();
        setIsRejectOpen(false);
        setRejectTargetPaymentId(null);
        setRejectTargetGroupIds([]);
      }
    } finally {
      setIsVerifyingAction(false);
    }
  };

  const pendingVerificationCount = groupedRows.filter(
    (g) => g.summary.uploadedRecords.some((r) => r.status === 'verifikasi')
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4 w-full">
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Verifikasi Pembayaran &amp; Multi-Bukti Transfer</span>
          </h3>
          {activeBanks.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>Rekening Aktif Yayasan:</span>
              {activeBanks.map((bank) => (
                <span
                  key={bank.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold text-[11px]"
                >
                  <span className="font-extrabold">{bank.bankCode || bank.bankName}</span>
                  <span className="font-mono">{bank.accountNumber}</span>
                  <span className="text-emerald-700 font-normal">a.n {bank.accountHolder}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-amber-700 font-semibold">
              Belum ada rekening yayasan yang aktif. Hubungi Master Admin / Admin Yayasan.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          {canManageBanks && (
            <button
              type="button"
              onClick={() => setDesktopActiveMenu('rekening_yayasan')}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors cursor-pointer"
            >
              Kelola Rekening Bank
            </button>
          )}

          {pendingVerificationCount > 0 && (
            <div className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>{pendingVerificationCount} tagihan menunggu verifikasi</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-emerald-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 w-full">
        <div className="flex-1 w-full relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari siswa atau nomor pendaftaran..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
          >
            <option value="all">Semua Jenis Pembayaran</option>
            <option value="Formulir">Biaya Formulir</option>
            <option value="Daftar Ulang">Biaya Daftar Ulang</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
          >
            <option value="all">Semua Status</option>
            <option value="verifikasi">Menunggu Verifikasi</option>
            <option value="lunas">Lunas</option>
            <option value="pending">Menunggu Bukti</option>
            <option value="ditolak">Ditolak</option>
          </select>

          <ExportDropdown
            moduleName="Pembayaran"
            title="Rekap Verifikasi Pembayaran & Bukti Transfer PPDB"
            filename="Pembayaran_PPDB"
            headers={[
              'ID Transaksi',
              'No. Pendaftaran',
              'Nama Siswa',
              'Unit',
              'Jenis Pembayaran',
              'Rekening Tujuan',
              'Nominal (Rp)',
              'Status',
              'Tanggal Bayar',
              'Verifikator',
              'Catatan',
            ]}
            rows={filteredRawForExport.map((p) => [
              p.id,
              p.registrationNumber,
              resolvePayStudentName(p.registrationId, p.registrationNumber, p.studentName),
              p.unit,
              p.type,
              p.bankAccount || '-',
              p.amount,
              p.status === 'lunas' ? 'Lunas' : p.status === 'verifikasi' ? 'Menunggu Verifikasi' : p.status === 'pending' ? 'Menunggu Bukti' : 'Ditolak',
              p.date,
              p.verifiedBy || '-',
              p.verificationNotes || '-',
            ])}
          />
        </div>
      </div>

      {/* Main Grouped Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Calon Siswa</th>
                <th className="py-3.5 px-4">Unit</th>
                <th className="py-3.5 px-4">Jenis Tagihan</th>
                <th className="py-3.5 px-4 text-right">Terkirim / Tarif</th>
                <th className="py-3.5 px-4 text-center">Bukti Transfer</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Update Terakhir</th>
                <th className="py-3.5 px-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Tidak ada catatan pembayaran yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                paginatedGroups.map((row, idx) => {
                  const { summary } = row;
                  const uploaded = summary.uploadedRecords;
                  const hasPendingVerify = uploaded.some((r) => r.status === 'verifikasi');

                  return (
                    <tr
                      key={row.key}
                      className={`hover:bg-emerald-50/30 transition-colors ${
                        idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{row.studentName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {row.registrationNumber}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <UnitBadge unit={row.unit} />
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-700">{row.type}</span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                        <div className="font-bold text-slate-900">
                          {formatRupiah(summary.submittedValidAmount)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Tarif: {formatRupiah(summary.targetFee)}
                        </div>
                        {summary.remainingAmount > 0 && uploaded.length > 0 && (
                          <div className="text-[10px] font-bold text-rose-600">
                            Kurang {formatRupiah(summary.remainingAmount)}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {uploaded.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleOpenGroup(row)}
                            className="inline-flex items-center gap-1.5 p-1.5 rounded-xl border border-slate-200 hover:border-emerald-400 bg-slate-50 transition-colors group cursor-pointer"
                          >
                            <div className="flex -space-x-2">
                              {uploaded.slice(0, 3).map((rec, rIdx) =>
                                rec.proofUrl.startsWith('data:application/pdf') ||
                                rec.proofUrl.toLowerCase().endsWith('.pdf') ? (
                                  <span
                                    key={rec.id}
                                    className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 font-extrabold text-[9px] flex items-center justify-center border border-white shadow-2xs"
                                  >
                                    PDF
                                  </span>
                                ) : (
                                  <img
                                    key={rec.id}
                                    src={rec.proofUrl}
                                    alt={`Bukti ${rIdx + 1}`}
                                    className="w-8 h-8 rounded-lg object-cover border border-white shadow-2xs group-hover:scale-105 transition-transform"
                                  />
                                )
                              )}
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 px-1">
                              {uploaded.length > 1 ? `${uploaded.length} Bukti` : 'Lihat'}
                            </span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Belum upload
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 space-y-1">
                        <PaymentBadge status={summary.overallStatus} />
                        {summary.hasAnyNote && (
                          <p
                            className={`text-[10px] font-semibold max-w-[160px] truncate ${
                              summary.overallStatus === 'lunas'
                                ? 'text-emerald-700'
                                : summary.overallStatus === 'ditolak'
                                ? 'text-rose-700'
                                : 'text-slate-600'
                            }`}
                            title={summary.latestNote}
                          >
                            {summary.latestNote}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 tabular-nums">
                        {row.latestDate}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {hasPendingVerify ? (
                          <button
                            type="button"
                            onClick={() => handleOpenGroup(row)}
                            className="px-3 py-1.5 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
                          >
                            Verifikasi ({uploaded.filter((r) => r.status === 'verifikasi').length})
                          </button>
                        ) : summary.overallStatus === 'lunas' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenGroup(row)}
                            className="text-[11px] font-semibold text-emerald-700 hover:underline inline-flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Detail ({uploaded.length})</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenGroup(row)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalItems={filteredGroups.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>

      {/* Modal Preview Semua Bukti & Verifikasi (Individual maupun Grup) */}
      {selectedGroupRow && (
        <Modal
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setSelectedGroupKey(null);
          }}
          title={`Verifikasi Pembayaran: ${selectedGroupRow.studentName}`}
          description={`${selectedGroupRow.registrationNumber} · Tagihan ${selectedGroupRow.type} · ${selectedGroupRow.summary.uploadedRecords.length} Bukti Diunggah`}
          maxWidth="3xl"
          hideFooter
        >
          <div className="space-y-4 py-1 text-xs">
            {/* Ringkasan Tagihan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between sm:block gap-2">
                <span className="text-[11px] text-slate-500 sm:block">Tarif Resmi Unit</span>
                <span className="font-mono font-extrabold text-slate-900 text-sm">
                  {formatRupiah(selectedGroupRow.summary.targetFee)}
                </span>
              </div>
              <div className="flex items-center justify-between sm:block gap-2">
                <span className="text-[11px] text-slate-500 sm:block">Sudah Disetujui</span>
                <span className="font-mono font-extrabold text-emerald-700 text-sm">
                  {formatRupiah(selectedGroupRow.summary.approvedAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between sm:block gap-2">
                <span className="text-[11px] text-slate-500 sm:block">Menunggu Dicek</span>
                <span className="font-mono font-extrabold text-amber-700 text-sm">
                  {formatRupiah(selectedGroupRow.summary.verifyingAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between sm:block gap-2">
                <span className="text-[11px] text-slate-500 sm:block">Sisa Kekurangan</span>
                <span
                  className={`font-mono font-extrabold text-sm ${
                    selectedGroupRow.summary.remainingAmount > 0 ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {formatRupiah(selectedGroupRow.summary.remainingAmount)}
                </span>
              </div>
            </div>

            {selectedGroupRow.summary.remainingAmount > 0 && selectedGroupRow.summary.uploadedRecords.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="text-[11px] font-semibold leading-relaxed">
                  Total nominal dari bukti yang masuk ({formatRupiah(selectedGroupRow.summary.submittedValidAmount)}) masih kurang{' '}
                  <strong>{formatRupiah(selectedGroupRow.summary.remainingAmount)}</strong> dari tarif resmi unit ({formatRupiah(selectedGroupRow.summary.targetFee)}).
                  Anda dapat menolak dengan catatan kekurangan agar wali mengirim struk pelunasan, atau menyetujui per struk yang sudah valid.
                </p>
              </div>
            )}

            {/* Daftar Semua Bukti Transfer */}
            {selectedGroupRow.summary.uploadedRecords.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Wali siswa belum mengunggah bukti transfer untuk tagihan {selectedGroupRow.type}.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-0.5">
                {selectedGroupRow.summary.uploadedRecords.map((rec, idx) => {
                  const isPdf =
                    rec.proofUrl.startsWith('data:application/pdf') ||
                    rec.proofUrl.toLowerCase().endsWith('.pdf');
                  return (
                    <div
                      key={rec.id}
                      className={`p-3.5 rounded-2xl border space-y-3 ${
                        rec.status === 'ditolak'
                          ? 'bg-rose-50/40 border-rose-200'
                          : rec.status === 'lunas'
                          ? 'bg-emerald-50/30 border-emerald-200'
                          : 'bg-white border-slate-200 shadow-2xs'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-900 text-white font-extrabold text-[11px]">
                            Bukti #{idx + 1}
                          </span>
                          <span className="font-mono font-extrabold text-emerald-800 text-sm">
                            {formatRupiah(rec.amount)}
                          </span>
                          <PaymentBadge status={rec.status} />
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 break-words">
                          {rec.bankAccount || 'Rekening Yayasan'} · {rec.date}
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-xl bg-slate-100 p-2 flex items-center justify-center max-h-[40vh] overflow-hidden">
                        {isPdf ? (
                          <iframe
                            src={rec.proofUrl}
                            title={`Bukti Transfer #${idx + 1}`}
                            className="w-full h-[36vh] rounded-lg bg-white"
                          />
                        ) : (
                          <img
                            src={rec.proofUrl}
                            alt={`Bukti Transfer #${idx + 1}`}
                            className="max-h-[36vh] w-auto object-contain rounded-lg"
                          />
                        )}
                      </div>

                      {rec.verificationNotes && (
                        <div
                          className={`p-2.5 rounded-xl border text-[11px] font-semibold flex items-start gap-2 break-words leading-relaxed ${
                            rec.status === 'lunas'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : rec.status === 'ditolak'
                              ? 'bg-rose-50 border-rose-200 text-rose-900'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
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
                            <strong>Catatan Verifikator:</strong> {rec.verificationNotes}
                          </span>
                        </div>
                      )}

                      {canVerify && (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="text-[11px] font-bold text-slate-700">
                              Nominal Real (Sesuai Mutasi / Struk) — Rp
                            </label>
                            {typeof editedAmounts[rec.id] === 'number' &&
                              editedAmounts[rec.id] > 0 &&
                              editedAmounts[rec.id] !== rec.amount && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                  Input awal: {formatRupiah(rec.amount)} → Real:{' '}
                                  {formatRupiah(editedAmounts[rec.id])}
                                </span>
                              )}
                          </div>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                                Rp
                              </span>
                              <CurrencyInput
                                value={editedAmounts[rec.id] ?? rec.amount}
                                onChange={(val) =>
                                  setEditedAmounts((prev) => ({ ...prev, [rec.id]: val }))
                                }
                                placeholder="Contoh: 150.000"
                                className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                              />
                            </div>
                            {typeof editedAmounts[rec.id] === 'number' &&
                              editedAmounts[rec.id] > 0 &&
                              editedAmounts[rec.id] !== rec.amount && (
                                <button
                                  type="button"
                                  disabled={isVerifyingAction}
                                  onClick={() => handleSaveSingleRealAmount(rec.id, rec.amount)}
                                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold whitespace-nowrap cursor-pointer disabled:opacity-50"
                                >
                                  Simpan Nominal
                                </button>
                              )}
                          </div>
                          <p className="text-[10px] text-slate-500 leading-snug">
                            Jika nominal di struk/mutasi berbeda dari input wali (misal terketik 100.000 padahal transfer 150.000), ubah di sini lalu langsung klik <strong>Approve</strong> tanpa perlu menolak bukti.
                          </p>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[11px]">
                        <span className="text-slate-500 break-all">
                          {rec.verifiedBy ? `Diverifikasi oleh: ${rec.verifiedBy}` : `ID Transaksi: ${rec.id}`}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          {rec.status === 'lunas' && (
                            <button
                              type="button"
                              onClick={() => {
                                const targetUnit = units.find((u) => u.id === selectedGroupRow.unit);
                                setActiveReceiptData({
                                  paymentId: rec.id,
                                  registrationNumber: selectedGroupRow.registrationNumber,
                                  studentName: selectedGroupRow.studentName,
                                  unitId: selectedGroupRow.unit,
                                  unitName: targetUnit?.name || selectedGroupRow.unit,
                                  unitShortName: targetUnit?.shortName || selectedGroupRow.unit,
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
                              className="w-full sm:w-auto px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold inline-flex items-center justify-center gap-1.5 text-center whitespace-normal leading-tight shadow-2xs cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5 shrink-0" />
                              <span>Cetak Resi</span>
                            </button>
                          )}
                          {canVerify && (
                            <>
                              <button
                                type="button"
                                disabled={isVerifyingAction}
                                onClick={() => handleOpenRejectSingle(rec.id, rec.verificationNotes)}
                                className="w-full sm:w-auto px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-semibold border border-red-200 inline-flex items-center justify-center gap-1.5 text-center whitespace-normal leading-tight cursor-pointer disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>Tolak Bukti #{idx + 1}</span>
                              </button>
                              {rec.status !== 'lunas' && (
                                <button
                                  type="button"
                                  disabled={isVerifyingAction}
                                  onClick={() => handleApproveSingle(rec.id, rec.amount)}
                                  className="w-full sm:w-auto px-3 py-2 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white font-bold inline-flex items-center justify-center gap-1.5 text-center whitespace-normal leading-tight shadow-2xs cursor-pointer disabled:opacity-50"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>
                                    {typeof editedAmounts[rec.id] === 'number' &&
                                    editedAmounts[rec.id] > 0 &&
                                    editedAmounts[rec.id] !== rec.amount
                                      ? `Sesuaikan & Approve Bukti #${idx + 1}`
                                      : `Approve Bukti #${idx + 1}`}
                                  </span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer Group Action Buttons */}
            <div className="pt-3 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 border-t border-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPreviewOpen(false);
                    setSelectedGroupKey(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 text-center whitespace-normal leading-tight cursor-pointer"
                >
                  Tutup
                </button>

                {selectedGroupRow.summary.overallStatus === 'lunas' && (() => {
                  const lunasRecords = selectedGroupRow.summary.uploadedRecords.filter((r) => r.status === 'lunas');
                  const latestLunas = lunasRecords[lunasRecords.length - 1];
                  if (!latestLunas) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        const targetUnit = units.find((u) => u.id === selectedGroupRow.unit);
                        setActiveReceiptData({
                          paymentId: latestLunas.id,
                          registrationNumber: selectedGroupRow.registrationNumber,
                          studentName: selectedGroupRow.studentName,
                          unitId: selectedGroupRow.unit,
                          unitName: targetUnit?.name || selectedGroupRow.unit,
                          unitShortName: targetUnit?.shortName || selectedGroupRow.unit,
                          paymentType: selectedGroupRow.type,
                          amount: latestLunas.amount,
                          totalApprovedForBill: selectedGroupRow.summary.approvedAmount,
                          date: latestLunas.date,
                          bankAccount: latestLunas.bankAccount || 'Rekening Resmi Yayasan',
                          verificationNotes: latestLunas.verificationNotes,
                          verifiedBy: latestLunas.verifiedBy,
                          academicYear: activeAcademicYearLabel,
                          receiptSig: latestLunas.receiptSig,
                          appName: landingConfig?.appName,
                          logoUrl: landingConfig?.logoUrl,
                          tranches: lunasRecords.map((r) => ({
                            id: r.id,
                            amount: r.amount,
                            date: r.date,
                            bankAccount: r.bankAccount,
                          })),
                        });
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Cetak Resi Lunas</span>
                    </button>
                  );
                })()}
              </div>

              {canVerify && selectedGroupRow.summary.uploadedRecords.length > 0 && (
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    disabled={isVerifyingAction}
                    onClick={handleOpenRejectGroup}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200 text-center whitespace-normal leading-tight cursor-pointer disabled:opacity-50"
                  >
                    Tolak &amp; Beri Catatan Kekurangan
                  </button>

                  <button
                    type="button"
                    disabled={isVerifyingAction}
                    onClick={handleApproveGroup}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold text-center whitespace-normal leading-tight shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {selectedGroupRow.summary.uploadedRecords.length > 1
                      ? `Approve Semua (${selectedGroupRow.summary.uploadedRecords.length} Bukti) & Set Lunas`
                      : 'Approve & Set Lunas'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Tolak Bukti Transfer dengan Template Cepat */}
      <Modal
        isOpen={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        title="Tolak Bukti Pembayaran"
        description="Pilih alasan cepat atau tulis catatan detail agar wali siswa tahu bukti mana yang perlu diperbaiki/dilengkapi."
        icon={<AlertCircle className="w-6 h-6 text-red-600" />}
        confirmLabel="Simpan & Tolak"
        confirmVariant="danger"
        onConfirm={handleConfirmReject}
      >
        <div className="space-y-3 py-2 text-xs">
          <div className="space-y-1.5">
            <span className="font-bold text-slate-700 block">Pilih Alasan Cepat (Opsional):</span>
            <div className="flex flex-col gap-1.5">
              {REJECT_TEMPLATES.map((tpl, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setRejectNotes(tpl)}
                  className="text-left p-2 rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-[11px] text-slate-700 transition-colors cursor-pointer"
                >
                  {tpl}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">
              Catatan Penolakan (ditampilkan ke wali siswa):
            </label>
            <textarea
              rows={3}
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Contoh: Struk #1 terbaca Rp 300.000. Masih kurang Rp 50.000 lagi — silakan kirim 1 struk tambahan untuk melunasi tagihan."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white"
            />
          </div>
        </div>
      </Modal>

      <PaymentReceiptModal
        receipt={activeReceiptData}
        onClose={() => setActiveReceiptData(null)}
        onToast={showToast}
      />
    </div>
  );
};

