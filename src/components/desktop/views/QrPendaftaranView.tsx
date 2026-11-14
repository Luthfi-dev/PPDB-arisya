import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Download,
  Copy,
  Check,
  ExternalLink,
  Printer,
  School,
  Lock,
  Sparkles,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { UnitQuotaFee } from '../../../types/ppdb';
import { UnitBadge } from '../../common/Badge';
import { isSuperAdmin } from '../../../utils/rbac';
import { getActiveAcademicYearLabel } from '../../../utils/studentFieldResolver';

export const QrPendaftaranView: React.FC = () => {
  const {
    units,
    academicYears,
    currentUser,
    activeSchoolId,
    setActiveSchoolId,
    landingConfig,
    showToast,
  } = usePPDB();

  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [copiedUnit, setCopiedUnit] = useState<string | null>(null);
  const [downloadingPoster, setDownloadingPoster] = useState<string | null>(null);

  const isGlobalAdmin = useMemo(() => {
    if (!currentUser) return false;
    if (isSuperAdmin(currentUser)) return true;
    const roleLower = (currentUser.role || '').toLowerCase();
    if (roleLower.includes('admin yayasan')) return true;
    if (currentUser.schoolId === 'MASTER' && !roleLower.includes('admin unit')) {
      return true;
    }
    return false;
  }, [currentUser]);

  // Determine which units this user can see & download QR codes for
  const visibleUnits = useMemo(() => {
    if (!isGlobalAdmin) {
      // Strictly locked to Admin Unit's own schoolId
      return units.filter((u) => u.id === currentUser?.schoolId);
    }
    if (activeSchoolId !== 'MASTER') {
      return units.filter((u) => u.id === activeSchoolId);
    }
    return units;
  }, [units, isGlobalAdmin, currentUser, activeSchoolId]);

  const getShortcutUrl = (unitId: string) => {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://ppdb.arrisalahaceh.or.id';
    return `${origin}/?daftar=${unitId}`;
  };

  // Generate QR Code Data URLs locally using qrcode library
  useEffect(() => {
    let cancelled = false;
    const generateAll = async () => {
      const nextMap: Record<string, string> = {};
      for (const unit of visibleUnits) {
        try {
          const url = getShortcutUrl(unit.id);
          const dataUrl = await QRCode.toDataURL(url, {
            width: 600,
            margin: 2,
            errorCorrectionLevel: 'H',
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          });
          nextMap[unit.id] = dataUrl;
        } catch (err) {
          console.error('QR generation failed for unit', unit.id, err);
        }
      }
      if (!cancelled) {
        setQrMap(nextMap);
      }
    };
    generateAll();
    return () => {
      cancelled = true;
    };
  }, [visibleUnits]);

  const handleCopyUrl = (unit: UnitQuotaFee) => {
    const url = getShortcutUrl(unit.id);
    navigator.clipboard.writeText(url);
    setCopiedUnit(unit.id);
    showToast(`Link pendaftaran unit ${unit.id} berhasil disalin!`);
    setTimeout(() => setCopiedUnit(null), 2200);
  };

  const handleDownloadPlainQr = async (unit: UnitQuotaFee) => {
    try {
      const url = getShortcutUrl(unit.id);
      const dataUrl =
        qrMap[unit.id] ||
        (await QRCode.toDataURL(url, {
          width: 800,
          margin: 3,
          errorCorrectionLevel: 'H',
          color: { dark: '#0f172a', light: '#ffffff' },
        }));

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `QR-PPDB-${unit.id}-${unit.shortName.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`QR Code unit ${unit.name} berhasil diunduh!`);
    } catch (e) {
      showToast('Gagal mengunduh file QR Code.', 'error');
    }
  };

  const handleDownloadPoster = async (unit: UnitQuotaFee) => {
    setDownloadingPoster(unit.id);
    try {
      const url = getShortcutUrl(unit.id);
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 540,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#0f172a', light: '#ffffff' },
      });

      const canvas = document.createElement('canvas');
      canvas.width = 900;
      canvas.height = 1220;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      // Background
      ctx.fillStyle = '#f0fdf4';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Top green header banner
      const grad = ctx.createLinearGradient(0, 0, 900, 260);
      grad.addColorStop(0, '#14532d');
      grad.addColorStop(1, '#15803d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 900, 270);

      // Header Accent Line
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(0, 264, 900, 6);

      // Header Texts
      ctx.textAlign = 'center';
      ctx.fillStyle = '#a7f3d0';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('PENERIMAAN PESERTA DIDIK BARU (PPDB ONLINE)', 450, 75);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px sans-serif';
      ctx.fillText(landingConfig?.appName || 'PPDB Yayasan Ar-Risalah Aceh', 450, 132);

      ctx.fillStyle = '#dcfce7';
      ctx.font = '600 22px sans-serif';
      ctx.fillText(
        landingConfig?.appTagline || `Yayasan Ar-Risalah Aceh • Tahun Ajaran ${getActiveAcademicYearLabel(academicYears)}`,
        450,
        178
      );

      // Unit Pill Badge
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(220, 218, 460, 88, 22);
      ctx.fill();
      ctx.strokeStyle = '#86efac';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#14532d';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`${unit.id} — ${unit.name}`, 450, 272);

      // Main QR White Card
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(140, 345, 620, 620, 36);
      ctx.fill();
      ctx.strokeStyle = '#bbf7d0';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Draw QR image inside card
      const qrImg = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve();
        qrImg.onerror = () => reject(new Error('Failed loading QR image'));
        qrImg.src = qrDataUrl;
      });
      ctx.drawImage(qrImg, 180, 385, 540, 540);

      // Scan Instructions
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(`SCAN QR CODE PENDAFTARAN ${unit.shortName.toUpperCase()}`, 450, 1025);

      ctx.fillStyle = '#475569';
      ctx.font = '600 20px sans-serif';
      ctx.fillText('1. Arahkan Kamera HP / Google Lens ke QR Code di atas', 450, 1070);
      ctx.fillText('2. Buat Akun Wali (atau Masuk jika sudah memiliki akun)', 450, 1102);
      ctx.fillText(`3. Otomatis diarahkan ke Formulir Pendaftaran Unit ${unit.id}`, 450, 1134);

      // Direct URL Footer
      ctx.fillStyle = '#15803d';
      ctx.font = 'bold 17px monospace';
      ctx.fillText(url, 450, 1185);

      const posterDataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = posterDataUrl;
      link.download = `Poster-QR-PPDB-${unit.id}-${unit.shortName.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Poster QR siap cetak untuk ${unit.name} berhasil diunduh!`);
    } catch (err) {
      console.error(err);
      showToast('Gagal membuat poster QR.', 'error');
    } finally {
      setDownloadingPoster(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-700" />
              <span>QR Code Shortcut Pendaftaran Per Unit</span>
            </h3>
            {!isGlobalAdmin && currentUser?.schoolId && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                <Lock className="w-3 h-3" />
                <span>Khusus Unit {currentUser.schoolId}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Bagikan atau cetak QR Code ini sebagai shortcut pendaftaran resmi. Saat dipindai, pendaftar yang belum masuk akan diarahkan ke halaman pembuatan akun wali lalu otomatis menuju formulir unit tujuan. Jika sudah memiliki sesi aktif, formulir pendaftaran unit langsung terbuka.
          </p>
        </div>

        {/* Filter shortcut for Global Admin (Master / Admin Yayasan) */}
        {isGlobalAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Tampilkan:</span>
            <select
              value={activeSchoolId}
              onChange={(e) => setActiveSchoolId(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
            >
              <option value="MASTER">Semua Unit Sekolah ({units.length} Unit)</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.id} - {u.shortName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Info Box: Flow Explanation */}
      <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-emerald-950">
        <Info className="w-4.5 h-4.5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-extrabold text-emerald-900">Cara Kerja Otomatis Saat QR Dipindai Calon Wali:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-emerald-800">
            <div className="bg-white/80 rounded-xl p-2.5 border border-emerald-200/80">
              <strong className="text-emerald-950 block">1. Belum Login / Belum Punya Akun:</strong>
              Otomatis diarahkan ke halaman <strong>Buat Akun Wali</strong>. Setelah daftar/masuk selesai, formulir pendaftaran <strong>unit tersebut</strong> langsung terbuka otomatis.
            </div>
            <div className="bg-white/80 rounded-xl p-2.5 border border-emerald-200/80">
              <strong className="text-emerald-950 block">2. Sudah Login (Ada Sesi Aktif):</strong>
              Langsung diarahkan menuju <strong>Formulir Pendaftaran Unit</strong> tersebut tanpa perlu memilih ulang unit sekolah.
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Cards Grid */}
      <div
        className={`grid gap-6 ${
          visibleUnits.length === 1 ? 'grid-cols-1 max-w-xl' : 'grid-cols-1 md:grid-cols-2'
        }`}
      >
        {visibleUnits.map((unit) => {
          const shortcutUrl = getShortcutUrl(unit.id);
          const qrSrc = qrMap[unit.id];
          const remaining = Math.max(0, unit.totalQuota - unit.filledQuota);
          const isOpen = unit.isOpen !== false;

          return (
            <div
              key={unit.id}
              className="bg-white rounded-3xl border border-emerald-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
            >
              {/* Card Header */}
              <div className="p-5 bg-gradient-to-r from-[#14532d] to-emerald-800 text-white flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-white/20 text-white font-mono font-extrabold text-xs border border-white/20">
                      {unit.id}
                    </span>
                    {isOpen ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-100 border border-emerald-400/40 text-[10px] font-bold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                        <span>Pendaftaran Buka</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-500/30 text-rose-100 border border-rose-400/40 text-[10px] font-bold inline-flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-rose-200" />
                        <span>Pendaftaran Ditutup</span>
                      </span>
                    )}
                  </div>
                  <h4 className="text-lg font-extrabold tracking-tight">{unit.name}</h4>
                  <p className="text-[11px] text-emerald-200">
                    Sisa Kuota: <strong className="text-white">{remaining}</strong> dari {unit.totalQuota} kursi
                  </p>
                </div>

                <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                  <School className="w-5 h-5 text-emerald-200" />
                </div>
              </div>

              {/* QR Preview Body */}
              <div className="p-6 flex flex-col items-center space-y-4">
                <div className="p-4 bg-white rounded-3xl border-2 border-emerald-200 shadow-inner flex flex-col items-center">
                  {qrSrc ? (
                    <img
                      src={qrSrc}
                      alt={`QR Code Pendaftaran ${unit.name}`}
                      className="w-52 h-52 sm:w-56 sm:h-56 object-contain"
                    />
                  ) : (
                    <div className="w-52 h-52 flex items-center justify-center text-xs text-slate-400">
                      Membuat QR Code...
                    </div>
                  )}
                  <span className="mt-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200 text-[11px] font-extrabold tracking-wide">
                    SCAN UNTUK DAFTAR {unit.id}
                  </span>
                </div>

                {/* Copyable URL Field */}
                <div className="w-full space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Link Langsung Pendaftaran Unit {unit.id}:
                  </label>
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 pl-3">
                    <span className="text-xs font-mono text-slate-700 truncate flex-1 select-all">
                      {shortcutUrl}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(unit)}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedUnit === unit.id ? (
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
                </div>
              </div>

              {/* Action Footer Buttons */}
              <div className="p-4 bg-slate-50/90 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleDownloadPoster(unit)}
                  disabled={downloadingPoster === unit.id}
                  className="flex-1 min-w-[160px] py-2.5 px-4 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-sm inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
                >
                  <Printer className="w-4 h-4" />
                  <span>
                    {downloadingPoster === unit.id ? 'Menyiapkan Poster...' : 'Unduh Poster QR (PNG)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadPlainQr(unit)}
                  className="py-2.5 px-3.5 rounded-xl bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Unduh Gambar QR Code Polos (PNG)"
                >
                  <Download className="w-4 h-4 text-emerald-700" />
                  <span>QR Polos</span>
                </button>

                <a
                  href={shortcutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center justify-center transition-colors"
                  title="Tes Buka Link Shortcut di Tab Baru"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
