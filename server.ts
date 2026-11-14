import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { db, initDatabase, addAuditLog } from './server/db';
import {
  getCardBiodataRows,
  ensureCoreNameFieldInSections,
  isLockedNameField,
  resolveStudentNameFromSchema,
  resolveGuardianSummaryFromSchema,
  getActiveAcademicYearLabel,
} from './src/utils/studentFieldResolver';
import { MODULE_ACTIONS } from './src/utils/rbac';

dotenv.config();

const ALL_VALID_PERMISSIONS = new Set<string>(
  MODULE_ACTIONS.flatMap((m) => [m.module, ...m.actions.map((a) => `${m.module}:${a.key}`)])
);

const SUPER_ADMIN_ONLY_MODULES = new Set<string>([
  'Manajemen Role',
  'Status Sistem',
  'Audit Log',
  'Konfigurasi SMTP',
  'Kelola Export',
]);

function escapeHtml(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeHttpUrl(val: unknown, allowRelativeUploads = false): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  if (allowRelativeUploads && (trimmed.startsWith('/uploads/') || trimmed.startsWith('/src/assets/'))) {
    return !trimmed.includes('..');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function verifyBufferMagicBytes(
  buf: Buffer,
  expectedKind: 'png' | 'jpg' | 'jpeg' | 'webp' | 'ico' | 'pdf'
): boolean {
  if (!buf || buf.length < 4) return false;
  switch (expectedKind) {
    case 'png':
      return (
        buf.length >= 8 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a
      );
    case 'jpg':
    case 'jpeg':
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case 'webp':
      return (
        buf.length >= 12 &&
        buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buf.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    case 'ico':
      return (
        buf[0] === 0x00 &&
        buf[1] === 0x00 &&
        (buf[2] === 0x01 || buf[2] === 0x02) &&
        buf[3] === 0x00
      );
    case 'pdf':
      return buf.subarray(0, 5).toString('ascii') === '%PDF-';
    default:
      return false;
  }
}

function verifyDataUriPayload(
  rawData: string,
  options: { allowPdf?: boolean; allowIco?: boolean; maxBytes?: number } = {}
): { ok: true; ext: string; buffer: Buffer } | { ok: false; error: string } {
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
  const regex = options.allowPdf
    ? (options.allowIco
        ? /^data:(image\/(?:png|jpeg|jpg|webp|x-icon|vnd\.microsoft\.icon)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/i
        : /^data:(image\/(?:png|jpeg|jpg|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/i)
    : (options.allowIco
        ? /^data:image\/(png|jpeg|jpg|webp|x-icon|vnd\.microsoft\.icon);base64,([A-Za-z0-9+/=]+)$/i
        : /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/i);

  const match = rawData.match(regex);
  if (!match) {
    return { ok: false, error: 'Format tipe MIME file tidak diizinkan.' };
  }

  const mime = match[1].toLowerCase();
  const base64Body = match[2];
  const buffer = Buffer.from(base64Body, 'base64');
  if (buffer.length === 0 || buffer.length > maxBytes) {
    return { ok: false, error: `Ukuran file tidak valid atau melebihi batas maksimal ${Math.round(maxBytes / (1024 * 1024))}MB.` };
  }

  let ext = 'png';
  let expectedKind: 'png' | 'jpg' | 'webp' | 'ico' | 'pdf' = 'png';
  if (mime === 'application/pdf') {
    ext = 'pdf';
    expectedKind = 'pdf';
  } else if (mime.includes('jpeg') || mime.includes('jpg')) {
    ext = 'jpg';
    expectedKind = 'jpg';
  } else if (mime.includes('webp')) {
    ext = 'webp';
    expectedKind = 'webp';
  } else if (mime.includes('icon')) {
    ext = 'ico';
    expectedKind = 'ico';
  }

  // Note: some legacy favicon PNGs may carry image/x-icon header or PNG magic bytes
  const magicValid =
    expectedKind === 'ico'
      ? verifyBufferMagicBytes(buffer, 'ico') || verifyBufferMagicBytes(buffer, 'png')
      : verifyBufferMagicBytes(buffer, expectedKind);

  if (!magicValid) {
    return { ok: false, error: 'Signature biner (magic bytes) file tidak cocok dengan ekstensi yang diklaim.' };
  }

  return { ok: true, ext, buffer };
}

function getEnvCloudflareConfig(): { enabled: boolean; siteKey: string; secretKey: string } {
  const rawEnabled = (
    process.env.CLOUDFLARE_ENABLED ??
    process.env.CLOUDFLARE_TURNSTILE_ENABLED ??
    'false'
  )
    .trim()
    .toLowerCase();
  const enabled = rawEnabled === 'true' || rawEnabled === '1' || rawEnabled === 'yes';
  const siteKey = (process.env.CLOUDFLARE_TURNSTILE_SITE_KEY || '').trim();
  const secretKey = (process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || '').trim();
  return { enabled, siteKey, secretKey };
}

async function verifyTurnstileServer(
  token: unknown,
  remoteIp: string
): Promise<{ success: boolean; error?: string }> {
  const config = getEnvCloudflareConfig();
  if (!config.enabled) {
    return { success: true };
  }

  if (typeof token !== 'string' || token.trim().length < 10 || token.length > 4096) {
    return { success: false, error: 'Verifikasi keamanan Cloudflare Turnstile wajib diselesaikan.' };
  }

  const secret = config.secretKey;
  if (!secret) {
    return {
      success: false,
      error: 'Konfigurasi CLOUDFLARE_TURNSTILE_SECRET_KEY di .env server belum lengkap. Silakan hubungi administrator.',
    };
  }

  try {
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token.trim(),
        remoteip: remoteIp || '',
      }),
    });
    if (!verifyRes.ok) {
      return { success: false, error: 'Gagal memvalidasi token Cloudflare Turnstile.' };
    }
    const data: any = await verifyRes.json();
    if (data && data.success === true) {
      return { success: true };
    }
    return { success: false, error: 'Verifikasi bot Cloudflare Turnstile gagal atau kedaluwarsa. Silakan ulangi verifikasi.' };
  } catch (err) {
    console.error('[Turnstile Verify Error]:', err);
    return { success: false, error: 'Layanan verifikasi Cloudflare Turnstile tidak dapat dijangkau.' };
  }
}

async function sendMailWithActiveSmtp(params: {
  to: string;
  subject: string;
  html: string;
  attachments?: any[];
}): Promise<{ sent: boolean; usedAccount?: string; error?: string }> {
  const smtp = db.getSmtpConfig();
  if (!smtp.enabled) {
    return { sent: false, error: 'Layanan email SMTP belum diaktifkan oleh administrator yayasan.' };
  }

  const accounts = db.getDecryptedSmtpAccounts().filter((a) => a.isActive && a.authPassword);
  if (accounts.length === 0) {
    return { sent: false, error: 'Belum ada akun SMTP aktif dengan App Password yang dikonfigurasi.' };
  }

  let lastError = '';
  for (const acc of accounts) {
    try {
      const transporter = nodemailer.createTransport({
        host: acc.host || 'smtp.gmail.com',
        port: acc.port || 465,
        secure: acc.secure !== undefined ? acc.secure : true,
        auth: {
          user: acc.senderEmail,
          pass: acc.authPassword.replace(/\s+/g, ''),
        },
        connectionTimeout: 9000,
      });

      await transporter.sendMail({
        from: `"${acc.senderName || smtp.senderName || 'PPDB Yayasan Ar-Risalah'}" <${acc.senderEmail}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
        attachments: params.attachments,
      });
      return { sent: true, usedAccount: acc.senderEmail };
    } catch (err: any) {
      lastError = err?.message || 'Gagal terhubung ke server SMTP.';
    }
  }
  return { sent: false, error: lastError || 'Gagal mengirim email melalui seluruh akun SMTP.' };
}

/**
 * Server-side generation of Kartu Peserta Ujian PDF for email attachments
 */
async function generateStudentCardPdfBuffer(
  student: any,
  schedule: any,
  landingConfig: any,
  letterConfigs?: any[],
  formSchemas?: any[]
): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const allLetters = letterConfigs || db.getLetterConfigs();
  const allSchemas = formSchemas || db.getFormSchemas();
  const letterConfig =
    allLetters.find((l: any) => l.unitId === student.unit) ||
    allLetters.find((l: any) => l.unitId === 'MASTER') || {
      committeeChairName: 'Ustadz Dr. Rahmat Hidayat, M.A',
      committeeChairNip: 'NIPY. 19850412 201001 1 002',
      committeeRoleTitle: 'Ketua Panitia PPDB Yayasan',
      letterHeaderTitle: 'PANITIA PENERIMAAN PESERTA DIDIK BARU (PPDB)',
      cardTitle: 'KARTU TANDA PESERTA UJIAN & OBSERVASI PPDB',
      issueLocation: 'Bireuen',
      issueDate: todayFormatted,
      examInstructions: [
        '1. Peserta wajib hadir 15 menit sebelum pelaksanaan ujian seleksi dimulai.',
        '2. Membawa Kartu Tanda Peserta ini (cetak fisik) dan alat tulis secukupnya.',
        '3. Berpakaian sopan, rapi, dan menutup aurat (busana muslim/muslimah).',
        '4. Orang tua/wali santri wajib mendampingi ananda saat sesi wawancara orang tua.',
      ],
      stampNote: 'Dokumen ini diterbitkan sah secara elektronik oleh Panitia PPDB Ar-Risalah Aceh.',
    };

  const pageWidth = doc.internal.pageSize.getWidth();
  const addressText = landingConfig?.contact?.address || 'Jl. BTN Kupula Indah, Geulanggang Gampong (Geulanggang Baro), Kec. Kota Juang, Kab. Bireuen, Aceh';
  const phoneText = landingConfig?.contact?.phone || landingConfig?.contact?.whatsapp || '0812-6900-1234';
  const emailText = landingConfig?.contact?.email || 'info@arrisalahaceh.or.id';

  // 1. Top Decorative Green Bar
  doc.setFillColor(20, 83, 45); // emerald-900
  doc.rect(0, 0, pageWidth, 6, 'F');
  doc.setFillColor(22, 163, 74); // emerald-600
  doc.rect(0, 6, pageWidth, 2, 'F');

  // 2. Kop Surat Yayasan
  doc.setTextColor(20, 83, 45);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('YAYASAN AR-RISALAH ACEH', pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  const headerTitleText = letterConfig.letterHeaderTitle || 'PANITIA PENERIMAAN PESERTA DIDIK BARU (PPDB)';
  doc.text(headerTitleText, pageWidth / 2, 23.5, { align: 'center' });

  const activeYearLabel = getActiveAcademicYearLabel(db.getAcademicYears());
  const activeUnitsLabel =
    db.getUnits().length > 0
      ? db.getUnits().map((u: any) => u.shortName).filter(Boolean).join(', ')
      : 'TKIT, SDIT, SMPIT & SMAIT';

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Tahun Ajaran ${activeYearLabel} · Jenjang ${activeUnitsLabel}`, pageWidth / 2, 28, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${addressText} | Telp/WA: ${phoneText}`, pageWidth / 2, 32.5, { align: 'center' });

  // Divider Lines
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.8);
  doc.line(14, 36, pageWidth - 14, 36);
  doc.setLineWidth(0.2);
  doc.line(14, 37.5, pageWidth - 14, 37.5);

  // 3. Title Card Header Box
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(14, 42, pageWidth - 28, 14, 3, 3, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, 42, pageWidth - 28, 14, 3, 3, 'D');

  doc.setTextColor(20, 83, 45);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const cardTitleText = letterConfig.cardTitle || 'KARTU TANDA PESERTA UJIAN & OBSERVASI PPDB';
  doc.text(cardTitleText, pageWidth / 2, 49, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(22, 101, 52);
  doc.text(`Unit Pilihan: ${student.unit} · Dokumen Resmi Verifikasi Peserta`, pageWidth / 2, 53.5, { align: 'center' });

  // 4. Registration Number Highlight Box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.6);
  doc.roundedRect(14, 60, pageWidth - 28, 16, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('NOMOR REGISTRASI PENDAFTARAN RESMI', 18, 66);

  doc.setFont('courier', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 83, 45);
  doc.text(String(student.registrationNumber || ''), 18, 72.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const regDateText = student.registeredAt ? `Terdaftar: ${student.registeredAt} WIB` : 'Status: Berkas Lengkap';
  doc.text(regDateText, pageWidth - 18, 71, { align: 'right' });

  // 5. Student Details Table (Synced with Pengaturan Surat & Form Builder)
  const unitFormSchema = allSchemas.find((s: any) => s.unitId === student.unit) || null;
  const computedRows = getCardBiodataRows(student, allLetters, unitFormSchema);
  const studentRows: [string, string][] =
    computedRows.length > 0
      ? computedRows
      : [['Data Biodata', ': Belum ada kolom biodata dipilih pada Pengaturan Surat unit']];

  autoTable(doc, {
    startY: 80,
    head: [['Biodata Calon Siswa', 'Keterangan']],
    body: studentRows,
    theme: 'plain',
    headStyles: {
      fillColor: [22, 163, 74],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 65, fontStyle: 'bold', textColor: [71, 85, 105] },
      1: { fontStyle: 'bold', textColor: [15, 23, 42] },
    },
    margin: { left: 14, right: 14 },
  });

  // 6. Schedule Details Box
  const pageHeight = doc.internal.pageSize.getHeight();
  let finalY = (doc as any).lastAutoTable?.finalY || 135;
  if (finalY + 95 > pageHeight - 14) {
    doc.addPage();
    finalY = 16;
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, finalY + 4, pageWidth - 28, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(20, 83, 45);
  doc.text('JADWAL & LOKASI UJIAN SELEKSI / OBSERVASI', 18, finalY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  if (schedule) {
    doc.text(`• Tanggal & Waktu  : ${schedule.date} (Pukul ${schedule.startTime} - ${schedule.endTime} WIB)`, 18, finalY + 16.5);
    doc.text(`• Ruangan / Tempat : ${schedule.room} (Kampus Yayasan Ar-Risalah Aceh)`, 18, finalY + 21.5);
    if (schedule.examiner) {
      doc.text(`• Tim Penguji     : ${schedule.examiner}`, 18, finalY + 26.5);
    }
  } else {
    doc.text('• Tanggal & Waktu  : Mengikuti jadwal gelombang observasi unit (dapat dicek berkala di portal)', 18, finalY + 16.5);
    doc.text('• Ruangan / Tempat : Kampus Terpadu Yayasan Ar-Risalah Aceh', 18, finalY + 21.5);
  }

  // 7. Tata Tertib Ringkas (Dynamic from LetterConfig)
  const rulesY = finalY + 32;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(20, 83, 45);
  doc.text('TATA TERTIB PESERTA UJIAN:', 14, rulesY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  const instructions: string[] =
    Array.isArray(letterConfig.examInstructions) && letterConfig.examInstructions.length > 0
      ? letterConfig.examInstructions
      : [
          '1. Peserta wajib hadir 15 menit sebelum pelaksanaan ujian seleksi dimulai.',
          '2. Membawa Kartu Tanda Peserta ini (cetak fisik) dan alat tulis secukupnya.',
          '3. Berpakaian sopan, rapi, dan menutup aurat (busana muslim/muslimah).',
          '4. Orang tua/wali santri wajib mendampingi ananda saat sesi wawancara orang tua.',
        ];

  instructions.slice(0, 4).forEach((inst, idx) => {
    doc.text(inst, 14, rulesY + 4.5 + idx * 4);
  });

  // 8. Signature Block (Dynamic Chair Name & Role with Online TTD QR Code)
  const sigY = rulesY + 26;
  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const locationText = letterConfig.issueLocation || 'Bireuen';
  const issueDateText = letterConfig.issueDate || todayStr;
  const chairTitleText = letterConfig.committeeRoleTitle || 'Ketua Panitia PPDB';
  const chairNameText = letterConfig.committeeChairName || 'Ustadz Dr. Rahmat Hidayat, M.A';

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Mengetahui,', 30, sigY, { align: 'center' });
  doc.text('Orang Tua / Wali Siswa,', 30, sigY + 4.5, { align: 'center' });

  doc.text(`${locationText}, ${issueDateText}`, pageWidth - 40, sigY, { align: 'center' });
  doc.text(`${chairTitleText},`, pageWidth - 40, sigY + 4.5, { align: 'center' });

  // Generate QR Code for online verification
  const baseUrl = process.env.APP_URL || 'https://ppdb.arrisalahaceh.or.id';
  const verifyUrl = `${baseUrl}/#verify-ttd?reg=${encodeURIComponent(student.registrationNumber || '')}`;

  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 160,
      margin: 1,
      color: { dark: '#14532d', light: '#ffffff' },
    });
  } catch (err) {
    console.error('QR code generation error:', err);
  }

  const resolvedGuardian = resolveGuardianSummaryFromSchema(student, unitFormSchema);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`( ${resolvedGuardian.name || student.parentName || 'Wali Siswa'} )`, 30, sigY + 32, { align: 'center' });

  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', pageWidth - 50, sigY + 6.5, 20, 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(`( ${chairNameText} )`, pageWidth - 40, sigY + 30, { align: 'center' });

    if (letterConfig.committeeChairNip) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(letterConfig.committeeChairNip, pageWidth - 40, sigY + 34, { align: 'center' });
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.text(`( ${chairNameText} )`, pageWidth - 40, sigY + 32, { align: 'center' });
    if (letterConfig.committeeChairNip) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(letterConfig.committeeChairNip, pageWidth - 40, sigY + 36, { align: 'center' });
    }
  }

  // 9. Footer Note (Dynamic from DB)
  doc.setFillColor(240, 253, 244);
  doc.rect(0, doc.internal.pageSize.getHeight() - 10, pageWidth, 10, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(22, 101, 52);
  doc.text(
    `Sekretariat: ${addressText} · Email: ${emailText}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 4,
    { align: 'center' }
  );

  return Buffer.from(doc.output('arraybuffer'));
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const isBuiltBundle = import.meta.url.endsWith('.mjs') || import.meta.url.endsWith('.js');
const rawAppMode = (process.env.APP_MODE || process.env.NODE_ENV || '').trim().toLowerCase();
const isProd = rawAppMode === 'production' || (isBuiltBundle && rawAppMode !== 'development');

// Disable X-Powered-By header fingerprinting
app.disable('x-powered-by');

// Enable trust proxy for reverse proxies (Nginx, Apache, Cloud Run, Cloudflare)
const trustProxyEnv = (process.env.TRUST_PROXY || '').trim().toLowerCase();
app.set('trust proxy', trustProxyEnv === '0' || trustProxyEnv === 'false' ? false : Number(trustProxyEnv) || 1);

// ==============================================================
// HttpOnly Session Cookie & HMAC-Bound CSRF Token Utilities
// ==============================================================
const SESSION_COOKIE_NAME = 'ppdb_session';
const CSRF_COOKIE_NAME = 'ppdb_csrf';
const SESSION_COOKIE_MAX_AGE_SEC = 7 * 24 * 60 * 60;
const CSRF_HMAC_SECRET = crypto
  .createHash('sha256')
  .update(`csrf:${process.env.SESSION_SECRET || 'ppdb_arrisalah_aceh_session_secret_2026'}`)
  .digest('hex');

const RECEIPT_HMAC_SECRET = crypto
  .createHash('sha256')
  .update(`receipt:${process.env.SESSION_SECRET || 'ppdb_arrisalah_aceh_session_secret_2026'}`)
  .digest('hex');

function computeReceiptSignature(paymentId: string, registrationNumber: string): string {
  return crypto
    .createHmac('sha256', RECEIPT_HMAC_SECRET)
    .update(`${String(paymentId).trim()}:${String(registrationNumber || '').trim().toUpperCase()}`)
    .digest('hex')
    .slice(0, 24);
}

function attachReceiptSig<T extends { id: string; registrationNumber: string; status: string }>(pay: T): T & { receiptSig?: string } {
  if (pay && pay.status === 'lunas' && pay.id && pay.registrationNumber) {
    return { ...pay, receiptSig: computeReceiptSignature(pay.id, pay.registrationNumber) };
  }
  return pay;
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return result;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (!key || key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

function computeCsrfToken(sessionToken: string): string {
  return crypto.createHmac('sha256', CSRF_HMAC_SECRET).update(sessionToken).digest('hex');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

function getEffectiveHost(req: Request): string {
  const fwdHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim().toLowerCase();
  return fwdHost || String(req.get('host') || '').toLowerCase();
}

function isSecureCookieContext(req: Request): boolean {
  const protoHeader = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const originHeader = String(req.headers.origin || '').toLowerCase();
  const refererHeader = String(req.headers.referer || '').toLowerCase();
  const appUrlEnv = String(process.env.APP_URL || '').toLowerCase();
  const effectiveHost = getEffectiveHost(req);
  const isLocalHost = effectiveHost.startsWith('localhost') || effectiveHost.startsWith('127.0.0.1');
  return Boolean(
    req.secure ||
      protoHeader.includes('https') ||
      originHeader.startsWith('https://') ||
      refererHeader.startsWith('https://') ||
      (appUrlEnv.startsWith('https://') && !isLocalHost)
  );
}

function isCrossSiteIframeContext(req: Request): boolean {
  const effectiveHost = getEffectiveHost(req);
  const appUrlEnv = String(process.env.APP_URL || '').toLowerCase();
  const secFetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  const secFetchDest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
  return Boolean(
    effectiveHost.includes('ais-dev-') ||
      effectiveHost.includes('ais-pre-') ||
      effectiveHost.endsWith('.run.app') ||
      appUrlEnv.includes('ais-dev-') ||
      appUrlEnv.includes('ais-pre-') ||
      appUrlEnv.includes('.run.app') ||
      secFetchSite === 'cross-site' ||
      secFetchDest === 'iframe'
  );
}

function resolveCookieSameSite(req: Request): {
  sameSite: 'Strict' | 'Lax' | 'None';
  secure: boolean;
  partitioned: boolean;
} {
  const secure = isSecureCookieContext(req);
  // In development mode or cross-site iframes (such as AI Studio preview/shared URLs),
  // avoid blocking cookies with SameSite=Lax/Strict; use SameSite=None; Secure; Partitioned on HTTPS.
  if (secure && (!isProd || isCrossSiteIframeContext(req))) {
    return { sameSite: 'None', secure: true, partitioned: true };
  }
  if (!isProd) {
    return { sameSite: 'Lax', secure: false, partitioned: false };
  }
  const configured = (process.env.COOKIE_SAMESITE || '').trim().toLowerCase();
  if (configured === 'strict') {
    return { sameSite: 'Strict', secure, partitioned: false };
  }
  if (configured === 'lax') {
    return { sameSite: 'Lax', secure, partitioned: false };
  }
  if (secure) {
    return { sameSite: 'None', secure: true, partitioned: true };
  }
  return { sameSite: 'Lax', secure: false, partitioned: false };
}

function serializeCookie(
  name: string,
  value: string,
  opts: {
    maxAgeSeconds: number;
    httpOnly: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
    secure: boolean;
    partitioned?: boolean;
  }
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${opts.maxAgeSeconds}`,
    `SameSite=${opts.sameSite}`,
  ];
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.partitioned && opts.sameSite === 'None' && opts.secure) {
    parts.push('Partitioned');
  }
  return parts.join('; ');
}

function setAuthCookies(req: Request, res: Response, sessionToken: string): string {
  const csrfToken = computeCsrfToken(sessionToken);
  const { sameSite, secure, partitioned } = resolveCookieSameSite(req);
  res.setHeader('Set-Cookie', [
    serializeCookie(SESSION_COOKIE_NAME, sessionToken, {
      maxAgeSeconds: SESSION_COOKIE_MAX_AGE_SEC,
      httpOnly: true,
      sameSite,
      secure,
      partitioned,
    }),
    serializeCookie(CSRF_COOKIE_NAME, csrfToken, {
      maxAgeSeconds: SESSION_COOKIE_MAX_AGE_SEC,
      httpOnly: false,
      sameSite,
      secure,
      partitioned,
    }),
  ]);
  return csrfToken;
}

function clearAuthCookies(req: Request, res: Response): void {
  const { sameSite, secure, partitioned } = resolveCookieSameSite(req);
  res.setHeader('Set-Cookie', [
    serializeCookie(SESSION_COOKIE_NAME, '', { maxAgeSeconds: 0, httpOnly: true, sameSite, secure, partitioned }),
    serializeCookie(CSRF_COOKIE_NAME, '', { maxAgeSeconds: 0, httpOnly: false, sameSite, secure, partitioned }),
  ]);
}

function extractAuthFromRequest(req: Request): { token: string; source: 'cookie' | 'bearer' } | null {
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = typeof cookies[SESSION_COOKIE_NAME] === 'string' ? cookies[SESSION_COOKIE_NAME].trim() : '';
  if (cookieToken) {
    return { token: cookieToken, source: 'cookie' };
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken) {
      return { token: bearerToken, source: 'bearer' };
    }
  }
  return null;
}

function verifyCsrfForCookieMutation(req: Request, sessionToken: string): boolean {
  const csrfHeader = String(req.headers['x-csrf-token'] || '').trim();
  const expected = computeCsrfToken(sessionToken);
  return timingSafeEqualHex(csrfHeader, expected);
}

// 1. Security Headers Middleware (OWASP Defense in Depth)
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://challenges.cloudflare.com https://generativelanguage.googleapis.com; frame-src 'self' https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'"
  );
  if (isProd && (req.secure || req.headers['x-forwarded-proto'] === 'https')) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// 2. Origin-Allowlist CORS & Body Parser Middleware
const rawAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const allowAllOriginsWildcard = rawAllowedOrigins.includes('*');
const configuredAllowedOrigins = new Set<string>(
  [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.APP_URL || '',
    ...rawAllowedOrigins.filter((o) => o !== '*'),
  ]
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
);

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim().replace(/\/+$/, '') : '';
  if (!origin) {
    return next();
  }

  let isSameHostOrigin = false;
  let isDevAllowedOrigin = false;
  try {
    const parsedOrigin = new URL(origin);
    const reqHost = req.get('host');
    const fwdHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
    const origHost = String(req.headers['x-original-host'] || '').split(',')[0].trim();
    if (
      (reqHost && parsedOrigin.host === reqHost) ||
      (fwdHost && parsedOrigin.host === fwdHost) ||
      (origHost && parsedOrigin.host === origHost)
    ) {
      isSameHostOrigin = true;
    }
    if (
      !isProd &&
      (parsedOrigin.hostname === 'localhost' ||
        parsedOrigin.hostname === '127.0.0.1' ||
        parsedOrigin.hostname.endsWith('.run.app'))
    ) {
      isDevAllowedOrigin = true;
    }
  } catch {
    isSameHostOrigin = false;
    isDevAllowedOrigin = false;
  }

  // Never pair wildcard "*" with Access-Control-Allow-Credentials: true.
  // Explicit allowlisted / same-host / dev origins receive credentialed CORS;
  // ALLOWED_ORIGINS="*" permits public cross-domain requests via "*" without credentials.
  if (configuredAllowedOrigins.has(origin) || isSameHostOrigin || isDevAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-DB-Access-Token');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  }

  if (allowAllOriginsWildcard || !isProd) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-DB-Access-Token');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  }

  if (req.path.startsWith('/api')) {
    return res.status(403).json({ error: 'Akses CORS ditolak: Origin tidak terdaftar pada allowlist.' });
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Persistent uploads directory in data/uploads and public/uploads
const dataUploadsDir = path.resolve(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(dataUploadsDir)) {
  fs.mkdirSync(dataUploadsDir, { recursive: true });
}
const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Bi-directional synchronizer between persistent data/uploads and public/uploads
function syncUploadsDirectory() {
  try {
    if (fs.existsSync(dataUploadsDir)) {
      const dataFiles = fs.readdirSync(dataUploadsDir);
      for (const f of dataFiles) {
        const src = path.join(dataUploadsDir, f);
        const dst = path.join(uploadsDir, f);
        if (!fs.existsSync(dst)) {
          fs.copyFileSync(src, dst);
        }
      }
    }
    if (fs.existsSync(uploadsDir)) {
      const publicFiles = fs.readdirSync(uploadsDir);
      for (const f of publicFiles) {
        const src = path.join(uploadsDir, f);
        const dst = path.join(dataUploadsDir, f);
        if (!fs.existsSync(dst)) {
          fs.copyFileSync(src, dst);
        }
      }
    }
  } catch (err) {
    console.error('[UploadsSync Error]:', err);
  }
}

// Seed default official crest logo & favicon into persistent storage if not present
function seedDefaultUploadAssets() {
  const crestLogoSrc = path.resolve(process.cwd(), 'src', 'assets', 'images', 'logo_arrisalah_crest_1792900905994.jpg');
  if (fs.existsSync(crestLogoSrc)) {
    const targets = ['logo.png', 'logo.jpg', '1000828600.png'];
    for (const t of targets) {
      const pPub = path.join(uploadsDir, t);
      const pData = path.join(dataUploadsDir, t);
      if (!fs.existsSync(pPub)) {
        try { fs.copyFileSync(crestLogoSrc, pPub); } catch (e) {}
      }
      if (!fs.existsSync(pData)) {
        try { fs.copyFileSync(crestLogoSrc, pData); } catch (e) {}
      }
    }
  }
  const faviconTargets = ['favicon.ico', '1000828601.ico'];
  for (const t of faviconTargets) {
    const pPub = path.join(uploadsDir, t);
    const pData = path.join(dataUploadsDir, t);
    if (fs.existsSync(crestLogoSrc)) {
      if (!fs.existsSync(pPub)) {
        try { fs.copyFileSync(crestLogoSrc, pPub); } catch (e) {}
      }
      if (!fs.existsSync(pData)) {
        try { fs.copyFileSync(crestLogoSrc, pData); } catch (e) {}
      }
    }
  }
}

syncUploadsDirectory();
seedDefaultUploadAssets();

// Robust uploads serving with automated recovery from data/uploads and crest fallback
app.get('/uploads/:filename', (req: Request, res: Response, next: NextFunction) => {
  const safeFilename = path.basename(req.params.filename);
  const publicFile = path.join(uploadsDir, safeFilename);
  const dataFile = path.join(dataUploadsDir, safeFilename);

  if (fs.existsSync(publicFile)) {
    return res.sendFile(publicFile);
  }
  if (fs.existsSync(dataFile)) {
    try { fs.copyFileSync(dataFile, publicFile); } catch (e) {}
    return res.sendFile(dataFile);
  }

  // Auto-restore logo or favicon on-the-fly from landingConfig Base64 if file was cleaned on disk
  try {
    const landing = db.getLandingConfig();
    const currentLogoFile = landing?.logoUrl ? path.basename(landing.logoUrl) : '';
    const isLogoMatch = safeFilename === currentLogoFile || safeFilename.includes('logo') || (landing?.logoUrl && landing.logoUrl.includes(safeFilename));

    if (landing?.customLogoBase64 && isLogoMatch) {
      const logoBuf = Buffer.from(
        landing.customLogoBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, ''),
        'base64'
      );
      fs.writeFileSync(publicFile, logoBuf);
      try { fs.writeFileSync(dataFile, logoBuf); } catch (e) {}
      return res.sendFile(publicFile);
    }

    const currentFaviconFile = landing?.faviconUrl ? path.basename(landing.faviconUrl) : '';
    const isFaviconMatch = safeFilename === currentFaviconFile || safeFilename.includes('favicon') || (landing?.faviconUrl && landing.faviconUrl.includes(safeFilename));

    if (landing?.customFaviconBase64 && isFaviconMatch) {
      const favBuf = Buffer.from(
        landing.customFaviconBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, ''),
        'base64'
      );
      fs.writeFileSync(publicFile, favBuf);
      try { fs.writeFileSync(dataFile, favBuf); } catch (e) {}
      return res.sendFile(publicFile);
    }
  } catch (e) {}

  // Graceful fallback for logo or icon files ONLY if no custom uploaded logo exists
  if (safeFilename.includes('logo') || safeFilename.includes('1000828600')) {
    const defaultLogo = path.resolve(process.cwd(), 'src', 'assets', 'images', 'logo_arrisalah_crest_1792900905994.jpg');
    if (fs.existsSync(defaultLogo)) {
      return res.sendFile(defaultLogo);
    }
  }
  next();
});
app.use('/uploads', express.static(uploadsDir));

// 3. Robust In-Memory Rate Limiter with Session-Aware Tiering & Memory Eviction
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const requestCounts = new Map<string, RateLimitRecord>();
const authAttemptMap = new Map<string, RateLimitRecord>();
const realDbPinRateLimitMap = new Map<string, RateLimitRecord>();
const otpAttemptMap = new Map<string, RateLimitRecord>();
const lookupAttemptMap = new Map<string, RateLimitRecord>();
const uploadAttemptMap = new Map<string, RateLimitRecord>();

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes window
const MAX_REQUESTS_UNAUTH = 1000; // 1,000 requests per 5 minutes for public / unauthenticated
const MAX_REQUESTS_AUTH = 5000; // 5,000 requests per 5 minutes for active authenticated sessions (admin, staff, wali)

// Periodic Garbage Collection: purge expired entries every 60s to prevent memory leak
const memoryCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetTime) requestCounts.delete(key);
  }
  for (const [key, record] of authAttemptMap.entries()) {
    if (now > record.resetTime) authAttemptMap.delete(key);
  }
  for (const [key, record] of realDbPinRateLimitMap.entries()) {
    if (now > record.resetTime) realDbPinRateLimitMap.delete(key);
  }
  for (const [key, record] of otpAttemptMap.entries()) {
    if (now > record.resetTime) otpAttemptMap.delete(key);
  }
  for (const [key, record] of lookupAttemptMap.entries()) {
    if (now > record.resetTime) lookupAttemptMap.delete(key);
  }
  for (const [key, record] of uploadAttemptMap.entries()) {
    if (now > record.resetTime) uploadAttemptMap.delete(key);
  }
  db.cleanupExpiredSessions();
}, 60 * 1000);
memoryCleanupTimer.unref();

const createScopedLimiter = (
  map: Map<string, RateLimitRecord>,
  windowMs: number,
  maxRequests: number,
  errorMessage: string
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isProd) {
      return next();
    }
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userId = (req as AuthRequest).user?.id;
    const key = userId ? `u_${userId}` : `ip_${ip}`;
    const now = Date.now();
    const rec = map.get(key);
    if (!rec || now > rec.resetTime) {
      map.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    if (rec.count >= maxRequests) {
      return res.status(429).json({ error: errorMessage });
    }
    rec.count++;
    next();
  };
};

const otpRateLimiter = createScopedLimiter(
  otpAttemptMap,
  10 * 60 * 1000,
  10,
  'Terlalu banyak permintaan kode OTP. Silakan tunggu beberapa menit.'
);
const lookupRateLimiter = createScopedLimiter(
  lookupAttemptMap,
  5 * 60 * 1000,
  30,
  'Terlalu banyak permintaan pengecekan status. Silakan tunggu 5 menit.'
);
const uploadRateLimiter = createScopedLimiter(
  uploadAttemptMap,
  5 * 60 * 1000,
  40,
  'Terlalu banyak unggahan berkas dalam waktu singkat. Silakan coba lagi sebentar.'
);

const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  // Always permit system diagnostics & health probes, and bypass general throttling in development mode
  const path = req.path || '';
  if (!isProd || path.includes('/health') || path.includes('/db-status')) {
    return next();
  }

  // Derive client identity (HttpOnly cookie or Bearer session token priority, fallback to client IP)
  const extractedAuth = extractAuthFromRequest(req);
  const isAuthSession = Boolean(extractedAuth && extractedAuth.token.startsWith('sess_'));
  const forwardedHeader = req.headers['x-forwarded-for'];
  const clientIp = typeof forwardedHeader === 'string'
    ? forwardedHeader.split(',')[0].trim()
    : (req.ip || req.socket.remoteAddress || '127.0.0.1');

  // Authenticated sessions are keyed by hashed token slice to isolate users behind shared proxies
  const clientKey = isAuthSession && extractedAuth
    ? `sess_${crypto.createHash('sha256').update(extractedAuth.token).digest('hex').slice(0, 24)}`
    : `ip_${clientIp}`;

  const maxAllowed = isAuthSession ? MAX_REQUESTS_AUTH : MAX_REQUESTS_UNAUTH;
  const now = Date.now();
  const clientData = requestCounts.get(clientKey);

  if (!clientData || now > clientData.resetTime) {
    // Prevent Map unbounded growth under DDoS
    if (requestCounts.size > 5000) {
      for (const [k, r] of requestCounts.entries()) {
        if (now > r.resetTime) requestCounts.delete(k);
      }
    }
    requestCounts.set(clientKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (clientData.count >= maxAllowed) {
    const remainingSeconds = Math.max(1, Math.ceil((clientData.resetTime - now) / 1000));
    return res.status(429).json({
      error: `Terlalu banyak permintaan (Rate limit exceeded). Silakan coba lagi dalam ${remainingSeconds} detik.`,
    });
  }

  clientData.count++;
  next();
};

app.use('/api', rateLimiter);

// 4. API Endpoints

// System Status & MySQL Database Diagnostic
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'PPDB Yayasan Ar-Risalah Aceh API',
  });
});

app.get('/api/db-status', (req: Request, res: Response) => {
  const status = db.getDbStatus();
  res.json(status);
});

// -------------------------------------------------------------
// Authentication Endpoints (Unified 1-Form Login & Token System)
// -------------------------------------------------------------
const AUTH_RATE_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_AUTH_ATTEMPTS = isProd ? 15 : 100; // 15 attempts/min in production; 100/min in development

const authRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const attempts = authAttemptMap.get(ip);

  if (!attempts || now > attempts.resetTime) {
    authAttemptMap.set(ip, { count: 1, resetTime: now + AUTH_RATE_WINDOW_MS });
    return next();
  }

  if (attempts.count >= MAX_AUTH_ATTEMPTS) {
    return res.status(429).json({
      error: 'Terlalu banyak percobaan masuk. Demi keamanan, silakan tunggu 1 menit.',
    });
  }

  attempts.count++;
  next();
};

app.post('/api/auth/login', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { identifier, password, turnstileToken } = req.body || {};
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

    const cfCheck = await verifyTurnstileServer(turnstileToken, ip);
    if (!cfCheck.success) {
      return res.status(400).json({ error: cfCheck.error });
    }

    if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
      return res.status(400).json({
        error: 'Identitas masuk (Email / No. WhatsApp / No. Pendaftaran) wajib diisi.',
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        error: 'Kata sandi atau PIN akun wajib diisi.',
      });
    }

    const result = await db.authenticateUser(identifier, password, ip);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    const csrfToken = setAuthCookies(req, res, result.token!);

    res.json({
      success: true,
      user: result.user,
      csrfToken,
      expiresAt: result.expiresAt,
    });
  } catch (err: any) {
    console.error('[API Auth Error]:', err);
    res.status(500).json({ error: 'Terjadi kesalahan sistem saat memproses autentikasi.' });
  }
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const auth = extractAuthFromRequest(req);
  if (!auth) {
    return res.status(401).json({ error: 'Sesi tidak ditemukan atau kedaluwarsa.' });
  }

  const user = db.verifySessionToken(auth.token);
  if (!user) {
    if (auth.source === 'cookie') {
      clearAuthCookies(req, res);
    }
    return res.status(401).json({ error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' });
  }

  const csrfToken = setAuthCookies(req, res, auth.token);
  res.json({ user, csrfToken });
});

