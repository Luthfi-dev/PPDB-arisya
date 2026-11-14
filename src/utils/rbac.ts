import type { AppUser, UserRole } from '../types/ppdb.ts';

export type ActionType = 'view' | 'add' | 'edit' | 'delete' | 'verify' | 'export';

export interface ActionDefinition {
  key: ActionType;
  label: string;
}

export interface ModuleActionDefinition {
  module: string;
  label: string;
  actions: ActionDefinition[];
}

export const MODULE_ACTIONS: ModuleActionDefinition[] = [
  {
    module: 'Dashboard',
    label: 'Dashboard Overview',
    actions: [
      { key: 'view', label: 'Lihat Dashboard' },
      { key: 'export', label: 'Ekspor Data (Excel/PDF)' },
    ],
  },
  {
    module: 'Pendaftar',
    label: 'Data Pendaftar',
    actions: [
      { key: 'view', label: 'Lihat Data' },
      { key: 'add', label: 'Tambah Pendaftar' },
      { key: 'edit', label: 'Ubah Data' },
      { key: 'delete', label: 'Hapus Data' },
      { key: 'export', label: 'Ekspor Data (Excel/PDF)' },
    ],
  },
  {
    module: 'Verifikasi',
    label: 'Verifikasi Berkas',
    actions: [
      { key: 'view', label: 'Lihat Berkas' },
      { key: 'verify', label: 'Verifikasi / Approve / Tolak' },
      { key: 'export', label: 'Ekspor Data (Excel/PDF)' },
    ],
  },
  {
    module: 'Jadwal',
    label: 'Jadwal Tes Seleksi',
    actions: [
      { key: 'view', label: 'Lihat Jadwal' },
      { key: 'add', label: 'Tambah Jadwal' },
      { key: 'edit', label: 'Ubah Jadwal' },
      { key: 'delete', label: 'Hapus Jadwal' },
      { key: 'export', label: 'Ekspor Data (Excel/PDF)' },
    ],
  },
  {
    module: 'Kelulusan',
    label: 'Penetapan Kelulusan',
    actions: [
      { key: 'view', label: 'Lihat Hasil Tes' },
      { key: 'edit', label: 'Penetapan Lulus/Tidak Lulus' },
      { key: 'export', label: 'Ekspor Data (Excel/PDF)' },
    ],
  },
  {
    module: 'Pembayaran',
    label: 'Verifikasi Pembayaran',
    actions: [
      { key: 'view', label: 'Lihat Mutasi/Bukti' },
      { key: 'verify', label: 'Konfirmasi Lunas/Tolak' },
      { key: 'export', label: 'Ekspor Data (Excel/PDF)' },
    ],
  },
  {
    module: 'Laporan',
    label: 'Laporan Keuangan',
    actions: [
      { key: 'view', label: 'Lihat Laporan' },
      { key: 'export', label: 'Ekspor Data (Excel/PDF)' },
    ],
  },
  {
    module: 'Form Builder',
    label: 'Form Builder Dinamis',
    actions: [
      { key: 'view', label: 'Lihat Skema' },
      { key: 'edit', label: 'Ubah/Simpan Skema' },
      { key: 'export', label: 'Ekspor Data (Excel/PDF)' },
    ],
  },
  {
    module: 'Kuota & Biaya',
    label: 'Kuota & Tarif Biaya',
    actions: [
      { key: 'view', label: 'Lihat Kuota' },
      { key: 'edit', label: 'Ubah Kuota & Biaya' },
      { key: 'export', label: 'Ekspor Data (Excel/PDF)' },
    ],
  },
  {
    module: 'Tahun Ajaran',
    label: 'Periode Tahun Ajaran',
    actions: [
      { key: 'view', label: 'Lihat Periode' },
      { key: 'add', label: 'Tambah Periode' },
      { key: 'edit', label: 'Aktivasi Periode' },
      { key: 'export', label: 'Ekspor Data (Excel/PDF)' },
    ],
  },
  {
    module: 'Kelola Landing',
    label: 'Kelola Landing Page',
    actions: [
      { key: 'view', label: 'Lihat Landing CMS' },
      { key: 'edit', label: 'Ubah Content Landing' },
    ],
  },
  {
    module: 'Manajemen Role',
    label: 'Manajemen Role & Akses',
    actions: [
      { key: 'view', label: 'Lihat Role' },
      { key: 'add', label: 'Tambah Role' },
      { key: 'edit', label: 'Ubah Role' },
      { key: 'delete', label: 'Hapus Role' },
      { key: 'export', label: 'Ekspor Data (Excel/PDF)' },
    ],
  },
  {
    module: 'Kelola Users',
    label: 'Kelola Pengguna Staf',
    actions: [
      { key: 'view', label: 'Lihat Users' },
      { key: 'add', label: 'Tambah User' },
      { key: 'edit', label: 'Ubah User' },
      { key: 'delete', label: 'Hapus User' },
      { key: 'export', label: 'Ekspor Data (Excel/PDF)' },
    ],
  },
  {
    module: 'Audit Log',
    label: 'Security Audit Log',
    actions: [
      { key: 'view', label: 'Lihat Audit Log' },
      { key: 'export', label: 'Ekspor Data (Excel/PDF)' },
    ],
  },
  {
    module: 'Status Sistem',
    label: 'Status Arsitektur Sistem',
    actions: [
      { key: 'view', label: 'Lihat Diagnostik' },
      { key: 'export', label: 'Ekspor Data (Excel/PDF)' },
    ],
  },
  {
    module: 'Kelola Export',
    label: 'Kelola Ekspor Data Tabel',
    actions: [
      { key: 'view', label: 'Lihat Aturan Ekspor' },
      { key: 'edit', label: 'Ubah Aturan Ekspor' },
    ],
  },
  {
    module: 'Konfigurasi SMTP',
    label: 'Konfigurasi SMTP Google',
    actions: [
      { key: 'view', label: 'Lihat Pengaturan SMTP' },
      { key: 'edit', label: 'Ubah Pengaturan SMTP' },
    ],
  },
  {
    module: 'Link Grup Siswa',
    label: 'Kelola Link Grup Siswa & Wali',
    actions: [
      { key: 'view', label: 'Lihat Link Grup' },
      { key: 'edit', label: 'Ubah Link Grup & Aturan' },
    ],
  },
  {
    module: 'Kelola Kontak',
    label: 'Kontak Unit Sekolah & Yayasan',
    actions: [
      { key: 'view', label: 'Lihat Kontak Unit' },
      { key: 'edit', label: 'Ubah Informasi Kontak' },
    ],
  },
  {
    module: 'Rekening Yayasan',
    label: 'Rekening Bank Yayasan (Multi-Bank)',
    actions: [
      { key: 'view', label: 'Lihat Rekening' },
      { key: 'add', label: 'Tambah Rekening' },
      { key: 'edit', label: 'Ubah Rekening' },
      { key: 'delete', label: 'Hapus Rekening' },
    ],
  },
];


