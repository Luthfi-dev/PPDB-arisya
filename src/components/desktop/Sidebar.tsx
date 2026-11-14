import React from 'react';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Calendar,
  GraduationCap,
  CreditCard,
  FileSpreadsheet,
  FormInput,
  ShieldCheck,
  UserCog,
  CalendarRange,
  Coins,
  Globe,
  Server,
  ClipboardList,
  Database,
  LogOut,
  ChevronDown,
  Building2,
  Lock,
  Sliders,
  Mail,
  MessageCircle,
  PhoneCall,
  FileEdit,
  QrCode,
  Trash2,
  Power,
  Landmark,
} from 'lucide-react';
import { usePPDB } from '../../context/PPDBContext';
import { SchoolId } from '../../types/ppdb';
import { hasMenuAccess, isMasterUser, isSuperAdmin } from '../../utils/rbac';
import { DeveloperFooter } from '../common/DeveloperFooter';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  masterOnly?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const MENU_SECTIONS: MenuSection[] = [
  {
    title: 'UTAMA',
    items: [{ id: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard }],
  },
  {
    title: 'OPERASIONAL PPDB',
    items: [
      { id: 'pendaftar', label: 'Data Pendaftar', icon: Users },
      { id: 'verifikasi', label: 'Verifikasi Berkas', icon: CheckSquare },
      { id: 'jadwal', label: 'Jadwal Tes Seleksi', icon: Calendar },
      { id: 'kelulusan', label: 'Penetapan Kelulusan', icon: GraduationCap },
    ],
  },
  {
    title: 'KEUANGAN & REKENING',
    items: [
      { id: 'pembayaran', label: 'Verifikasi Pembayaran', icon: CreditCard },
      { id: 'rekening_yayasan', label: 'Rekening Bank Yayasan', icon: Landmark },
      { id: 'laporan', label: 'Laporan Keuangan & Mutasi', icon: FileSpreadsheet },
    ],
  },
  {
    title: 'KONFIGURASI UNIT',
    items: [
      { id: 'form_builder', label: 'Form Builder Dinamis', icon: FormInput },
      { id: 'kuota_biaya', label: 'Kuota & Tarif Biaya', icon: Coins },
      { id: 'aktivasi_pendaftaran', label: 'Aktivasi Pendaftaran Unit', icon: Power },
      { id: 'tahun_ajaran', label: 'Periode Tahun Ajaran', icon: CalendarRange },
      { id: 'kelola_grup', label: 'Link Grup Calon Siswa', icon: MessageCircle },
      { id: 'kelola_kontak', label: 'Kontak Unit Sekolah', icon: PhoneCall },
      { id: 'kelola_surat', label: 'Kelola Surat & Kartu PPDB', icon: FileEdit },
      { id: 'qr_pendaftaran', label: 'QR Code Pendaftaran', icon: QrCode },
    ],
  },
  {
    title: 'SISTEM & KEAMANAN',
    items: [
      { id: 'kelola_landing', label: 'Kelola Landing Page', icon: Globe },
      { id: 'kelola_export', label: 'Kelola Ekspor Data', icon: Sliders, masterOnly: true },
      { id: 'smtp_config', label: 'Konfigurasi SMTP Google', icon: Mail, masterOnly: true },
      { id: 'roles', label: 'Manajemen Role & Akses', icon: ShieldCheck },

      { id: 'users', label: 'Kelola Pengguna Staf', icon: UserCog },
      { id: 'audit_log', label: 'Security Audit Log', icon: ClipboardList },
      { id: 'status_sistem', label: 'Status Arsitektur', icon: Server },
      { id: 'real_db', label: 'Inspeksi Real Database', icon: Database, masterOnly: true },
      { id: 'trash', label: 'Sampah / Trash Data', icon: Trash2, masterOnly: true },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const {
    desktopActiveMenu,
    setDesktopActiveMenu,
    activeSchoolId,
    setActiveSchoolId,
    currentUser,
    roles,
    setActiveView,
    landingConfig,
    units,
    logout,
    showToast,
  } = usePPDB();

  const [logoError, setLogoError] = React.useState(false);

  React.useEffect(() => {
    setLogoError(false);
  }, [landingConfig?.logoUrl]);

  const isMaster = isMasterUser(currentUser);
  const isSuper = isSuperAdmin(currentUser);

  const logoSrc = landingConfig?.logoUrl || '/uploads/1794360625078_my_new_logo.png';
  const fallbackInitial = landingConfig?.appName ? landingConfig.appName.charAt(0).toUpperCase() : 'P';

  const handleLogout = () => {
    logout();
  };

  const handleSelectMenu = (id: string) => {
    if (!hasMenuAccess(id, currentUser, roles)) {
      showToast('Akses ditolak: Anda tidak memiliki izin untuk menu ini.', 'error');
      return;
    }
    setDesktopActiveMenu(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Backdrop for mobile / tablet drawer */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-[270px] shrink-0 h-screen bg-[#14532d] text-white flex flex-col justify-between select-none border-r border-emerald-950/40 font-['Plus_Jakarta_Sans',sans-serif] transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Section */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Brand Header */}
          <div className="p-4 pb-3 border-b border-emerald-800/40">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setActiveView('landing');
                  if (onCloseMobile) onCloseMobile();
                }}
                title="Ke Halaman Utama PPDB"
                className="flex items-center gap-3 overflow-hidden text-left hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-md shrink-0 border border-emerald-200 overflow-hidden p-0.5">
                  {logoSrc && !logoError ? (
                    <img
                      src={logoSrc}
                      alt="Logo App"
                      className="w-full h-full object-contain"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <span className="text-xl font-black text-[#14532d] tracking-tight">
                      {fallbackInitial}
                    </span>
                  )}
                </div>
                <div className="overflow-hidden">
                  <h1 className="font-extrabold text-sm leading-tight tracking-tight text-white truncate">
                    {landingConfig?.appName || 'PPDB Ar-Risalah'}
                  </h1>
                  <p className="text-[11px] text-emerald-300 font-semibold truncate">
                    {landingConfig?.appTagline || 'Yayasan Ar-Risalah Aceh'}
                  </p>
                </div>
              </button>

              {/* Close Button on Mobile Drawer */}
              {onCloseMobile && (
                <button
                  onClick={onCloseMobile}
                  className="md:hidden p-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-white/10 transition-colors"
                  title="Tutup Menu"
                >
                  <ChevronDown className="w-5 h-5 rotate-90" />
                </button>
              )}
            </div>

            {/* School Selector Dropdown - Strictly Protected */}
            <div className="mt-3 pt-2.5 border-t border-emerald-800/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold tracking-wider text-emerald-300 uppercase">
                  Lingkup Unit Sekolah:
                </span>
                {!isMaster ? (
                  <span className="text-[9px] text-amber-300 font-semibold flex items-center gap-1 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/30">
                    <Lock className="w-2.5 h-2.5" /> Terkunci ({currentUser?.schoolId})
                  </span>
                ) : (
                  <span className="text-[9px] text-emerald-300 font-mono">Master Mode</span>
                )}
              </div>

              <div className="relative">
                {isMaster ? (
                  <>
                    <select
                      value={activeSchoolId}
                      onChange={(e) => {
                        const val = e.target.value as SchoolId;
                        setActiveSchoolId(val);
                        showToast(`Filter aktif unit disesuaikan: ${val}`);
                      }}
                      className="w-full appearance-none bg-emerald-950/70 border border-emerald-700/60 rounded-xl px-3 py-1.5 text-xs font-semibold text-emerald-100 pr-8 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                    >
                      <option value="MASTER">MASTER (Semua {units.length} Unit)</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.id} - {u.shortName}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-emerald-300 absolute right-2.5 top-2.5 pointer-events-none" />
                  </>
                ) : (
                  <div className="w-full bg-emerald-950/90 border border-emerald-700/60 rounded-xl px-3 py-1.5 text-xs font-semibold text-emerald-200 flex items-center justify-between">
                    <span className="truncate">
                      {(() => {
                        const matchedUnit = units.find((u) => u.id === currentUser?.schoolId);
                        if (matchedUnit) return `${matchedUnit.id} - ${matchedUnit.shortName}`;
                        return currentUser?.schoolId || 'Unit Sekolah';
                      })()}
                    </span>
                    <Lock className="w-3 h-3 text-amber-300 shrink-0" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Grouped Navigation Menu List - Middleware Enforced */}
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin scrollbar-thumb-emerald-800">
            {MENU_SECTIONS.map((section, sectionIdx) => {
              // STRICT RBAC FILTERING: Only show items the user is authorized to access
              const visibleItems = section.items.filter((item) => hasMenuAccess(item.id, currentUser, roles));

              // If no items in this section are authorized, completely hide the section header
              if (visibleItems.length === 0) return null;

              return (
                <div key={sectionIdx} className="space-y-1">
                  <p className="px-3 text-[10px] font-extrabold tracking-wider text-emerald-400 uppercase">
                    {section.title}
                  </p>
                  {visibleItems.map((item) => {
                    const isActive = desktopActiveMenu === item.id;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectMenu(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-white text-[#14532d] shadow-sm font-bold'
                            : 'text-white/80 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-[#16a34a]' : 'text-emerald-300/80'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                        {item.masterOnly && isMaster && (
                          <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 border border-amber-400/40 font-mono shrink-0">
                            Master
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </div>

      {/* Bottom Profile & Inline Logout */}
      <div className="p-3 pb-2.5 bg-[#0f3d20] border-t border-emerald-800/40 space-y-2">

        {/* User Card + Inline Logout Icon */}
        <div className="flex items-center justify-between gap-2 pt-0.5 px-1">
          <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0 border border-emerald-400">
              {(currentUser?.name || 'A').charAt(0)}
            </div>
            <div className="min-w-0 overflow-hidden">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {currentUser?.name || 'Pengguna'}
              </p>
              <p className="text-[10px] text-emerald-300 truncate font-medium">
                {currentUser?.role || 'Staff Yayasan'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            title="Keluar Akun"
            aria-label="Keluar Akun"
            className="p-2 rounded-xl bg-red-900/50 hover:bg-red-800/70 text-red-200 hover:text-white border border-red-800/40 transition-colors shrink-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <DeveloperFooter variant="sidebar" />
      </div>
    </aside>
    </>
  );
};