app.post('/api/auth/demo-login', authRateLimiter, (req: Request, res: Response) => {
  try {
    if (process.env.ENABLE_DEMO_LOGIN !== 'true') {
      return res.status(403).json({
        error: 'Fitur demo login dinonaktifkan pada mode produksi. Silakan masuk menggunakan email dan kata sandi resmi Anda.',
      });
    }
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email wajib disertakan.' });
    }

    const allUsers = db.getUsers();
    const cleanEmail = String(email).trim().toLowerCase();
    const target = allUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!target) {
      return res.status(404).json({ error: `Akun dengan email "${cleanEmail}" tidak ditemukan di database.` });
    }

    if (!target.isActive) {
      return res.status(403).json({ error: 'Akun ini sedang dinonaktifkan oleh administrator yayasan.' });
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const session = db.createSessionForUser(target, ip);
    addAuditLog('login', target.schoolId, `Demo login terverifikasi: ${target.name} (${target.role})`, target.email, ip);

    const csrfToken = setAuthCookies(req, res, session.token);

    res.json({
      success: true,
      user: target,
      csrfToken,
      expiresAt: session.expiresAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Gagal membuat sesi demo.' });
  }
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const auth = extractAuthFromRequest(req);
  if (auth) {
    const activeUser = db.verifySessionToken(auth.token);
    if (activeUser && auth.source === 'cookie' && !verifyCsrfForCookieMutation(req, auth.token)) {
      return res.status(403).json({ error: 'Validasi CSRF logout gagal.' });
    }
    db.revokeSessionToken(auth.token);
    if (activeUser) {
      addAuditLog(
        'logout',
        activeUser.schoolId || 'MASTER',
        `Keluar dari sesi portal: ${activeUser.name} (${activeUser.role})`,
        activeUser.email,
        req.ip || '127.0.0.1'
      );
    }
  }
  clearAuthCookies(req, res);
  res.json({ success: true, message: 'Berhasil keluar.' });
});

// One-Time Cryptographic Password Reset Endpoints (Anti-Enumeration & SHA-256 Token)
app.post('/api/auth/forgot-password', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { identifier, email, turnstileToken } = req.body || {};
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

    const cfCheck = await verifyTurnstileServer(turnstileToken, ip);
    if (!cfCheck.success) {
      return res.status(400).json({ error: cfCheck.error });
    }

    const targetIdent = String(identifier || email || '').trim();
    if (!targetIdent || targetIdent.length > 180) {
      return res.status(400).json({ error: 'Alamat email akun wajib diisi dengan benar.' });
    }

    const genericSuccessResponse = {
      success: true,
      message:
        'Jika alamat email tersebut terdaftar dan aktif, tautan reset kata sandi sekali pakai telah dikirimkan (berlaku 15 menit).',
    };

    const tokenResult = db.createPasswordResetToken(targetIdent);
    if (!tokenResult.success) {
      if ((tokenResult as any).cooldownSeconds) {
        return res.status(429).json({
          error: tokenResult.error,
          cooldownSeconds: (tokenResult as any).cooldownSeconds,
        });
      }
      return res.json(genericSuccessResponse);
    }

    const appBaseUrl =
      (process.env.APP_URL && process.env.APP_URL.trim().replace(/\/+$/, '')) ||
      `${req.protocol}://${req.get('host')}`;
    const resetLink = `${appBaseUrl}/?resetToken=${encodeURIComponent(tokenResult.rawToken)}`;

    const mailOutcome = await sendMailWithActiveSmtp({
      to: tokenResult.user.email,
      subject: '🔐 Reset Kata Sandi Portal PPDB Yayasan Ar-Risalah Aceh (Berlaku 15 Menit)',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; border: 1px solid #16a34a; border-radius: 16px; overflow: hidden; background: #ffffff;">
          <div style="background-color: #14532d; color: white; padding: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px;">YAYASAN AR-RISALAH ACEH</h2>
            <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Permintaan Reset Kata Sandi Portal PPDB</p>
          </div>
          <div style="padding: 28px 24px; color: #1e293b;">
            <p style="font-size: 14px; line-height: 1.6;">
              Assalamu'alaikum <strong>${escapeHtml(tokenResult.user.name)}</strong>,<br/>
              Kami menerima permintaan pengaturan ulang kata sandi untuk akun <strong>${escapeHtml(tokenResult.user.email)}</strong>.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${escapeHtml(resetLink)}" style="display: inline-block; background-color: #15803d; color: #ffffff; text-decoration: none; font-weight: bold; padding: 14px 26px; border-radius: 10px; font-size: 14px;">
                Atur Ulang Kata Sandi Sekarang
              </a>
            </div>
            <p style="font-size: 12px; color: #64748b; word-break: break-all;">
              Jika tombol tidak berfungsi, salin tautan ini ke browser:<br/>${escapeHtml(resetLink)}
            </p>
            <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 12px; font-size: 12px; color: #92400e; margin-top: 16px;">
              Tautan ini hanya berlaku <strong>15 menit</strong> untuk <strong>1 kali penggunaan</strong>. Abaikan email ini jika Anda tidak merasa meminta reset kata sandi.
            </div>
          </div>
        </div>
      `,
    });

    if (!mailOutcome.sent) {
      addAuditLog(
        'smtp_config',
        tokenResult.user.schoolId || 'MASTER',
        `Pengiriman email reset kata sandi untuk ${tokenResult.user.email} gagal: ${mailOutcome.error}`,
        tokenResult.user.email,
        ip
      );
      return res.status(503).json({
        error: 'Layanan pengiriman email (SMTP) sedang tidak aktif atau bermasalah. Silakan hubungi administrator yayasan.',
      });
    }

    addAuditLog(
      'update_status',
      tokenResult.user.schoolId || 'MASTER',
      `Tautan reset kata sandi sekali pakai dikirim ke ${tokenResult.user.email}`,
      tokenResult.user.email,
      ip
    );

    res.json(genericSuccessResponse);
  } catch (err: any) {
    console.error('[Forgot Password Error]:', err);
    res.status(500).json({ error: 'Gagal memproses permintaan reset kata sandi.' });
  }
});

app.get('/api/auth/verify-reset-token', (req: Request, res: Response) => {
  const token = String(req.query.token || '').trim();
  const result = db.verifyPasswordResetToken(token);
  if (!result.valid) {
    return res.status(400).json(result);
  }
  res.json(result);
});

app.post('/api/auth/reset-password', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body || {};
    if (typeof token !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Token reset dan kata sandi baru wajib diisi.' });
    }
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const result = await db.consumePasswordResetToken(token, newPassword, ip);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (err: any) {
    console.error('[Reset Password Error]:', err);
    res.status(500).json({ error: 'Gagal memperbarui kata sandi baru.' });
  }
});

// =========================================================================
// SECURITY MIDDLEWARE SUITE (OWASP Defense-in-Depth, Deny-by-Default, RBAC)
// =========================================================================

interface AuthRequest extends Request {
  user?: any;
}

// 1. Mandatory Authentication + Cookie CSRF Middleware
const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const auth = extractAuthFromRequest(req);
  if (!auth) {
    return res.status(401).json({
      error: 'Autentikasi Diperlukan (401 Unauthorized): Sesi tidak ditemukan.',
    });
  }

  const user = db.verifySessionToken(auth.token);
  if (!user) {
    if (auth.source === 'cookie') {
      clearAuthCookies(req, res);
    }
    return res.status(401).json({
      error: 'Sesi Tidak Valid (401 Unauthorized): Sesi kedaluwarsa atau dicabut. Silakan login kembali.',
    });
  }

  if (!user.isActive) {
    if (auth.source === 'cookie') {
      clearAuthCookies(req, res);
    }
    return res.status(403).json({
      error: 'Akun Dinonaktifkan (403 Forbidden): Akun Anda telah dinonaktifkan oleh administrator yayasan.',
    });
  }

  // Enforce CSRF check on all cookie-authenticated mutating requests
  if (auth.source === 'cookie' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
    if (!verifyCsrfForCookieMutation(req, auth.token)) {
      return res.status(403).json({
        error: 'Validasi Keamanan CSRF Gagal (403 Forbidden): Token CSRF tidak cocok atau tidak disertakan. Silakan muat ulang halaman.',
      });
    }
  }

  req.user = user;
  next();
};

// Optional auth for public routes (e.g. GET roles, POST students)
const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const auth = extractAuthFromRequest(req);
  if (auth) {
    const user = db.verifySessionToken(auth.token);
    if (user && user.isActive) {
      if (auth.source === 'cookie' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
        if (!verifyCsrfForCookieMutation(req, auth.token)) {
          return res.status(403).json({
            error: 'Validasi Keamanan CSRF Gagal (403 Forbidden): Token CSRF tidak cocok atau tidak disertakan.',
          });
        }
      }
      req.user = user;
    }
  }
  next();
};

// 2. Role-Based Authorization Middleware
const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autentikasi diperlukan.' });
    }

    if (req.user.role === 'Super Admin Yayasan' || allowedRoles.includes(req.user.role)) {
      return next();
    }

    addAuditLog(
      'unauthorized_access' as any,
      req.user.schoolId || 'MASTER',
      `Percobaan akses tidak sah: Role "${req.user.role}" mencoba mengakses endpoint terproteksi ${req.path}`,
      req.user.email,
      req.ip || '127.0.0.1'
    );

    return res.status(403).json({
      error: `Akses Ditolak (403 Forbidden): Role Anda (${req.user.role}) tidak memiliki izin untuk operasi ini.`,
    });
  };
};

// 3. Granular Permission Middleware
const requirePermission = (moduleName: string, action?: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autentikasi diperlukan.' });
    }

    if (req.user.role === 'Super Admin Yayasan') {
      return next();
    }

    const permissions: string[] = req.user.permissions || [];

    // Full module permission check
    if (permissions.includes(moduleName)) {
      return next();
    }

    if (action) {
      const actionKey = `${moduleName}:${action}`;
      if (permissions.includes(actionKey)) {
        return next();
      }
    } else {
      // Any permission for this module (e.g. moduleName:view, moduleName:edit, etc.)
      const hasAnyAction = permissions.some(
        (p) => p === moduleName || p.startsWith(`${moduleName}:`)
      );
      if (hasAnyAction) {
        return next();
      }
    }

    addAuditLog(
      'unauthorized_access' as any,
      req.user.schoolId || 'MASTER',
      `Izin Ditolak: "${req.user.email}" (Role: ${req.user.role}) membutuhkan izin "${action ? `${moduleName}:${action}` : moduleName}" pada ${req.path}`,
      req.user.email,
      req.ip || '127.0.0.1'
    );

    return res.status(403).json({
      error: `Akses Ditolak (403 Forbidden): Anda tidak memiliki izin ${action ? `"${action}"` : 'akses'} pada modul ${moduleName}.`,
    });
  };
};

// 4. Master / Yayasan Scope Middleware (Explicit Yayasan Admin roles ONLY - never by schoolId alone)
const requireMaster = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Autentikasi diperlukan.' });
  }

  const roleLower = (req.user.role || '').toLowerCase();
  const isWali = isWaliRoleName(req.user.role);
  const isMaster =
    !isWali &&
    (req.user.role === 'Super Admin Yayasan' ||
      req.user.role === 'Admin Yayasan' ||
      roleLower.includes('super admin') ||
      roleLower.includes('admin yayasan'));

  if (!isMaster) {
    return res.status(403).json({
      error: 'Akses Ditolak (403 Forbidden): Modul ini khusus Administrator Yayasan (Master).',
    });
  }

  next();
};

// 5. Unit Isolation Middleware (Prevents BOLA / IDOR across school units)
const requireUnitIsolation = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Autentikasi diperlukan.' });
  }

  if (isWaliRoleName(req.user.role)) {
    return res.status(403).json({
      error: 'Akses Ditolak (403 Forbidden): Akun Wali Siswa tidak diizinkan mengakses endpoint staf.',
    });
  }

  // Master users can access all units
  if (
    req.user.role === 'Super Admin Yayasan' ||
    (req.user.role || '').toLowerCase().includes('admin yayasan') ||
    (req.user.schoolId === 'MASTER' && !isWaliRoleName(req.user.role))
  ) {
    return next();
  }

  const userUnit = req.user.schoolId;

  // Verify route parameter unitId or unit id in /api/units/:id/...
  const paramUnit = req.params.unitId || (req.path.includes('/units/') ? req.params.id : undefined);
  if (paramUnit && paramUnit !== userUnit) {
    return res.status(403).json({
      error: `Pelanggaran Batas Unit (BOLA): Anda (${userUnit}) dilarang mengubah konfigurasi unit ${paramUnit}.`,
    });
  }

  // Verify query unit
  if (req.query.unit && req.query.unit !== 'all' && req.query.unit !== userUnit) {
    return res.status(403).json({
      error: `Pelanggaran Batas Unit: Anda tidak memiliki wewenang melihat data unit ${req.query.unit}.`,
    });
  }

  // Verify body unit if present
  if (req.body && req.body.unit && req.body.unit !== userUnit) {
    return res.status(403).json({
      error: `Pelanggaran Batas Unit: Tidak dapat mengarahkan operasi ke unit ${req.body.unit}.`,
    });
  }

  // If targeting a specific student ID
  if (req.params.id && (req.baseUrl?.includes('students') || req.path.includes('/students/'))) {
    const student = db.getStudentById(req.params.id);
    if (student && student.unit !== userUnit) {
      return res.status(403).json({
        error: `Pelanggaran Privasi Siswa (IDOR): Siswa ini terdaftar di unit ${student.unit}, bukan di unit Anda (${userUnit}).`,
      });
    }
  }

  // If targeting a schedule ID
  if (req.params.id && req.path.includes('/schedules/')) {
    const allSchedules = db.getSchedules();
    const sch = allSchedules.find((s) => s.id === req.params.id);
    if (sch && sch.unit !== userUnit) {
      return res.status(403).json({
        error: `Pelanggaran Batas Unit: Jadwal tes ini milik unit ${sch.unit}.`,
      });
    }
  }

  next();
};

// =========================================================================
// PROTECTED API ENDPOINTS
// =========================================================================

function isWaliRoleName(role?: string): boolean {
  const r = (role || '').toLowerCase();
  return r === 'wali siswa' || r === 'wali santri' || r === 'wali murid' || r.includes('wali');
}

function studentBelongsToWali(student: any, user: any): boolean {
  if (!student || !user) return false;
  return Boolean(
    (student.parentUserId && student.parentUserId === user.id) ||
      (Array.isArray(user.childrenIds) && user.childrenIds.includes(student.id)) ||
      (user.studentId && user.studentId === student.id) ||
      (user.studentRegistrationNumber && student.registrationNumber === user.studentRegistrationNumber)
  );
}

const STUDENT_STAFF_MODULES = ['Dashboard', 'Pendaftar', 'Verifikasi', 'Jadwal', 'Kelulusan', 'Pembayaran', 'Laporan'];
const PAYMENT_STAFF_MODULES = ['Dashboard', 'Pembayaran', 'Laporan'];

function userHasAnyModulePermission(user: any, modules: string[]): boolean {
  if (!user) return false;
  if (user.role === 'Super Admin Yayasan') return true;
  const perms: string[] = Array.isArray(user.permissions) ? user.permissions : [];
  return modules.some((mod) => perms.some((p) => p === mod || p.startsWith(`${mod}:`)));
}

// Public API: Cek Status Pendaftaran siswa berdasarkan No. Registrasi atau NISN persis (tanpa pencarian nama & rate-limited)
app.get('/api/students/check-status', lookupRateLimiter, (req: Request, res: Response) => {
  const query = String(req.query.q || req.query.query || '').trim();
  const cleanQ = query.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
  if (!query || cleanQ.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Masukkan Nomor Pendaftaran resmi atau NISN minimal 6 karakter alfanumerik.',
    });
  }

  const allStudents = db.getStudents();
  const found = allStudents.find((s) => {
    const regClean = (s.registrationNumber || '').toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    const nisnClean = (s.nisn || '').toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    return regClean === cleanQ || (nisnClean.length >= 6 && nisnClean === cleanQ);
  });

  if (found) {
    const rawUnitSchema = db.getFormSchemas().find((fs) => fs.unitId === found.unit);
    const normUnitSchema = rawUnitSchema
      ? { ...rawUnitSchema, sections: ensureCoreNameFieldInSections(rawUnitSchema.sections, rawUnitSchema.unitId) }
      : undefined;
    const resolvedFullName = resolveStudentNameFromSchema(found, normUnitSchema);
    const safeStatus = {
      id: found.id,
      registrationNumber: found.registrationNumber,
      fullName: resolvedFullName,
      nisn: found.nisn,
      unit: found.unit,
      parentName: found.parentName,
      status: found.status,
      testScore: found.testPublished ? found.testScore : undefined,
      testPublished: found.testPublished,
      registeredAt: found.registeredAt,
    };
    return res.json({ success: true, student: safeStatus });
  } else {
    return res.json({
      success: false,
      message: `Data pendaftaran dengan nomor registrasi / NISN tersebut tidak ditemukan dalam database resmi PPDB.`,
    });
  }
});

// Students API (Protected + Strict RBAC / Ownership / Unit Isolation)
app.get('/api/students', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  let { unit, status, search } = req.query;

  if (isWaliRoleName(user.role)) {
    const allOwn = db.getStudents({
      unit: unit as string,
      status: status as string,
      search: search as string,
    }).filter((s) => studentBelongsToWali(s, user));
    return res.json(allOwn);
  }

  if (!userHasAnyModulePermission(user, STUDENT_STAFF_MODULES)) {
    return res.status(403).json({
      error: 'Akses Ditolak (403 Forbidden): Anda tidak memiliki izin melihat daftar data pendaftar.',
    });
  }

  // Enforce unit scope for non-master unit staff
  const isGlobalStaff =
    user.schoolId === 'MASTER' ||
    user.role === 'Super Admin Yayasan' ||
    user.role.includes('Admin Yayasan');
  if (!isGlobalStaff && user.schoolId) {
    unit = user.schoolId;
  }

  const list = db.getStudents({
    unit: unit as string,
    status: status as string,
    search: search as string,
  });
  res.json(list);
});

app.get('/api/students/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const student = db.getStudentById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Calon siswa tidak ditemukan.' });
  }

  if (isWaliRoleName(user.role)) {
    if (!studentBelongsToWali(student, user)) {
      return res.status(403).json({ error: 'Akses ditolak: Anda hanya berhak melihat data calon siswa milik Anda.' });
    }
    return res.json(student);
  }

  if (!userHasAnyModulePermission(user, STUDENT_STAFF_MODULES)) {
    return res.status(403).json({
      error: 'Akses Ditolak (403 Forbidden): Anda tidak memiliki izin melihat detail data pendaftar.',
    });
  }

  // Unit isolation check for staff
  if (user.schoolId !== 'MASTER' && user.role !== 'Super Admin Yayasan' && !user.role.includes('Admin Yayasan')) {
    if (student.unit !== user.schoolId) {
      return res.status(403).json({ error: 'Akses siswa unit lain ditolak.' });
    }
  }

  res.json(student);
});

// Create student: Public (from PPDB registration form) or Staff
app.post('/api/students', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      fullName,
      unit: rawUnit,
      parentName,
      parentPhone,
      parentJob,
      parentIncome,
      nisn,
      gender,
      birthPlace,
      birthDate,
      address,
      schoolOrigin,
      track,
      documents,
      dynamicAnswers,
    } = req.body || {};

    const unit = typeof rawUnit === 'string' ? rawUnit.trim().toUpperCase() : '';
    const allUnits = db.getUnits();
    const targetUnitConfig = allUnits.find((u) => u.id === unit);

    // Strict Input Validation
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0 || fullName.length > 200) {
      return res.status(400).json({ error: 'Nama lengkap calon siswa wajib diisi (maks 200 karakter).' });
    }
    if (!unit || !targetUnitConfig) {
      return res.status(400).json({ error: 'Pilihan unit sekolah tidak valid atau tidak terdaftar.' });
    }

    // Server-side guard: block public/Wali online registration if unit is closed OR quota is full
    const callerPerms: string[] = req.user?.permissions || [];
    const isAuthorizedStaffCreator =
      Boolean(req.user) &&
      !isWaliRoleName(req.user!.role) &&
      (req.user!.role === 'Super Admin Yayasan' ||
        callerPerms.includes('Pendaftar') ||
        callerPerms.includes('Pendaftar:add'));

    if (targetUnitConfig.isOpen === false && !isAuthorizedStaffCreator) {
      return res.status(403).json({
        error:
          targetUnitConfig.closedNotice ||
          `Pendaftaran untuk unit ${targetUnitConfig.name || unit} saat ini belum dibuka.`,
      });
    }

    const remainingQuota = Number(targetUnitConfig.totalQuota) - Number(targetUnitConfig.filledQuota);
    if (remainingQuota <= 0 && !isAuthorizedStaffCreator) {
      return res.status(409).json({
        error: `Kuota pendaftaran untuk unit ${targetUnitConfig.name || unit} telah penuh (${targetUnitConfig.filledQuota}/${targetUnitConfig.totalQuota} kursi terisi). Silakan hubungi panitia PPDB.`,
      });
    }

    if (parentName !== undefined && typeof parentName !== 'string') {
      return res.status(400).json({ error: 'Format nama orang tua tidak valid.' });
    }
    if (parentPhone !== undefined && typeof parentPhone !== 'string') {
      return res.status(400).json({ error: 'Format nomor telepon tidak valid.' });
    }

    let sanitizedNisn = '';
    if (nisn && typeof nisn === 'string' && nisn.trim().length > 0) {
      const cleanNisn = nisn.replace(/\D/g, '');
      if (cleanNisn.length !== 10) {
        return res.status(400).json({ error: 'NISN harus tepat 10 digit jika diisi.' });
      }

      // Deduplication Check 1: Unique NISN across all registered students
      const existingNisn = db.getStudents().find(
        (s) => s.nisn && s.nisn.trim() === cleanNisn
      );
      if (existingNisn) {
        return res.status(409).json({
          error: `Calon siswa dengan NISN ${cleanNisn} sudah terdaftar sebelumnya (No. Registrasi: ${existingNisn.registrationNumber}). Data tidak boleh duplikat.`,
        });
      }
      sanitizedNisn = cleanNisn;
    }

    // Deduplication Check 2: Unique Name + BirthDate + Unit combination
    if (fullName && birthDate && unit) {
      const cleanName = fullName.toLowerCase().trim();
      const existingDuplicate = db.getStudents().find((s) => {
        const matchName = s.fullName.toLowerCase().trim() === cleanName;
        const matchBirth = s.birthDate === birthDate;
        const matchUnit = s.unit === unit;
        return matchName && matchBirth && matchUnit;
      });

      if (existingDuplicate) {
        return res.status(409).json({
          error: `Calon siswa "${fullName}" dengan tanggal lahir ${birthDate} sudah terdaftar pada unit ${unit} (No. Registrasi: ${existingDuplicate.registrationNumber}). Menghindari pendaftaran ganda/duplikat.`,
        });
      }
    }

    // Sanitize documents & dynamicAnswers against XSS (SVG), fake magic bytes, and prototype pollution
    const isSafeCreateDocValue = (val: unknown): boolean => {
      if (val === '') return true;
      if (typeof val !== 'string') return false;
      if (val.length > 8 * 1024 * 1024) return false;
      if (val.startsWith('data:')) {
        return verifyDataUriPayload(val, { allowPdf: true }).ok;
      }
      return isSafeHttpUrl(val, true);
    };

    const sanitizedDocs: Record<string, string> = {};
    if (documents && typeof documents === 'object' && !Array.isArray(documents)) {
      for (const [k, v] of Object.entries(documents)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        if (v === undefined || v === null || v === '') continue;
        if (!isSafeCreateDocValue(v)) {
          return res.status(400).json({ error: `Format atau konten biner dokumen "${k}" tidak valid (hanya JPG/PNG/WEBP/PDF max 5MB).` });
        }
        sanitizedDocs[k] = String(v);
      }
    }

    const sanitizedAnswers: Record<string, any> = {};
    if (dynamicAnswers && typeof dynamicAnswers === 'object' && !Array.isArray(dynamicAnswers)) {
      for (const [k, v] of Object.entries(dynamicAnswers)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        if (typeof v === 'string' && v.startsWith('data:') && !isSafeCreateDocValue(v)) {
          return res.status(400).json({ error: `Format atau konten biner berkas pada kolom "${k}" tidak diizinkan (hanya JPG/PNG/WEBP/PDF max 5MB).` });
        }
        sanitizedAnswers[k] = v;
      }
    }

    // Whitelist payload strictly (block mass-assignment of status, testScore, testPublished, isOffline)
    const resolvedParentName = typeof parentName === 'string' && parentName.trim() ? parentName.trim().slice(0, 150) : '';
    const resolvedParentPhone = typeof parentPhone === 'string' && parentPhone.trim() ? parentPhone.trim().slice(0, 30) : '';
    const cleanPayload: Partial<any> = {
      fullName: fullName.trim(),
      nisn: sanitizedNisn,
      unit,
      gender: gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki',
      birthPlace: typeof birthPlace === 'string' ? birthPlace.trim().slice(0, 100) : '',
      birthDate: typeof birthDate === 'string' ? birthDate.trim().slice(0, 20) : '',
      address: typeof address === 'string' ? address.trim().slice(0, 500) : '',
      parentName: resolvedParentName,
      parentPhone: resolvedParentPhone,
      parentJob: typeof parentJob === 'string' ? parentJob.trim().slice(0, 100) : '',
      parentIncome: typeof parentIncome === 'string' ? parentIncome.trim().slice(0, 60) : '',
      schoolOrigin: typeof schoolOrigin === 'string' ? schoolOrigin.trim().slice(0, 150) : undefined,
      track: typeof track === 'string' ? track.trim().slice(0, 50) : undefined,
      parentUserId: req.user?.id || (isAuthorizedStaffCreator ? req.body.parentUserId : undefined),
      documents: sanitizedDocs,
      dynamicAnswers: sanitizedAnswers,
      isOffline: false,
    };

    const newStudent = await db.createStudent(cleanPayload);
    res.status(201).json(newStudent);
  } catch (err: any) {
    console.error('[API Create Student Error]:', err);
    res.status(500).json({ error: 'Gagal menyimpan pendaftaran siswa ke database.' });
  }
});

app.put('/api/students/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const existing = db.getStudentById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Calon siswa tidak ditemukan.' });
    }

    const user = req.user!;
    const isSuper = user.role === 'Super Admin Yayasan';
    const isWali = isWaliRoleName(user.role);

    let updatesPayload: Record<string, any> = req.body && typeof req.body === 'object' ? { ...req.body } : {};

    if (isWali) {
      if (!studentBelongsToWali(existing, user) && !isSuper) {
        return res.status(403).json({ error: 'Akses Ditolak: Anda hanya berhak mengubah data calon siswa milik Anda sendiri.' });
      }

      // Mass-assignment guard: Wali may only update biodata, parent contact, documents, and dynamicAnswers
      if (!isSuper) {
        const allowedWaliFields = [
          'fullName',
          'nisn',
          'gender',
          'birthPlace',
          'birthDate',
          'address',
          'schoolOrigin',
          'parentName',
          'parentPhone',
          'parentJob',
          'parentIncome',
          'documents',
          'dynamicAnswers',
        ];
        const filtered: Record<string, any> = {};
        for (const key of allowedWaliFields) {
          if (updatesPayload[key] !== undefined) {
            filtered[key] = updatesPayload[key];
          }
        }
        updatesPayload = filtered;
      }
    } else if (!isSuper) {
      const permissions: string[] = user.permissions || [];
      const hasPerm =
        permissions.includes('Pendaftar') ||
        permissions.includes('Pendaftar:edit') ||
        permissions.includes('Jadwal') ||
        permissions.includes('Jadwal:edit');
      if (!hasPerm) {
        return res.status(403).json({ error: 'Akses Ditolak: Anda tidak memiliki izin untuk mengubah data pendaftar.' });
      }
      const isYysAdmin = (user.role || '').toLowerCase().includes('admin yayasan');
      if (!isYysAdmin && user.schoolId && user.schoolId !== 'MASTER' && existing.unit !== user.schoolId) {
        return res.status(403).json({ error: `Akses Ditolak: Anda hanya berhak mengelola pendaftar unit ${user.schoolId}.` });
      }
    }

    // Prevent immutable identifier & privileged offline/score tampering
    delete updatesPayload.id;
    delete updatesPayload.registrationNumber;
    delete updatesPayload.parentUserId;
    delete updatesPayload.isOffline;

    // Server-side input validation for biodata, dynamicAnswers, and documents
    if (updatesPayload.fullName !== undefined) {
      if (typeof updatesPayload.fullName !== 'string' || updatesPayload.fullName.trim().length === 0 || updatesPayload.fullName.length > 200) {
        return res.status(400).json({ error: 'Nama lengkap calon siswa tidak valid (1-200 karakter).' });
      }
      updatesPayload.fullName = updatesPayload.fullName.trim();
    }

    if (updatesPayload.nisn !== undefined && updatesPayload.nisn !== null && String(updatesPayload.nisn).trim().length > 0) {
      const cleanNisn = String(updatesPayload.nisn).replace(/\D/g, '');
      if (cleanNisn.length !== 10) {
        return res.status(400).json({ error: 'NISN harus tepat 10 digit angka atau kosongkan bila belum ada.' });
      }
      updatesPayload.nisn = cleanNisn;
    }

    const isPlainRecord = (v: unknown): v is Record<string, unknown> =>
      Boolean(v) && typeof v === 'object' && !Array.isArray(v);

    const isSafeDocValue = (val: unknown): boolean => {
      if (val === '') return true;
      if (typeof val !== 'string') return false;
      if (val.length > 8 * 1024 * 1024) return false; // Max ~8MB base64 payload
      if (val.startsWith('data:')) {
        return verifyDataUriPayload(val, { allowPdf: true }).ok;
      }
      return isSafeHttpUrl(val, true);
    };

    if (updatesPayload.dynamicAnswers !== undefined) {
      if (!isPlainRecord(updatesPayload.dynamicAnswers)) {
        return res.status(400).json({ error: 'Format dynamicAnswers tidak valid.' });
      }
      const sanitizedAnswers: Record<string, any> = {};
      for (const [k, v] of Object.entries(updatesPayload.dynamicAnswers)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        if (typeof v === 'string' && v.startsWith('data:') && !isSafeDocValue(v)) {
          return res.status(400).json({ error: `Format berkas pada kolom "${k}" tidak diizinkan (hanya JPG/PNG/WEBP/PDF max 5MB).` });
        }
        sanitizedAnswers[k] = v;
      }
      updatesPayload.dynamicAnswers = sanitizedAnswers;
    }

    if (updatesPayload.documents !== undefined) {
      if (!isPlainRecord(updatesPayload.documents)) {
        return res.status(400).json({ error: 'Format documents tidak valid.' });
      }
      const sanitizedDocs: Record<string, string> = {};
      for (const [k, v] of Object.entries(updatesPayload.documents)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        if (v === undefined || v === null) continue;
        if (!isSafeDocValue(v)) {
          return res.status(400).json({ error: `Format dokumen "${k}" tidak valid atau melebihi batas ukuran.` });
        }
        sanitizedDocs[k] = String(v);
      }
      updatesPayload.documents = sanitizedDocs;
    }

    const updated = await db.updateStudent(req.params.id, updatesPayload);
    res.json(updated);
  } catch (err: any) {
    console.error('[API Update Student Error]:', err);
    res.status(500).json({ error: 'Gagal menyimpan pembaruan data calon siswa ke database.' });
  }
});

app.delete('/api/students/:id', requireAuth, requirePermission('Pendaftar', 'delete'), requireUnitIsolation, async (req: AuthRequest, res: Response) => {
  try {
    const actor = req.user?.email || req.user?.name || 'Admin';
    const actorRole = req.user?.role || 'Staff';
    const success = await db.deleteStudent(req.params.id, actor, actorRole);
    if (!success) {
      return res.status(404).json({ error: 'Calon siswa tidak ditemukan.' });
    }
    res.json({ message: 'Pendaftar berhasil dihapus dan diarsipkan ke Sampah Master.' });
  } catch (err: any) {
    console.error('[API Delete Student Error]:', err);
    res.status(500).json({ error: 'Gagal menghapus data pendaftar dari database.' });
  }
});

app.post('/api/students/:id/verify', requireAuth, requirePermission('Verifikasi', 'verify'), requireUnitIsolation, async (req: Request, res: Response) => {
  try {
    const { approved, notes } = req.body;
    const updated = await db.verifyStudent(req.params.id, Boolean(approved), notes);
    if (!updated) {
      return res.status(404).json({ error: 'Calon siswa tidak ditemukan.' });
    }
    res.json(updated);
  } catch (err: any) {
    console.error('[API Verify Student Error]:', err);
    res.status(500).json({ error: 'Gagal menyimpan status verifikasi siswa ke database.' });
  }
});

app.post('/api/students/:id/test-result', requireAuth, requirePermission('Kelulusan', 'edit'), requireUnitIsolation, async (req: Request, res: Response) => {
  try {
    const { score, status, publish } = req.body;
    const numericScore = Number(score);
    if (
      score === undefined ||
      score === null ||
      !Number.isFinite(numericScore) ||
      numericScore < 0 ||
      numericScore > 100 ||
      !['lulus', 'tidak_lulus'].includes(status)
    ) {
      return res.status(400).json({ error: 'Nilai ujian (0 - 100) dan status kelulusan wajib valid.' });
    }
    const updated = await db.setTestResult(req.params.id, Math.round(numericScore * 100) / 100, status, Boolean(publish));
    if (!updated) {
      return res.status(404).json({ error: 'Calon siswa tidak ditemukan.' });
    }
    res.json(updated);
  } catch (err: any) {
    console.error('[API Set Test Result Error]:', err);
    res.status(500).json({ error: 'Gagal menyimpan hasil seleksi ke database.' });
  }
});

// Payments API (Protected + Strict RBAC / Ownership / Unit Isolation)
app.get('/api/payments', requireAuth, async (req: AuthRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const user = req.user!;
  let { unit, status, type } = req.query;

  if (isWaliRoleName(user.role)) {
    const ownIds = new Set(
      db.getStudents().filter((s) => studentBelongsToWali(s, user)).map((s) => s.id)
    );
    const list = (await db.getPaymentsFresh({
      unit: unit as string,
      status: status as string,
      type: type as string,
    }))
      .filter((p) => ownIds.has(p.registrationId))
      .map(attachReceiptSig);
    return res.json(list);
  }

  if (!userHasAnyModulePermission(user, PAYMENT_STAFF_MODULES)) {
    return res.status(403).json({
      error: 'Akses Ditolak (403 Forbidden): Anda tidak memiliki izin melihat data pembayaran.',
    });
  }

  // Unit isolation for unit staff
  if (user.schoolId !== 'MASTER' && user.role !== 'Super Admin Yayasan' && !user.role.includes('Admin Yayasan')) {
    unit = user.schoolId;
  }

  const list = (await db.getPaymentsFresh({
    unit: unit as string,
    status: status as string,
    type: type as string,
  })).map(attachReceiptSig);
  res.json(list);
});

// Upload proof: Protected (Wali owner or authorized Finance/Admin staff)
app.post('/api/payments/proof', requireAuth, uploadRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { registrationId, proofUrl, amount, type } = req.body;
    if (!registrationId || typeof registrationId !== 'string') {
      return res.status(400).json({ error: 'ID pendaftaran siswa tidak valid.' });
    }
    if (!['Formulir', 'Daftar Ulang'].includes(type)) {
      return res.status(400).json({ error: 'Jenis pembayaran harus Formulir atau Daftar Ulang.' });
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 500_000_000) {
      return res.status(400).json({ error: 'Nominal pembayaran harus lebih dari 0 dan maksimal Rp 500.000.000.' });
    }
    if (typeof proofUrl !== 'string' || proofUrl.trim().length === 0 || proofUrl.length > 8_000_000) {
      return res.status(400).json({ error: 'Bukti pembayaran tidak valid atau melebihi batas ukuran (maks 5MB).' });
    }
    const trimmedProof = proofUrl.trim();
    let validatedDataCheck: { ext: string; buffer: Buffer } | null = null;
    if (trimmedProof.startsWith('data:')) {
      const check = verifyDataUriPayload(trimmedProof, { allowPdf: true });
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }
      validatedDataCheck = { ext: check.ext, buffer: check.buffer };
    } else if (!isSafeHttpUrl(trimmedProof, true)) {
      return res.status(400).json({ error: 'Format URL bukti transfer tidak diizinkan (gunakan file JPG, PNG, WebP, atau PDF).' });
    }

    const student = db.getStudentById(registrationId);
    if (!student) {
      return res.status(404).json({ error: 'Pendaftaran siswa tidak ditemukan.' });
    }

    const user = req.user!;
    const isSuper = user.role === 'Super Admin Yayasan';
    const isWali = isWaliRoleName(user.role);

    if (isWali) {
      if (!studentBelongsToWali(student, user)) {
        return res.status(403).json({
          error: 'Akses Ditolak: Anda hanya berhak mengunggah bukti pembayaran untuk putra/putri Anda sendiri.',
        });
      }
    } else if (!isSuper) {
      const perms: string[] = user.permissions || [];
      const hasPayPerm =
        perms.includes('Pembayaran') ||
        perms.includes('Pembayaran:add') ||
        perms.includes('Pembayaran:edit') ||
        perms.includes('Pembayaran:verify');
      if (!hasPayPerm) {
        return res.status(403).json({ error: 'Akses Ditolak: Anda tidak memiliki izin mengelola pembayaran.' });
      }
      if (user.schoolId && user.schoolId !== 'MASTER' && student.unit !== user.schoolId) {
        return res.status(403).json({
          error: `Pelanggaran Batas Unit: Siswa terdaftar pada unit ${student.unit}, bukan unit ${user.schoolId}.`,
        });
      }
    }

    const rawPaymentId = typeof req.body?.paymentId === 'string' ? req.body.paymentId.trim().slice(0, 80) : '';
    const paymentId = rawPaymentId.length > 0 ? rawPaymentId : undefined;
    if (paymentId) {
      const existingPay = (await db.getPaymentsFresh()).find((p) => p.id === paymentId);
      if (!existingPay || existingPay.registrationId !== student.id) {
        return res.status(403).json({
          error: 'Catatan pembayaran tujuan tidak ditemukan atau bukan milik siswa ini.',
        });
      }
      if (isWali && existingPay.status === 'lunas') {
        return res.status(400).json({
          error: 'Bukti pembayaran ini sudah diverifikasi Lunas dan tidak dapat ditimpa. Silakan unggah sebagai bukti transfer baru.',
        });
      }
    }

    const storedProofUrl = validatedDataCheck
      ? db.saveUploadedBufferToDisk(validatedDataCheck.buffer, 'pay', validatedDataCheck.ext)
      : trimmedProof;

    const bankAccountId = typeof req.body?.bankAccountId === 'string' ? req.body.bankAccountId.trim().slice(0, 80) : undefined;
    const savedPayment = await db.uploadPaymentProof(
      student.id,
      storedProofUrl,
      Math.round(numericAmount),
      type,
      bankAccountId,
      paymentId
    );
    if (!savedPayment) {
      if (validatedDataCheck) {
        db.deleteUploadFileIfUnused(storedProofUrl);
      }
      return res.status(404).json({ error: 'Pendaftaran siswa atau catatan pembayaran tidak ditemukan.' });
    }
    res.json({ message: 'Bukti transfer berhasil diunggah.', payment: savedPayment });
  } catch (err: any) {
    console.error('[API Upload Proof Error]:', err);
    res.status(500).json({ error: 'Gagal menyimpan bukti pembayaran ke database.' });
  }
});

// Verify payment group (multi-proof approval/rejection for a student's billing): Restricted to Bendahara or Master (with unit isolation)
app.post('/api/payments/verify-group', requireAuth, requirePermission('Pembayaran', 'verify'), async (req: AuthRequest, res: Response) => {
  try {
    const { paymentIds, approved, notes } = req.body || {};
    if (!Array.isArray(paymentIds) || paymentIds.length === 0 || paymentIds.length > 50) {
      return res.status(400).json({ error: 'Daftar ID pembayaran tidak valid (minimal 1, maksimal 50).' });
    }
    const cleanIds = Array.from(
      new Set(
        paymentIds
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          .map((id) => id.trim().slice(0, 80))
      )
    );
    if (cleanIds.length === 0) {
      return res.status(400).json({ error: 'Daftar ID pembayaran kosong.' });
    }

    const allPayments = await db.getPaymentsFresh();
    const user = req.user!;
    const isMasterOrYys =
      user.schoolId === 'MASTER' ||
      user.role === 'Super Admin Yayasan' ||
      (user.role || '').toLowerCase().includes('admin yayasan');

    for (const pid of cleanIds) {
      const targetPay = allPayments.find((p) => p.id === pid);
      if (!targetPay) {
        return res.status(404).json({ error: `Catatan pembayaran "${pid}" tidak ditemukan.` });
      }
      if (!isMasterOrYys && user.schoolId && targetPay.unit !== user.schoolId) {
        return res.status(403).json({
          error: `Pelanggaran Batas Unit: Pembayaran ini milik unit ${targetPay.unit}, bukan unit ${user.schoolId}.`,
        });
      }
    }

    const cleanNotes = typeof notes === 'string' ? notes.trim().slice(0, 1000) : undefined;
    const verifiedBy = req.user?.email || 'bendahara@arrisalahaceh.or.id';
    const updatedList = await db.verifyPaymentGroup(cleanIds, Boolean(approved), cleanNotes, verifiedBy);
    res.json({ payments: updatedList.map(attachReceiptSig) });
  } catch (err: any) {
    console.error('[API Verify Payment Group Error]:', err);
    res.status(500).json({ error: 'Gagal memperbarui status verifikasi pembayaran di database.' });
  }
});

// Verify payment: Restricted to Bendahara or Master (with unit isolation)
app.post('/api/payments/:id/verify', requireAuth, requirePermission('Pembayaran', 'verify'), async (req: AuthRequest, res: Response) => {
  try {
    const targetPay = (await db.getPaymentsFresh()).find((p) => p.id === req.params.id);
    if (!targetPay) {
      return res.status(404).json({ error: 'Catatan pembayaran tidak ditemukan.' });
    }
    const user = req.user!;
    if (
      user.schoolId &&
      user.schoolId !== 'MASTER' &&
      user.role !== 'Super Admin Yayasan' &&
      !(user.role || '').toLowerCase().includes('admin yayasan') &&
      targetPay.unit !== user.schoolId
    ) {
      return res.status(403).json({
        error: `Pelanggaran Batas Unit: Pembayaran ini milik unit ${targetPay.unit}, bukan unit ${user.schoolId}.`,
      });
    }
    const { approved, notes, amount } = req.body || {};
    let adjustedAmount: number | undefined = undefined;
    if (amount !== undefined && amount !== null && amount !== '') {
      const validRawType =
        (typeof amount === 'number' && Number.isFinite(amount)) ||
        (typeof amount === 'string' && /^\d+$/.test(amount.trim()));
      const parsedAmount = validRawType ? Number(amount) : NaN;
      if (!Number.isFinite(parsedAmount) || parsedAmount < 1 || parsedAmount > 1_000_000_000) {
        return res.status(400).json({ error: 'Nominal real harus berupa angka valid antara Rp 1 hingga Rp 1.000.000.000.' });
      }
      adjustedAmount = Math.round(parsedAmount);
    }
    const cleanNotes = typeof notes === 'string' ? notes.trim().slice(0, 1000) : undefined;
    const verifiedBy = req.user?.email || 'bendahara@arrisalahaceh.or.id';
    const updated = await db.verifyPayment(req.params.id, Boolean(approved), cleanNotes, verifiedBy, adjustedAmount);
    if (!updated) {
      return res.status(404).json({ error: 'Catatan pembayaran tidak ditemukan.' });
    }
    res.json(attachReceiptSig(updated));
  } catch (err: any) {
    console.error('[API Verify Payment Error]:', err);
    res.status(500).json({ error: 'Gagal memperbarui status verifikasi pembayaran di database.' });
  }
});

// Update real nominal amount by authorized verifier/admin (unit-isolated)
app.patch('/api/payments/:id/amount', requireAuth, requirePermission('Pembayaran', 'verify'), async (req: AuthRequest, res: Response) => {
  try {
    const targetPay = (await db.getPaymentsFresh()).find((p) => p.id === req.params.id);
    if (!targetPay) {
      return res.status(404).json({ error: 'Catatan pembayaran tidak ditemukan.' });
    }
    const user = req.user!;
    if (
      user.schoolId &&
      user.schoolId !== 'MASTER' &&
      user.role !== 'Super Admin Yayasan' &&
      !(user.role || '').toLowerCase().includes('admin yayasan') &&
      targetPay.unit !== user.schoolId
    ) {
      return res.status(403).json({
        error: `Pelanggaran Batas Unit: Pembayaran ini milik unit ${targetPay.unit}, bukan unit ${user.schoolId}.`,
      });
    }
    const rawAmount = req.body?.amount;
    const validRawType =
      (typeof rawAmount === 'number' && Number.isFinite(rawAmount)) ||
      (typeof rawAmount === 'string' && /^\d+$/.test(rawAmount.trim()));
    const parsedAmount = validRawType ? Number(rawAmount) : NaN;
    if (!Number.isFinite(parsedAmount) || parsedAmount < 1 || parsedAmount > 1_000_000_000) {
      return res.status(400).json({ error: 'Nominal real harus berupa angka valid antara Rp 1 hingga Rp 1.000.000.000.' });
    }
    const updatedBy = req.user?.email || 'bendahara@arrisalahaceh.or.id';
    const updated = await db.updatePaymentAmount(req.params.id, Math.round(parsedAmount), updatedBy);
    if (!updated) {
      return res.status(404).json({ error: 'Catatan pembayaran tidak ditemukan.' });
    }
    res.json(attachReceiptSig(updated));
  } catch (err: any) {
    console.error('[API Update Payment Amount Error]:', err);
    res.status(500).json({ error: 'Gagal memperbarui nominal pembayaran di database.' });
  }
});

// Test Schedules API
app.get('/api/schedules', (req: Request, res: Response) => {
  const list = db.getSchedules(req.query.unit as string);
  res.json(list);
});

app.post('/api/schedules', requireAuth, requirePermission('Jadwal', 'add'), requireUnitIsolation, async (req: Request, res: Response) => {
  try {
    const { title, unit, date, startTime, endTime, room, examiner, quota } = req.body;
    if (!title || !room || !examiner) {
      return res.status(400).json({ error: 'Judul, ruangan, dan nama penguji wajib diisi.' });
    }
    const newSch = await db.createSchedule({
      title,
      unit: unit || 'SD01',
      date: date || new Date().toISOString().slice(0, 10),
      startTime: startTime || '08:00',
      endTime: endTime || '12:00',
      room,
      examiner,
      quota: Number(quota) || 40,
    });
    res.status(201).json(newSch);
  } catch (err: any) {
    console.error('[API Create Schedule Error]:', err);
    res.status(500).json({ error: 'Gagal menambahkan jadwal tes ke database.' });
  }
});

app.put('/api/schedules/:id', requireAuth, requirePermission('Jadwal', 'edit'), requireUnitIsolation, async (req: Request, res: Response) => {
  try {
    const { title, unit, date, startTime, endTime, room, examiner, quota } = req.body || {};
    const updates: Record<string, any> = {};
    if (typeof title === 'string' && title.trim()) updates.title = title.trim().slice(0, 150);
    if (typeof unit === 'string' && unit.trim()) updates.unit = unit.trim().toUpperCase();
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) updates.date = date.trim();
    if (typeof startTime === 'string' && startTime.trim()) updates.startTime = startTime.trim().slice(0, 10);
    if (typeof endTime === 'string' && endTime.trim()) updates.endTime = endTime.trim().slice(0, 10);
    if (typeof room === 'string' && room.trim()) updates.room = room.trim().slice(0, 100);
    if (typeof examiner === 'string' && examiner.trim()) updates.examiner = examiner.trim().slice(0, 150);
    if (quota !== undefined) {
      const q = Number(quota);
      if (!Number.isFinite(q) || q < 1 || q > 5000) {
        return res.status(400).json({ error: 'Kuota jadwal tes harus antara 1 sampai 5.000.' });
      }
      updates.quota = Math.floor(q);
    }
    const updated = await db.updateSchedule(req.params.id, updates);
    if (!updated) {
      return res.status(404).json({ error: 'Jadwal tes tidak ditemukan.' });
    }
    res.json(updated);
  } catch (err: any) {
    console.error('[API Update Schedule Error]:', err);
    res.status(500).json({ error: 'Gagal memperbarui jadwal tes di database.' });
  }
});

app.delete('/api/schedules/:id', requireAuth, requirePermission('Jadwal', 'delete'), requireUnitIsolation, async (req: AuthRequest, res: Response) => {
  try {
    const actor = req.user?.email || req.user?.name || 'Admin';
    const actorRole = req.user?.role || 'Staff';
    const success = await db.deleteSchedule(req.params.id, actor, actorRole);
    if (!success) {
      return res.status(404).json({ error: 'Jadwal tes tidak ditemukan.' });
    }
    res.json({ message: 'Jadwal berhasil dihapus dan diarsipkan ke Sampah Master.' });
  } catch (err: any) {
    console.error('[API Delete Schedule Error]:', err);
    res.status(500).json({ error: 'Gagal menghapus jadwal tes dari database.' });
  }
});

// Units & Quota API: Master level + Unit Status + Offline Counter
app.get('/api/units', (req: Request, res: Response) => {
  res.json(db.getUnits());
});

// Create New School Unit (Strictly Master Admin & Admin Yayasan ONLY)
app.post('/api/units', requireAuth, requireMaster, requirePermission('Kuota & Biaya', 'edit'), async (req: AuthRequest, res: Response) => {
  try {
    const { id, name, shortName, totalQuota, offlineCount, formFee, reRegFee, isOpen, closedNotice, facilities } = req.body || {};
    const cleanId = typeof id === 'string' ? id.trim().toUpperCase() : '';
    if (!cleanId || !/^[A-Z0-9]{2,10}$/.test(cleanId)) {
      return res.status(400).json({ error: 'Kode Unit wajib 2-10 karakter huruf kapital/angka tanpa spasi (contoh: KB01, MA01).' });
    }
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.length > 120) {
      return res.status(400).json({ error: 'Nama resmi unit sekolah wajib diisi (2-120 karakter).' });
    }
    if (!shortName || typeof shortName !== 'string' || shortName.trim().length < 2 || shortName.length > 20) {
      return res.status(400).json({ error: 'Singkatan jenjang wajib diisi (2-20 karakter, contoh: KBIT, MAIT).' });
    }
    const q = Number(totalQuota);
    if (!Number.isFinite(q) || q < 1 || q > 10000) {
      return res.status(400).json({ error: 'Total kuota daya tampung harus antara 1 sampai 10.000.' });
    }
    const off = offlineCount !== undefined ? Number(offlineCount) : 0;
    if (!Number.isFinite(off) || off < 0 || off > 10000) {
      return res.status(400).json({ error: 'Jumlah pendaftar offline awal tidak valid.' });
    }
    if (db.getUnits().some((u) => u.id.toUpperCase() === cleanId)) {
      return res.status(409).json({ error: `Kode unit "${cleanId}" sudah terdaftar di sistem.` });
    }

    const sanitizedFacilities = Array.isArray(facilities)
      ? facilities.filter((f): f is string => typeof f === 'string' && f.trim().length > 0).map((f) => f.trim().slice(0, 120)).slice(0, 12)
      : [];

    const actor = req.user?.email || req.user?.name || 'Master Admin';
    const created = await db.createUnit(
      {
        id: cleanId,
        name: name.trim(),
        shortName: shortName.trim(),
        totalQuota: Math.floor(q),
        offlineCount: Math.floor(off),
        formFee: Math.max(0, Number(formFee) || 0),
        reRegFee: Math.max(0, Number(reRegFee) || 0),
        isOpen: isOpen !== undefined ? Boolean(isOpen) : true,
        closedNotice: typeof closedNotice === 'string' ? closedNotice.trim().slice(0, 500) : undefined,
        facilities: sanitizedFacilities,
      },
      actor
    );
    if (!created) {
      return res.status(409).json({ error: `Gagal membuat unit "${cleanId}" (kemungkinan kode sudah ada).` });
    }
    res.status(201).json(created);
  } catch (err: any) {
    console.error('[API Create Unit Error]:', err);
    res.status(500).json({ error: 'Gagal menambahkan unit sekolah baru ke database.' });
  }
});

// Update Offline Applicant Count Counter for a Unit (Admin Unit for own unit, Admin Yayasan, Master Admin)
app.put('/api/units/:id/offline-count', requireAuth, requirePermission('Kuota & Biaya', 'edit'), requireUnitIsolation, async (req: AuthRequest, res: Response) => {
  try {
    const targetUnit = String(req.params.id || '').trim().toUpperCase();
    const existing = db.getUnits().find((u) => u.id === targetUnit);
    if (!existing) {
      return res.status(404).json({ error: 'Unit sekolah tidak ditemukan.' });
    }
    const rawCount = req.body?.offlineCount;
    const numericCount = Number(rawCount);
    if (rawCount === undefined || rawCount === null || !Number.isFinite(numericCount) || numericCount < 0 || numericCount > 100000) {
      return res.status(400).json({ error: 'Jumlah pendaftar offline harus berupa angka bulat >= 0.' });
    }
    const actor = req.user?.email || req.user?.name || 'Admin';
    const updated = await db.updateUnitOfflineCount(targetUnit, Math.floor(numericCount), actor);
    if (!updated) {
      return res.status(404).json({ error: 'Unit sekolah tidak ditemukan.' });
    }
    res.json(updated);
  } catch (err: any) {
    console.error('[API Update Offline Count Error]:', err);
    res.status(500).json({ error: 'Gagal memperbarui angka pendaftar offline ke database.' });
  }
});

// Reorder School Units (Strictly Admin Yayasan & Master Admin ONLY - Dynamic N units)
app.put('/api/units/reorder', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (isWaliRoleName(user.role)) {
      return res.status(403).json({
        error: 'Akses Ditolak: Wali siswa tidak berhak mengubah urutan unit sekolah.',
      });
    }

    const roleLower = (user.role || '').toLowerCase();
    const isMasterOrYayasanAdmin =
      user.role === 'Super Admin Yayasan' ||
      roleLower.includes('super admin') ||
      roleLower.includes('admin yayasan');

    if (!isMasterOrYayasanAdmin) {
      addAuditLog(
        'unauthorized_access' as any,
        user.schoolId || 'MASTER',
        `Akses ditolak: ${user.email} (${user.role}) mencoba mengurutkan ulang unit sekolah`,
        user.email,
        req.ip || '127.0.0.1'
      );
      return res.status(403).json({
        error: 'Akses Ditolak (403 Forbidden): Hanya Admin Yayasan dan Master Admin yang dapat mengubah urutan unit sekolah.',
      });
    }

    const rawOrderedIds = req.body?.orderedIds;
    const currentUnitIds = db.getUnits().map((u) => u.id);
    if (
      !Array.isArray(rawOrderedIds) ||
      rawOrderedIds.length !== currentUnitIds.length ||
      !rawOrderedIds.every((id) => typeof id === 'string')
    ) {
      return res.status(400).json({
        error: `Daftar orderedIds tidak valid. Harus berupa array berisi seluruh ${currentUnitIds.length} unit sekolah.`,
      });
    }

    const normalizedIds = rawOrderedIds.map((id) => id.trim().toUpperCase());
    if (
      new Set(normalizedIds).size !== currentUnitIds.length ||
      !currentUnitIds.every((u) => normalizedIds.includes(u))
    ) {
      return res.status(400).json({
        error: `Daftar orderedIds harus memuat setiap unit (${currentUnitIds.join(', ')}) tepat satu kali.`,
      });
    }

    const actor = user.email || user.name || 'Admin';
    const updatedUnits = await db.reorderUnits(normalizedIds, actor);
    if (!updatedUnits) {
      return res.status(400).json({ error: 'Gagal memvalidasi urutan unit sekolah.' });
    }
    res.json(updatedUnits);
  } catch (err: any) {
    console.error('[API Reorder Units Error]:', err);
    res.status(500).json({ error: 'Gagal menyimpan urutan unit sekolah ke database.' });
  }
});

app.put('/api/units/:id', requireAuth, requireMaster, requirePermission('Kuota & Biaya', 'edit'), async (req: Request, res: Response) => {
  try {
    const { quota, formFee, reRegFee, isOpen, closedNotice, offlineCount } = req.body;
    const updated = await db.updateUnit(
      String(req.params.id || '').trim().toUpperCase(),
      Number(quota) || 100,
      Number(formFee) || 0,
      Number(reRegFee) || 0,
      isOpen !== undefined ? Boolean(isOpen) : true,
      closedNotice,
      offlineCount !== undefined ? Number(offlineCount) : undefined
    );
    if (!updated) {
      return res.status(404).json({ error: 'Unit sekolah tidak ditemukan.' });
    }
    res.json(updated);
  } catch (err: any) {
    console.error('[API Update Unit Error]:', err);
    res.status(500).json({ error: 'Gagal memperbarui konfigurasi unit sekolah di database.' });
  }
});

// Toggle Unit Registration Status (Accessible to Admin Unit for own unit, Admin Yayasan, and Master Admin)
app.put('/api/units/:id/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (isWaliRoleName(user.role)) {
      return res.status(403).json({
        error: 'Akses Ditolak: Wali siswa tidak berhak mengubah status pendaftaran unit.',
      });
    }

    const targetUnit = String(req.params.id || '').trim().toUpperCase();
    const validUnitIds = db.getUnits().map((u) => u.id);
    if (!validUnitIds.includes(targetUnit)) {
      return res.status(400).json({ error: 'Unit sekolah tidak valid.' });
    }

    const roleLower = (user.role || '').toLowerCase();
    const isSuperOrYys =
      user.role === 'Super Admin Yayasan' ||
      roleLower.includes('admin yayasan') ||
      roleLower.includes('super admin');
    const isAdminUnit = roleLower.includes('admin unit');
    const perms: string[] = user.permissions || [];
    const hasQuotaEdit = perms.includes('Kuota & Biaya') || perms.includes('Kuota & Biaya:edit');

    if (!isSuperOrYys && !isAdminUnit && !hasQuotaEdit) {
      addAuditLog(
        'unauthorized_access' as any,
        user.schoolId || 'MASTER',
        `Akses ditolak: ${user.email} (${user.role}) mencoba mengubah aktivasi pendaftaran unit ${targetUnit}`,
        user.email,
        req.ip || '127.0.0.1'
      );
      return res.status(403).json({
        error: 'Akses Ditolak: Hanya Admin Unit, Admin Yayasan, atau Master Admin yang dapat mengaktifkan pendaftaran.',
      });
    }

    if (!isSuperOrYys && user.schoolId && user.schoolId !== 'MASTER' && targetUnit !== user.schoolId) {
      addAuditLog(
        'unauthorized_access' as any,
        user.schoolId,
        `Pelanggaran Isolasi Unit (BOLA): ${user.email} (${user.schoolId}) mencoba mengubah status pendaftaran unit ${targetUnit}`,
        user.email,
        req.ip || '127.0.0.1'
      );
      return res.status(403).json({
        error: `Pelanggaran Batas Unit: Anda (${user.schoolId}) hanya dapat mengaktifkan/menonaktifkan pendaftaran untuk unit ${user.schoolId}.`,
      });
    }

    if (typeof req.body?.isOpen !== 'boolean') {
      return res.status(400).json({ error: 'Field status aktivasi (isOpen: boolean) wajib dikirim.' });
    }

    const rawNotice =
      typeof req.body.closedNotice === 'string'
        ? req.body.closedNotice.trim().slice(0, 500)
        : undefined;

    const actor = user.email || user.name || 'Admin';
    const updated = await db.updateUnitRegistrationStatus(
      targetUnit,
      req.body.isOpen,
      rawNotice,
      actor
    );
    if (!updated) {
      return res.status(404).json({ error: 'Unit sekolah tidak ditemukan.' });
    }
    res.json(updated);
  } catch (err: any) {
    console.error('[API Update Unit Status Error]:', err);
    res.status(500).json({ error: 'Gagal memperbarui status aktivasi pendaftaran unit.' });
  }
});

// Delete School Unit (Super Admin Yayasan ONLY - fails if students remain in unit)
app.delete('/api/units/:id', requireAuth, requireRole(['Super Admin Yayasan']), async (req: AuthRequest, res: Response) => {
  try {
    const cleanId = String(req.params.id || '').trim().toUpperCase();
    const actor = req.user?.email || req.user?.name || 'Super Admin';
    const result = await db.deleteUnit(cleanId, actor);
    if (!result.deleted) {
      if (result.reason === 'not_found') {
        return res.status(404).json({ error: 'Unit sekolah tidak ditemukan.' });
      }
      return res.status(409).json({
        error: `Unit ${cleanId} tidak dapat dihapus karena masih memiliki data calon siswa terdaftar.`,
      });
    }
    res.json({ success: true, deletedId: cleanId });
  } catch (err: any) {
    console.error('[API Delete Unit Error]:', err);
    res.status(500).json({ error: 'Gagal menghapus unit sekolah dari database.' });
  }
});

// Upload Asset API: Save logo or favicon directly to /public/uploads/ & /data/uploads/ (Strict raster/ico + magic bytes allowlist - NO SVG XSS)
app.post('/api/upload-asset', requireAuth, requireMaster, uploadRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { filename, fileData, data, assetType } = req.body || {};
    const rawData = fileData || data;
    if (!filename || !rawData || typeof rawData !== 'string') {
      return res.status(400).json({ error: 'Filename dan fileData (Base64) wajib dikirim.' });
    }

    const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.ico'];
    const rawExt = path.extname(String(filename)).toLowerCase();
    const defaultExt = assetType === 'favicon' ? '.ico' : '.png';
    const ext = rawExt && rawExt.length > 1 ? rawExt : defaultExt;
    if (!ALLOWED_EXTS.includes(ext)) {
      return res.status(400).json({ error: 'Ekstensi aset tidak diizinkan (hanya PNG, JPG, WebP, atau ICO).' });
    }

    let buffer: Buffer;
    if (rawData.startsWith('data:')) {
      const check = verifyDataUriPayload(rawData, { allowPdf: false, allowIco: true });
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }
      buffer = check.buffer;
    } else {
      buffer = Buffer.from(rawData, 'base64');
      if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Ukuran aset maksimal 5MB.' });
      }
      const expectedKind = (ext.replace('.', '') as 'png' | 'jpg' | 'jpeg' | 'webp' | 'ico');
      const magicOk =
        expectedKind === 'ico'
          ? verifyBufferMagicBytes(buffer, 'ico') || verifyBufferMagicBytes(buffer, 'png')
          : verifyBufferMagicBytes(buffer, expectedKind);
      if (!magicOk) {
        return res.status(400).json({ error: 'Signature biner (magic bytes) aset tidak cocok dengan ekstensi file.' });
      }
    }

    const baseClean = path.basename(String(filename), rawExt).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const timestamp = Date.now();
    const safeName = `${timestamp}_${baseClean}${ext}`;

    const targetPath = path.resolve(process.cwd(), 'public', 'uploads', safeName);
    fs.writeFileSync(targetPath, buffer);
    const dataTargetPath = path.resolve(process.cwd(), 'data', 'uploads', safeName);
    try { fs.writeFileSync(dataTargetPath, buffer); } catch (e) {}

    // Copy to static fallback filenames for legacy compatibility
    if (assetType === 'logo') {
      try {
        fs.copyFileSync(targetPath, path.resolve(process.cwd(), 'public', 'uploads', 'logo.png'));
        fs.copyFileSync(targetPath, path.resolve(process.cwd(), 'data', 'uploads', 'logo.png'));
      } catch (e) {}
    } else if (assetType === 'favicon') {
      try {
        fs.copyFileSync(targetPath, path.resolve(process.cwd(), 'public', 'uploads', 'favicon.ico'));
        fs.copyFileSync(targetPath, path.resolve(process.cwd(), 'data', 'uploads', 'favicon.ico'));
      } catch (e) {}
    }

    const assetUrl = `/uploads/${safeName}`;

    // Auto-bind to landing config if assetType is logo or favicon
    if (assetType === 'logo') {
      const current = db.getLandingConfig();
      await db.updateLandingConfig(
        {
          ...current,
          logoUrl: assetUrl,
          customLogoBase64: rawData,
        },
        req.user?.email || 'Master Admin',
        req.user?.role || 'Super Admin Yayasan',
        true
      );
    } else if (assetType === 'favicon') {
      const current = db.getLandingConfig();
      await db.updateLandingConfig(
        {
          ...current,
          faviconUrl: assetUrl,
          customFaviconBase64: rawData,
        },
        req.user?.email || 'Master Admin',
        req.user?.role || 'Super Admin Yayasan',
        true
      );
    }

    addAuditLog(
      'update_status' as any,
      'MASTER',
      `Upload aset web ${safeName} (${assetType || 'asset'}) oleh ${req.user?.email}`,
      req.user?.email || 'admin',
      req.ip || '127.0.0.1'
    );
    res.json({ success: true, url: assetUrl, filename: safeName, assetType });
  } catch (err: any) {
    console.error('[Upload Asset Error]:', err);
    res.status(500).json({ error: 'Gagal mengunggah file aset ke database.' });
  }
});

// Form Builder API: Requires Form Builder permission and Unit isolation (Dynamic units)
app.get('/api/form-schemas', optionalAuth, (req: AuthRequest, res: Response) => {
  const allSchemas = db.getFormSchemas();
  res.json(allSchemas);
});

app.put('/api/form-schemas/:unitId', requireAuth, requirePermission('Form Builder', 'edit'), requireUnitIsolation, async (req: AuthRequest, res: Response) => {
  const targetUnit = String(req.params.unitId || '').trim().toUpperCase();
  const VALID_UNITS = db.getUnits().map((u) => u.id);
  if (!VALID_UNITS.includes(targetUnit)) {
    return res.status(400).json({ error: 'Unit sekolah tidak valid.' });
  }

  // Strict double check on user schoolId
  if (req.user && req.user.schoolId !== 'MASTER' && req.user.role !== 'Super Admin Yayasan') {
    if (targetUnit !== req.user.schoolId) {
      addAuditLog(
        'unauthorized_access' as any,
        req.user.schoolId,
        `Pelanggaran Isolasi Unit: ${req.user.email} (${req.user.schoolId}) mencoba mengubah formulir unit ${targetUnit}`,
        req.user.email,
        req.ip || '127.0.0.1'
      );
      return res.status(403).json({
        error: `Pelanggaran Batas Unit (BOLA): Anda (${req.user.schoolId}) tidak memiliki izin mengubah formulir unit ${targetUnit}. Setiap unit sekolah berdiri sendiri.`,
      });
    }
  }

  // Ensure body unit matches
  if (req.body && req.body.unitId && req.body.unitId !== targetUnit) {
    return res.status(400).json({ error: 'Data unitId payload tidak sesuai dengan target URL.' });
  }

  // Strict schema validation
  if (!req.body || !Array.isArray(req.body.sections)) {
    return res.status(400).json({ error: 'Payload formulir harus memiliki array sections yang valid.' });
  }

  const ALLOWED_FIELD_TYPES = ['text', 'number', 'date', 'dropdown', 'file', 'textarea'];
  const sanitizedSections = [];
  for (const sec of req.body.sections) {
    if (!sec || typeof sec !== 'object' || typeof sec.id !== 'string' || !sec.id.trim()) {
      return res.status(400).json({ error: 'Setiap seksi formulir wajib memiliki ID yang valid.' });
    }
    if (typeof sec.title !== 'string' || sec.title.trim().length === 0 || sec.title.length > 200) {
      return res.status(400).json({ error: 'Judul seksi wajib diisi (maksimal 200 karakter).' });
    }
    if (!Array.isArray(sec.fields)) {
      return res.status(400).json({ error: `Daftar field pada seksi "${sec.title}" tidak valid.` });
    }

    const sanitizedFields = [];
    for (const f of sec.fields) {
      if (!f || typeof f !== 'object' || typeof f.id !== 'string' || !f.id.trim()) {
        return res.status(400).json({ error: 'Setiap field wajib memiliki ID yang valid.' });
      }
      if (typeof f.label !== 'string' || f.label.trim().length === 0 || f.label.length > 200) {
        return res.status(400).json({ error: 'Label pertanyaan wajib diisi (maksimal 200 karakter).' });
      }
      if (!ALLOWED_FIELD_TYPES.includes(f.type)) {
        return res.status(400).json({ error: `Tipe field "${f.type}" tidak didukung.` });
      }
      const isCoreName = isLockedNameField(f);
      sanitizedFields.push({
        id: f.id.trim(),
        label: f.label.trim(),
        type: isCoreName ? 'text' : f.type,
        required: isCoreName ? true : Boolean(f.required),
        helpText: typeof f.helpText === 'string' ? f.helpText.slice(0, 500) : '',
        options:
          !isCoreName && Array.isArray(f.options)
            ? f.options.map((o: any) => String(o).slice(0, 200))
            : undefined,
        fileConfig:
          !isCoreName && f.fileConfig && typeof f.fileConfig === 'object'
            ? {
                allowedTypes: Array.isArray(f.fileConfig.allowedTypes)
                  ? f.fileConfig.allowedTypes.map((t: any) => String(t).slice(0, 20))
                  : ['PDF', 'JPG', 'PNG'],
                maxSizeMB: Math.min(20, Math.max(1, Number(f.fileConfig.maxSizeMB) || 5)),
              }
            : undefined,
        ...(isCoreName ? { systemKey: 'fullName' as const, locked: true } : {}),
      });
    }

    sanitizedSections.push({
      id: sec.id.trim(),
      title: sec.title.trim(),
      description: typeof sec.description === 'string' ? sec.description.trim().slice(0, 500) : undefined,
      fields: sanitizedFields,
    });
  }

  // Server-side protection: locked core Name field cannot be deleted
  const existingSchemas = db.getFormSchemas();
  const existingUnitSchema = existingSchemas.find((s) => s.unitId === targetUnit);
  const existingHasLockedName = existingUnitSchema?.sections?.some((s) =>
    (s.fields || []).some((f) => isLockedNameField(f))
  );
  const incomingHasLockedName = sanitizedSections.some((s) =>
    (s.fields || []).some((f) => isLockedNameField(f))
  );
  if (existingHasLockedName && !incomingHasLockedName) {
    return res.status(400).json({
      error: 'Field Nama pada Section 1 bersifat wajib sistem (labelnya dapat diedit, tetapi field tidak dapat dihapus).',
    });
  }

  const normalizedSections = ensureCoreNameFieldInSections(sanitizedSections, targetUnit);

  // Server-side protection: saved sections can only be deleted by Admin Yayasan / Master Admin
  if (existingUnitSchema && Array.isArray(existingUnitSchema.sections)) {
    const incomingIds = new Set(normalizedSections.map((s) => s.id));
    const removedSavedSections = existingUnitSchema.sections.filter((s) => !incomingIds.has(s.id));
    if (removedSavedSections.length > 0) {
      const isMasterOrYayasan =
        req.user?.role === 'Super Admin Yayasan' ||
        req.user?.role === 'Admin Yayasan' ||
        (req.user?.role || '').toLowerCase().includes('yayasan') ||
        req.user?.schoolId === 'MASTER';
      if (!isMasterOrYayasan) {
        addAuditLog(
          'unauthorized_access' as any,
          req.user?.schoolId || targetUnit,
          `Akses Ditolak: ${req.user?.email} mencoba menghapus seksi tersimpan (${removedSavedSections.map((s) => s.title).join(', ')}) pada unit ${targetUnit}`,
          req.user?.email || 'unknown',
          req.ip || '127.0.0.1'
        );
        return res.status(403).json({
          error: 'Akses Ditolak: Seksi formulir yang sudah tersimpan tidak dapat dihapus oleh Admin Unit. Hanya Admin Yayasan atau Master Admin yang berwenang menghapus seksi tersimpan.',
        });
      }
    }
  }

  try {
    const actor = req.user?.email || req.user?.name || 'Admin';
    const actorRole = req.user?.role || 'Staff';
    const updated = await db.updateFormSchema(
      targetUnit as any,
      {
        unitId: targetUnit as any,
        sections: normalizedSections,
      },
      actor,
      actorRole
    );
    addAuditLog(
      'update_status' as any,
      targetUnit as any,
      `Form builder unit ${targetUnit} berhasil diperbarui (${sanitizedSections.length} seksi) oleh ${req.user?.email || 'admin'}`,
      req.user?.email || 'admin@arrisalahaceh.or.id',
      req.ip || '127.0.0.1'
    );
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal menyimpan skema formulir ke database.' });
  }
});

// Roles & Access API: GET for all users to sync RBAC, mutations strictly Super Admin Yayasan
app.get('/api/roles', optionalAuth, (req: Request, res: Response) => {
  res.json(db.getRoles());
});

app.post('/api/roles', requireAuth, requireRole(['Super Admin Yayasan']), async (req: Request, res: Response) => {
  try {
    const { name, schoolId, permissions, description } = req.body || {};
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.length > 100) {
      return res.status(400).json({ error: 'Nama role wajib 2-100 karakter.' });
    }
    const cleanSchool = typeof schoolId === 'string' && schoolId.trim() ? schoolId.trim().toUpperCase() : 'MASTER';
    const validUnits = ['MASTER', ...db.getUnits().map((u) => u.id)];
    if (!validUnits.includes(cleanSchool)) {
      return res.status(400).json({ error: 'Lingkup unit sekolah role tidak valid.' });
    }
    const cleanPermissions = Array.isArray(permissions)
      ? Array.from(new Set(permissions.map((p: any) => String(p).trim()).filter((p) => ALL_VALID_PERMISSIONS.has(p))))
      : [];
    const newRole = await db.createRole({
      name: name.trim(),
      schoolId: cleanSchool,
      permissions: cleanPermissions,
      description: typeof description === 'string' ? description.trim().slice(0, 500) : '',
    });
    res.status(201).json(newRole);
  } catch (err: any) {
    console.error('[API Create Role Error]:', err);
    res.status(500).json({ error: 'Gagal menyimpan role baru ke database.' });
  }
});

app.put('/api/roles/:id', requireAuth, requireRole(['Super Admin Yayasan']), async (req: Request, res: Response) => {
  try {
    const { name, schoolId, permissions, description } = req.body || {};
    const updates: Record<string, any> = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100) {
        return res.status(400).json({ error: 'Nama role wajib 2-100 karakter.' });
      }
      updates.name = name.trim();
    }
    if (schoolId !== undefined) {
      const cleanSchool = String(schoolId).trim().toUpperCase();
      const validUnits = ['MASTER', ...db.getUnits().map((u) => u.id)];
      if (!validUnits.includes(cleanSchool)) {
        return res.status(400).json({ error: 'Lingkup unit sekolah role tidak valid.' });
      }
      updates.schoolId = cleanSchool;
    }
    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: 'Daftar permissions role harus berupa array.' });
      }
      updates.permissions = Array.from(
        new Set(permissions.map((p: any) => String(p).trim()).filter((p) => ALL_VALID_PERMISSIONS.has(p)))
      );
    }
    if (description !== undefined) {
      updates.description = typeof description === 'string' ? description.trim().slice(0, 500) : '';
    }
    const updated = await db.updateRole(req.params.id, updates);
    res.json(updated);
  } catch (err: any) {
    console.error('[API Update Role Error]:', err);
    res.status(500).json({ error: 'Gagal menyimpan pembaruan role ke database.' });
  }
});

app.delete('/api/roles/:id', requireAuth, requireRole(['Super Admin Yayasan']), async (req: AuthRequest, res: Response) => {
  try {
    const actor = req.user?.email || req.user?.name || 'Master Admin';
    const actorRole = req.user?.role || 'Super Admin Yayasan';
    const success = await db.deleteRole(req.params.id, actor, actorRole);
    if (!success) {
      return res.status(404).json({ error: 'Role tidak ditemukan.' });
    }
    res.json({ success });
  } catch (err: any) {
    console.error('[API Delete Role Error]:', err);
    res.status(500).json({ error: 'Gagal menghapus role dari database.' });
  }
});

// Users API: Accessible strictly to authenticated users; full list requires staff management permission
app.get('/api/users', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const isSuper = user.role === 'Super Admin Yayasan' || user.email === 'master@dev.com';
  const isYys = user.role === 'Admin Yayasan' || user.email === 'adminyys@dev.com' || user.role?.includes('Admin Yayasan');
  const hasPerm = user.permissions?.includes('Kelola Users') || user.permissions?.some((p: string) => p.startsWith('Kelola Users'));

  if (!isSuper && !isYys && !hasPerm) {
    const self = db.getUsers().find((u) => u.id === user.id) || user;
    return res.json([self]);
  }

  let users = db.getUsers(user);
  if (!isSuper && !isYys && user.schoolId && user.schoolId !== 'MASTER') {
    users = users.filter((u) => u.schoolId === user.schoolId || u.id === user.id);
  }
  res.json(users);
});

app.post('/api/users', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const isSuper = req.user?.role === 'Super Admin Yayasan' || req.user?.email === 'master@dev.com';
    const isYys = req.user?.role === 'Admin Yayasan' || req.user?.email === 'adminyys@dev.com' || req.user?.role?.includes('Admin Yayasan');
    const hasPerm = req.user?.permissions?.includes('Kelola Users') || req.user?.permissions?.includes('Kelola Users:add');

    if (!isSuper && !isYys && !hasPerm) {
      return res.status(403).json({ error: 'Akses Ditolak: Anda tidak memiliki izin menambah staf.' });
    }

    const { name, email, phone, schoolId, role, permissions, isActive, password } = req.body || {};
    if (!name || typeof name !== 'string' || !email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Nama lengkap dan alamat email valid wajib diisi.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const targetSchoolId = typeof schoolId === 'string' && schoolId.trim() ? schoolId.trim().toUpperCase() : 'MASTER';

    if (!isSuper) {
      const requestedRole = String(role || '');
      if (
        requestedRole.includes('Super Admin') ||
        requestedRole.includes('Admin Yayasan') ||
        cleanEmail === 'master@dev.com' ||
        cleanEmail === 'adminyys@dev.com'
      ) {
        return res.status(403).json({
          error: 'Akses Ditolak: Anda tidak memiliki wewenang untuk membuat akun staf tingkat Master atau Admin Yayasan.',
        });
      }
      if (!isYys && req.user?.schoolId && req.user.schoolId !== 'MASTER') {
        if (targetSchoolId !== req.user.schoolId) {
          return res.status(403).json({
            error: `Pelanggaran Batas Unit: Anda hanya berhak menambah staf untuk unit ${req.user.schoolId}.`,
          });
        }
      }
      if (Array.isArray(permissions)) {
        const triesSuperPerm = permissions.some((p: any) =>
          SUPER_ADMIN_ONLY_MODULES.has(String(p).split(':')[0].trim())
        );
        if (triesSuperPerm) {
          return res.status(403).json({
            error: 'Akses Ditolak: Hak akses modul khusus Master Admin tidak dapat diberikan.',
          });
        }
      }
    }

    if (db.getUsers().some((u) => u.email.toLowerCase() === cleanEmail)) {
      return res.status(409).json({ error: `Alamat email "${cleanEmail}" sudah terdaftar di sistem.` });
    }
    if (password !== undefined && (typeof password !== 'string' || password.length < 6)) {
      return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
    }

    const cleanPerms = Array.isArray(permissions)
      ? Array.from(new Set(permissions.map((p: any) => String(p).trim()).filter((p) => ALL_VALID_PERMISSIONS.has(p))))
      : [];

    const newUser = await db.createUser({
      name: name.trim().slice(0, 150),
      email: cleanEmail,
      phone: typeof phone === 'string' ? phone.trim().slice(0, 30) : '',
      schoolId: targetSchoolId,
      role: typeof role === 'string' && role.trim() ? role.trim() : 'Staf Verifikator Berkas',
      permissions: cleanPerms,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      emailVerified: true,
      password,
    });
    res.status(201).json(newUser);
  } catch (err: any) {
    console.error('[API Create User Error]:', err);
    res.status(500).json({ error: 'Gagal menyimpan akun pengguna ke database.' });
  }
});

app.put('/api/users/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const isSelf = req.user?.id === req.params.id;
    const isSuper = req.user?.role === 'Super Admin Yayasan' || req.user?.email === 'master@dev.com';
    const isYys = req.user?.role === 'Admin Yayasan' || req.user?.email === 'adminyys@dev.com' || req.user?.role?.includes('Admin Yayasan');
    const hasPerm = req.user?.permissions?.includes('Kelola Users') || req.user?.permissions?.includes('Kelola Users:edit');

    if (!isSelf && !isSuper && !isYys && !hasPerm) {
      return res.status(403).json({ error: 'Akses Ditolak: Anda tidak memiliki izin mengubah data akun pengguna.' });
    }

    const target = db.getUsers().find((u) => u.id === req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    let sanitizedUpdates: Record<string, any> = {};
    if (isSelf && !isSuper) {
      const { name, phone, password } = req.body || {};
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Nama lengkap wajib diisi.' });
      }
      sanitizedUpdates = {
        name: name.trim().slice(0, 150),
        phone: phone ? String(phone).trim().slice(0, 30) : '',
      };
      if (password && typeof password === 'string' && password.length >= 6) {
        sanitizedUpdates.password = password;
      }
    } else {
      // Admin/Staff modifying user: enforce hierarchy, unit isolation & strict field allowlist
      if (!isSuper) {
        const isTargetMaster =
          target.role === 'Super Admin Yayasan' ||
          target.email === 'master@dev.com' ||
          target.role?.includes('Super Admin');
        const isTargetYys =
          target.role === 'Admin Yayasan' ||
          target.email === 'adminyys@dev.com' ||
          (target.role?.includes('Admin Yayasan') && !target.role?.includes('Super'));
        if (isTargetMaster || isTargetYys) {
          return res.status(403).json({
            error: 'Akses Ditolak: Akun Master dan Admin Yayasan dilindungi sistem dan tidak dapat diubah.',
          });
        }
        if (!isYys && req.user?.schoolId && req.user.schoolId !== 'MASTER' && target.schoolId !== req.user.schoolId) {
          return res.status(403).json({
            error: `Pelanggaran Batas Unit: Anda hanya berhak mengelola akun unit ${req.user.schoolId}.`,
          });
        }

        const requestedRole = String(req.body?.role || '');
        if (requestedRole.includes('Super Admin') || requestedRole.includes('Admin Yayasan')) {
          return res.status(403).json({
            error: 'Akses Ditolak: Anda tidak memiliki wewenang menaikkan hak staf ke tingkat Master atau Admin Yayasan.',
          });
        }
        if (req.body?.schoolId !== undefined && !isYys && req.user?.schoolId && req.user.schoolId !== 'MASTER') {
          const reqSchool = String(req.body.schoolId).trim().toUpperCase();
          if (reqSchool !== req.user.schoolId) {
            return res.status(403).json({
              error: `Pelanggaran Batas Unit: Tidak dapat memindahkan akun ke unit ${reqSchool}.`,
            });
          }
        }
        if (Array.isArray(req.body?.permissions)) {
          const triesSuperPerm = req.body.permissions.some((p: any) =>
            SUPER_ADMIN_ONLY_MODULES.has(String(p).split(':')[0].trim())
          );
          if (triesSuperPerm) {
            return res.status(403).json({
              error: 'Akses Ditolak: Hak akses modul khusus Master Admin tidak dapat diberikan.',
            });
          }
        }
      }

      const { name, email, phone, schoolId, role, permissions, isActive, emailVerified, password } = req.body || {};
      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
          return res.status(400).json({ error: 'Nama lengkap tidak valid.' });
        }
        sanitizedUpdates.name = name.trim().slice(0, 150);
      }
      if (email !== undefined) {
        if (typeof email !== 'string' || !email.includes('@')) {
          return res.status(400).json({ error: 'Alamat email tidak valid.' });
        }
        sanitizedUpdates.email = email.trim().toLowerCase();
      }
      if (phone !== undefined) sanitizedUpdates.phone = String(phone).trim().slice(0, 30);
      if (schoolId !== undefined) sanitizedUpdates.schoolId = String(schoolId).trim().toUpperCase();
      if (role !== undefined && typeof role === 'string' && role.trim()) sanitizedUpdates.role = role.trim().slice(0, 100);
      if (permissions !== undefined) {
        if (!Array.isArray(permissions)) {
          return res.status(400).json({ error: 'Format permissions tidak valid.' });
        }
        sanitizedUpdates.permissions = Array.from(
          new Set(permissions.map((p: any) => String(p).trim()).filter((p) => ALL_VALID_PERMISSIONS.has(p)))
        );
      }
      if (isActive !== undefined) sanitizedUpdates.isActive = Boolean(isActive);
      if (emailVerified !== undefined && isSuper) sanitizedUpdates.emailVerified = Boolean(emailVerified);
      if (password !== undefined && typeof password === 'string' && password.length > 0) {
        if (password.length < 6) {
          return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
        }
        sanitizedUpdates.password = password;
      }
    }

    if (sanitizedUpdates.email) {
      const cleanEmail = String(sanitizedUpdates.email).trim().toLowerCase();
      const existing = db.getUsers().find((u) => u.email.toLowerCase() === cleanEmail && u.id !== req.params.id);
      if (existing) {
        return res.status(400).json({ error: `Alamat email "${cleanEmail}" sudah digunakan oleh akun lain (${existing.name}).` });
      }
      sanitizedUpdates.email = cleanEmail;
    }

    const updated = await db.updateUser(req.params.id, sanitizedUpdates);
    if (!updated) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    res.json(updated);
  } catch (err: any) {
    console.error('[API Update User Error]:', err);
    res.status(500).json({ error: 'Gagal menyimpan pembaruan pengguna ke database.' });
  }
});

// Admin-triggered Password Reset Email via One-Time Token (NO default password fallback)
app.post('/api/users/:id/reset-password', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const isSuper = req.user?.role === 'Super Admin Yayasan' || req.user?.email === 'master@dev.com';
    const isYys = req.user?.role === 'Admin Yayasan' || req.user?.email === 'adminyys@dev.com' || req.user?.role?.includes('Admin Yayasan');
    const hasPerm = req.user?.permissions?.includes('Kelola Users') || req.user?.permissions?.includes('Kelola Users:edit');

    if (!isSuper && !isYys && !hasPerm) {
      return res.status(403).json({ error: 'Akses Ditolak: Anda tidak memiliki izin mereset kata sandi pengguna.' });
    }

    const target = db.getUsers().find((u) => u.id === req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    if (!isSuper) {
      const isTargetMaster =
        target.role === 'Super Admin Yayasan' || target.email === 'master@dev.com' || target.role?.includes('Super Admin');
      const isTargetYys =
        target.role === 'Admin Yayasan' || target.email === 'adminyys@dev.com' || (target.role?.includes('Admin Yayasan') && !target.role?.includes('Super'));
      if (isTargetMaster || isTargetYys) {
        return res.status(403).json({ error: 'Akses Ditolak: Akun Master dan Admin Yayasan dilindungi sistem.' });
      }
      if (!isYys && req.user?.schoolId && req.user.schoolId !== 'MASTER' && target.schoolId !== req.user.schoolId) {
        return res.status(403).json({ error: `Pelanggaran Batas Unit: Anda hanya berhak mereset akun unit ${req.user.schoolId}.` });
      }
    }

    const tokenResult = db.createPasswordResetToken(target.id);
    if (!tokenResult.success) {
      const status = (tokenResult as any).cooldownSeconds ? 429 : 400;
      return res.status(status).json({ error: tokenResult.error });
    }

    const appBaseUrl =
      (process.env.APP_URL && process.env.APP_URL.trim().replace(/\/+$/, '')) ||
      `${req.protocol}://${req.get('host')}`;
    const resetLink = `${appBaseUrl}/?resetToken=${encodeURIComponent(tokenResult.rawToken)}`;

    const mailOutcome = await sendMailWithActiveSmtp({
      to: target.email,
      subject: '🔐 Tautan Atur Ulang Kata Sandi Portal PPDB (Oleh Administrator)',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; border: 1px solid #16a34a; border-radius: 16px; overflow: hidden; background: #ffffff;">
          <div style="background-color: #14532d; color: white; padding: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px;">YAYASAN AR-RISALAH ACEH</h2>
            <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Reset Kata Sandi Akun Portal PPDB</p>
          </div>
          <div style="padding: 28px 24px; color: #1e293b;">
            <p style="font-size: 14px; line-height: 1.6;">
              Assalamu'alaikum <strong>${escapeHtml(target.name)}</strong>,<br/>
              Administrator (${escapeHtml(req.user?.name || req.user?.email)}) mengirimkan tautan aman sekali pakai untuk mengatur ulang kata sandi akun Anda (<strong>${escapeHtml(target.email)}</strong>).
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${escapeHtml(resetLink)}" style="display: inline-block; background-color: #15803d; color: #ffffff; text-decoration: none; font-weight: bold; padding: 14px 26px; border-radius: 10px; font-size: 14px;">
                Buat Kata Sandi Baru
              </a>
            </div>
            <p style="font-size: 12px; color: #64748b; word-break: break-all;">
              Salin tautan berikut bila tombol tidak berfungsi:<br/>${escapeHtml(resetLink)}
            </p>
            <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 12px; font-size: 12px; color: #92400e;">
              Tautan ini berlaku <strong>15 menit</strong> untuk <strong>1 kali penggunaan</strong>.
            </div>
          </div>
        </div>
      `,
    });

    if (!mailOutcome.sent) {
      return res.status(503).json({
        error: 'Layanan email SMTP belum aktif atau gagal mengirim email reset. Aktifkan SMTP atau ubah kata sandi langsung melalui form Edit User.',
      });
    }

    addAuditLog(
      'update_status',
      target.schoolId || 'MASTER',
      `Admin ${req.user?.email} mengirim tautan reset kata sandi sekali pakai ke ${target.email}`,
      req.user?.email || 'admin',
      req.ip || '127.0.0.1'
    );

    res.json({
      success: true,
      message: `Tautan reset kata sandi aman (berlaku 15 menit) telah dikirim ke email ${target.email}.`,
    });
  } catch (err: any) {
    console.error('[Admin Reset Password Error]:', err);
    res.status(500).json({ error: 'Gagal memproses reset kata sandi.' });
  }
});

app.delete('/api/users/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const isSuper = req.user?.role === 'Super Admin Yayasan' || req.user?.email === 'master@dev.com';
    const isYys = req.user?.role === 'Admin Yayasan' || req.user?.email === 'adminyys@dev.com' || req.user?.role?.includes('Admin Yayasan');
    const hasPerm = req.user?.permissions?.includes('Kelola Users') || req.user?.permissions?.includes('Kelola Users:delete');

    if (!isSuper && !isYys && !hasPerm) {
      return res.status(403).json({ error: 'Akses Ditolak: Anda tidak memiliki izin menghapus staf.' });
    }

    const target = db.getUsers().find((u) => u.id === req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    if (!isSuper) {
      const isTargetMaster =
        target.role === 'Super Admin Yayasan' ||
        target.email === 'master@dev.com' ||
        target.role?.includes('Super Admin');
      const isTargetYys =
        target.role === 'Admin Yayasan' ||
        target.email === 'adminyys@dev.com' ||
        (target.role?.includes('Admin Yayasan') && !target.role?.includes('Super'));
      if (isTargetMaster || isTargetYys) {
        return res.status(403).json({
          error: 'Akses Ditolak: Akun Master dan Admin Yayasan dilindungi sistem dan tidak dapat dihapus.',
        });
      }
      if (!isYys && req.user?.schoolId && req.user.schoolId !== 'MASTER' && target.schoolId !== req.user.schoolId) {
        return res.status(403).json({
          error: `Pelanggaran Batas Unit: Anda hanya berhak menghapus akun unit ${req.user.schoolId}.`,
        });
      }
    }

    const actor = req.user?.email || req.user?.name || 'Admin';
    const actorRole = req.user?.role || 'Staff';
    const success = await db.deleteUser(req.params.id, actor, actorRole);
    if (!success) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }
    res.json({ success });
  } catch (err: any) {
    console.error('[API Delete User Error]:', err);
    res.status(500).json({ error: 'Gagal menghapus pengguna dari database.' });
  }
});

// Academic Years API: Master only
app.get('/api/academic-years', (req: Request, res: Response) => {
  res.json(db.getAcademicYears());
});

app.post('/api/academic-years', requireAuth, requireMaster, async (req: Request, res: Response) => {
  try {
    const { year, yearLabel, startDate, endDate } = req.body || {};
    const label = String(year || yearLabel || '').trim();
    if (!label || label.length > 50) {
      return res.status(400).json({ error: 'Label tahun ajaran wajib diisi (maks 50 karakter).' });
    }
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(startDate)) || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(endDate))) {
      return res.status(400).json({ error: 'Tanggal mulai dan selesai wajib berformat YYYY-MM-DD.' });
    }
    const newAy = await db.createAcademicYear({
      year: label,
      startDate: String(startDate),
      endDate: String(endDate),
    });
    res.status(201).json(newAy);
  } catch (err: any) {
    console.error('[API Create Academic Year Error]:', err);
    res.status(500).json({ error: 'Gagal menyimpan tahun ajaran baru ke database.' });
  }
});

app.post('/api/academic-years/:id/activate', requireAuth, requireMaster, async (req: Request, res: Response) => {
  try {
    const ok = await db.activateAcademicYear(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: 'Periode tahun ajaran tidak ditemukan.' });
    }
    res.json({ message: 'Tahun ajaran berhasil diaktifkan.' });
  } catch (err: any) {
    console.error('[API Activate Academic Year Error]:', err);
    res.status(500).json({ error: 'Gagal mengaktifkan tahun ajaran di database.' });
  }
});

// Landing Page Config API: Master only
app.get('/api/landing-config', (req: Request, res: Response) => {
  res.json(db.getLandingConfig());
});

app.put('/api/landing-config', requireAuth, requireMaster, async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Payload konfigurasi landing page tidak valid.' });
    }
    if (body.logoUrl && !isSafeHttpUrl(body.logoUrl, true) && !String(body.logoUrl).startsWith('data:image/')) {
      return res.status(400).json({ error: 'URL logo landing page tidak valid atau tidak aman.' });
    }
    if (body.faviconUrl && !isSafeHttpUrl(body.faviconUrl, true) && !String(body.faviconUrl).startsWith('data:image/')) {
      return res.status(400).json({ error: 'URL favicon landing page tidak valid atau tidak aman.' });
    }
    if (body.canonicalUrl && String(body.canonicalUrl).trim() !== '' && !isSafeHttpUrl(body.canonicalUrl, false)) {
      return res.status(400).json({ error: 'Canonical URL harus diawali http:// atau https://.' });
    }
    if (body.ogImage && String(body.ogImage).trim() !== '' && !isSafeHttpUrl(body.ogImage, true)) {
      return res.status(400).json({ error: 'URL OG Image tidak aman.' });
    }
    if (body.structuredDataJson && String(body.structuredDataJson).trim() !== '') {
      try {
        JSON.parse(String(body.structuredDataJson));
      } catch {
        return res.status(400).json({ error: 'Structured Data JSON-LD tidak valid.' });
      }
    }
    if (Array.isArray(body.heroSlides)) {
      for (const slide of body.heroSlides) {
        if (slide?.imageUrl && !isSafeHttpUrl(slide.imageUrl, true) && !String(slide.imageUrl).startsWith('data:image/')) {
          return res.status(400).json({ error: 'URL gambar slide hero tidak valid.' });
        }
        if (slide?.buttonLink && String(slide.buttonLink).trim() !== '' && !String(slide.buttonLink).startsWith('#') && !isSafeHttpUrl(slide.buttonLink, true)) {
          return res.status(400).json({ error: 'Tautan tombol slide hero tidak aman.' });
        }
      }
    }

    const actor = req.user?.email || req.user?.name || 'Master Admin';
    const actorRole = req.user?.role || 'Super Admin Yayasan';
    const updated = await db.updateLandingConfig(body, actor, actorRole);
    res.json(updated);
  } catch (err: any) {
    console.error('[API Update Landing Config Error]:', err);
    res.status(500).json({ error: 'Gagal menyimpan konfigurasi landing page ke database.' });
  }
});

// Image Upload Endpoint with Strict Format & Magic-Byte Allowlist (Block SVG XSS)
app.post('/api/upload', requireAuth, uploadRateLimiter, async (req: Request, res: Response) => {
  try {
    const { filename, data } = req.body || {};
    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'Data file gambar (base64) wajib disertakan.' });
    }

    const check = verifyDataUriPayload(data, { allowPdf: false, allowIco: false });
    if (!check.ok) {
      return res.status(400).json({ error: check.error });
    }

    const sanitizedName = (filename || 'image')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 30);
    const safeFilename = `${Date.now()}_${sanitizedName}.${check.ext}`;
    const filePath = path.join(uploadsDir, safeFilename);

    await fs.promises.writeFile(filePath, check.buffer);
    const dataFilePath = path.join(dataUploadsDir, safeFilename);
    await fs.promises.writeFile(dataFilePath, check.buffer).catch(() => {});

    const fileUrl = `/uploads/${safeFilename}`;
    res.json({
      success: true,
      url: fileUrl,
      filename: safeFilename,
      sizeKB: Math.round(check.buffer.length / 1024),
    });
  } catch (err: any) {
    console.error('[Upload API Error]:', err);
    res.status(500).json({ error: 'Gagal mengunggah dan menyimpan file gambar ke server.' });
  }
});

// Audit Logs API: Server-authoritative audit + client export tracking + integrity verification
app.get('/api/audit-logs', requireAuth, requirePermission('Audit Log'), (req: Request, res: Response) => {
  res.json(db.getAuditLogs());
});

app.get('/api/audit-logs/verify-integrity', requireAuth, requirePermission('Audit Log'), (req: Request, res: Response) => {
  res.json(db.verifyAuditLogIntegrity());
});

app.post('/api/audit-logs', requireAuth, (req: AuthRequest, res: Response) => {
  if (isWaliRoleName(req.user?.role)) {
    return res.status(403).json({ error: 'Akses Ditolak: Pengguna portal wali tidak dapat menulis log audit staf.' });
  }
  const CLIENT_ALLOWED_ACTIONS = new Set(['export_data', 'export_config']);
  const rawAction = String(req.body?.action || '').trim();
  if (!CLIENT_ALLOWED_ACTIONS.has(rawAction)) {
    return res.status(403).json({ error: 'Aksi log audit harus dicatat otomatis oleh operasi backend.' });
  }
  const details = typeof req.body?.details === 'string' ? req.body.details.trim().slice(0, 500) : 'Ekspor data oleh staf.';
  const email = req.user!.email;
  const unit = req.user!.schoolId || 'MASTER';
  const log = addAuditLog(rawAction as any, unit, details, email, req.ip || '127.0.0.1');
  res.status(201).json(log);
});

app.get('/api/system-security-status', requireAuth, requirePermission('Status Sistem'), async (req: Request, res: Response) => {
  try {
    const tables = await db.getRealDbTables();
    const cf = getEnvCloudflareConfig();
    const smtp = db.getSmtpConfig();
    const auditIntegrity = db.verifyAuditLogIntegrity();
    const dbStatus = db.getDbStatus();

    res.json({
      database: dbStatus,
      tableCount: tables.length,
      tables: tables.map((t) => ({ name: t.name, rowCount: t.rowCount, isLiveMySQL: t.isLiveMySQL })),
      security: {
        appMode: isProd ? 'production' : 'development',
        authMechanism: 'HttpOnly Cookie + HMAC-SHA256 Session + CSRF Token + Bcrypt (cost 10)',
        sessionDuration: '7 Hari (Auto-revoke saat ganti password/role/nonaktif)',
        corsAllowlistActive: !allowAllOriginsWildcard,
        corsWildcard: allowAllOriginsWildcard,
        rateLimits: {
          generalUnauth: isProd ? `${MAX_REQUESTS_UNAUTH} Req / 5 Menit` : 'Mode Development (Non-blocking)',
          generalAuth: isProd ? `${MAX_REQUESTS_AUTH} Req / 5 Menit` : 'Mode Development (Non-blocking)',
          authSensitive: `${MAX_AUTH_ATTEMPTS} Req / 1 Menit`,
          otp: isProd ? '10 Req / 10 Menit' : 'Mode Development (Non-blocking)',
          publicLookup: isProd ? '30 Req / 5 Menit' : 'Mode Development (Non-blocking)',
          upload: isProd ? '40 Req / 5 Menit' : 'Mode Development (Non-blocking)',
        },
        cloudflareEnabled: cf.enabled,
        cloudflareManagedByEnv: true,
        smtpEnabled: Boolean(smtp.enabled),
        smtpVerified: Boolean(smtp.isVerified),
        auditIntegrity,
        securityHeaders: [
          'HttpOnly Session Cookie + X-CSRF-Token',
          'Content-Security-Policy',
          'X-Content-Type-Options: nosniff',
          'X-Frame-Options: SAMEORIGIN',
          'Referrer-Policy: strict-origin-when-cross-origin',
          'Permissions-Policy',
        ],
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Gagal memuat status keamanan sistem.' });
  }
});

// Download MySQL SQL Dump File: Restricted to Super Admin (Master) role only
app.get('/api/database/sql-dump', requireAuth, requireRole(['Super Admin Yayasan']), (req: Request, res: Response) => {
  const sql = db.getSqlDump();
  res.setHeader('Content-Type', 'application/sql');
  res.setHeader('Content-Disposition', 'attachment; filename="ppdb_arrisalah_mysql.sql"');
  res.send(sql);
});

// -------------------------------------------------------------
// Real Database Explorer API: Master only with Encrypted PIN Guard
// -------------------------------------------------------------
const REAL_DB_PIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REAL_DB_PIN_ATTEMPTS = 50; // High limit to allow admin entry

const realDbPinRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const attempt = realDbPinRateLimitMap.get(ip);

  if (!attempt || now > attempt.resetTime) {
    realDbPinRateLimitMap.set(ip, { count: 1, resetTime: now + REAL_DB_PIN_WINDOW_MS });
    return next();
  }

  if (attempt.count >= MAX_REAL_DB_PIN_ATTEMPTS) {
    return res.status(429).json({
      error: 'Terlalu banyak percobaan PIN keamanan database. Silakan coba lagi sebentar.',
    });
  }

  attempt.count++;
  next();
};

const requireRealDbAccess = (req: Request, res: Response, next: NextFunction) => {
  const dbToken = req.headers['x-db-access-token'] as string;
  if (!dbToken || !db.verifyRealDbAccessToken(dbToken)) {
    return res.status(401).json({
      error: 'Akses Ditolak: PIN Keamanan Database diperlukan atau sesi inspeksi database telah kedaluwarsa.',
    });
  }
  next();
};

app.post(
  '/api/real-db/verify-pin',
  requireAuth,
  requireRole(['Super Admin Yayasan']),
  realDbPinRateLimiter,
  (req: Request, res: Response) => {
    const { pin } = req.body;
    if (!pin || typeof pin !== 'string') {
      return res.status(400).json({ error: 'PIN keamanan wajib diisi.' });
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const result = db.verifyRealDbPin(pin.trim(), ip);
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    realDbPinRateLimitMap.delete(ip);
    res.json(result);
  }
);

app.post(
  '/api/real-db/revoke-pin',
  requireAuth,
  requireRole(['Super Admin Yayasan']),
  (req: Request, res: Response) => {
    const dbToken = req.headers['x-db-access-token'] as string;
    if (dbToken) {
      db.revokeRealDbAccessToken(dbToken);
    }
    res.json({ success: true, message: 'Sesi inspeksi database telah dikunci kembali.' });
  }
);

app.get(
  '/api/real-db/tables',
  requireAuth,
  requireRole(['Super Admin Yayasan']),
  requireRealDbAccess,
  async (req: Request, res: Response) => {
    try {
      const tables = await db.getRealDbTables();
      res.json(tables);
    } catch (err: any) {
      res.status(500).json({ error: 'Gagal memuat daftar tabel database.', message: err.message });
    }
  }
);

app.get(
  '/api/real-db/table/:tableName',
  requireAuth,
  requireRole(['Super Admin Yayasan']),
  requireRealDbAccess,
  async (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 25;
      const search = (req.query.search as string) || '';

      const data = await db.getRealDbTableData(tableName, page, limit, search);
      res.json(data);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Gagal memuat isi tabel database.' });
    }
  }
);

// -------------------------------------------------------------
// Wali Registration & Email Verification Endpoints
// -------------------------------------------------------------
app.post('/api/auth/register-wali', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { name, email, phone, password, turnstileToken } = req.body || {};
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

    const cfCheck = await verifyTurnstileServer(turnstileToken, ip);
    if (!cfCheck.success) {
      return res.status(400).json({ error: cfCheck.error });
    }

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Nama lengkap, email, nomor WhatsApp, dan kata sandi wajib diisi.' });
    }
    if (typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Format email tidak valid.' });
    }
    if (typeof phone !== 'string' || phone.replace(/\D/g, '').length < 9) {
      return res.status(400).json({ error: 'Nomor WhatsApp minimal 9 digit angka.' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Kata sandi minimal 6 karakter demi keamanan.' });
    }

    const result = await db.registerWaliAccount({ name, email, phone, password }, ip);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const csrfToken = result.token ? setAuthCookies(req, res, result.token) : '';
    res.status(201).json({
      success: true,
      user: result.user,
      csrfToken,
    });
  } catch (err: any) {
    console.error('[Register Wali Error]:', err);
    res.status(500).json({ error: 'Gagal memproses pendaftaran akun wali.' });
  }
});

// -------------------------------------------------------------
// Email OTP Verification Endpoints (No Plaintext OTP Leak)
// -------------------------------------------------------------
app.post('/api/auth/send-verification-otp', requireAuth, otpRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Autentikasi diperlukan.' });
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const result = db.generateEmailVerificationOtp(userId, ip);

    if (!result.success || !result.email || !result.otp) {
      return res.status(400).json({ error: result.error || 'Gagal membuat kode OTP verifikasi.', cooldownSeconds: result.cooldownSeconds });
    }

    const recipientEmail: string = result.email;
    const otpCode: string = result.otp;

    const mailOutcome = await sendMailWithActiveSmtp({
      to: recipientEmail,
      subject: `🔐 Kode OTP Verifikasi Email PPDB - Yayasan Ar-Risalah Aceh`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; border: 1px solid #16a34a; border-radius: 16px; overflow: hidden; background: #ffffff;">
          <div style="background-color: #14532d; color: white; padding: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px; letter-spacing: 0.5px;">YAYASAN AR-RISALAH ACEH</h2>
            <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Penerimaan Peserta Didik Baru (PPDB) ${escapeHtml(getActiveAcademicYearLabel(db.getAcademicYears()))}</p>
          </div>
          <div style="padding: 28px 24px; color: #1e293b;">
            <h3 style="color: #14532d; margin-top: 0; font-size: 16px;">Verifikasi Alamat Email Akun Wali Siswa</h3>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              Assalamu'alaikum Warahmatullahi Wabarakatuh.<br/>
              Gunakan kode OTP 6-digit di bawah ini untuk memverifikasi alamat email <strong>${escapeHtml(recipientEmail)}</strong>:
            </p>
            <div style="background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 12px; padding: 18px; margin: 20px 0; text-align: center;">
              <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold; color: #15803d; display: block; margin-bottom: 6px;">KODE VERIFIKASI OTP:</span>
              <span style="font-size: 32px; font-weight: 800; font-family: monospace; letter-spacing: 6px; color: #14532d;">${escapeHtml(otpCode)}</span>
            </div>
            <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 12px; font-size: 12px; color: #92400e;">
              <strong>Perhatian:</strong> Kode ini hanya berlaku selama <strong>10 menit</strong>. Jangan pernah membagikan kode OTP ini kepada siapapun demi keamanan akun Anda.
            </div>
            <p style="font-size: 13px; color: #64748b; margin-top: 24px; line-height: 1.5;">
              Setelah email terverifikasi, kartu tanda peserta seleksi dan bukti pembayaran pendaftaran ananda akan otomatis dikirimkan ke email ini.
            </p>
          </div>
          <div style="background: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            © ${new Date().getFullYear()} Panitia PPDB Yayasan Ar-Risalah Aceh • Email Resmi Sistem
          </div>
        </div>
      `,
    });

    if (!mailOutcome.sent) {
      return res.status(503).json({
        success: false,
        error: 'Layanan email SMTP belum aktif atau gagal mengirim kode OTP. Silakan hubungi Panitia PPDB.',
      });
    }

    res.json({
      success: true,
      message: `Kode OTP 6-digit telah dikirim ke email ${recipientEmail}.`,
      sentVia: 'smtp',
      cooldownSeconds: 60,
    });
  } catch (err: any) {
    console.error('[Send OTP Error]:', err);
    res.status(500).json({ error: 'Gagal mengirim kode OTP verifikasi email.' });
  }
});

app.post('/api/auth/verify-verification-otp', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Autentikasi diperlukan.' });
    }

    const { otp } = req.body;
    if (!otp || typeof otp !== 'string') {
      return res.status(400).json({ error: 'Kode OTP wajib diisi.' });
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const result = await db.verifyEmailVerificationOtp(userId, otp, ip);

    if (!result.success) {
      return res.status(400).json({ error: result.error, attemptsLeft: (result as any).attemptsLeft });
    }

    res.json(result);
  } catch (err: any) {
    console.error('[Verify OTP Error]:', err);
    res.status(500).json({ error: 'Gagal memverifikasi kode OTP.' });
  }
});

