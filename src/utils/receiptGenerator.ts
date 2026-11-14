import QRCode from 'qrcode';
import { formatRupiah } from './paymentHelpers';
import { getPublicAppUrl } from './appUrl';

export interface ReceiptTrancheItem {
  id: string;
  amount: number;
  date: string;
  bankAccount: string;
}

export interface ReceiptData {
  paymentId: string;
  registrationNumber: string;
  studentName: string;
  unitId: string;
  unitName: string;
  unitShortName?: string;
  paymentType: 'Formulir' | 'Daftar Ulang';
  amount: number;
  totalBillAmount?: number;
  totalApprovedForBill?: number;
  date: string;
  bankAccount: string;
  verificationNotes?: string;
  verifiedBy?: string;
  academicYear?: string;
  receiptSig?: string;
  appName?: string;
  logoUrl?: string;
  contactAddress?: string;
  contactPhone?: string;
  appUrl?: string;
  tranches?: ReceiptTrancheItem[];
}

export function buildReceiptVerifyUrl(params: {
  paymentId: string;
  registrationNumber: string;
  receiptSig?: string;
  appUrl?: string;
}): string {
  const baseUrl = getPublicAppUrl(params.appUrl);
  const query = new URLSearchParams();
  query.set('pid', params.paymentId || '');
  if (params.registrationNumber) {
    query.set('reg', params.registrationNumber);
  }
  if (params.receiptSig) {
    query.set('sig', params.receiptSig);
  }
  return `${baseUrl}/#verify-resi?${query.toString()}`;
}

