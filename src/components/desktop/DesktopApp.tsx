import React, { useState, useEffect, Suspense, lazy } from 'react';
import { usePPDB } from '../../context/PPDBContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ForbiddenBarrier } from './ForbiddenBarrier';
import { hasMenuAccess, getDefaultMenuForUser, isMasterUser, isParentUser } from '../../utils/rbac';
import { DeveloperFooter } from '../common/DeveloperFooter';

const DashboardView = lazy(() => import('./views/DashboardView').then((m) => ({ default: m.DashboardView })));
const PendaftarView = lazy(() => import('./views/PendaftarView').then((m) => ({ default: m.PendaftarView })));
const VerifikasiView = lazy(() => import('./views/VerifikasiView').then((m) => ({ default: m.VerifikasiView })));
const JadwalTesView = lazy(() => import('./views/JadwalTesView').then((m) => ({ default: m.JadwalTesView })));
const KelulusanView = lazy(() => import('./views/KelulusanView').then((m) => ({ default: m.KelulusanView })));
const PembayaranView = lazy(() => import('./views/PembayaranView').then((m) => ({ default: m.PembayaranView })));
const LaporanView = lazy(() => import('./views/LaporanView').then((m) => ({ default: m.LaporanView })));
const FormBuilderView = lazy(() => import('./views/FormBuilderView').then((m) => ({ default: m.FormBuilderView })));
const RoleManagementView = lazy(() => import('./views/RoleManagementView').then((m) => ({ default: m.RoleManagementView })));
const UsersManagementView = lazy(() => import('./views/UsersManagementView').then((m) => ({ default: m.UsersManagementView })));
const TahunAjaranView = lazy(() => import('./views/TahunAjaranView').then((m) => ({ default: m.TahunAjaranView })));
const KuotaBiayaView = lazy(() => import('./views/KuotaBiayaView').then((m) => ({ default: m.KuotaBiayaView })));
const KelolaLandingView = lazy(() => import('./views/KelolaLandingView').then((m) => ({ default: m.KelolaLandingView })));
const StatusSistemView = lazy(() => import('./views/StatusSistemView').then((m) => ({ default: m.StatusSistemView })));
const AuditLogView = lazy(() => import('./views/AuditLogView').then((m) => ({ default: m.AuditLogView })));
const RealDatabaseView = lazy(() => import('./views/RealDatabaseView').then((m) => ({ default: m.RealDatabaseView })));
const KelolaExportView = lazy(() => import('./views/KelolaExportView').then((m) => ({ default: m.KelolaExportView })));
const SmtpConfigView = lazy(() => import('./views/SmtpConfigView').then((m) => ({ default: m.SmtpConfigView })));
const KelolaGrupView = lazy(() => import('./views/KelolaGrupView').then((m) => ({ default: m.KelolaGrupView })));
const KelolaKontakView = lazy(() => import('./views/KelolaKontakView').then((m) => ({ default: m.KelolaKontakView })));
const KelolaSuratView = lazy(() => import('./views/KelolaSuratView').then((m) => ({ default: m.KelolaSuratView })));
const QrPendaftaranView = lazy(() => import('./views/QrPendaftaranView').then((m) => ({ default: m.QrPendaftaranView })));
const TrashView = lazy(() => import('./views/TrashView').then((m) => ({ default: m.TrashView })));
const AktivasiPendaftaranView = lazy(() => import('./views/AktivasiPendaftaranView').then((m) => ({ default: m.AktivasiPendaftaranView })));
const RekeningYayasanView = lazy(() => import('./views/RekeningYayasanView').then((m) => ({ default: m.RekeningYayasanView })));
const WaliDashboard = lazy(() => import('../wali/WaliDashboard').then((m) => ({ default: m.WaliDashboard })));

const ViewLoaderFallback: React.FC = () => (
  <div className="flex items-center justify-center py-20">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 rounded-full border-3 border-emerald-200 border-t-emerald-600 animate-spin" />
      <span className="text-xs font-medium text-slate-500">Memuat modul...</span>
    </div>
  </div>
);