app.post('/api/auth/verify-email', requireAuth, requireRole(['Super Admin Yayasan']), async (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = typeof req.body?.userId === 'string' && req.body.userId.trim() ? req.body.userId.trim() : req.user?.id;
    if (!targetUserId) {
      return res.status(400).json({ error: 'ID pengguna tidak valid.' });
    }
    const result = await db.verifyWaliEmail(targetUserId);
    res.json(result);
  } catch (err: any) {
    console.error('[Verify Email Error]:', err);
    res.status(500).json({ error: 'Gagal memverifikasi email ke database.' });
  }
});

// -------------------------------------------------------------
// Offline / Walk-in Registration Endpoint (Strict Validation + Quota Check)
// -------------------------------------------------------------
app.post('/api/students/offline', requireAuth, requirePermission('Pendaftar', 'add'), requireUnitIsolation, async (req: AuthRequest, res: Response) => {
  try {
    const {
      fullName,
      unit: rawUnit,
      nisn,
      gender,
      birthPlace,
      birthDate,
      address,
      parentName,
      parentPhone,
      parentJob,
      parentIncome,
      track,
      schoolOrigin,
      documents,
      dynamicAnswers,
    } = req.body || {};

    const unit = typeof rawUnit === 'string' ? rawUnit.trim().toUpperCase() : '';
    const validUnits = db.getUnits();
    const targetUnit = validUnits.find((u) => u.id === unit);
    if (!unit || !targetUnit) {
      return res.status(400).json({ error: 'Unit sekolah tujuan tidak valid atau tidak terdaftar.' });
    }
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.length > 200) {
      return res.status(400).json({ error: 'Nama lengkap calon siswa wajib diisi (2-200 karakter).' });
    }
    if (parentName !== undefined && typeof parentName !== 'string') {
      return res.status(400).json({ error: 'Format nama wali tidak valid.' });
    }
    if (parentPhone !== undefined && typeof parentPhone !== 'string') {
      return res.status(400).json({ error: 'Format nomor telepon tidak valid.' });
    }

    let sanitizedNisn = '';
    if (nisn && typeof nisn === 'string' && nisn.trim().length > 0) {
      const cleanNisn = nisn.replace(/\D/g, '');
      if (cleanNisn.length !== 10) {
        return res.status(400).json({ error: 'NISN harus tepat 10 digit angka jika diisi.' });
      }
      const existingNisn = db.getStudents().find((s) => s.nisn && s.nisn.trim() === cleanNisn);
      if (existingNisn) {
        return res.status(409).json({
          error: `Calon siswa dengan NISN ${cleanNisn} sudah terdaftar sebelumnya (${existingNisn.registrationNumber}).`,
        });
      }
      sanitizedNisn = cleanNisn;
    }

    const isSafeDocVal = (val: unknown): boolean => {
      if (val === '') return true;
      if (typeof val !== 'string' || val.length > 8 * 1024 * 1024) return false;
      if (val.startsWith('data:')) return verifyDataUriPayload(val, { allowPdf: true }).ok;
      return isSafeHttpUrl(val, true);
    };

    const sanitizedDocs: Record<string, string> = {};
    if (documents && typeof documents === 'object' && !Array.isArray(documents)) {
      for (const [k, v] of Object.entries(documents)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype' || !v) continue;
        if (!isSafeDocVal(v)) {
          return res.status(400).json({ error: `Format dokumen "${k}" tidak valid.` });
        }
        sanitizedDocs[k] = String(v);
      }
    }

    const sanitizedAnswers: Record<string, any> = {};
    if (dynamicAnswers && typeof dynamicAnswers === 'object' && !Array.isArray(dynamicAnswers)) {
      for (const [k, v] of Object.entries(dynamicAnswers)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        if (typeof v === 'string' && v.startsWith('data:') && !isSafeDocVal(v)) {
          return res.status(400).json({ error: `Format berkas pada kolom "${k}" tidak diizinkan.` });
        }
        sanitizedAnswers[k] = v;
      }
    }

    const recordedBy = req.user?.email || 'admin@arrisalahaceh.or.id';
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const newStudent = await db.addOfflineStudent(
      {
        fullName: fullName.trim().slice(0, 200),
        nisn: sanitizedNisn,
        unit,
        gender: gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki',
        birthPlace: typeof birthPlace === 'string' ? birthPlace.trim().slice(0, 100) : '',
        birthDate: typeof birthDate === 'string' ? birthDate.trim().slice(0, 20) : '',
        address: typeof address === 'string' ? address.trim().slice(0, 500) : '',
        parentName: typeof parentName === 'string' ? parentName.trim().slice(0, 150) : '',
        parentPhone: typeof parentPhone === 'string' ? parentPhone.trim().slice(0, 30) : '',
        parentJob: typeof parentJob === 'string' ? parentJob.trim().slice(0, 100) : '',
        parentIncome: typeof parentIncome === 'string' ? parentIncome.trim().slice(0, 60) : '',
        track: typeof track === 'string' ? track.trim().slice(0, 50) : 'Reguler',
        schoolOrigin: typeof schoolOrigin === 'string' ? schoolOrigin.trim().slice(0, 150) : undefined,
        documents: sanitizedDocs,
        dynamicAnswers: sanitizedAnswers,
      },
      recordedBy,
      ip
    );
    res.status(201).json(newStudent);
  } catch (err: any) {
    console.error('[Offline Register Error]:', err);
    res.status(500).json({ error: 'Gagal mencatat pendaftaran offline ke database.' });
  }
});