export interface MenuDefinition {
  id: string;
  label: string;
  permission: string;
  masterOnly?: boolean;
  superAdminOnly?: boolean;
}

export const SYSTEM_MENUS: Record<string, MenuDefinition> = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard Overview',
    permission: 'Dashboard',
  },
  pendaftar: {
    id: 'pendaftar',
    label: 'Data Pendaftar',
    permission: 'Pendaftar',
  },
  verifikasi: {
    id: 'verifikasi',
    label: 'Verifikasi Berkas',
    permission: 'Verifikasi',
  },
  jadwal: {
    id: 'jadwal',
    label: 'Jadwal Tes Seleksi',
    permission: 'Jadwal',
  },
  kelulusan: {
    id: 'kelulusan',
    label: 'Penetapan Kelulusan',
    permission: 'Kelulusan',
  },
  pembayaran: {
    id: 'pembayaran',
    label: 'Verifikasi Pembayaran',
    permission: 'Pembayaran',
  },
  rekening_yayasan: {
    id: 'rekening_yayasan',
    label: 'Rekening Bank Yayasan',
    permission: 'Rekening Yayasan',
  },
  laporan: {
    id: 'laporan',
    label: 'Laporan Keuangan & Mutasi',
    permission: 'Laporan',
  },
  form_builder: {
    id: 'form_builder',
    label: 'Form Builder Dinamis',
    permission: 'Form Builder',
  },
  kuota_biaya: {
    id: 'kuota_biaya',
    label: 'Kuota & Tarif Biaya',
    permission: 'Kuota & Biaya',
  },
  aktivasi_pendaftaran: {
    id: 'aktivasi_pendaftaran',
    label: 'Aktivasi Pendaftaran Unit',
    permission: 'Kuota & Biaya',
  },
  tahun_ajaran: {
    id: 'tahun_ajaran',
    label: 'Periode Tahun Ajaran',
    permission: 'Tahun Ajaran',
  },
  kelola_landing: {
    id: 'kelola_landing',
    label: 'Kelola Landing Page',
    permission: 'Kelola Landing',
  },
  kelola_grup: {
    id: 'kelola_grup',
    label: 'Link Grup Calon Siswa',
    permission: 'Kelola Landing',
  },
  kelola_export: {
    id: 'kelola_export',
    label: 'Kelola Ekspor Data (Master)',
    permission: 'Kelola Export',
    masterOnly: true,
    superAdminOnly: true,
  },
  smtp_config: {
    id: 'smtp_config',
    label: 'Konfigurasi SMTP Google (Master)',
    permission: 'Konfigurasi SMTP',
    masterOnly: true,
    superAdminOnly: true,
  },
  kelola_kontak: {
    id: 'kelola_kontak',
    label: 'Kontak Unit Sekolah',
    permission: 'Kelola Kontak',
  },
  kelola_surat: {
    id: 'kelola_surat',
    label: 'Kelola Surat & Kartu PPDB',
    permission: 'Kelola Landing',
  },
  qr_pendaftaran: {
    id: 'qr_pendaftaran',
    label: 'QR Code Pendaftaran',
    permission: 'Dashboard',
  },
  roles: {

    id: 'roles',
    label: 'Manajemen Role & Akses',
    permission: 'Manajemen Role',
  },
  users: {
    id: 'users',
    label: 'Kelola Pengguna Staf',
    permission: 'Kelola Users',
  },
  audit_log: {
    id: 'audit_log',
    label: 'Security Audit Log',
    permission: 'Audit Log',
  },
  status_sistem: {
    id: 'status_sistem',
    label: 'Status Arsitektur Sistem',
    permission: 'Status Sistem',
  },
  real_db: {
    id: 'real_db',
    label: 'Inspeksi Real Database',
    permission: 'Status Sistem',
    masterOnly: true,
    superAdminOnly: true,
  },
  trash: {
    id: 'trash',
    label: 'Sampah / Trash Data',
    permission: 'Status Sistem',
    masterOnly: true,
    superAdminOnly: true,
  },
};