function loadImageSafe(src?: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const clean = String(text || '').trim();
  if (!clean) return ['-'];
  const paragraphs = clean.split(/\r?\n/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        // Handle single very long token
        if (ctx.measureText(word).width > maxWidth) {
          let chunk = '';
          for (const ch of word) {
            if (ctx.measureText(chunk + ch).width <= maxWidth) {
              chunk += ch;
            } else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : ['-'];
}

export async function downloadReceiptAsJpg(data: ReceiptData): Promise<void> {
  const verifyUrl = buildReceiptVerifyUrl({
    paymentId: data.paymentId,
    registrationNumber: data.registrationNumber,
    receiptSig: data.receiptSig,
    appUrl: data.appUrl,
  });

  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 300,
    margin: 1,
    color: { dark: '#064e3b', light: '#ffffff' },
  });

  const [qrImg, logoImg] = await Promise.all([
    loadImageSafe(qrDataUrl),
    loadImageSafe(data.logoUrl),
  ]);

  const width = 1120;
  const padX = 64;
  const contentW = width - padX * 2;

  // Measure dynamic text height first using a temporary canvas context
  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d')!;
  mCtx.font = '600 22px "Plus Jakarta Sans", system-ui, sans-serif';
  const noteText =
    data.verificationNotes?.trim() ||
    'Pembayaran telah diverifikasi dan dinyatakan LUNAS.';
  const noteLines = wrapCanvasText(mCtx, noteText, contentW - 88);
  const noteBoxH = Math.max(96, 56 + noteLines.length * 30);

  const showTranches = Boolean(data.tranches && data.tranches.length > 1);
  const trancheRowsH = showTranches ? 46 + (data.tranches?.length || 0) * 40 + 18 : 0;

  const height = 1320 + noteBoxH + trancheRowsH;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser tidak mendukung pembuatan gambar kanvas.');
  }

  // White background (critical for JPEG)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Subtle outer frame
  ctx.strokeStyle = '#d1fae5';
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 20, 20, width - 40, height - 40, 28);
  ctx.stroke();

  // Top Header Gradient
  const headerH = 210;
  const grad = ctx.createLinearGradient(24, 24, width - 24, headerH);
  grad.addColorStop(0, '#064e3b');
  grad.addColorStop(0.55, '#047857');
  grad.addColorStop(1, '#065f46');
  ctx.save();
  drawRoundedRect(ctx, 24, 24, width - 48, headerH, 24);
  ctx.clip();
  ctx.fillStyle = grad;
  ctx.fillRect(24, 24, width - 48, headerH);
  ctx.restore();

  // Header Logo / Emblem
  const logoSize = 86;
  const logoX = padX;
  const logoY = 68;
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 20);
  ctx.fill();
  if (logoImg) {
    ctx.save();
    drawRoundedRect(ctx, logoX + 6, logoY + 6, logoSize - 12, logoSize - 12, 14);
    ctx.clip();
    ctx.drawImage(logoImg, logoX + 6, logoY + 6, logoSize - 12, logoSize - 12);
    ctx.restore();
  } else {
    ctx.fillStyle = '#047857';
    ctx.font = '800 32px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AR', logoX + logoSize / 2, logoY + logoSize / 2);
  }

  // Header Title
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#a7f3d0';
  ctx.font = '700 18px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText((data.appName || 'YAYASAN AR-RISALAH ACEH').toUpperCase(), logoX + logoSize + 24, 96);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 34px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('RESI PEMBAYARAN RESMI PPDB', logoX + logoSize + 24, 140);

  ctx.fillStyle = '#d1fae5';
  ctx.font = '500 19px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    `${data.unitName}${data.academicYear ? ` · Tahun Ajaran ${data.academicYear}` : ''}`,
    logoX + logoSize + 24,
    174
  );

  // LUNAS Badge on Top Right
  const badgeW = 230;
  const badgeH = 54;
  const badgeX = width - padX - badgeW;
  const badgeY = 86;
  ctx.fillStyle = '#ecfdf5';
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 16);
  ctx.fill();
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#065f46';
  ctx.font = '800 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✓ LUNAS', badgeX + badgeW / 2, badgeY + badgeH / 2);

  let y = 272;

  // Receipt Meta Strip
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f8fafc';
  drawRoundedRect(ctx, padX, y, contentW, 74, 16);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '600 17px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('KODE / ID RESI', padX + 24, y + 28);
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 21px "JetBrains Mono", monospace';
  ctx.fillText(data.paymentId, padX + 24, y + 56);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = '600 17px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('TANGGAL PEMBAYARAN', width - padX - 24, y + 28);
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 21px "JetBrains Mono", monospace';
  ctx.fillText(data.date || '-', width - padX - 24, y + 56);

  y += 106;

  // Section 1: Data Pendaftar
  ctx.textAlign = 'left';
  ctx.fillStyle = '#065f46';
  ctx.font = '800 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('DATA CALON PESERTA DIDIK', padX, y);
  y += 16;

  const studentBoxH = 196;
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, padX, y, contentW, studentBoxH, 18);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const studentRows: Array<[string, string, boolean?]> = [
    ['Nama Lengkap Pendaftar', data.studentName || '-', true],
    ['Nomor Registrasi', data.registrationNumber || '-', false],
    ['Jenjang / Unit Pendidikan', data.unitName || data.unitId, false],
  ];

  studentRows.forEach(([label, val, bold], idx) => {
    const rowY = y + 48 + idx * 54;
    if (idx > 0) {
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padX + 24, rowY - 32);
      ctx.lineTo(width - padX - 24, rowY - 32);
      ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '600 20px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(label, padX + 24, rowY);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = bold
      ? '800 23px "Plus Jakarta Sans", system-ui, sans-serif'
      : '700 21px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(val, width - padX - 24, rowY);
  });

  y += studentBoxH + 36;

  // Section 2: Detail Pembayaran Berhasil & Lunas
  ctx.textAlign = 'left';
  ctx.fillStyle = '#065f46';
  ctx.font = '800 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('DETAIL PEMBAYARAN BERHASIL & LUNAS', padX, y);
  y += 16;

  const paymentBoxH = 262 + trancheRowsH;
  ctx.fillStyle = '#f0fdf4';
  drawRoundedRect(ctx, padX, y, contentW, paymentBoxH, 18);
  ctx.fill();
  ctx.strokeStyle = '#86efac';
  ctx.lineWidth = 2;
  ctx.stroke();

  const billLabel =
    data.paymentType === 'Daftar Ulang'
      ? 'Biaya Daftar Ulang / Uang Pangkal'
      : 'Biaya Formulir Pendaftaran';

  const payRows: Array<[string, string, string?]> = [
    ['Jenis Tagihan', billLabel],
    ['Rekening Tujuan', data.bankAccount || 'Rekening Resmi Yayasan'],
    ['Status Verifikasi', 'BERHASIL & LUNAS (TERVERIFIKASI)', '#047857'],
  ];

  payRows.forEach(([label, val, color], idx) => {
    const rowY = y + 48 + idx * 52;
    if (idx > 0) {
      ctx.strokeStyle = '#dcfce7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padX + 24, rowY - 32);
      ctx.lineTo(width - padX - 24, rowY - 32);
      ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = '600 20px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(label, padX + 24, rowY);

    ctx.textAlign = 'right';
    ctx.fillStyle = color || '#0f172a';
    ctx.font = '700 20px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(val, width - padX - 24, rowY);
  });

  let innerY = y + 206;

  if (showTranches && data.tranches) {
    ctx.strokeStyle = '#bbf7d0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padX + 24, innerY - 14);
    ctx.lineTo(width - padX - 24, innerY - 14);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#065f46';
    ctx.font = '700 18px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Rincian Bukti Pembayaran Lunas:', padX + 24, innerY + 14);
    innerY += 40;

    data.tranches.forEach((tr, idx) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#334155';
      ctx.font = '500 18px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(
        `• Bukti #${idx + 1} (${tr.bankAccount || 'Rekening Yayasan'} · ${tr.date})`,
        padX + 28,
        innerY + 10
      );
      ctx.textAlign = 'right';
      ctx.fillStyle = '#065f46';
      ctx.font = '700 19px "JetBrains Mono", monospace';
      ctx.fillText(formatRupiah(tr.amount), width - padX - 24, innerY + 10);
      innerY += 40;
    });
  }

  // Total Nominal Strip
  ctx.fillStyle = '#065f46';
  drawRoundedRect(ctx, padX + 20, innerY, contentW - 40, 62, 14);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#d1fae5';
  ctx.font = '700 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('TOTAL NOMINAL LUNAS', padX + 44, innerY + 38);

  const displayAmount =
    data.totalApprovedForBill && data.totalApprovedForBill > data.amount
      ? data.totalApprovedForBill
      : data.amount;

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 28px "JetBrains Mono", monospace';
  ctx.fillText(formatRupiah(displayAmount), width - padX - 44, innerY + 40);

  y += paymentBoxH + 28;

  // Section 3: Keterangan Admin (HIJAU)
  ctx.fillStyle = '#ecfdf5';
  drawRoundedRect(ctx, padX, y, contentW, noteBoxH, 16);
  ctx.fill();
  ctx.strokeStyle = '#6ee7b7';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#047857';
  ctx.font = '800 19px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('✓ KETERANGAN ADMIN / VERIFIKATOR', padX + 24, y + 34);

  ctx.fillStyle = '#064e3b';
  ctx.font = '600 21px "Plus Jakarta Sans", system-ui, sans-serif';
  noteLines.forEach((line, idx) => {
    ctx.fillText(line, padX + 24, y + 68 + idx * 30);
  });

  y += noteBoxH + 34;

  // Section 4: Validasi Keaslian & QR Code
  const qrBoxH = 260;
  ctx.fillStyle = '#f8fafc';
  drawRoundedRect(ctx, padX, y, contentW, qrBoxH, 20);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const qrSize = 200;
  const qrX = padX + 28;
  const qrY = y + 30;
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 14);
  ctx.fill();
  ctx.strokeStyle = '#a7f3d0';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (qrImg) {
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  }

  const infoX = qrX + qrSize + 36;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#065f46';
  ctx.font = '800 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('VALIDASI KEASLIAN RESI ONLINE (QR CODE)', infoX, y + 64);

  ctx.fillStyle = '#334155';
  ctx.font = '500 19px "Plus Jakarta Sans", system-ui, sans-serif';
  const qrDescLines = wrapCanvasText(
    ctx,
    'Pindai QR Code di samping untuk memverifikasi keaslian resi pembayaran ini pada portal resmi PPDB Yayasan Ar-Risalah Aceh.',
    contentW - qrSize - 92
  );
  qrDescLines.forEach((line, idx) => {
    ctx.fillText(line, infoX, y + 102 + idx * 28);
  });

  ctx.fillStyle = '#047857';
  ctx.font = '700 18px "JetBrains Mono", monospace';
  ctx.fillText(`ID Validasi: ${data.paymentId}`, infoX, y + 194);

  ctx.fillStyle = '#64748b';
  ctx.font = '500 16px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    `Dicetak pada: ${new Date().toLocaleString('id-ID')} · Dokumen Resi Digital Sah`,
    infoX,
    y + 226
  );

  // Convert to JPEG & download
  const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.95);
  const safeReg = (data.registrationNumber || 'PPDB').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeType = (data.paymentType || 'Resi').replace(/\s+/g, '_');
  const link = document.createElement('a');
  link.href = jpgDataUrl;
  link.download = `Resi_Lunas_${safeReg}_${safeType}.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