// -------------------------------------------------------------
// Export Field Configurations API (Master Managed)
// -------------------------------------------------------------
app.get('/api/export-configs', (req: Request, res: Response) => {
  res.json(db.getExportConfigs());
});

app.put('/api/export-configs', requireAuth, requireMaster, async (req: AuthRequest, res: Response) => {
  try {
    const { moduleName, roleId, allowedHeaders } = req.body;
    if (!moduleName || !roleId || !Array.isArray(allowedHeaders)) {
      return res.status(400).json({ error: 'Data konfigurasi ekspor tidak valid.' });
    }
    const updatedBy = req.user?.name || req.user?.email || 'Master Admin';
    const saved = await db.saveExportConfig(
      { id: `${moduleName}_${roleId}`, moduleName, roleId, allowedHeaders, updatedAt: '', updatedBy },
      updatedBy
    );
    res.json(saved);
  } catch (err: any) {
    console.error('[Export Configs Error]:', err);
    res.status(500).json({ error: 'Gagal menyimpan konfigurasi ekspor ke database.' });
  }
});

// -------------------------------------------------------------
// Cloudflare Turnstile Security API (Env-Controlled & Read-Only Public Status)
// -------------------------------------------------------------
app.get('/api/cloudflare-config', (_req: Request, res: Response) => {
  const cf = getEnvCloudflareConfig();
  res.json({
    enabled: cf.enabled,
    siteKey: cf.enabled ? cf.siteKey : '',
    mode: 'managed',
    appearance: 'always',
    managedByEnv: true,
  });
});