/**
 * Checks if the user is a Master / Yayasan level administrator
 */
export function isMasterUser(user: AppUser | null): boolean {
  if (!user) return false;
  // Admin Yayasan email removed from bypass to enforce granular RBAC
  return (
    user.role === 'Super Admin Yayasan' ||
    user.role === 'Admin Yayasan' ||
    user.email === 'master@dev.com' ||
    user.schoolId === 'MASTER'
  );
}

/**
 * Checks if the user is the Super Admin (Highest Privilege)
 */
export function isSuperAdmin(user: AppUser | null): boolean {
  if (!user) return false;
  return user.role === 'Super Admin Yayasan' || user.email === 'master@dev.com';
}

/**
 * Checks if the user is a Wali / Parent account (Wali Siswa, Wali Santri, Wali Murid, etc.)
 */
export function isParentUser(user: AppUser | null | undefined): boolean {
  if (!user || !user.role) return false;
  const roleLower = user.role.toLowerCase().trim();
  return (
    roleLower === 'wali siswa' ||
    roleLower === 'wali santri' ||
    roleLower === 'wali murid' ||
    roleLower.includes('wali') ||
    roleLower.includes('orang tua') ||
    (Array.isArray(user.permissions) &&
      (user.permissions.includes('Portal Wali') || user.permissions.includes('Anak Saya')))
  );
}

/**
 * Validates whether the given user has granular action-level permission on a module.
 * STRICT DENY-BY-DEFAULT with dynamic role resolution
 */
export function hasActionPermission(
  user: AppUser | null,
  modulePermission: string,
  action: ActionType,
  roles?: UserRole[]
): boolean {
  if (!user || !user.isActive) return false;

  // Wali / Parent user has no staff permissions
  if (isParentUser(user)) return false;

  // SUPER ADMIN (Master) has full access to all system modules and actions
  if (isSuperAdmin(user)) {
    return true;
  }

  // DYNAMIC RESOLUTION: Use backend-synced role permissions from state
  let perms = user.permissions || [];
  const effectiveRoles: UserRole[] = roles || [];

  if (effectiveRoles && effectiveRoles.length > 0) {
    let matchedRole: UserRole | undefined;
    if (user.email === 'master@dev.com' || user.role === 'Super Admin Yayasan') {
      matchedRole = effectiveRoles.find((r) => r.id === 'role-master' || r.name.includes('Super Admin'));
    } else if (
      user.email === 'adminyys@dev.com' ||
      (user.role && user.role.includes('Admin Yayasan') && !user.role.includes('Super'))
    ) {
      matchedRole = effectiveRoles.find(
        (r) => r.id === 'role-admin-yys' || (r.name.includes('Admin Yayasan') && !r.name.includes('Super'))
      );
    } else {
      matchedRole = effectiveRoles.find((r) => r.name === user.role || r.id === user.role);
    }

    if (matchedRole && Array.isArray(matchedRole.permissions)) {
      perms = matchedRole.permissions;
    }
  }

  // 1. Full Module permission string (e.g., "Pendaftar", "Kuota & Biaya") grants all actions
  if (perms.includes(modulePermission)) {
    return true;
  }

  // 2. Specific granular action permission string exists (e.g., "Kuota & Biaya:view", "Pendaftar:edit")
  const specificKey = `${modulePermission}:${action}`;
  if (perms.includes(specificKey)) {
    return true;
  }

  // 3. If action is 'view', grant view if any action or module key is present for this module
  if (action === 'view') {
    return perms.some((p) => p === modulePermission || p.startsWith(`${modulePermission}:`));
  }

  return false;
}

