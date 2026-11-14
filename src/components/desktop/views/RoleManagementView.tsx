import React, { useState } from 'react';
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  Users,
  CheckSquare,
  Lock,
  Eye,
  Check,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { UserRole, SchoolId } from '../../../types/ppdb';
import { UnitBadge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { MODULE_ACTIONS, ActionType } from '../../../utils/rbac';

export const RoleManagementView: React.FC = () => {
  const { roles, units, addRole, updateRole, deleteRole } = usePPDB();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<UserRole | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [schoolId, setSchoolId] = useState<SchoolId>('MASTER');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<string[]>(['Dashboard', 'Pendaftar:view']);

  const handleOpenAdd = () => {
    setName('');
    setSchoolId('MASTER');
    setDescription('');
    setPermissions(['Dashboard', 'Pendaftar:view', 'Verifikasi:view']);
    setIsAddOpen(true);
  };

  const handleCreate = async () => {
    if (!name) return;
    const ok = await addRole({
      name,
      schoolId,
      description,
      permissions,
    });
    if (ok) {
      setIsAddOpen(false);
    }
  };

  const handleOpenEdit = (role: UserRole) => {
    setEditingRole(role);
    setName(role.name);
    setSchoolId(role.schoolId);
    setDescription(role.description);
    setPermissions(role.permissions || []);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingRole || !name) return;
    const ok = await updateRole(editingRole.id, {
      name,
      schoolId,
      description,
      permissions,
    });
    if (ok) {
      setIsEditOpen(false);
      setEditingRole(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return;
    const ok = await deleteRole(roleToDelete.id);
    if (ok) {
      setIsDeleteOpen(false);
      setRoleToDelete(null);
    }
  };

  const hasFullModulePermission = (modName: string) => {
    return permissions.includes(modName);
  };

  const toggleFullModulePermission = (modName: string) => {
    if (permissions.includes(modName)) {
      setPermissions((prev) => prev.filter((p) => p !== modName && !p.startsWith(`${modName}:`)));
    } else {
      // Add full module and remove granular action keys to keep clean
      setPermissions((prev) => [...prev.filter((p) => !p.startsWith(`${modName}:`)), modName]);
    }
  };

  const hasActionPermissionKey = (modName: string, actionKey: ActionType) => {
    if (permissions.includes(modName)) return true;
    return permissions.includes(`${modName}:${actionKey}`);
  };

  const toggleActionPermissionKey = (modName: string, actionKey: ActionType) => {
    const key = `${modName}:${actionKey}`;

    if (permissions.includes(modName)) {
      // Expand full module into granular actions minus the toggled one
      const modDef = MODULE_ACTIONS.find((m) => m.module === modName);
      const remainingActions = modDef?.actions
        .filter((a) => a.key !== actionKey)
        .map((a) => `${modName}:${a.key}`) || [];

      setPermissions((prev) => [...prev.filter((p) => p !== modName), ...remainingActions]);
    } else if (permissions.includes(key)) {
      setPermissions((prev) => prev.filter((p) => p !== key));
    } else {
      setPermissions((prev) => [...prev, key]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>Manajemen Role & Hak Akses Pengguna (Granular RBAC)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Atur izin modul hingga tingkat aksi (Lihat, Tambah, Ubah, Hapus, Verifikasi) sesuai level role staf.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Role Baru</span>
        </button>
      </div>

      {/* Role Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Nama Role</th>
                <th className="py-3.5 px-4">Cakupan Unit</th>
                <th className="py-3.5 px-4">Hak Akses Modul & Aksi (Granular Permissions)</th>
                <th className="py-3.5 px-4 text-center">Pengguna</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.map((role, idx) => (
                <tr
                  key={role.id}
                  className={`hover:bg-emerald-50/30 transition-colors ${
                    idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                  }`}
                >
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{role.name}</span>
                      {role.name.includes('Monitoring') && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[9px] font-extrabold uppercase">
                          Read-Only
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
                      {role.description}
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <UnitBadge unit={role.schoolId} />
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1 max-w-lg">
                      {role.permissions?.map((p) => {
                        const isActionKey = p.includes(':');
                        return (
                          <span
                            key={p}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                              isActionKey
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {p}
                          </span>
                        );
                      })}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-center font-bold text-slate-700 tabular-nums">
                    {role.userCount} staf
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(role)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Edit Role & Permission Aksi"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setRoleToDelete(role);
                          setIsDeleteOpen(true);
                        }}
                        disabled={role.id === 'role-master'}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Hapus Role"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah / Edit Role */}
      <Modal
        isOpen={isAddOpen || isEditOpen}
        onClose={() => {
          setIsAddOpen(false);
          setIsEditOpen(false);
        }}
        title={isEditOpen ? `Edit Granular RBAC Role: ${name}` : 'Tambah Role Baru'}
        description="Konfigurasi izin akses per modul hingga tingkat tindakan (Lihat, Tambah, Ubah, Hapus, Verifikasi)."
        icon={<ShieldCheck className="w-6 h-6 text-emerald-600" />}
        confirmLabel="Simpan Konfigurasi Role"
        onConfirm={isEditOpen ? handleSaveEdit : handleCreate}
        confirmDisabled={!name}
        maxWidth="3xl"
      >
        <div className="space-y-5 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nama Role / Jabatan *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Admin Yayasan (Monitoring)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Cakupan Unit (school_id)
              </label>
              <select
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value as SchoolId)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              >
                <option value="MASTER">MASTER (Semua Unit Yayasan)</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.id} - {u.shortName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Keterangan & Tugas Utama
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Pengawasan tingkat yayasan (Read-Only)"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
            />
          </div>

          {/* Granular Permission Matrix */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-900 block">
                Matrix Hak Akses Granular Per Modul & Aksi:
              </label>
              <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                {permissions.length} Izin Dipilih
              </span>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {MODULE_ACTIONS.map((modDef) => {
                const fullModule = hasFullModulePermission(modDef.module);

                return (
                  <div
                    key={modDef.module}
                    className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 hover:border-emerald-200 transition-colors"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-xs">{modDef.label}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({modDef.module})</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleFullModulePermission(modDef.module)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                          fullModule
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {fullModule ? 'Akses Penuh Modul (FULL)' : 'Beri Akses Penuh'}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {modDef.actions.map((act) => {
                        const checked = hasActionPermissionKey(modDef.module, act.key);

                        return (
                          <label
                            key={act.key}
                            onClick={() => toggleActionPermissionKey(modDef.module, act.key)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-[11px] font-semibold border transition-all select-none ${
                              checked
                                ? 'bg-emerald-100 border-emerald-300 text-emerald-900 shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {}}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                            />
                            <span>{act.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Hapus Role */}
      {roleToDelete && (
        <Modal
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          title="Hapus Role Pengguna?"
          description={`Role ${roleToDelete.name} akan dihapus dari sistem hak akses.`}
          confirmLabel="Hapus Role"
          confirmVariant="danger"
          onConfirm={handleConfirmDelete}
        >
          <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-700">
            Perhatian: Pengguna yang terhubung dengan role ini perlu dialihkan ke role lain.
          </div>
        </Modal>
      )}
    </div>
  );
};