app.put('/api/cloudflare-config', requireAuth, requireRole(['Super Admin Yayasan']), (_req: Request, res: Response) => {
  return res.status(403).json({
    error: 'Konfigurasi Cloudflare Turnstile dikelola secara eksklusif melalui file .env server (CLOUDFLARE_ENABLED) demi keamanan dan tidak dapat diubah melalui dashboard.',
  });
});

app.post('/api/verify-turnstile', authRateLimiter, async (req: Request, res: Response) => {
  const { token } = req.body || {};
  const cf = getEnvCloudflareConfig();

  if (!cf.enabled) {
    return res.json({ success: true, verified: true, message: 'Cloudflare Turnstile non-aktif (CLOUDFLARE_ENABLED=false).' });
  }

  const check = await verifyTurnstileServer(token, req.ip || '');
  if (!check.success) {
    return res.status(400).json({ success: false, error: check.error });
  }
  return res.json({ success: true, verified: true });
});

// -------------------------------------------------------------
// SMTP Google Configuration API (Strictly Super Admin Yayasan - Masked Passwords)
// -------------------------------------------------------------
app.get('/api/smtp-config', requireAuth, requireRole(['Super Admin Yayasan']), (req: Request, res: Response) => {
  const config = db.getSmtpConfig();
  const rawPassword = db.getDecryptedSmtpPassword();
  const accounts = db.getDecryptedSmtpAccounts().map((acc) => ({
    ...acc,
    authPassword: acc.authPassword ? '••••••••••••••••' : '',
    hasPassword: Boolean(acc.authPassword && acc.authPassword.length > 0),
  }));

  res.json({
    ...config,
    authPassword: rawPassword ? '••••••••••••••••' : '',
    hasPassword: Boolean(rawPassword && rawPassword.length > 0),
    accounts,
  });
});

