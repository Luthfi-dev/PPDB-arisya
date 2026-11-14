import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  CheckCircle2,
  Printer,
  Image as ImageIcon,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { Modal } from './Modal';
import { formatRupiah } from '../../utils/paymentHelpers';
import {
  buildReceiptVerifyUrl,
  downloadReceiptAsJpg,
  ReceiptData,
} from '../../utils/receiptGenerator';

interface PaymentReceiptModalProps {
  receipt: ReceiptData | null;
  onClose: () => void;
  onToast?: (msg: string, type?: 'success' | 'error') => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  receipt,
  onClose,
  onToast,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isDownloadingJpg, setIsDownloadingJpg] = useState(false);

  const verifyUrl = receipt
    ? buildReceiptVerifyUrl({
        paymentId: receipt.paymentId,
        registrationNumber: receipt.registrationNumber,
        receiptSig: receipt.receiptSig,
        appUrl: receipt.appUrl,
      })
    : '';

  useEffect(() => {
    let cancelled = false;
    if (!receipt || !verifyUrl) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(verifyUrl, {
      width: 220,
      margin: 1,
      color: { dark: '#064e3b', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [receipt, verifyUrl]);

  if (!receipt) return null;

  const billLabel =
    receipt.paymentType === 'Daftar Ulang'
      ? 'Biaya Daftar Ulang / Uang Pangkal'
      : 'Biaya Formulir Pendaftaran';

  const displayTotalAmount =
    receipt.totalApprovedForBill && receipt.totalApprovedForBill > receipt.amount
      ? receipt.totalApprovedForBill
      : receipt.amount;

  const handleSaveJpg = async () => {
    setIsDownloadingJpg(true);
    try {
      await downloadReceiptAsJpg(receipt);
      onToast?.('Resi pembayaran berhasil disimpan sebagai gambar (.JPG).', 'success');
    } catch (err) {
      onToast?.('Gagal menyimpan resi sebagai gambar JPG.', 'error');
    } finally {
      setIsDownloadingJpg(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(receipt)}
      onClose={onClose}
      title="Resi Pembayaran Resmi (LUNAS)"
      description={`Kode Resi ${receipt.paymentId} · ${receipt.registrationNumber}`}
      maxWidth="xl"
      hideFooter
    >
      <div className="space-y-4">
        {/* Printable Receipt Card (#print-area for clean A4 print) */}
        <div
          id="print-area"
          className="rounded-2xl border-2 border-emerald-200 bg-white overflow-hidden shadow-xs text-xs"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-700 px-5 py-4 text-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {receipt.logoUrl ? (
                <img
                  src={receipt.logoUrl}
                  alt="Logo Yayasan"
                  className="w-11 h-11 rounded-xl bg-white p-1 object-contain shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center font-extrabold text-sm shrink-0">
                  AR
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-wider uppercase text-emerald-200">
                  {receipt.appName || 'Yayasan Ar-Risalah Aceh'}
                </p>
                <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                  RESI PEMBAYARAN RESMI PPDB
                </h3>
                <p className="text-[11px] text-emerald-100 truncate">
                  {receipt.unitName}
                  {receipt.academicYear ? ` · TA ${receipt.academicYear}` : ''}
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-300 font-extrabold text-xs shrink-0 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>LUNAS</span>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {/* Meta ID & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Kode / ID Resi
                </p>
                <p className="font-mono font-bold text-slate-900 text-xs break-all mt-0.5">
                  {receipt.paymentId}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Tanggal Pembayaran
                </p>
                <p className="font-mono font-bold text-slate-900 text-xs mt-0.5">
                  {receipt.date || '-'}
                </p>
              </div>
            </div>

            {/* Data Pendaftar */}
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
              <div className="px-3.5 py-2 bg-slate-50/80 font-extrabold text-[11px] uppercase tracking-wider text-emerald-900">
                Data Pendaftar
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                <span className="text-slate-500">Nama Lengkap Pendaftar</span>
                <span className="font-extrabold text-slate-900 text-right">
                  {receipt.studentName}
                </span>
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                <span className="text-slate-500">Nomor Registrasi</span>
                <span className="font-mono font-bold text-emerald-800 text-right">
                  {receipt.registrationNumber}
                </span>
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                <span className="text-slate-500">Jenjang / Unit Pendidikan</span>
                <span className="font-bold text-slate-800 text-right">
                  {receipt.unitName}
                </span>
              </div>
            </div>

            {/* Detail Pembayaran Berhasil & Lunas */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 divide-y divide-emerald-100 overflow-hidden">
              <div className="px-3.5 py-2 bg-emerald-100/70 font-extrabold text-[11px] uppercase tracking-wider text-emerald-950">
                Detail Pembayaran Berhasil &amp; Lunas
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                <span className="text-slate-600">Jenis Tagihan</span>
                <span className="font-bold text-slate-900 text-right">{billLabel}</span>
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                <span className="text-slate-600">Rekening Tujuan</span>
                <span className="font-semibold text-slate-800 text-right">
                  {receipt.bankAccount || 'Rekening Resmi Yayasan'}
                </span>
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                <span className="text-slate-600">Status Pembayaran</span>
                <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700 text-right">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  BERHASIL &amp; LUNAS
                </span>
              </div>

              {receipt.tranches && receipt.tranches.length > 1 && (
                <div className="px-3.5 py-2.5 space-y-1.5 bg-white/70">
                  <p className="text-[11px] font-bold text-emerald-900">
                    Rincian Bukti Transfer Lunas ({receipt.tranches.length} tahap):
                  </p>
                  {receipt.tranches.map((t, idx) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 text-[11px] text-slate-700"
                    >
                      <span>
                        #{idx + 1} · {t.bankAccount || 'Rekening Yayasan'} ({t.date})
                      </span>
                      <span className="font-mono font-bold text-emerald-800">
                        {formatRupiah(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="px-3.5 py-3 bg-emerald-800 text-white flex items-center justify-between gap-3">
                <span className="font-bold text-emerald-100 uppercase tracking-wider text-[11px]">
                  Total Nominal Lunas
                </span>
                <span className="font-mono font-extrabold text-base text-white">
                  {formatRupiah(displayTotalAmount)}
                </span>
              </div>
            </div>

            {/* Keterangan Admin (Hijau) */}
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-0.5">
                <p className="text-[11px] font-extrabold text-emerald-800">
                  Keterangan Admin / Verifikator:
                </p>
                <p className="text-[11px] font-semibold leading-relaxed break-words">
                  {receipt.verificationNotes?.trim() ||
                    'Pembayaran telah diverifikasi dan dinyatakan LUNAS.'}
                </p>
              </div>
            </div>

            {/* Validasi Keaslian Resi & QR Code */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
              <div className="p-2 rounded-xl bg-white border border-emerald-200 shadow-2xs shrink-0">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR Code Validasi Resi"
                    className="w-28 h-28 object-contain"
                  />
                ) : (
                  <div className="w-28 h-28 flex items-center justify-center text-[10px] text-slate-400">
                    Membuat QR...
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>VALIDASI KEASLIAN RESI ONLINE</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Pindai QR Code di samping menggunakan kamera ponsel untuk memverifikasi
                  apakah resi pembayaran ini asli dan terdaftar atas nama pendaftar{' '}
                  <strong className="text-slate-900">{receipt.studentName}</strong> pada
                  sistem resmi PPDB Yayasan Ar-Risalah Aceh.
                </p>
                <div className="pt-1 print-hidden">
                  <a
                    href={verifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Buka Halaman Validasi Resi</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="print-hidden flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
          >
            Tutup
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isDownloadingJpg}
              onClick={handleSaveJpg}
              className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {isDownloadingJpg ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan JPG...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4 text-emerald-200" />
                  <span>Simpan Gambar (JPG)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Cetak / Print Resi</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
