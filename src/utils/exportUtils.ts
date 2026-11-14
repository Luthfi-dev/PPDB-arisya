import type { jsPDF as JsPdfType } from 'jspdf';
import { LetterConfig, UnitFormSchema } from '../types/ppdb';
import { getCardBiodataRows, resolveGuardianSummaryFromSchema, resolveStudentNameFromSchema } from './studentFieldResolver';
import { getPublicAppUrl } from './appUrl';

export interface ExportDataOptions {
  filename: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  unitName?: string;
}

/**
 * Export data to Excel-compatible CSV file (with BOM UTF-8 for Excel recognition)
 */
export function exportToExcel({ filename, title, headers, rows }: ExportDataOptions) {
  const sanitizeCell = (cell: string | number) => {
    let str = String(cell ?? '');
    // Formula Injection Protection
    if (/^[=\+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    // Escape quotes for CSV
    return `"${str.replace(/"/g, '""')}"`;
  };

  const csvRows: string[] = [];

  // Title Header
  csvRows.push(sanitizeCell(`YAYASAN AR-RISALAH ACEH - ${title.toUpperCase()}`));
  csvRows.push(sanitizeCell(`Tanggal Ekspor: ${new Date().toLocaleString('id-ID')}`));
  csvRows.push(''); // Empty row

  // Table Headers
  csvRows.push(headers.map(sanitizeCell).join(','));

  // Table Rows
  rows.forEach((row) => {
    csvRows.push(row.map(sanitizeCell).join(','));
  });

  // UTF-8 BOM prefix for Excel
  const bom = '\uFEFF';
  const csvContent = bom + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data to official formatted PDF document using jsPDF
 */
export async function exportToPdf({ filename, title, subtitle, headers, rows, unitName }: ExportDataOptions): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({
    orientation: headers.length > 6 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Top Header Bar (Emerald Green)
  doc.setFillColor(22, 163, 74); // #16a34a
  doc.rect(0, 0, pageWidth, 18, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('YAYASAN AR-RISALAH ACEH', 14, 12);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistem Penerimaan Peserta Didik Baru (PPDB)', pageWidth - 14, 12, { align: 'right' });

  // Document Title & Metadata
  doc.setTextColor(30, 41, 59); // slate-800
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 27);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // slate-500
  const subText = subtitle || `Laporan Resmi Data PPDB · Unit: ${unitName || 'Semua Unit'}`;
  doc.text(subText, 14, 33);

  const dateStr = `Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`;
  doc.text(dateStr, pageWidth - 14, 33, { align: 'right' });

  // Divider Line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(14, 37, pageWidth - 14, 37);

  // AutoTable
  autoTable(doc, {
    startY: 41,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [22, 163, 74],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [240, 253, 244], // emerald-50
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Footer page numbering
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Halaman ${data.pageNumber} dari ${pageCount} · Dokumen Resmi Yayasan Ar-Risalah Aceh`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 7,
        { align: 'center' }
      );
    },
  });

  doc.save(`${filename}.pdf`);
}

export interface StudentCardPdfOptions {
  student: {
    fullName: string;
    registrationNumber: string;
    unit: string;
    parentName?: string;
    parentPhone?: string;
    parentJob?: string;
    parentIncome?: string;
    schoolOrigin?: string;
    registeredAt?: string;
    gender?: string;
    birthPlace?: string;
    birthDate?: string;
    address?: string;
    nisn?: string;
    documents?: Record<string, string>;
    dynamicAnswers?: Record<string, any>;
  };
  schedule?: {
    date: string;
    startTime: string;
    endTime: string;
    room: string;
    examiner?: string;
  } | null;
  landingConfig?: {
    appName?: string;
    appUrl?: string;
    contact?: {
      address?: string;
      phone?: string;
      whatsapp?: string;
      email?: string;
    };
  } | null;
  letterConfigs?: LetterConfig[] | null;
  letterConfig?: LetterConfig | null;
  formSchemas?: UnitFormSchema[] | null;
  formSchema?: UnitFormSchema | null;
  academicYearLabel?: string;
  units?: Array<{ id?: string; shortName: string }> | null;
  download?: boolean;
}

/**
 * Generate official PDF for Kartu Peserta Ujian / Bukti Pendaftaran
 */
export async function generateStudentCardPdf({
  student,
  schedule,
  landingConfig,
  letterConfigs,
  letterConfig: directConfig,
  formSchemas,
  formSchema: directFormSchema,
  academicYearLabel,
  units,
  download = true,
}: StudentCardPdfOptions): Promise<{ doc: JsPdfType; blob: Blob; dataUri: string }> {
  const [{ default: jsPDF }, { default: autoTable }, QRCodeModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    import('qrcode'),
  ]);
  const QRCode = QRCodeModule.default || QRCodeModule;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const letterConfig: Partial<LetterConfig> =
    directConfig ||
    letterConfigs?.find((l) => l.unitId === student.unit) ||
    letterConfigs?.find((l) => l.unitId === 'MASTER') || {
      committeeChairName: 'Ustadz Dr. Rahmat Hidayat, M.A',
      committeeChairNip: 'NIPY. 19850412 201001 1 002',
      committeeRoleTitle: 'Ketua Panitia PPDB Yayasan',
      letterHeaderTitle: 'PANITIA PENERIMAAN PESERTA DIDIK BARU (PPDB)',
      cardTitle: 'KARTU TANDA PESERTA UJIAN & OBSERVASI PPDB',
      issueLocation: 'Bireuen',
      issueDate: todayStr,
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
  doc.setFillColor(20, 83, 45); // emerald-900 (#14532d)
  doc.rect(0, 0, pageWidth, 6, 'F');
  doc.setFillColor(22, 163, 74); // emerald-600 (#16a34a)
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

  const currentYr = new Date().getFullYear();
  const resolvedYearLabel = (academicYearLabel && academicYearLabel.trim()) || `${currentYr}/${currentYr + 1}`;
  const resolvedUnitsLabel =
    Array.isArray(units) && units.length > 0
      ? units.map((u) => u.shortName).filter(Boolean).join(', ')
      : 'TKIT, SDIT, SMPIT & SMAIT';

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Tahun Ajaran ${resolvedYearLabel} · Jenjang ${resolvedUnitsLabel}`, pageWidth / 2, 28, { align: 'center' });

  // Address in Kop (Dynamic from DB)
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${addressText} | Telp/WA: ${phoneText}`, pageWidth / 2, 32.5, { align: 'center' });

  // Double Divider Lines
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.8);
  doc.line(14, 36, pageWidth - 14, 36);
  doc.setLineWidth(0.2);
  doc.line(14, 37.5, pageWidth - 14, 37.5);

  // 3. Title Card Header Box
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.roundedRect(14, 42, pageWidth - 28, 14, 3, 3, 'F');
  doc.setDrawColor(187, 247, 208); // emerald-200
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
  doc.text(student.registrationNumber, 18, 72.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const regDateText = student.registeredAt ? `Terdaftar: ${student.registeredAt} WIB` : 'Status: Berkas Lengkap';
  doc.text(regDateText, pageWidth - 18, 71, { align: 'right' });

  // 5. Student Details Table via AutoTable (Synced with Pengaturan Surat & Form Builder)
  const resolvedUnitSchema =
    directFormSchema ||
    formSchemas?.find((s) => s.unitId === student.unit) ||
    null;

  const effectiveLetterConfigs = directConfig
    ? [directConfig, ...(letterConfigs || [])]
    : letterConfigs;

  const computedRows = getCardBiodataRows(student, effectiveLetterConfigs, resolvedUnitSchema);
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

  doc.setFillColor(248, 250, 252); // slate-50
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

  // 8. Signature Block (Dynamic Chair Name & Role with TTD Online QR Code)
  const sigY = rulesY + 26;

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

  // Generate QR Code for online verification using APP_URL from server .env
  const baseUrl = getPublicAppUrl(landingConfig?.appUrl);
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

  const resolvedGuardian = resolveGuardianSummaryFromSchema(student, resolvedUnitSchema);
  const guardianSignatureLabel = resolvedGuardian.name || student.parentName || 'Wali Siswa';

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`( ${guardianSignatureLabel} )`, 30, sigY + 32, { align: 'center' });

  if (qrDataUrl) {
    // Draw QR Code Image (20mm x 20mm)
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

  const resolvedStudentName = resolveStudentNameFromSchema(student, resolvedUnitSchema);
  const cleanReg = student.registrationNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Kartu_PPDB_${cleanReg}_${resolvedStudentName.replace(/\s+/g, '_')}.pdf`;

  if (download) {
    doc.save(filename);
  }

  const blob = doc.output('blob');
  const dataUri = doc.output('datauristring');

  return { doc, blob, dataUri };
}