app.put('/api/smtp-config', requireAuth, requireRole(['Super Admin Yayasan']), async (req: AuthRequest, res: Response) => {
  try {
    const { enabled, host, port, secure, senderEmail, senderName, authPassword, accounts } = req.body;
    const current = db.getSmtpConfig();

    let passwordToSave = current.authPassword;
    if (authPassword !== undefined) {
      if (authPassword === '••••••••••••••••') {
        passwordToSave = current.authPassword;
      } else if (typeof authPassword === 'string' && authPassword.trim() === '') {
        passwordToSave = '';
      } else {
        passwordToSave = authPassword.trim();
      }
    }

    const actor = req.user?.email || req.user?.name || 'Master Admin';
    const actorRole = req.user?.role || 'Super Admin Yayasan';
    const saved = await db.saveSmtpConfig(
      {
        enabled: Boolean(enabled),
        host: host || 'smtp.gmail.com',
        port: Number(port) || 465,
        secure: secure !== undefined ? Boolean(secure) : true,
        senderEmail: senderEmail || 'ppdb.arrisalah.aceh@gmail.com',
        senderName: senderName || 'Panitia PPDB Yayasan Ar-Risalah Aceh',
        authPassword: passwordToSave,
        isVerified: current.isVerified,
        accounts: Array.isArray(accounts) ? accounts : current.accounts,
      },
      actor,
      actorRole
    );

    const rawPassword = db.getDecryptedSmtpPassword();
    const savedAccounts = db.getDecryptedSmtpAccounts().map((acc) => ({
      ...acc,
      authPassword: acc.authPassword ? '••••••••••••••••' : '',
      hasPassword: Boolean(acc.authPassword && acc.authPassword.length > 0),
    }));

    res.json({
      ...saved,
      authPassword: rawPassword ? '••••••••••••••••' : '',
      hasPassword: Boolean(rawPassword && rawPassword.length > 0),
      accounts: savedAccounts,
    });
  } catch (err: any) {
    console.error('[SMTP Config Error]:', err);
    res.status(500).json({ error: 'Gagal menyimpan konfigurasi SMTP ke database.' });
  }
});

app.post('/api/smtp-config/test', requireAuth, requireRole(['Super Admin Yayasan']), async (req: AuthRequest, res: Response) => {
  const { testRecipient, senderEmail, authPassword } = req.body;
  const smtp = db.getSmtpConfig();

  // If specific credentials passed in body, test that specific account
  const accountsToTry: Array<{
    senderEmail: string;
    senderName: string;
    authPassword: string;
    host: string;
    port: number;
    secure: boolean;
  }> = [];

  if (senderEmail && authPassword) {
    let rawPassword = authPassword.trim();
    if (rawPassword === '••••••••••••••••') {
      const matched = db.getDecryptedSmtpAccounts().find(
        (a) => a.senderEmail.toLowerCase() === senderEmail.trim().toLowerCase()
      );
      rawPassword = matched?.authPassword || db.getDecryptedSmtpPassword();
    }

    accountsToTry.push({
      senderEmail: senderEmail.trim(),
      senderName: smtp.senderName || 'Panitia PPDB Yayasan Ar-Risalah Aceh',
      authPassword: rawPassword,
      host: smtp.host || 'smtp.gmail.com',
      port: Number(smtp.port) || 465,
      secure: smtp.secure !== undefined ? smtp.secure : true,
    });
  } else {
    // Test all configured active accounts in rotation
    const decryptedList = db.getDecryptedSmtpAccounts().filter((a) => a.isActive && a.authPassword);
    if (decryptedList.length > 0) {
      accountsToTry.push(...decryptedList);
    } else {
      const rootPass = db.getDecryptedSmtpPassword();
      if (smtp.senderEmail && rootPass) {
        accountsToTry.push({
          senderEmail: smtp.senderEmail,
          senderName: smtp.senderName || 'Panitia PPDB Yayasan Ar-Risalah Aceh',
          authPassword: rootPass,
          host: smtp.host || 'smtp.gmail.com',
          port: Number(smtp.port) || 465,
          secure: smtp.secure !== undefined ? smtp.secure : true,
        });
      }
    }
  }

  if (accountsToTry.length === 0) {
    return res.status(200).json({
      success: false,
      message: 'Konfigurasi SMTP belum lengkap: Email pengirim dan Google App Password (16-karakter) wajib diisi terlebih dahulu sebelum menguji.',
    });
  }

  const recipient = (testRecipient && testRecipient.trim()) || accountsToTry[0].senderEmail;
  let lastError = '';
  let successAccount: any = null;

  for (const acc of accountsToTry) {
    try {
      const transporter = nodemailer.createTransport({
        host: acc.host || 'smtp.gmail.com',
        port: acc.port || 465,
        secure: acc.secure !== undefined ? acc.secure : true,
        auth: {
          user: acc.senderEmail,
          pass: acc.authPassword.replace(/\s+/g, ''),
        },
        connectionTimeout: 8000,
      });

      await transporter.verify();

      await transporter.sendMail({
        from: `"${acc.senderName || 'PPDB Yayasan Ar-Risalah'}" <${acc.senderEmail}>`,
        to: recipient,
        subject: `✅ Tes Koneksi SMTP Google - Akun ${escapeHtml(acc.senderEmail)} Berhasil`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #16a34a; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #14532d; color: white; padding: 20px; text-align: center;">
              <h2 style="margin: 0;">YAYASAN AR-RISALAH ACEH</h2>
              <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">Sistem Notifikasi Resmi PPDB ${escapeHtml(getActiveAcademicYearLabel(db.getAcademicYears()))}</p>
            </div>
            <div style="padding: 24px; color: #1e293b;">
              <h3 style="color: #16a34a; margin-top: 0;">Alhamdulillah! Koneksi SMTP Google Berhasil Terhubung</h3>
              <p>Email ini adalah konfirmasi bahwa akun SMTP Gmail <strong>${escapeHtml(acc.senderEmail)}</strong> aktif dan siap digunakan untuk pengiriman notifikasi kartu pendaftaran PPDB.</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
                <tr><td style="padding: 6px; font-weight: bold; width: 140px;">Akun Pengirim:</td><td>${escapeHtml(acc.senderEmail)}</td></tr>
                <tr><td style="padding: 6px; font-weight: bold;">Host Server:</td><td>${escapeHtml(acc.host)}:${escapeHtml(acc.port)}</td></tr>
                <tr><td style="padding: 6px; font-weight: bold;">Waktu Pengujian:</td><td>${escapeHtml(new Date().toLocaleString('id-ID'))} WIB</td></tr>
              </table>
            </div>
            <div style="background-color: #f0fdf4; padding: 12px; text-align: center; font-size: 12px; color: #15803d; border-top: 1px solid #dcfce7;">
              Ar-Risalah Aceh • Menginspirasi Generasi Qur'ani, Cerdas, dan Mandiri
            </div>
          </div>
        `,
      });

      successAccount = acc;
      break; // Success! No need to failover
    } catch (err: any) {
      lastError = err.message || '';
      console.warn(`[SMTP Test Failover]: Gagal pada akun ${acc.senderEmail}, mencoba akun berikutnya...`);
    }
  }

  if (successAccount) {
    smtp.isVerified = true;
    await db.saveSmtpConfig(smtp, req.user?.email || 'Master Admin', req.user?.role || 'Super Admin Yayasan', true);
    return res.json({
      success: true,
      message: `Alhamdulillah! Tes kirim email berhasil menggunakan akun "${successAccount.senderEmail}" ke ${recipient}. Konfigurasi SMTP aktif dan terverifikasi.`,
      usedAccount: successAccount.senderEmail,
    });
  }

  return res.status(200).json({
    success: false,
    message: `Gagal mengirim email melalui akun SMTP: ${lastError}. Pastikan menggunakan Google App Password (16-karakter) dan 2-Step Verification aktif.`,
  });
});

// -------------------------------------------------------------
// Group Links Configuration API
// -------------------------------------------------------------
app.get('/api/group-links', (req: Request, res: Response) => {
  res.json(db.getGroupLinkConfigs());
});

app.put('/api/group-links', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (isWaliRoleName(user.role)) {
      return res.status(403).json({ error: 'Akses Ditolak: Wali siswa tidak memiliki izin mengubah pengaturan link grup.' });
    }

    const roleLower = (user.role || '').toLowerCase();
    const isSuperOrYys =
      user.role === 'Super Admin Yayasan' ||
      user.role === 'Admin Yayasan' ||
      roleLower.includes('admin yayasan') ||
      roleLower.includes('super admin');
    const perms: string[] = user.permissions || [];
    const hasLandingPerm = perms.includes('Kelola Landing') || perms.includes('Kelola Landing:edit');

    if (!isSuperOrYys && !hasLandingPerm) {
      return res.status(403).json({ error: 'Akses Ditolak: Anda tidak memiliki izin mengelola link grup PPDB.' });
    }

    const rawUnitId = typeof req.body?.unitId === 'string' ? req.body.unitId.trim().toUpperCase() : '';
    const validGroupUnits = ['ALL', ...db.getUnits().map((u) => u.id)];
    const { groupUrl, groupName, visibilityRule } = req.body;
    if (!rawUnitId || !validGroupUnits.includes(rawUnitId)) {
      return res.status(400).json({ error: 'Target unit link grup tidak valid.' });
    }
    if (!isSuperOrYys && user.schoolId && user.schoolId !== 'MASTER' && rawUnitId !== user.schoolId) {
      return res.status(403).json({
        error: `Pelanggaran Batas Unit: Anda (${user.schoolId}) hanya berhak mengubah link grup untuk unit Anda.`,
      });
    }
    if (!groupUrl || !groupName || !isSafeHttpUrl(groupUrl, false)) {
      return res.status(400).json({ error: 'Nama grup dan URL link grup (http/https) yang valid wajib diisi.' });
    }
    const cleanVisRule = ['always', 'after_data', 'after_payment'].includes(String(visibilityRule))
      ? (visibilityRule as 'always' | 'after_data' | 'after_payment')
      : 'always';

    const saved = await db.saveGroupLinkConfig({
      unitId: rawUnitId,
      groupUrl: String(groupUrl).trim().slice(0, 500),
      groupName: String(groupName).trim().slice(0, 150),
      visibilityRule: cleanVisRule,
    });
    res.json(saved);
  } catch (err: any) {
    console.error('[Group Links Error]:', err);
    res.status(500).json({ error: 'Gagal menyimpan link grup ke database.' });
  }
});

// -------------------------------------------------------------
// Unit Contacts Configuration API (Public GET, Protected PUT)
// -------------------------------------------------------------
app.get('/api/unit-contacts', (req: Request, res: Response) => {
  res.json(db.getUnitContacts());
});

app.put('/api/unit-contacts/:unitId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (isWaliRoleName(user.role)) {
      return res.status(403).json({ error: 'Akses Ditolak: Wali siswa tidak memiliki izin mengubah kontak unit.' });
    }

    const roleLower = (user.role || '').toLowerCase();
    const isSuperOrYys =
      user.role === 'Super Admin Yayasan' ||
      roleLower.includes('admin yayasan') ||
      roleLower.includes('super admin');
    const perms: string[] = user.permissions || [];
    const hasContactPerm =
      roleLower.includes('admin unit') ||
      perms.includes('Kelola Landing') ||
      perms.includes('Kelola Landing:edit') ||
      perms.includes('Kelola Kontak') ||
      perms.includes('Kelola Kontak:edit');

    if (!isSuperOrYys && !hasContactPerm) {
      return res.status(403).json({ error: 'Akses Ditolak: Anda tidak memiliki izin mengelola kontak unit PPDB.' });
    }

    const targetUnit = String(req.params.unitId || '').trim().toUpperCase();
    const allowedContactUnits = ['MASTER', ...db.getUnits().map((u) => u.id)];
    if (!allowedContactUnits.includes(targetUnit)) {
      return res.status(400).json({ error: 'Unit ID kontak tidak valid.' });
    }

    const { unitName, contactPerson, phone, whatsapp, email, officeHours, address, notes } = req.body || {};

    // Unit isolation check
    if (!isSuperOrYys && user.schoolId !== 'MASTER') {
      if (targetUnit !== user.schoolId) {
        return res.status(403).json({
          error: `Akses Ditolak: Anda hanya dapat mengelola kontak untuk unit ${user.schoolId}.`,
        });
      }
    }

    if (!contactPerson || typeof contactPerson !== 'string' || !phone || !whatsapp) {
      return res.status(400).json({ error: 'Nama penanggung jawab, nomor HP, dan WhatsApp wajib diisi.' });
    }
    if (email && (typeof email !== 'string' || !email.includes('@') || email.length > 150)) {
      return res.status(400).json({ error: 'Format email kontak tidak valid.' });
    }

    const updatedBy = user.name || user.email || 'Admin';
    const saved = await db.saveUnitContact(
      {
        unitId: targetUnit as any,
        unitName: (typeof unitName === 'string' && unitName.trim() ? unitName.trim() : `Unit ${targetUnit}`).slice(0, 120),
        contactPerson: contactPerson.trim().slice(0, 150),
        phone: String(phone).trim().slice(0, 40),
        whatsapp: String(whatsapp).replace(/[^0-9]/g, '').slice(0, 30),
        email: email ? String(email).trim().slice(0, 150) : '',
        officeHours: typeof officeHours === 'string' && officeHours.trim() ? officeHours.trim().slice(0, 120) : 'Senin - Sabtu (08:00 - 15:00 WIB)',
        address: typeof address === 'string' ? address.trim().slice(0, 300) : '',
        notes: typeof notes === 'string' ? notes.trim().slice(0, 400) : '',
      },
      updatedBy
    );

    res.json(saved);
  } catch (err: any) {
    console.error('[Unit Contacts Error]:', err);
    res.status(500).json({ error: 'Gagal menyimpan kontak unit ke database.' });
  }
});

// -------------------------------------------------------------
// Letter & Committee Chair Configurations API
// -------------------------------------------------------------
app.get('/api/letter-configs', (req: Request, res: Response) => {
  res.json(db.getLetterConfigs());
});

app.put('/api/letter-configs/:unitId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (isWaliRoleName(user.role)) {
      return res.status(403).json({ error: 'Akses Ditolak: Wali siswa tidak memiliki izin mengubah format surat panitia.' });
    }

    const roleLower = (user.role || '').toLowerCase();
    const isSuperOrYys =
      user.role === 'Super Admin Yayasan' ||
      roleLower.includes('admin yayasan') ||
      roleLower.includes('super admin');
    const perms: string[] = user.permissions || [];
    const hasLetterPerm =
      roleLower.includes('admin unit') ||
      perms.includes('Kelola Landing') ||
      perms.includes('Kelola Landing:edit');

    if (!isSuperOrYys && !hasLetterPerm) {
      return res.status(403).json({ error: 'Akses Ditolak: Anda tidak memiliki izin mengelola format surat panitia.' });
    }

    const targetUnit = String(req.params.unitId || '').trim().toUpperCase();
    const allowedUnits = ['MASTER', ...db.getUnits().map((u) => u.id)];
    if (!allowedUnits.includes(targetUnit)) {
      return res.status(400).json({ error: 'Unit ID pengaturan surat tidak valid.' });
    }

    const {
      unitName,
      committeeChairName,
      committeeChairNip,
      committeeRoleTitle,
      letterHeaderTitle,
      cardTitle,
      issueLocation,
      issueDate,
      examInstructions,
      stampNote,
      cardFields,
    } = req.body;

    // Unit isolation check
    if (
      user.schoolId !== 'MASTER' &&
      user.role !== 'Super Admin Yayasan' &&
      !user.role.includes('Admin Yayasan')
    ) {
      if (targetUnit !== user.schoolId) {
        return res.status(403).json({
          error: `Akses Ditolak: Anda hanya dapat mengelola format surat untuk unit ${user.schoolId}.`,
        });
      }
    }

    if (!committeeChairName || typeof committeeChairName !== 'string' || committeeChairName.trim().length === 0) {
      return res.status(400).json({ error: 'Nama Ketua Panitia PPDB wajib diisi.' });
    }

    // Validate & sanitize cardFields (Form Builder columns shown on printed/PDF card)
    let sanitizedCardFields: Array<{ fieldId: string; label: string; sectionTitle?: string }> | undefined = undefined;
    if (cardFields !== undefined) {
      if (!Array.isArray(cardFields) || cardFields.length > 30) {
        return res.status(400).json({ error: 'Format cardFields tidak valid (maksimal 30 kolom).' });
      }
      const seenFieldIds = new Set<string>();
      sanitizedCardFields = [];
      for (const rawItem of cardFields) {
        if (
          typeof rawItem !== 'object' ||
          rawItem === null ||
          Array.isArray(rawItem) ||
          Object.prototype.hasOwnProperty.call(rawItem, '__proto__') ||
          Object.prototype.hasOwnProperty.call(rawItem, 'constructor') ||
          Object.prototype.hasOwnProperty.call(rawItem, 'prototype')
        ) {
          return res.status(400).json({ error: 'Item kolom kartu cetak tidak valid.' });
        }
        const fId = typeof rawItem.fieldId === 'string' ? rawItem.fieldId.trim() : '';
        const fLabel = typeof rawItem.label === 'string' ? rawItem.label.trim() : '';
        const fSection = typeof rawItem.sectionTitle === 'string' ? rawItem.sectionTitle.trim().slice(0, 150) : '';
        if (!fId || fId.length > 120 || !fLabel || fLabel.length > 150) {
          return res.status(400).json({ error: 'Setiap kolom kartu wajib memiliki fieldId dan label yang valid.' });
        }
        if (seenFieldIds.has(fId)) continue;
        seenFieldIds.add(fId);
        sanitizedCardFields.push(
          fSection ? { fieldId: fId, label: fLabel, sectionTitle: fSection } : { fieldId: fId, label: fLabel }
        );
      }
    }

    const sanitizedInstructions = Array.isArray(examInstructions)
      ? examInstructions
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => item.trim().slice(0, 400))
          .slice(0, 10)
      : [];

    const existingUnitConfig = db.getLetterConfigs().find((l) => l.unitId === targetUnit);
    const updatedBy = user.name || user.email || 'Admin';
    const saved = await db.saveLetterConfig(
      {
        unitId: targetUnit as any,
        unitName: typeof unitName === 'string' && unitName.trim() ? unitName.trim().slice(0, 120) : `Unit ${targetUnit}`,
        committeeChairName: committeeChairName.trim().slice(0, 160),
        committeeChairNip: committeeChairNip ? String(committeeChairNip).trim().slice(0, 100) : '',
        committeeRoleTitle: committeeRoleTitle ? String(committeeRoleTitle).trim().slice(0, 120) : 'Ketua Panitia PPDB',
        letterHeaderTitle: letterHeaderTitle ? String(letterHeaderTitle).trim().slice(0, 180) : 'PANITIA PENERIMAAN PESERTA DIDIK BARU (PPDB)',
        cardTitle: cardTitle ? String(cardTitle).trim().slice(0, 180) : 'KARTU TANDA PESERTA UJIAN & OBSERVASI PPDB',
        issueLocation: issueLocation ? String(issueLocation).trim().slice(0, 100) : 'Bireuen',
        issueDate: issueDate ? String(issueDate).trim().slice(0, 80) : '',
        examInstructions: sanitizedInstructions,
        stampNote: stampNote ? String(stampNote).trim().slice(0, 250) : '',
        cardFields: sanitizedCardFields !== undefined ? sanitizedCardFields : existingUnitConfig?.cardFields,
      },
      updatedBy
    );

    res.json(saved);
  } catch (err: any) {
    console.error('[Letter Configs Error]:', err);
    res.status(500).json({ error: 'Gagal menyimpan format surat panitia ke database.' });
  }
});

// -------------------------------------------------------------
// Yayasan Multi-Bank Accounts API (Public active GET, Master Admin & Admin Yayasan ONLY mutations)
// -------------------------------------------------------------
const isMasterOrYayasanAdminUser = (user?: AuthRequest['user'] | null): boolean => {
  if (!user || !user.isActive || isWaliRoleName(user.role)) return false;
  const roleLower = (user.role || '').toLowerCase();
  return (
    user.role === 'Super Admin Yayasan' ||
    roleLower.includes('super admin') ||
    roleLower.includes('admin yayasan')
  );
};

const validateBankAccountPayload = (body: any) => {
  const bankName = typeof body?.bankName === 'string' ? body.bankName.trim() : '';
  const rawBankCode = typeof body?.bankCode === 'string' ? body.bankCode.trim().toUpperCase() : '';
  const rawAccountNumber = typeof body?.accountNumber === 'string' ? body.accountNumber.trim() : '';
  const accountHolder = typeof body?.accountHolder === 'string' ? body.accountHolder.trim() : '';
  const branch = typeof body?.branch === 'string' ? body.branch.trim() : '';
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';

  if (bankName.length < 2 || bankName.length > 100) {
    return { error: 'Nama bank wajib diisi (2-100 karakter).' };
  }
  if (!/^[0-9\s-]{5,30}$/.test(rawAccountNumber)) {
    return { error: 'Nomor rekening harus berupa angka (5-30 karakter, boleh menggunakan spasi atau tanda hubung).' };
  }
  const digitsOnly = rawAccountNumber.replace(/\D/g, '');
  if (digitsOnly.length < 5 || digitsOnly.length > 25) {
    return { error: 'Nomor rekening harus memuat 5 sampai 25 digit angka.' };
  }
  if (accountHolder.length < 2 || accountHolder.length > 120) {
    return { error: 'Nama pemilik rekening (a.n.) wajib diisi (2-120 karakter).' };
  }
  if (rawBankCode.length > 20) {
    return { error: 'Kode / singkatan bank maksimal 20 karakter.' };
  }

  const derivedCode =
    rawBankCode ||
    bankName
      .replace(/[^A-Za-z0-9\s]/g, ' ')
      .trim()
      .split(/\s+/)[0]
      ?.toUpperCase()
      .slice(0, 12) ||
    'BANK';

  return {
    data: {
      bankName: bankName.slice(0, 100),
      bankCode: derivedCode,
      accountNumber: rawAccountNumber.replace(/\s+/g, ' ').slice(0, 30),
      digitsOnly,
      accountHolder: accountHolder.slice(0, 120),
      branch: branch.slice(0, 100),
      notes: notes.slice(0, 300),
      isActive: body?.isActive !== undefined ? Boolean(body.isActive) : true,
      isPrimary: Boolean(body?.isPrimary),
    },
  };
};

app.get('/api/bank-accounts', optionalAuth, async (req: AuthRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const allAccounts = await db.getBankAccountsFresh();
  if (isMasterOrYayasanAdminUser(req.user)) {
    return res.json(allAccounts);
  }
  return res.json(allAccounts.filter((b) => b.isActive));
});

app.post('/api/bank-accounts', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!isMasterOrYayasanAdminUser(user)) {
      addAuditLog(
        'unauthorized_access' as any,
        user.schoolId || 'MASTER',
        `Akses ditolak: ${user.email} (${user.role}) mencoba menambah rekening yayasan`,
        user.email,
        req.ip || '127.0.0.1'
      );
      return res.status(403).json({
        error: 'Akses Ditolak (403 Forbidden): Hanya Master Admin dan Admin Yayasan yang dapat menambah rekening yayasan.',
      });
    }

    const validated = validateBankAccountPayload(req.body);
    if ('error' in validated) {
      return res.status(400).json({ error: validated.error });
    }

    const existing = db.getBankAccounts();
    const isDuplicate = existing.some(
      (b) =>
        b.accountNumber.replace(/\D/g, '') === validated.data.digitsOnly &&
        b.bankName.toLowerCase() === validated.data.bankName.toLowerCase()
    );
    if (isDuplicate) {
      return res.status(409).json({
        error: `Rekening ${validated.data.bankName} dengan nomor ${validated.data.accountNumber} sudah terdaftar.`,
      });
    }

    const actor = user.email || user.name || 'Admin Yayasan';
    const updatedList = await db.saveBankAccount(
      {
        id: `bank-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        bankName: validated.data.bankName,
        bankCode: validated.data.bankCode,
        accountNumber: validated.data.accountNumber,
        accountHolder: validated.data.accountHolder,
        branch: validated.data.branch,
        notes: validated.data.notes,
        isActive: validated.data.isActive,
        isPrimary: validated.data.isPrimary,
        sortOrder: existing.length + 1,
      },
      actor
    );

    res.status(201).json(updatedList);
  } catch (err: any) {
    console.error('[Bank Accounts POST Error]:', err);
    res.status(500).json({ error: 'Gagal menambahkan rekening bank yayasan.' });
  }
});

app.put('/api/bank-accounts/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!isMasterOrYayasanAdminUser(user)) {
      addAuditLog(
        'unauthorized_access' as any,
        user.schoolId || 'MASTER',
        `Akses ditolak: ${user.email} (${user.role}) mencoba mengubah rekening yayasan (${req.params.id})`,
        user.email,
        req.ip || '127.0.0.1'
      );
      return res.status(403).json({
        error: 'Akses Ditolak (403 Forbidden): Hanya Master Admin dan Admin Yayasan yang dapat mengubah rekening yayasan.',
      });
    }

    const targetId = String(req.params.id || '').trim();
    const existingList = db.getBankAccounts();
    const existingTarget = existingList.find((b) => b.id === targetId);
    if (!existingTarget) {
      return res.status(404).json({ error: 'Rekening bank yayasan tidak ditemukan.' });
    }

    const validated = validateBankAccountPayload(req.body);
    if ('error' in validated) {
      return res.status(400).json({ error: validated.error });
    }

    const isDuplicate = existingList.some(
      (b) =>
        b.id !== targetId &&
        b.accountNumber.replace(/\D/g, '') === validated.data.digitsOnly &&
        b.bankName.toLowerCase() === validated.data.bankName.toLowerCase()
    );
    if (isDuplicate) {
      return res.status(409).json({
        error: `Rekening ${validated.data.bankName} dengan nomor ${validated.data.accountNumber} sudah digunakan pada entri lain.`,
      });
    }

    const actor = user.email || user.name || 'Admin Yayasan';
    const updatedList = await db.saveBankAccount(
      {
        ...existingTarget,
        bankName: validated.data.bankName,
        bankCode: validated.data.bankCode,
        accountNumber: validated.data.accountNumber,
        accountHolder: validated.data.accountHolder,
        branch: validated.data.branch,
        notes: validated.data.notes,
        isActive: validated.data.isActive,
        isPrimary: validated.data.isPrimary,
      },
      actor
    );

    res.json(updatedList);
  } catch (err: any) {
    console.error('[Bank Accounts PUT Error]:', err);
    res.status(500).json({ error: 'Gagal memperbarui rekening bank yayasan.' });
  }
});