/**
 * Checks whether the user is Admin Unit, Admin Yayasan, or Super Admin (Master)
 * who is authorized to view & download Unit Registration QR Codes.
 */
export function canManageUnitQr(user: AppUser | null, roles?: UserRole[]): boolean {
  if (!user || !user.isActive) return false;
  if (isParentUser(user)) return false;
  if (isSuperAdmin(user)) return true;

  const roleLower = (user.role || '').toLowerCase();
  if (
    roleLower.includes('admin unit') ||
    roleLower.includes('admin yayasan') ||
    roleLower.includes('super admin')
  ) {
    return true;
  }

  return hasActionPermission(user, 'Form Builder', 'view', roles);
}

/**
 * Checks whether the user is Admin Unit, Admin Yayasan, or Super Admin (Master)
 * who is authorized to activate/deactivate Unit PPDB registration.
 */
export function canManageUnitActivation(user: AppUser | null, roles?: UserRole[]): boolean {
  if (!user || !user.isActive) return false;
  if (isParentUser(user)) return false;
  if (isSuperAdmin(user)) return true;

  const roleLower = (user.role || '').toLowerCase();
  if (
    roleLower.includes('admin unit') ||
    roleLower.includes('admin yayasan') ||
    roleLower.includes('super admin')
  ) {
    return true;
  }

  return hasActionPermission(user, 'Kuota & Biaya', 'edit', roles);
}

/**
 * Checks whether the user is Master Admin (Super Admin Yayasan) or Admin Yayasan
 * who is authorized to manage Yayasan multi-bank accounts.
 */
export function canManageBankAccounts(user: AppUser | null): boolean {
  if (!user || !user.isActive) return false;
  if (isParentUser(user)) return false;
  if (isSuperAdmin(user)) return true;

  const roleLower = (user.role || '').toLowerCase();
  return roleLower.includes('super admin') || roleLower.includes('admin yayasan');
}

/**
 * Validates whether the given user has access to a specific menu module
 * STRICT DENY-BY-DEFAULT with Master safeguard
 */
export function hasMenuAccess(menuId: string, user: AppUser | null, roles?: UserRole[]): boolean {
  if (!user || !user.isActive) return false;

  if (isParentUser(user)) return false;

  if (menuId === 'qr_pendaftaran') {
    return canManageUnitQr(user, roles);
  }

  if (menuId === 'aktivasi_pendaftaran') {
    return canManageUnitActivation(user, roles);
  }

  if (menuId === 'rekening_yayasan') {
    return canManageBankAccounts(user);
  }

  const def = SYSTEM_MENUS[menuId];
  if (!def) return false; // Unknown menu -> DENY

  // Master-only / Super Admin-only menu guard
  if ((def.masterOnly || def.superAdminOnly) && !isSuperAdmin(user)) {
    return false;
  }

  // Super Admin / Master has complete visibility and access to all standard menus
  // guaranteeing RBAC ('roles'), users, audit_log, status_sistem, dashboard etc. are never lost
  if (isSuperAdmin(user)) {
    return true;
  }

  return hasActionPermission(user, def.permission, 'view', roles);
}

/**
 * Returns list of allowed menu IDs for the user
 */
export function getAllowedMenuIds(user: AppUser | null): string[] {
  if (!user) return [];
  return Object.keys(SYSTEM_MENUS).filter((menuId) => hasMenuAccess(menuId, user));
}

/**
 * Returns the safest default landing menu for the user based on role
 */
export function getDefaultMenuForUser(user: AppUser | null): string {
  if (!user) return 'dashboard';
  if (isParentUser(user)) return 'dashboard';
  if (user.role.includes('Bendahara')) return 'pembayaran';
  if (user.role.includes('Verifikator')) return 'verifikasi';
  if (user.role.includes('Penguji')) return 'jadwal';
  return 'dashboard';
}

/**
 * Returns human-readable menu title
 */
export function getMenuLabel(menuId: string): string {
  return SYSTEM_MENUS[menuId]?.label || menuId;
}
