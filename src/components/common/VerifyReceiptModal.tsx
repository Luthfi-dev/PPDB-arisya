import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  X,
  CheckCircle2,
  Receipt,
  Image as ImageIcon,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { formatRupiah } from '../../utils/paymentHelpers';
import {
  buildReceiptVerifyUrl,
  downloadReceiptAsJpg,
  ReceiptData,
  ReceiptTrancheItem,
} from '../../utils/receiptGenerator';

interface VerifyReceiptModalProps {
  initialPaymentId?: string | null;
  initialRegNumber?: string | null;
  initialSignature?: string | null;
  onClose: () => void;
}

interface VerifyReceiptResponse {
  valid: boolean;
  paymentId: string;
  registrationNumber?: string;
  studentName?: string;
  unitId?: string;
  unitName?: string;
  unitShortName?: string;
  paymentType?: 'Formulir' | 'Daftar Ulang';
  amount?: number;
  totalApprovedForBill?: number;
  date?: string;
  bankAccount?: string;
  status?: string;
  verificationNotes?: string;
  academicYear?: string;
  appName?: string;
  logoUrl?: string;
  receiptSig?: string;
  tranches?: ReceiptTrancheItem[];
  message?: string;
}

export const VerifyReceiptModal: React.FC<VerifyReceiptModalProps> = ({
  initialPaymentId,
  initialRegNumber,
  initialSignature,
  onClose,
}) => {
  const [searchPid, setSearchPid] = useState<string>(initialPaymentId || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<VerifyReceiptResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isDownloadingJpg, setIsDownloadingJpg] = useState<boolean>(false);

  const performVerification = async (
    pid: string,
    reg?: string | null,
    sig?: string | null
  ) => {
    const cleanPid = (pid || '').trim();
    if (!cleanPid) {
      setResult(null);
      return;
    }

    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('pid', cleanPid);
      if (reg && reg.trim()) qs.set('reg', reg.trim());
      if (sig && sig.trim()) qs.set('sig', sig.trim());

      const res = await fetch(`/api/verify-resi?${qs.toString()}`, {
        cache: 'no-store',
      });
      const data: VerifyReceiptResponse = await res.json();
      setResult(data);
    } catch {
      setResult({
        valid: false,
        paymentId: cleanPid,
        message: 'Gagal terhubung ke server untuk memverifikasi keaslian resi pembayaran.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialPaymentId) {
      setSearchPid(initialPaymentId);
      performVerification(initialPaymentId, initialRegNumber, initialSignature);
    }
  }, [initialPaymentId, initialRegNumber, initialSignature]);

  useEffect(() => {
    let cancelled = false;
    if (!result || !result.valid || !result.paymentId) {
      setQrDataUrl('');
      return;
    }
    const url = buildReceiptVerifyUrl({
      paymentId: result.paymentId,
      registrationNumber: result.registrationNumber || '',
      receiptSig: result.receiptSig,
    });
    QRCode.toDataURL(url, {
      width: 180,
      margin: 1,
      color: { dark: '#064e3b', light: '#ffffff' },
    })
      .then((qr) => {
        if (!cancelled) setQrDataUrl(qr);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [result]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performVerification(searchPid, null, null);
  };

  const buildReceiptPayload = (): ReceiptData | null => {
    if (!result || !result.valid) return null;
    return {
      paymentId: result.paymentId,
      registrationNumber: result.registrationNumber || '-',
      studentName: result.studentName || '-',
      unitId: result.unitId || '-',
      unitName: result.unitName || result.unitId || '-',
      unitShortName: result.unitShortName,
      paymentType: result.paymentType || 'Formulir',
      amount: Number(result.amount) || 0,
      totalApprovedForBill: result.totalApprovedForBill,
      date: result.date || '-',
      bankAccount: result.bankAccount || 'Rekening Resmi Yayasan',
      verificationNotes: result.verificationNotes,
      academicYear: result.academicYear,
      receiptSig: result.receiptSig,
      appName: result.appName,
      logoUrl: result.logoUrl,
      tranches: result.tranches,
    };
  };

  const handleDownloadJpg = async () => {
    const payload = buildReceiptPayload();
    if (!payload) return;
    setIsDownloadingJpg(true);
    try {
      await downloadReceiptAsJpg(payload);
    } finally {
      setIsDownloadingJpg(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/75 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl my-auto overflow-hidden rounded-2xl bg-white shadow-2xl border border-emerald-100">
        {/* Header */}
        <div className="print-hidden bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 px-5 py-4 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-emerald-300 border border-white/20 shrink-0">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-white tracking-wide truncate">
                VALIDASI RESI PEMBAYARAN PPDB
              </h3>
              <p className="text-[11px] text-emerald-200 truncate">
                Yayasan Ar-Risalah Aceh · Pemeriksaan Keaslian Resi Lunas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-emerald-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="print-hidden">
            <label className="block mb-1.5 text-xs font-bold text-slate-700">
              Kode / ID Resi Pembayaran:
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchPid}
                onChange={(e) => setSearchPid(e.target.value)}
                placeholder="Contoh: pay-179..."
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-3.5 pr-28 text-xs sm:text-sm font-mono font-bold text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="submit"
                className="absolute right-1.5 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 transition-colors cursor-pointer"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Cek Resi</span>
              </button>
            </div>
          </form>

          {loading && (
            <div className="my-8 flex flex-col items-center justify-center py-6 text-emerald-700">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent mb-3" />
              <p className="text-xs font-bold">Memverifikasi keaslian resi di database resmi...</p>
            </div>
          )}

          {!loading && result && (
            <div>
              {result.valid ? (
                <div id="print-area" className="space-y-4">
                  {/* Valid Banner */}
                  <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/90 p-5 text-center space-y-2.5">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-8 ring-emerald-50">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 text-white px-3.5 py-1 text-[11px] font-extrabold tracking-wide">
                      <ShieldCheck className="h-4 w-4 text-emerald-200" />
                      <span>RESI ASLI &amp; VALID (LUNAS)</span>
                    </div>
                    <h4 className="text-base sm:text-lg font-extrabold text-emerald-950 leading-snug">
                      Valid atas nama pendaftar{' '}
                      <span className="underline decoration-emerald-500 decoration-2">
                        {result.studentName}
                      </span>
                    </h4>
                    <p className="text-xs text-emerald-800 font-medium">
                      Nomor Registrasi:{' '}
                      <span className="font-mono font-bold">{result.registrationNumber}</span> ·{' '}
                      {result.unitName}
                    </p>
                  </div>

                  {/* Detail Resi Terverifikasi */}
                  <div className="rounded-2xl border border-emerald-200 bg-white overflow-hidden text-xs divide-y divide-slate-100">
                    <div className="px-4 py-2.5 bg-emerald-800 text-white font-extrabold flex items-center justify-between gap-2">
                      <span>RINCIAN RESI PEMBAYARAN</span>
                      <span className="font-mono text-[11px] text-emerald-200">
                        {result.paymentId}
                      </span>
                    </div>
                    <div className="px-4 py-2.5 flex justify-between gap-3">
                      <span className="text-slate-500">Nama Pendaftar</span>
                      <span className="font-extrabold text-slate-900 text-right">
                        {result.studentName}
                      </span>
                    </div>
                    <div className="px-4 py-2.5 flex justify-between gap-3">
                      <span className="text-slate-500">Nomor Registrasi</span>
                      <span className="font-mono font-bold text-emerald-800 text-right">
                        {result.registrationNumber}
                      </span>
                    </div>
                    <div className="px-4 py-2.5 flex justify-between gap-3">
                      <span className="text-slate-500">Unit Pendidikan</span>
                      <span className="font-bold text-slate-800 text-right">
                        {result.unitName}
                        {result.academicYear ? ` (TA ${result.academicYear})` : ''}
                      </span>
                    </div>
                    <div className="px-4 py-2.5 flex justify-between gap-3">
                      <span className="text-slate-500">Jenis Tagihan</span>
                      <span className="font-bold text-slate-900 text-right">
                        {result.paymentType === 'Daftar Ulang'
                          ? 'Biaya Daftar Ulang / Uang Pangkal'
                          : 'Biaya Formulir Pendaftaran'}
                      </span>
                    </div>
                    <div className="px-4 py-2.5 flex justify-between gap-3">
                      <span className="text-slate-500">Tanggal Pembayaran</span>
                      <span className="font-mono font-semibold text-slate-800 text-right">
                        {result.date}
                      </span>
                    </div>
                    <div className="px-4 py-2.5 flex justify-between gap-3">
                      <span className="text-slate-500">Rekening Tujuan</span>
                      <span className="font-semibold text-slate-800 text-right">
                        {result.bankAccount}
                      </span>
                    </div>
                    <div className="px-4 py-3 bg-emerald-50 flex justify-between items-center gap-3">
                      <span className="font-bold text-emerald-900">Nominal Pembayaran</span>
                      <span className="font-mono font-extrabold text-base text-emerald-800">
                        {formatRupiah(
                          result.totalApprovedForBill && result.totalApprovedForBill > (result.amount || 0)
                            ? result.totalApprovedForBill
                            : Number(result.amount) || 0
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Keterangan Admin Hijau */}
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="font-extrabold text-emerald-800">Keterangan Admin: </span>
                      <span>
                        {result.verificationNotes ||
                          'Pembayaran telah diverifikasi dan dinyatakan LUNAS.'}
                      </span>
                    </div>
                  </div>

                  {qrDataUrl && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                      <img
                        src={qrDataUrl}
                        alt="QR Resi"
                        className="w-16 h-16 rounded-lg border border-emerald-200 bg-white p-1 shrink-0"
                      />
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Resi digital ini terverifikasi secara kriptografis dan tercatat sah pada database resmi{' '}
                        <strong className="text-slate-800">PPDB Yayasan Ar-Risalah Aceh</strong>.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* TIDAK VALID / TIDAK DITEMUKAN */
                <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-6 text-center space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 ring-8 ring-rose-50">
                    <ShieldAlert className="h-8 w-8" />
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-600/10 px-3.5 py-1 text-xs font-extrabold text-rose-800 border border-rose-300">
                    RESI TIDAK DITEMUKAN / TIDAK VALID
                  </div>
                  <p className="text-sm font-bold text-slate-800">
                    Kode resi{' '}
                    <span className="font-mono text-rose-700">{result.paymentId || searchPid}</span>{' '}
                    tidak ditemukan atau belum berstatus lunas.
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {result.message ||
                      'Pastikan QR Code berasal dari Resi Pembayaran Lunas resmi yang diterbitkan oleh portal PPDB Yayasan Ar-Risalah Aceh.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {!loading && !result && (
            <div className="py-8 text-center text-slate-500 text-xs">
              Masukkan Kode / ID Resi Pembayaran di atas untuk memeriksa keaslian resi PPDB.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="print-hidden bg-slate-50 px-5 py-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-200 hover:bg-slate-300 px-4 py-2 text-xs font-bold text-slate-800 transition-colors cursor-pointer"
          >
            Tutup
          </button>

          {result?.valid && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isDownloadingJpg}
                onClick={handleDownloadJpg}
                className="rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-bold text-white shadow-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
              >
                {isDownloadingJpg ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-200" />
                    <span>Simpan Resi (JPG)</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-bold text-white shadow-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cetak</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
