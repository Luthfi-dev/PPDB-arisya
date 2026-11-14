import React, { useState, useMemo } from 'react';
import {
  UserCog,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  CheckCircle,
  XCircle,
  Search,
  MailCheck,
  MailX,
  ShieldCheck,
  Power,
  Users,
  GraduationCap,
  AlertCircle,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { AppUser, SchoolId } from '../../../types/ppdb';
import { UnitBadge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { isSuperAdmin } from '../../../utils/rbac';
import { ExportDropdown } from '../../common/ExportDropdown';

type FilterTab = 'all' | 'wali' | 'staff' | 'unverified' | 'inactive';

export const UsersManagementView: React.FC = () => {
  const {
    users,
    roles,
    units,
    currentUser,
    addUser,
    updateUser,
    deleteUser,
    resetUserPassword,
    showToast,
  } = usePPDB();

  const isMaster = isSuperAdmin(currentUser);

  // Available roles: Admin Yayasan cannot assign Master or Admin Yayasan roles
  const availableRoles = isMaster
    ? roles
    : roles.filter(
        (r) =>
          !r.name.includes('Super Admin') &&
          !r.name.includes('Admin Yayasan') &&
          r.id !== 'role-master' &&
          r.id !== 'role-admin-yys'
      );

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<AppUser | null>(null);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    schoolId: 'MASTER' as SchoolId,
    role: isMaster ? 'Super Admin Yayasan' : (availableRoles[0]?.name || 'Staf Verifikator Berkas'),
    isActive: true,
    emailVerified: false,
  });

  // Base visible users according to RBAC
  const baseUsers = useMemo(() => {
    return users.filter((u) => {
      if (!isMaster) {
        const isMasterStaff =
          u.role === 'Super Admin Yayasan' ||
          u.email === 'master@dev.com' ||
          u.role?.includes('Super Admin');
        const isAdminYysStaff =
          u.role === 'Admin Yayasan' ||
          u.email === 'adminyys@dev.com' ||
          (u.role?.includes('Admin Yayasan') && !u.role?.includes('Super'));

        if (isMasterStaff || isAdminYysStaff) {
          return false;
        }
      }
      return true;
    });
  }, [users, isMaster]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    const isWali = (u: AppUser) =>
      u.role === 'Wali Siswa' ||
      u.role === 'Wali Santri' ||
      Boolean(u.studentId) ||
      u.id.startsWith('usr-wali') ||
      u.id.startsWith('wali-');

    return {
      all: baseUsers.length,
      wali: baseUsers.filter(isWali).length,
      staff: baseUsers.filter((u) => !isWali(u)).length,
      unverified: baseUsers.filter((u) => !u.emailVerified).length,
      inactive: baseUsers.filter((u) => !u.isActive).length,
    };
  }, [baseUsers]);

  // Filtered users by tab & search
  const filteredUsers = useMemo(() => {
    const isWali = (u: AppUser) =>
      u.role === 'Wali Siswa' ||
      u.role === 'Wali Santri' ||
      Boolean(u.studentId) ||
      u.id.startsWith('usr-wali') ||
      u.id.startsWith('wali-');

    return baseUsers.filter((u) => {
      // Tab filter
      if (activeTab === 'wali' && !isWali(u)) return false;
      if (activeTab === 'staff' && isWali(u)) return false;
      if (activeTab === 'unverified' && u.emailVerified) return false;
      if (activeTab === 'inactive' && u.isActive) return false;

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = u.name.toLowerCase().includes(q);
        const matchEmail = u.email.toLowerCase().includes(q);
        const matchPhone = (u.phone || '').includes(q);
        const matchRole = (u.role || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchRole) {
          return false;
        }
      }

      return true;
    });
  }, [baseUsers, activeTab, search]);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      schoolId: 'MASTER',
      role: availableRoles[0]?.name || 'Staf Verifikator Berkas',
      isActive: true,
      emailVerified: true, // Default staff accounts created by admin are pre-verified
    });
    setIsAddOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.email) return;
    const matchedRole = roles.find((r) => r.name === formData.role);
    const ok = await addUser({
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim() || '081234567890',
      schoolId: formData.schoolId,
      role: formData.role,
      permissions: matchedRole ? matchedRole.permissions : ['Dashboard'],
      isActive: formData.isActive,
      emailVerified: formData.emailVerified,
    } as any);
    if (ok) {
      setIsAddOpen(false);
    }
  };

  const handleOpenEdit = (user: AppUser) => {
    if (!isMaster) {
      const isMasterStaff =
        user.role === 'Super Admin Yayasan' ||
        user.email === 'master@dev.com' ||
        user.role?.includes('Super Admin');
      const isAdminYysStaff =
        user.role === 'Admin Yayasan' ||
        user.email === 'adminyys@dev.com' ||
        (user.role?.includes('Admin Yayasan') && !user.role?.includes('Super'));
      if (isMasterStaff || isAdminYysStaff) {
        showToast('Akses Ditolak: Akun staf ini dilindungi sistem dan tidak dapat diedit.', 'error');
        return;
      }
    }

    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      schoolId: user.schoolId || 'MASTER',
      role: user.role,
      isActive: user.isActive !== false,
      emailVerified: Boolean(user.emailVerified),
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser || !formData.name) return;
    const matchedRole = roles.find((r) => r.name === formData.role);
    const ok = await updateUser(editingUser.id, {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim(),
      schoolId: formData.schoolId,
      role: formData.role,
      permissions: matchedRole ? matchedRole.permissions : editingUser.permissions,
      isActive: formData.isActive,
      emailVerified: formData.emailVerified,
    });
    if (ok) {
      setIsEditOpen(false);
      setEditingUser(null);
    }
  };

  const handleToggleActive = async (user: AppUser) => {
    if (!isMaster) {
      const isMasterStaff =
        user.role === 'Super Admin Yayasan' ||
        user.email === 'master@dev.com' ||
        user.role?.includes('Super Admin');
      const isAdminYysStaff =
        user.role === 'Admin Yayasan' ||
        user.email === 'adminyys@dev.com' ||
        (user.role?.includes('Admin Yayasan') && !user.role?.includes('Super'));
      if (isMasterStaff || isAdminYysStaff) {
        showToast('Akses Ditolak: Anda tidak dapat mengubah status akun ini.', 'error');
        return;
      }
    }

    const nextActive = !user.isActive;
    setIsUpdatingId(user.id);
    try {
      const ok = await updateUser(user.id, { isActive: nextActive });
      if (!ok) return;
      if (nextActive) {
        showToast(`Akun "${user.name}" berhasil diaktifkan.`, 'success');
      } else {
        showToast(`Akun "${user.name}" dinonaktifkan. Pengguna tidak dapat login.`);
      }
    } catch {
      showToast('Gagal mengubah status aktif akun.', 'error');
    } finally {
      setIsUpdatingId(null);
    }
  };

  const handleToggleEmailVerified = async (user: AppUser) => {
    if (!isMaster) {
      const isMasterStaff =
        user.role === 'Super Admin Yayasan' ||
        user.email === 'master@dev.com' ||
        user.role?.includes('Super Admin');
      const isAdminYysStaff =
        user.role === 'Admin Yayasan' ||
        user.email === 'adminyys@dev.com' ||
        (user.role?.includes('Admin Yayasan') && !user.role?.includes('Super'));
      if (isMasterStaff || isAdminYysStaff) {
        showToast('Akses Ditolak: Anda tidak dapat mengubah status akun ini.', 'error');
        return;
      }
    }

    const nextVerified = !user.emailVerified;
    setIsUpdatingId(user.id);
    try {
      const ok = await updateUser(user.id, { emailVerified: nextVerified });
      if (!ok) return;
      if (nextVerified) {
        showToast(`Email ${user.email} berhasil ditandai sebagai Terverifikasi.`, 'success');
      } else {
        showToast(`Verifikasi email dicabut! Pengguna ${user.name} wajib verifikasi email via OTP saat login.`);
      }
    } catch {
      showToast('Gagal memperbarui status verifikasi email.', 'error');
    } finally {
      setIsUpdatingId(null);
    }
  };

  const handleConfirmReset = async () => {
    if (!userToReset) return;
    if (!isMaster) {
      const isMasterStaff =
        userToReset.role === 'Super Admin Yayasan' ||
        userToReset.email === 'master@dev.com' ||
        userToReset.role?.includes('Super Admin');
      const isAdminYysStaff =
        userToReset.role === 'Admin Yayasan' ||
        userToReset.email === 'adminyys@dev.com' ||
        (userToReset.role?.includes('Admin Yayasan') && !userToReset.role?.includes('Super'));
      if (isMasterStaff || isAdminYysStaff) {
        showToast('Akses Ditolak: Anda tidak dapat mereset kata sandi akun ini.', 'error');
        setIsResetOpen(false);
        setUserToReset(null);
        return;
      }
    }
    const ok = await resetUserPassword(userToReset.id);
    if (ok) {
      setIsResetOpen(false);
      setUserToReset(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    if (!isMaster) {
      const isMasterStaff =
        userToDelete.role === 'Super Admin Yayasan' ||
        userToDelete.email === 'master@dev.com' ||
        userToDelete.role?.includes('Super Admin');
      const isAdminYysStaff =
        userToDelete.role === 'Admin Yayasan' ||
        userToDelete.email === 'adminyys@dev.com' ||
        (userToDelete.role?.includes('Admin Yayasan') && !userToDelete.role?.includes('Super'));
      if (isMasterStaff || isAdminYysStaff) {
        showToast('Akses Ditolak: Akun staf ini dilindungi sistem dan tidak dapat dihapus.', 'error');
        setIsDeleteOpen(false);
        setUserToDelete(null);
        return;
      }
    }
    const ok = await deleteUser(userToDelete.id);
    if (ok) {
      setIsDeleteOpen(false);
      setUserToDelete(null);
    }
  };

  return (
    <div className="space-y-5 max-w-full overflow-hidden">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-emerald-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Kelola Akun Pengguna & Wali
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Aktivasi akun, batalkan/verifikasi email OTP, serta kelola hak akses wali santri dan staf.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Pengguna</span>
          </button>

          <div className="shrink-0">
            <ExportDropdown
              moduleName="Kelola Users"
              title="Daftar Akun Pengguna & Staf Yayasan Ar-Risalah"
              filename="Daftar_Pengguna_Staf"
              headers={['ID User', 'Nama Lengkap', 'Email', 'Verifikasi Email', 'No. HP', 'Role', 'Unit', 'Status Akun', 'Terakhir Login']}
              rows={filteredUsers.map((u) => [
                u.id,
                u.name,
                u.email,
                u.emailVerified ? 'Terverifikasi' : 'Belum Verif',
                u.phone || '-',
                u.role,
                u.schoolId,
                u.isActive ? 'Aktif' : 'Non-Aktif',
                u.lastLogin || '-',
              ])}
            />
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-xs border border-emerald-100 space-y-3">
        {/* Responsive Tab Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin text-xs">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Semua Akun</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${activeTab === 'all' ? 'bg-emerald-950 text-emerald-200' : 'bg-slate-200 text-slate-700'}`}>
              {tabCounts.all}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('wali')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'wali'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Wali Santri</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${activeTab === 'wali' ? 'bg-emerald-950 text-emerald-200' : 'bg-slate-200 text-slate-700'}`}>
              {tabCounts.wali}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('staff')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'staff'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Staf & Panitia</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${activeTab === 'staff' ? 'bg-emerald-950 text-emerald-200' : 'bg-slate-200 text-slate-700'}`}>
              {tabCounts.staff}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('unverified')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'unverified'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-amber-700'
            }`}
          >
            <MailX className="w-3.5 h-3.5" />
            <span>Belum Verif Email</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${activeTab === 'unverified' ? 'bg-amber-800 text-amber-100' : 'bg-amber-100 text-amber-800'}`}>
              {tabCounts.unverified}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('inactive')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'inactive'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-rose-700'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>Akun Nonaktif</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${activeTab === 'inactive' ? 'bg-rose-800 text-rose-100' : 'bg-rose-100 text-rose-800'}`}>
              {tabCounts.inactive}
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama pengguna, email, nomor HP, atau role..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-1"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* MOBILE CARD VIEW (block md:hidden) - Anti-Melar, Compact & Clean */}
      {/* ============================================================== */}
      <div className="block md:hidden space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">Tidak ada data pengguna yang cocok</p>
            <p className="text-[11px] text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau tab filter.</p>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isUpdating = isUpdatingId === user.id;
            return (
              <div
                key={user.id}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3 overflow-hidden min-w-0"
              >
                {/* Header Card: Name & Role */}
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {user.name}
                    </h4>
                    <p className="text-[11px] font-mono text-slate-500 break-all truncate">
                      {user.email}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <UnitBadge unit={user.schoolId} />
                  </div>
                </div>

                {/* Info Badges & Details */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="px-2 py-0.5 rounded-lg font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 truncate max-w-full">
                    {user.role}
                  </span>

                  {user.phone && (
                    <span className="px-2 py-0.5 rounded-lg font-mono text-slate-600 bg-slate-100">
                      {user.phone}
                    </span>
                  )}
                </div>

                {/* Status Badges Row */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  {/* Status Email */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    {user.emailVerified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg w-full truncate">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">Email Terverif</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg w-full truncate">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">Email Belum Verif</span>
                      </span>
                    )}
                  </div>

                  {/* Status Akun */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    {user.isActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg w-full truncate">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                        <span className="truncate">Akun Aktif</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg w-full truncate">
                        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                        <span className="truncate">Nonaktif</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Dedicated Action Buttons (Mobile Grid) */}
                <div className="space-y-2 pt-1">
                  {/* Quick Toggles: Email Verif & Akun Aktif */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Toggle Email Verif */}
                    <button
                      onClick={() => handleToggleEmailVerified(user)}
                      disabled={isUpdating}
                      className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
                        user.emailVerified
                          ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 active:bg-amber-200'
                          : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 active:bg-emerald-200'
                      }`}
                      title={user.emailVerified ? 'Kembalikan ke belum verifikasi' : 'Tandai email sudah diverifikasi'}
                    >
                      {user.emailVerified ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Batalkan Verif</span>
                        </>
                      ) : (
                        <>
                          <MailCheck className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Tandai Verif</span>
                        </>
                      )}
                    </button>

                    {/* Toggle Status Aktif */}
                    <button
                      onClick={() => handleToggleActive(user)}
                      disabled={isUpdating}
                      className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
                        user.isActive
                          ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 active:bg-rose-200'
                          : 'border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800'
                      }`}
                      title={user.isActive ? 'Nonaktifkan akun pengguna' : 'Aktifkan akun pengguna'}
                    >
                      <Power className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{user.isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
                    </button>
                  </div>

                  {/* Standard Actions: Edit, Reset Password, Hapus */}
                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setUserToReset(user);
                        setIsResetOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-lg text-slate-600 hover:text-amber-700 hover:bg-amber-50 border border-slate-200 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      title="Reset Password"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>

                    <button
                      onClick={() => handleOpenEdit(user)}
                      className="px-2.5 py-1 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      title="Edit User"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserToDelete(user);
                        setIsDeleteOpen(true);
                      }}
                      disabled={user.id === 'usr-1'}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-200 transition-colors"
                      title="Hapus Akun"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ============================================================== */}
      {/* DESKTOP TABLE VIEW (hidden md:block)                           */}
      {/* ============================================================== */}
      <div className="hidden md:block bg-white rounded-2xl shadow-xs border border-emerald-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4">Nama Pengguna</th>
                <th className="py-3.5 px-4">Email & Status OTP</th>
                <th className="py-3.5 px-4">Unit Sekolah</th>
                <th className="py-3.5 px-4">Role / Peran</th>
                <th className="py-3.5 px-4">No. HP</th>
                <th className="py-3.5 px-4 text-center">Status Akun</th>
                <th className="py-3.5 px-4 text-center">Aksi Verif & Akun</th>
                <th className="py-3.5 px-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Tidak ada akun yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, idx) => {
                  const isUpdating = isUpdatingId === user.id;
                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-emerald-50/30 transition-colors ${
                        idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                      }`}
                    >
                      {/* Nama */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div>{user.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{user.id}</div>
                      </td>

                      {/* Email & Status OTP */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-slate-700 font-medium">{user.email}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          {user.emailVerified ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                              <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>Terverifikasi</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                              <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>Belum Verif</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Unit */}
                      <td className="py-3.5 px-4">
                        <UnitBadge unit={user.schoolId} />
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-block">
                          {user.role}
                        </span>
                      </td>

                      {/* No HP */}
                      <td className="py-3.5 px-4 font-mono text-slate-600 tabular-nums">
                        {user.phone || '-'}
                      </td>

                      {/* Status Aktif */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            onClick={() => handleToggleActive(user)}
                            disabled={isUpdating}
                            className={`inline-flex items-center w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                              user.isActive ? 'bg-[#16a34a]' : 'bg-slate-300'
                            }`}
                            title={user.isActive ? 'Klik untuk menonaktifkan akun' : 'Klik untuk mengaktifkan akun'}
                          >
                            <span
                              className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform ${
                                user.isActive ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span className={`text-[10px] font-semibold ${user.isActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {user.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>
                      </td>

                      {/* Tombol Dedicated: Verifikasi Email & Status */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Toggle Email Button */}
                          <button
                            onClick={() => handleToggleEmailVerified(user)}
                            disabled={isUpdating}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1 ${
                              user.emailVerified
                                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                            title={
                              user.emailVerified
                                ? 'Kembalikan akun ke Belum Verifikasi (minta verifikasi OTP lagi saat login)'
                                : 'Tandai akun sudah terverifikasi email'
                            }
                          >
                            {user.emailVerified ? (
                              <>
                                <RotateCcw className="w-3 h-3 text-amber-600" />
                                <span>Batalkan Verif</span>
                              </>
                            ) : (
                              <>
                                <MailCheck className="w-3 h-3 text-emerald-600" />
                                <span>Tandai Verif</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Reset Password */}
                          <button
                            onClick={() => {
                              setUserToReset(user);
                              setIsResetOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Reset Password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit User"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {/* Hapus */}
                          <button
                            onClick={() => {
                              setUserToDelete(user);
                              setIsDeleteOpen(true);
                            }}
                            disabled={user.id === 'usr-1'}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Hapus User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================== */}
      {/* Modal Tambah / Edit User                                       */}
      {/* ============================================================== */}
      <Modal
        isOpen={isAddOpen || isEditOpen}
        onClose={() => {
          setIsAddOpen(false);
          setIsEditOpen(false);
        }}
        title={isEditOpen ? 'Edit Data Pengguna' : 'Tambah Pengguna Baru'}
        description="Akun ini akan memiliki akses sesuai role dan status verifikasi yang ditentukan."
        icon={<UserCog className="w-6 h-6 text-emerald-600" />}
        confirmLabel="Simpan Pengguna"
        onConfirm={isEditOpen ? handleSaveEdit : handleCreate}
        confirmDisabled={!formData.name || !formData.email}
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Nama Lengkap Pengguna *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: Ustadz Bukhari, S.Pd / Rahmat Dani"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Alamat Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="nama@arrisalahaceh.or.id / orangtua@gmail.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Unit Sekolah (school_id)
              </label>
              <select
                value={formData.schoolId}
                onChange={(e) =>
                  setFormData({ ...formData, schoolId: e.target.value as SchoolId })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              >
                <option value="MASTER">MASTER (Semua Unit / Wali)</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.id} - {u.shortName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Role Akses
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              >
                <option value="Wali Siswa">Wali Siswa (Orang Tua Santri)</option>
                {availableRoles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Nomor WhatsApp / HP
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="08126900xxxx"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
            />
          </div>

          {/* Status Switches: Status Aktif & Verifikasi Email */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Status Akun & Verifikasi
            </h5>

            {/* Switch 1: Akun Aktif */}
            <label className="flex items-center justify-between cursor-pointer select-none">
              <div>
                <span className="text-xs font-semibold text-slate-800 block">
                  Akun Aktif (Bisa Login)
                </span>
                <span className="text-[11px] text-slate-500">
                  Jika dinonaktifkan, pengguna tidak dapat masuk ke sistem.
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500"
              />
            </label>

            {/* Switch 2: Email Terverifikasi */}
            <label className="flex items-center justify-between cursor-pointer select-none pt-2 border-t border-slate-200">
              <div>
                <span className="text-xs font-semibold text-slate-800 block">
                  Email Terverifikasi (Status OTP)
                </span>
                <span className="text-[11px] text-slate-500">
                  Jika dicentang, akun sudah terverifikasi. Jika tidak dicentang, pengguna wajib memasukkan OTP saat login.
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.emailVerified}
                onChange={(e) => setFormData({ ...formData, emailVerified: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500"
              />
            </label>
          </div>
        </div>
      </Modal>

      {/* Modal Confirm Reset Password */}
      {userToReset && (
        <Modal
          isOpen={isResetOpen}
          onClose={() => setIsResetOpen(false)}
          title="Reset Password Pengguna?"
          description={`Tautan reset password sekali pakai (one-time token) yang aman akan dikirimkan ke email ${userToReset.email}.`}
          confirmLabel="Kirim Link Reset"
          onConfirm={handleConfirmReset}
        >
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
            Sesuai standar OWASP & security rules, token reset memiliki batas masa berlaku 15 menit dan di-hash dengan aman.
          </div>
        </Modal>
      )}

      {/* Modal Confirm Hapus User */}
      {userToDelete && (
        <Modal
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          title="Hapus Akun Pengguna?"
          description={`Pengguna ${userToDelete.name} (${userToDelete.email}) tidak akan dapat lagi mengakses sistem.`}
          confirmLabel="Hapus Akun"
          confirmVariant="danger"
          onConfirm={handleConfirmDelete}
        >
          <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-700">
            Tindakan ini tidak dapat dibatalkan.
          </div>
        </Modal>
      )}
    </div>
  );
};