app.delete('/api/bank-accounts/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!isMasterOrYayasanAdminUser(user)) {
      addAuditLog(
        'unauthorized_access' as any,
        user.schoolId || 'MASTER',
        `Akses ditolak: ${user.email} (${user.role}) mencoba menghapus rekening yayasan (${req.params.id})`,
        user.email,
        req.ip || '127.0.0.1'
      );
      return res.status(403).json({
        error: 'Akses Ditolak (403 Forbidden): Hanya Master Admin dan Admin Yayasan yang dapat menghapus rekening yayasan.',
      });
    }

    const targetId = String(req.params.id || '').trim();
    const actor = user.email || user.name || 'Admin Yayasan';
    const updatedList = await db.deleteBankAccount(targetId, actor);
    if (!updatedList) {
      return res.status(404).json({ error: 'Rekening bank yayasan tidak ditemukan.' });
    }

    res.json(updatedList);
  } catch (err: any) {
    console.error('[Bank Accounts DELETE Error]:', err);
    res.status(500).json({ error: 'Gagal menghapus rekening bank yayasan.' });
  }
});

// -------------------------------------------------------------
// Send Registration Card via Google SMTP with PDF Attachment & Multi-Account Failover
// -------------------------------------------------------------
app.post('/api/mail/send-card', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.body;
    const student = db.getStudentById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Calon siswa tidak ditemukan.' });
    }

    const parentUser = req.user;
    if (!parentUser) {
      return res.status(401).json({ error: 'Autentikasi diperlukan.' });
    }

    if (isWaliRoleName(parentUser.role)) {
      const targetStudent = db.getStudentById(student.id);
      if (!targetStudent || !studentBelongsToWali(targetStudent, parentUser)) {
        return res.status(403).json({ error: 'Akses Ditolak: Anda hanya dapat mengirim kartu pendaftaran milik putra/putri Anda sendiri.' });
      }
    }

    if (!parentUser.emailVerified) {
      return res.json({
        sent: false,
        reason: 'Email wali belum diverifikasi. Kartu ujian dan bukti nomor pendaftaran hanya dapat diunduh di layar portal.',
      });
    }

    const smtp = db.getSmtpConfig();
    if (!smtp.enabled) {
      return res.json({
        sent: false,
        reason: 'SMTP Google dinonaktifkan oleh administrator yayasan.',
      });
    }

    // Load all active SMTP accounts with decrypted credentials for Failover Rotation
    const accounts = db.getDecryptedSmtpAccounts().filter((a) => a.isActive && a.authPassword);

    if (accounts.length === 0) {
      return res.json({
        sent: false,
        reason: 'Belum ada akun SMTP Google yang aktif dengan kata sandi aplikasi 16-karakter.',
      });
    }

    // Dynamic Landing Page Config for official address, phone, email, and app name
    const landingConfig = db.getLandingConfig();
    const addressFromDb = landingConfig?.contact?.address || 'Jl. BTN Kupula Indah, Geulanggang Gampong (Geulanggang Baro), Kec. Kota Juang, Kab. Bireuen, Aceh';
    const phoneFromDb = landingConfig?.contact?.phone || landingConfig?.contact?.whatsapp || '0812-6900-1234';
    const emailFromDb = landingConfig?.contact?.email || 'info@arrisalahaceh.or.id';
    const appNameFromDb = landingConfig?.appName || 'Yayasan Ar-Risalah Aceh';

    // Find student's test schedule if available (fallback to unit schedule)
    const allSchedules = db.getSchedules();
    const studentSchedule = student.testScheduleId
      ? allSchedules.find((s) => s.id === student.testScheduleId) ||
        allSchedules.find((s) => s.unit === student.unit) ||
        null
      : allSchedules.find((s) => s.unit === student.unit) || null;

    // Generate Official PDF Buffer
    const pdfBuffer = await generateStudentCardPdfBuffer(student, studentSchedule, landingConfig);
    const cleanReg = student.registrationNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    const pdfFilename = `Kartu_PPDB_${cleanReg}_${student.fullName.replace(/\s+/g, '_')}.pdf`;

    let emailSent = false;
    let sentByAccount = '';
    let lastError = '';

    // Rotasi & Failover Multi-Akun Gmail: Coba Akun 1 -> jika gagal coba Akun 2 -> Akun 3 -> dst.
    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      try {
        const transporter = nodemailer.createTransport({
          host: acc.host || 'smtp.gmail.com',
          port: acc.port || 465,
          secure: acc.secure !== undefined ? acc.secure : true,
          auth: {
            user: acc.senderEmail,
            pass: acc.authPassword.replace(/\s+/g, ''),
          },
          connectionTimeout: 9000,
        });

        await transporter.sendMail({
          from: `"${acc.senderName || smtp.senderName || appNameFromDb}" <${acc.senderEmail}>`,
          to: parentUser.email,
          subject: `📜 Kartu Tanda Peserta Ujian PPDB & Lampiran PDF: ${student.fullName} (${student.registrationNumber})`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #16a34a; border-radius: 16px; overflow: hidden; background: #ffffff;">
              <div style="background-color: #14532d; color: white; padding: 24px; text-align: center;">
                <h2 style="margin: 0; font-size: 20px; letter-spacing: 0.5px; text-transform: uppercase;">${escapeHtml(appNameFromDb)}</h2>
                <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Penerimaan Peserta Didik Baru (PPDB) ${escapeHtml(getActiveAcademicYearLabel(db.getAcademicYears()))}</p>
              </div>

              <div style="padding: 26px 24px; color: #1e293b;">
                <h3 style="color: #15803d; margin-top: 0; font-size: 16px;">Assalamu'alaikum Warahmatullahi Wabarakatuh</h3>
                <p style="font-size: 13.5px; line-height: 1.6; color: #334155;">
                  Ahlan wa Sahlan, Bapak/Ibu <strong>${escapeHtml(parentUser.name)}</strong>.<br/>
                  Alhamdulillah, pendaftaran calon peserta didik baru ananda telah berhasil terverifikasi di sistem PPDB ${escapeHtml(appNameFromDb)}.
                </p>

                <div style="background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 12px; padding: 16px; margin: 18px 0; text-align: center;">
                  <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; color: #15803d; display: block; margin-bottom: 4px;">NOMOR REGISTRASI PENDAFTARAN RESMI</span>
                  <span style="font-size: 22px; font-weight: 800; font-family: monospace; letter-spacing: 2px; color: #14532d;">${escapeHtml(student.registrationNumber)}</span>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
                  <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; font-weight: bold; color: #64748b; width: 160px;">Nama Lengkap Ananda</td><td style="padding: 8px 4px; font-weight: bold; color: #0f172a;">: ${escapeHtml(student.fullName)}</td></tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; font-weight: bold; color: #64748b;">Unit Sekolah Pilihan</td><td style="padding: 8px 4px; font-weight: bold; color: #15803d;">: ${escapeHtml(student.unit)}</td></tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; font-weight: bold; color: #64748b;">Tanggal Pendaftaran</td><td style="padding: 8px 4px; color: #334155;">: ${escapeHtml(student.registeredAt)} WIB</td></tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; font-weight: bold; color: #64748b;">Jadwal Seleksi/Observasi</td><td style="padding: 8px 4px; color: #334155;">: ${studentSchedule ? escapeHtml(`${studentSchedule.date} (${studentSchedule.startTime} - ${studentSchedule.endTime} WIB) di ${studentSchedule.room}`) : 'Mengikuti gelombang seleksi unit'}</td></tr>
                </table>

                <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 14px; margin-top: 20px; font-size: 12.5px; color: #065f46; line-height: 1.5;">
                  📎 <strong>Dokumen Terlampir:</strong> File PDF resmi <strong>${escapeHtml(pdfFilename)}</strong> telah dilampirkan pada email ini. Silakan cetak kartu tersebut untuk dibawa ananda saat hari pelaksanaan ujian seleksi/observasi.
                </div>
              </div>

              <div style="background-color: #f8fafc; padding: 18px 24px; text-align: center; font-size: 11.5px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.6;">
                <strong style="color: #1e293b; font-size: 12px;">Panitia PPDB ${escapeHtml(appNameFromDb)}</strong><br/>
                📍 ${escapeHtml(addressFromDb)}<br/>
                📞 Telp/WA: ${escapeHtml(phoneFromDb)} &nbsp;|&nbsp; ✉️ Email: ${escapeHtml(emailFromDb)}
              </div>
            </div>
          `,
          attachments: [
            {
              filename: pdfFilename,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ],
        });

        emailSent = true;
        sentByAccount = acc.senderEmail;
        console.log(`[Mail Send] Sukses mengirim kartu PDF siswa ${student.fullName} via akun ${acc.senderEmail}`);
        break; // Successfully delivered, exit failover loop
      } catch (err: any) {
        lastError = err.message || '';
        console.warn(`[Mail Send Failover]: Gagal mengirim via akun ${acc.senderEmail} (${lastError}), mencoba akun cadangan berikutnya...`);
      }
    }

    if (emailSent) {
      addAuditLog(
        'update_status' as any,
        student.unit as any,
        `Kirim kartu pendaftaran PDF an. ${student.fullName} ke ${parentUser.email} via SMTP ${sentByAccount}`,
        parentUser.email,
        req.ip || '127.0.0.1'
      );

      return res.json({
        sent: true,
        message: `Kartu pendaftaran dan lampiran file PDF berhasil dikirim ke email ${parentUser.email} (via ${sentByAccount})!`,
        usedAccount: sentByAccount,
      });
    }

    res.status(500).json({
      sent: false,
      error: `Gagal mengirim email kartu: Seluruh akun SMTP gagal (${lastError}). Silakan periksa pengaturan Sandi Aplikasi SMTP Google di menu Master Admin.`,
    });
  } catch (err: any) {
    console.error('[Mail Send Error]:', err);
    res.status(500).json({ error: 'Gagal mengirim email pendaftaran.' });
  }
});

// Public API Endpoint: Verifikasi Keabsahan TTD Online (Tanpa data pribadi peserta, Rate-Limited)
app.get('/api/verify-ttd', lookupRateLimiter, (req: Request, res: Response) => {
  const reg = String(req.query.reg || '').trim().toUpperCase();
  if (!reg || reg.length < 6 || reg.length > 60) {
    return res.status(400).json({ valid: false, message: 'Nomor pendaftaran tidak diberikan atau format tidak valid.' });
  }

  const students = db.getStudents();
  const found = students.find((s) => (s.registrationNumber || '').toUpperCase() === reg);

  if (found) {
    return res.json({
      valid: true,
      registrationNumber: found.registrationNumber,
      registeredAt: found.registeredAt,
      message: `Dokumen ini sah di TTD online dengan no pendaftar ${found.registrationNumber}`,
    });
  } else {
    return res.json({
      valid: false,
      registrationNumber: reg,
      message: `Nomor pendaftaran ${reg} tidak ditemukan pada database resmi.`,
    });
  }
});

// Public API Endpoint: Verifikasi Keaslian Resi Pembayaran Lunas (Rate-Limited, tanpa PII sensitif)
app.get('/api/verify-resi', lookupRateLimiter, async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const pid = String(req.query.pid || '').trim();
  const reg = String(req.query.reg || '').trim().toUpperCase();
  const sig = String(req.query.sig || '').trim().toLowerCase();

  if (!pid || pid.length < 3 || pid.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(pid)) {
    return res.status(400).json({
      valid: false,
      paymentId: pid,
      message: 'Kode / ID resi pembayaran tidak diberikan atau formatnya tidak valid.',
    });
  }
  if (reg && (reg.length < 3 || reg.length > 60 || !/^[a-zA-Z0-9_-]+$/.test(reg))) {
    return res.status(400).json({
      valid: false,
      paymentId: pid,
      message: 'Format nomor pendaftaran pada tautan resi tidak valid.',
    });
  }
  if (sig && !/^[a-f0-9]{16,64}$/.test(sig)) {
    return res.json({
      valid: false,
      paymentId: pid,
      message: 'Tanda tangan digital resi tidak valid atau telah dimodifikasi.',
    });
  }

  try {
    const allPayments = await db.getPaymentsFresh();
    const pay = allPayments.find((p) => p.id === pid);
    if (!pay || pay.status !== 'lunas') {
      return res.json({
        valid: false,
        paymentId: pid,
        message: 'Resi pembayaran tidak ditemukan atau pembayaran belum berstatus LUNAS di sistem resmi.',
      });
    }

    if (reg && (pay.registrationNumber || '').toUpperCase() !== reg) {
      return res.json({
        valid: false,
        paymentId: pid,
        message: 'Resi tidak cocok dengan nomor pendaftaran yang tertera.',
      });
    }

    const expectedSig = computeReceiptSignature(pay.id, pay.registrationNumber);
    if (sig && !timingSafeEqualHex(sig, expectedSig)) {
      return res.json({
        valid: false,
        paymentId: pid,
        message: 'Tanda tangan kriptografi resi tidak cocok. Resi ini tidak valid.',
      });
    }

    const student = db.getStudentById(pay.registrationId);
    const schemas = db.getFormSchemas();
    const units = db.getUnits();
    const academicYears = db.getAcademicYears();
    const landing = db.getLandingConfig();
    const targetUnit = units.find((u) => u.id === pay.unit);
    const studentSchema = student ? schemas.find((s) => s.unitId === student.unit) : undefined;
    const resolvedName = student
      ? resolveStudentNameFromSchema(
          student,
          studentSchema
            ? { ...studentSchema, sections: ensureCoreNameFieldInSections(studentSchema.sections, studentSchema.unitId) }
            : undefined
        )
      : pay.studentName;

    // Collect any other lunas payments for the same registration & bill type (for multi-bank completeness)
    const billTranches = allPayments
      .filter(
        (p) =>
          p.registrationId === pay.registrationId &&
          p.type === pay.type &&
          p.status === 'lunas'
      )
      .map((p) => ({
        id: p.id,
        amount: p.amount,
        date: p.date,
        bankAccount: p.bankAccount || 'Rekening Resmi Yayasan',
      }));

    return res.json({
      valid: true,
      paymentId: pay.id,
      registrationNumber: pay.registrationNumber,
      studentName: resolvedName || pay.studentName,
      unitId: pay.unit,
      unitName: targetUnit?.name || pay.unit,
      unitShortName: targetUnit?.shortName || pay.unit,
      paymentType: pay.type,
      amount: pay.amount,
      totalApprovedForBill: billTranches.reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
      date: pay.date,
      bankAccount: pay.bankAccount || 'Rekening Resmi Yayasan',
      status: 'lunas',
      verificationNotes: pay.verificationNotes || 'Pembayaran telah diverifikasi dan dinyatakan LUNAS.',
      academicYear: getActiveAcademicYearLabel(academicYears),
      appName: landing?.appName || 'PPDB Yayasan Ar-Risalah Aceh',
      logoUrl: landing?.logoUrl || '',
      receiptSig: expectedSig,
      tranches: billTranches,
      message: `Valid atas nama pendaftar ${resolvedName || pay.studentName}`,
    });
  } catch (err: any) {
    console.error('[API Verify Resi Error]:', err);
    return res.status(500).json({
      valid: false,
      paymentId: pid,
      message: 'Terjadi kesalahan saat memverifikasi keaslian resi pembayaran.',
    });
  }
});

// -------------------------------------------------------------
// Master Admin Trash / Sampah Management API (Super Admin Yayasan ONLY)
// -------------------------------------------------------------
app.get('/api/trash', requireAuth, requireRole(['Super Admin Yayasan']), (req: AuthRequest, res: Response) => {
  try {
    let items = db.getTrashItems();
    const entityTypeFilter = typeof req.query.entityType === 'string' ? req.query.entityType.trim() : '';
    const unitIdFilter = typeof req.query.unitId === 'string' ? req.query.unitId.trim() : '';

    if (entityTypeFilter && entityTypeFilter !== 'ALL') {
      items = items.filter((item) => item.entityType === entityTypeFilter);
    }
    if (unitIdFilter && unitIdFilter !== 'ALL') {
      items = items.filter((item) => item.unitId === unitIdFilter);
    }

    res.json(items);
  } catch (err: any) {
    console.error('[API Get Trash Error]:', err);
    res.status(500).json({ error: 'Gagal mengambil daftar sampah dari database.' });
  }
});

app.post('/api/trash/:id/restore', requireAuth, requireRole(['Super Admin Yayasan']), async (req: AuthRequest, res: Response) => {
  try {
    const trashId = String(req.params.id || '').trim();
    if (!trashId || trashId.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(trashId)) {
      return res.status(400).json({ error: 'ID item sampah tidak valid.' });
    }

    const actor = req.user?.email || req.user?.name || 'Master Admin';
    const result = await db.restoreTrashItem(trashId, actor);
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ error: result.error || 'Gagal memulihkan data dari sampah.' });
    }

    res.json({
      success: true,
      entityType: result.entityType,
      message: result.message,
      trashItems: db.getTrashItems(),
    });
  } catch (err: any) {
    console.error('[API Restore Trash Error]:', err);
    res.status(500).json({ error: 'Gagal memulihkan data dari sampah.' });
  }
});

app.delete('/api/trash/:id', requireAuth, requireRole(['Super Admin Yayasan']), async (req: AuthRequest, res: Response) => {
  try {
    const trashId = String(req.params.id || '').trim();
    if (!trashId || trashId.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(trashId)) {
      return res.status(400).json({ error: 'ID item sampah tidak valid.' });
    }

    const actor = req.user?.email || req.user?.name || 'Master Admin';
    const deleted = await db.permanentlyDeleteTrashItem(trashId, actor);
    if (!deleted) {
      return res.status(404).json({ error: 'Item sampah tidak ditemukan.' });
    }

    res.json({
      success: true,
      message: 'Data berhasil dihapus permanen dari Sampah.',
      trashItems: db.getTrashItems(),
    });
  } catch (err: any) {
    console.error('[API Permanent Delete Trash Error]:', err);
    res.status(500).json({ error: 'Gagal menghapus permanen item dari sampah.' });
  }
});

app.delete('/api/trash', requireAuth, requireRole(['Super Admin Yayasan']), async (req: AuthRequest, res: Response) => {
  try {
    const actor = req.user?.email || req.user?.name || 'Master Admin';
    const deletedCount = await db.emptyTrash(actor);
    res.json({
      success: true,
      deletedCount,
      message: `Seluruh Sampah berhasil dikosongkan (${deletedCount} item dihapus permanen).`,
      trashItems: [],
    });
  } catch (err: any) {
    console.error('[API Empty Trash Error]:', err);
    res.status(500).json({ error: 'Gagal mengosongkan data sampah.' });
  }
});

// Return JSON 404 for unknown /api routes rather than SPA HTML
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
});

// 5. Safe Error Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[API Error]:', err);
  res.status(500).json({
    error: 'Terjadi kesalahan internal server yang aman.',
    message: isProd ? 'Internal Server Error' : err.message,
  });
});

// 6. Vite Integration / Static Assets
async function startServer() {
  await initDatabase();

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[PPDB Backend] Server berjalan di http://${HOST}:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[PPDB Backend] Fatal start error:', err);
});