export const DesktopApp: React.FC = () => {
  const {
    desktopActiveMenu,
    setDesktopActiveMenu,
    activeSchoolId,
    setActiveSchoolId,
    currentUser,
    roles,
    logout,
    addAuditLog,
  } = usePPDB();
  const [searchQuery, setSearchQuery] = useState('');

  // Unit-isolation middleware enforcement on client
  useEffect(() => {
    if (currentUser && !isMasterUser(currentUser) && currentUser.schoolId !== 'MASTER') {
      if (activeSchoolId !== currentUser.schoolId) {
        setActiveSchoolId(currentUser.schoolId);
      }
    }
  }, [currentUser, activeSchoolId, setActiveSchoolId]);

  // Audit log on unauthorized navigation attempt
  useEffect(() => {
    if (currentUser && !hasMenuAccess(desktopActiveMenu, currentUser, roles)) {
      addAuditLog(
        'unauthorized_access' as any,
        currentUser.schoolId,
        `Percobaan manipulasi akses menu ilegal dicegah: Modul "${desktopActiveMenu}" oleh ${currentUser.email}`
      );
    }
  }, [desktopActiveMenu, currentUser, roles]);

  if (isParentUser(currentUser)) {
    return (
      <Suspense fallback={<ViewLoaderFallback />}>
        <WaliDashboard />
      </Suspense>
    );
  }

  const getPageInfo = () => {
    switch (desktopActiveMenu) {
      case 'dashboard':
        return {
          title: `Dashboard ${activeSchoolId === 'MASTER' ? 'Master Yayasan' : activeSchoolId}`,
          subtitle: 'Ikhtisar statistik, grafik pendaftaran, dan data siswa terbaru.',
        };
      case 'pendaftar':
        return {
          title: 'Data Seluruh Pendaftar',
          subtitle: 'Daftar calon siswa, filter status verifikasi, dan manajemen berkas.',
        };
      case 'verifikasi':
        return {
          title: 'Verifikasi Data & Berkas',
          subtitle: 'Pemeriksaan kelengkapan isian formulir & berkas sesuai Form Builder unit.',
        };
      case 'jadwal':
        return {
          title: 'Manajemen Jadwal Tes & Seleksi',
          subtitle: 'Kalender jadwal observasi, kuota ruangan, dan penugasan penguji.',
        };
      case 'kelulusan':
        return {
          title: 'Penetapan Hasil Kelulusan',
          subtitle: 'Input nilai tes pemetaan akademik, kelulusan, dan publikasi pengumuman.',
        };
      case 'pembayaran':
        return {
          title: 'Verifikasi Pembayaran & Tagihan',
          subtitle: 'Pemeriksaan bukti transfer rekening resmi yayasan untuk formulir dan biaya daftar ulang.',
        };
      case 'rekening_yayasan':
        return {
          title: 'Rekening Bank Yayasan (Multi-Bank)',
          subtitle: 'Kelola daftar nomor rekening bank resmi yayasan untuk tujuan pembayaran PPDB.',
        };
      case 'laporan':
        return {
          title: 'Laporan Keuangan & Mutasi Kas',
          subtitle: 'Rekapitulasi penerimaan dana PPDB per unit dan ekspor CSV.',
        };
      case 'form_builder':
        return {
          title: 'Form Builder Dinamis',
          subtitle: 'Kustomisasi pertanyaan formulir pendaftaran tiap unit sekolah.',
        };
      case 'roles':
        return {
          title: 'Manajemen Role & Hak Akses',
          subtitle: 'Pengaturan izin pengguna sistem berdasarkan prinsip least privilege.',
        };
      case 'users':
        return {
          title: 'Kelola Pengguna Sistem',
          subtitle: 'Daftar akun staf yayasan, verifikator, bendahara, dan reset password.',
        };
      case 'tahun_ajaran':
        return {
          title: 'Periode Tahun Ajaran (Master)',
          subtitle: 'Manajemen tahun ajaran aktif penerimaan siswa baru.',
        };
      case 'kuota_biaya':
        return {
          title: 'Kuota & Biaya Pendidikan (Master)',
          subtitle: 'Pengaturan daya tampung dan tarif formulir/daftar ulang 4 unit sekolah.',
        };
      case 'aktivasi_pendaftaran':
        return {
          title: 'Aktivasi Pendaftaran Unit Sekolah',
          subtitle: 'Buka/tutup pendaftaran per unit beserta pengecekan kelengkapan Form Builder, surat, kuota, dan jadwal.',
        };
      case 'kelola_landing':
        return {
          title: 'Kelola Landing Page Publik (Master)',
          subtitle: 'Pengaturan teks banner hero, alur 5-langkah, syarat, dan kontak yayasan.',
        };
      case 'status_sistem':
        return {
          title: 'Status Arsitektur Sistem (Master)',
          subtitle: 'Pemeriksaan CSRF token, masa sesi, rate limit, dan security headers.',
        };
      case 'audit_log':
        return {
          title: 'Security Audit Trail & Log',
          subtitle: 'Rekaman aktivitas pengguna dengan alamat IP dan timestamp terverifikasi.',
        };
      case 'kelola_export':
        return {
          title: 'Kelola Ekspor Data Tabel (Master)',
          subtitle: 'Pengaturan pemilihan kolom/field ekspor per role pengguna atau aturan default umum.',
        };
      case 'smtp_config':
        return {
          title: 'Konfigurasi SMTP Google (Master)',
          subtitle: 'Integrasi server Gmail resmi untuk pengiriman kartu ujian & nomor registrasi otomatis.',
        };
      case 'kelola_grup':
        return {
          title: 'Link Grup Calon Siswa & Wali',
          subtitle: 'Pengaturan tautan grup WhatsApp resmi dan aturan trigger visibilitas tombol di akun wali.',
        };
      case 'kelola_kontak':
        return {
          title: 'Manajemen Kontak Layanan Informasi',
          subtitle: 'Pengaturan nomor WhatsApp, telepon, dan alamat panitia PPDB per unit sekolah.',
        };
      case 'kelola_surat':
        return {
          title: 'Format Surat & Penandatangan Kartu PPDB',
          subtitle: 'Pengaturan nama Ketua Panitia, NIP, Jabatan, Tempat & Tanggal Penetapan, serta Tata Tertib Ujian per unit.',
        };
      case 'qr_pendaftaran':
        return {
          title: 'QR Code Shortcut Pendaftaran Unit',
          subtitle: 'Buat dan unduh QR Code resmi per unit sekolah untuk shortcut formulir pendaftaran PPDB.',
        };
      case 'real_db':
        return {
          title: 'Inspeksi Real Database MySQL (Master)',
          subtitle: 'Pemeriksaan langsung isi tabel dan skema database yang terhubung secara realtime.',
        };
      case 'trash':
        return {
          title: 'Sampah & Pemulihan Data (Master)',
          subtitle: 'Arsip terpusat seluruh data yang dihapus beserta opsi pemulihan sewaktu-waktu oleh Master Admin.',
        };
      default:
        return {
          title: 'Dashboard PPDB Ar-Risalah',
          subtitle: 'Sistem Penerimaan Peserta Didik Baru',
        };
    }
  };

  const pageInfo = getPageInfo();

  const renderActiveView = () => {
    // ENFORCE FRONTEND PERMISSION GUARD: Deny-by-default
    if (!hasMenuAccess(desktopActiveMenu, currentUser, roles)) {
      return (
        <ForbiddenBarrier
          menuId={desktopActiveMenu}
          user={currentUser}
          onReset={() => setDesktopActiveMenu(getDefaultMenuForUser(currentUser))}
          onLogout={logout}
        />
      );
    }

    switch (desktopActiveMenu) {
      case 'dashboard':
        return <DashboardView />;
      case 'pendaftar':
        return <PendaftarView searchQuery={searchQuery} />;
      case 'verifikasi':
        return <VerifikasiView />;
      case 'jadwal':
        return <JadwalTesView />;
      case 'kelulusan':
        return <KelulusanView />;
      case 'pembayaran':
        return <PembayaranView />;
      case 'rekening_yayasan':
        return <RekeningYayasanView />;
      case 'laporan':
        return <LaporanView />;
      case 'form_builder':
        return <FormBuilderView />;
      case 'roles':
        return <RoleManagementView />;
      case 'users':
        return <UsersManagementView />;
      case 'tahun_ajaran':
        return <TahunAjaranView />;
      case 'kuota_biaya':
        return <KuotaBiayaView />;
      case 'aktivasi_pendaftaran':
        return <AktivasiPendaftaranView />;
      case 'kelola_landing':
        return <KelolaLandingView />;
      case 'kelola_export':
        return <KelolaExportView />;
      case 'smtp_config':
        return <SmtpConfigView />;
      case 'kelola_grup':
        return <KelolaGrupView />;
      case 'kelola_kontak':
        return <KelolaKontakView />;
      case 'kelola_surat':
        return <KelolaSuratView />;
      case 'qr_pendaftaran':
        return <QrPendaftaranView />;

      case 'status_sistem':
        return <StatusSistemView />;
      case 'audit_log':
        return <AuditLogView />;
      case 'real_db':
        return <RealDatabaseView />;
      case 'trash':
        return <TrashView />;
      default:
        return <DashboardView />;
    }
  };

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-[#f0fdf4] text-slate-800 overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      {/* 270px Fixed Left Sidebar (Permanent on Desktop/Laptop, off-canvas on mobile) */}
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Right Scrollable Main Content - FULL LAYAR */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        <Header
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onToggleSidebar={() => setMobileSidebarOpen((prev) => !prev)}
        />

        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-2 sm:px-6 sm:pt-6 sm:pb-2 lg:px-8 lg:pt-8 lg:pb-2 flex flex-col justify-between">
          <div className="w-full min-w-0">
            <Suspense fallback={<ViewLoaderFallback />}>{renderActiveView()}</Suspense>
          </div>
          <DeveloperFooter variant="light" className="pt-6 pb-0.5" />
        </main>
      </div>
    </div>
  );
};
