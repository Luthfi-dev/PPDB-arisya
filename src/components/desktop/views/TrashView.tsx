import React, { useEffect, useMemo, useState } from 'react';
import {
  Trash2,
  RotateCcw,
  Search,
  RefreshCw,
  Eye,
  AlertTriangle,
  Users,
  Calendar,
  ShieldCheck,
  FormInput,
  Globe,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Layers,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { TrashEntityType, TrashItem } from '../../../types/ppdb';
import { UnitBadge } from '../../common/Badge';
import { Modal } from '../../common/Modal';

type CategoryTab = 'ALL' | 'student' | 'schedule' | 'user' | 'role' | 'form' | 'config';

const ENTITY_LABELS: Record<TrashEntityType, { label: string; color: string }> = {
  student: { label: 'Calon Siswa', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  schedule: { label: 'Jadwal Tes', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  user: { label: 'Akun Pengguna', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  role: { label: 'Role & Akses', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  form_section: { label: 'Seksi Form', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  form_field: { label: 'Field Form', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  landing_slide: { label: 'Slide Hero', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  landing_step: { label: 'Alur Landing', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  landing_requirement: { label: 'Syarat PPDB', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  smtp_account: { label: 'Akun SMTP', color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export const TrashView: React.FC = () => {
  const {
    trashItems,
    units,
    refreshTrashItems,
    restoreTrashItem,
    permanentlyDeleteTrashItem,
    emptyTrash,
  } = usePPDB();

  const [activeTab, setActiveTab] = useState<CategoryTab>('ALL');
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [detailItem, setDetailItem] = useState<TrashItem | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<TrashItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrashItem | null>(null);
  const [isEmptyModalOpen, setIsEmptyModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pageSize = 15;

  useEffect(() => {
    setIsLoading(true);
    refreshTrashItems().finally(() => setIsLoading(false));
  }, [refreshTrashItems]);

  const handleManualRefresh = async () => {
    setIsLoading(true);
    await refreshTrashItems();
    setIsLoading(false);
  };

  const counts = useMemo(() => {
    return {
      ALL: trashItems.length,
      student: trashItems.filter((i) => i.entityType === 'student').length,
      schedule: trashItems.filter((i) => i.entityType === 'schedule').length,
      user: trashItems.filter((i) => i.entityType === 'user').length,
      role: trashItems.filter((i) => i.entityType === 'role').length,
      form: trashItems.filter((i) => i.entityType === 'form_section' || i.entityType === 'form_field').length,
      config: trashItems.filter((i) =>
        ['landing_slide', 'landing_step', 'landing_requirement', 'smtp_account'].includes(i.entityType)
      ).length,
    };
  }, [trashItems]);

  const filteredItems = useMemo(() => {
    return trashItems.filter((item) => {
      if (activeTab === 'student' && item.entityType !== 'student') return false;
      if (activeTab === 'schedule' && item.entityType !== 'schedule') return false;
      if (activeTab === 'user' && item.entityType !== 'user') return false;
      if (activeTab === 'role' && item.entityType !== 'role') return false;
      if (activeTab === 'form' && item.entityType !== 'form_section' && item.entityType !== 'form_field') {
        return false;
      }
      if (
        activeTab === 'config' &&
        !['landing_slide', 'landing_step', 'landing_requirement', 'smtp_account'].includes(item.entityType)
      ) {
        return false;
      }

      if (entityFilter !== 'ALL' && item.entityType !== entityFilter) return false;
      if (unitFilter !== 'ALL' && (item.unitId || 'MASTER') !== unitFilter) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchSub = (item.subtitle || '').toLowerCase().includes(q);
        const matchBy = (item.deletedBy || '').toLowerCase().includes(q);
        const matchId = (item.entityId || '').toLowerCase().includes(q);
        if (!matchTitle && !matchSub && !matchBy && !matchId) return false;
      }

      return true;
    });
  }, [trashItems, activeTab, entityFilter, unitFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleConfirmRestore = async () => {
    if (!restoreTarget || isSubmitting) return;
    setIsSubmitting(true);
    const ok = await restoreTrashItem(restoreTarget.id);
    setIsSubmitting(false);
    if (ok) {
      setRestoreTarget(null);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!deleteTarget || isSubmitting) return;
    setIsSubmitting(true);
    const ok = await permanentlyDeleteTrashItem(deleteTarget.id);
    setIsSubmitting(false);
    if (ok) {
      setDeleteTarget(null);
    }
  };

  const handleConfirmEmptyTrash = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const ok = await emptyTrash();
    setIsSubmitting(false);
    if (ok) {
      setIsEmptyModalOpen(false);
    }
  };

  const summaryCards: Array<{
    key: CategoryTab;
    label: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: 'ALL', label: 'Semua Arsip', count: counts.ALL, icon: Layers },
    { key: 'student', label: 'Calon Siswa', count: counts.student, icon: Users },
    { key: 'schedule', label: 'Jadwal Tes', count: counts.schedule, icon: Calendar },
    { key: 'user', label: 'Pengguna / Staf', count: counts.user, icon: UserCog },
    { key: 'role', label: 'Role Akses', count: counts.role, icon: ShieldCheck },
    { key: 'form', label: 'Form Builder', count: counts.form, icon: FormInput },
    { key: 'config', label: 'Landing & SMTP', count: counts.config, icon: Globe },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-emerald-600" />
            <span>Sampah &amp; Pemulihan Data Sistem (Master Trash)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Setiap data yang dihapus di seluruh aplikasi otomatis diarsipkan di sini. Hanya Master Admin yang dapat memulihkan atau menghapus permanen.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEmptyModalOpen(true)}
            disabled={trashItems.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Kosongkan Sampah ({trashItems.length})</span>
          </button>
        </div>
      </div>

      {/* Category Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const isActive = activeTab === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => {
                setActiveTab(card.key);
                setEntityFilter('ALL');
                setCurrentPage(1);
              }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#14532d] text-white border-[#14532d] shadow-md'
                  : 'bg-white text-slate-700 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-300' : 'text-emerald-600'}`} />
                <span
                  className={`text-sm font-extrabold font-mono tabular-nums ${
                    isActive ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {card.count}
                </span>
              </div>
              <p className={`text-[11px] font-semibold truncate ${isActive ? 'text-emerald-100' : 'text-slate-600'}`}>
                {card.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari nama item, no. registrasi, email penghapus, atau ID..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
          />
        </div>

        <select
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
        >
          <option value="ALL">Semua Jenis Data</option>
          <option value="student">Calon Siswa</option>
          <option value="schedule">Jadwal Tes</option>
          <option value="user">Akun Pengguna</option>
          <option value="role">Role &amp; Akses</option>
          <option value="form_section">Seksi Form Builder</option>
          <option value="form_field">Field Form Builder</option>
          <option value="landing_slide">Slide Hero Landing</option>
          <option value="landing_step">Alur Pendaftaran Landing</option>
          <option value="landing_requirement">Syarat Pendaftaran Landing</option>
          <option value="smtp_account">Akun SMTP Gmail</option>
        </select>

        <select
          value={unitFilter}
          onChange={(e) => {
            setUnitFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
        >
          <option value="ALL">Semua Unit</option>
          <option value="MASTER">MASTER / Yayasan</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.id} - {u.shortName}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Item &amp; Keterangan</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4">Dihapus Oleh</th>
                <th className="py-3 px-4">Waktu Hapus</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Trash2 className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-500">
                        {trashItems.length === 0
                          ? 'Tempat sampah masih kosong.'
                          : 'Tidak ada data sampah yang cocok dengan filter pencarian.'}
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-md">
                        Setiap penghapusan siswa, jadwal tes, pengguna staf, role, field/seksi form builder, komponen landing page, atau akun SMTP akan tercatat aman di sini.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => {
                  const badge = ENTITY_LABELS[item.entityType] || {
                    label: item.entityType,
                    color: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-emerald-50/30 transition-colors ${
                        idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                      }`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-3 px-4 max-w-sm">
                        <p className="font-bold text-slate-900 truncate">{item.title}</p>
                        {item.subtitle && (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                        )}
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                          ID: {item.entityId}
                        </p>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <UnitBadge unit={item.unitId || 'MASTER'} />
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="font-medium text-slate-800">{item.deletedBy}</p>
                        {item.deletedByRole && (
                          <p className="text-[10px] text-slate-500">{item.deletedByRole}</p>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap tabular-nums">
                        {item.deletedAt}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailItem(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
                            title="Lihat Isi Snapshot"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setRestoreTarget(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors"
                            title="Pulihkan Data"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Pulihkan</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold transition-colors"
                            title="Hapus Permanen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
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

        {/* Pagination */}
        {filteredItems.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/40">
            <span>
              Menampilkan {(safePage - 1) * pageSize + 1} -{' '}
              {Math.min(safePage * pageSize, filteredItems.length)} dari {filteredItems.length} arsip sampah
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2.5 font-mono font-semibold text-slate-700">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Detail Snapshot */}
      {detailItem && (
        <Modal
          isOpen={true}
          onClose={() => setDetailItem(null)}
          title="Detail Arsip Data Sampah"
          description={`${ENTITY_LABELS[detailItem.entityType]?.label || detailItem.entityType} · Dihapus pada ${detailItem.deletedAt}`}
          maxWidth="2xl"
          hideFooter={true}
        >
          <div className="space-y-4 pb-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Nama / Judul Item</p>
                <p className="font-bold text-slate-900 mt-0.5">{detailItem.title}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">ID Entitas</p>
                <p className="font-mono text-slate-800 mt-0.5 break-all">{detailItem.entityId}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Dihapus Oleh</p>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {detailItem.deletedBy} {detailItem.deletedByRole ? `(${detailItem.deletedByRole})` : ''}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Unit Terkait</p>
                <div className="mt-0.5">
                  <UnitBadge unit={detailItem.unitId || 'MASTER'} />
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-700 mb-1.5">
                Snapshot Data Tersimpan (Siap Dipulihkan):
              </p>
              <pre className="bg-slate-900 text-emerald-300 p-4 rounded-xl overflow-x-auto max-h-80 text-[11px] leading-relaxed font-mono">
                {JSON.stringify(detailItem.snapshot, null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = detailItem;
                  setDetailItem(null);
                  setRestoreTarget(target);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Pulihkan Data Ini</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Konfirmasi Pulihkan */}
      {restoreTarget && (
        <Modal
          isOpen={true}
          onClose={() => !isSubmitting && setRestoreTarget(null)}
          title="Pulihkan Data dari Sampah?"
          description={`Data "${restoreTarget.title}" akan dikembalikan ke tabel aktif aplikasi.`}
          confirmLabel={isSubmitting ? 'Memulihkan...' : 'Ya, Pulihkan Sekarang'}
          confirmDisabled={isSubmitting}
          onConfirm={handleConfirmRestore}
        >
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <RotateCcw className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Konfirmasi Pemulihan Data</span>
            </div>
            <p className="leading-relaxed">
              Kategori: <strong>{ENTITY_LABELS[restoreTarget.entityType]?.label || restoreTarget.entityType}</strong>
              <br />
              Item: <strong>{restoreTarget.title}</strong>
              {restoreTarget.subtitle ? (
                <>
                  <br />
                  Info: <span className="text-emerald-800">{restoreTarget.subtitle}</span>
                </>
              ) : null}
            </p>
            <p className="text-[11px] text-emerald-700 pt-1 border-t border-emerald-200/70">
              Jika terdapat riwayat terkait (misalnya tagihan pembayaran calon siswa atau peserta jadwal tes), sistem akan ikut memulihkan dan menyinkronkannya ke database MySQL.
            </p>
          </div>
        </Modal>
      )}

      {/* Modal Konfirmasi Hapus Permanen 1 Item */}
      {deleteTarget && (
        <Modal
          isOpen={true}
          onClose={() => !isSubmitting && setDeleteTarget(null)}
          title="Hapus Permanen dari Sampah?"
          description="Tindakan ini menghapus arsip secara permanen dan tidak dapat dibatalkan lagi."
          confirmLabel={isSubmitting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
          confirmVariant="danger"
          confirmDisabled={isSubmitting}
          onConfirm={handleConfirmPermanentDelete}
        >
          <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-800 space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>PERINGATAN HAPUS PERMANEN</span>
            </div>
            <p>
              Anda akan menghapus arsip <strong>{deleteTarget.title}</strong> ({deleteTarget.entityId}) secara permanen dari database <code>trash_items</code>. Setelah dihapus permanen, data ini tidak bisa dipulihkan kembali.
            </p>
          </div>
        </Modal>
      )}

      {/* Modal Kosongkan Semua Sampah */}
      <Modal
        isOpen={isEmptyModalOpen}
        onClose={() => !isSubmitting && setIsEmptyModalOpen(false)}
        title="Kosongkan Seluruh Sampah?"
        description={`Total ${trashItems.length} item di Sampah akan dihapus permanen dari database.`}
        confirmLabel={isSubmitting ? 'Mengosongkan...' : 'Ya, Kosongkan Semua'}
        confirmVariant="danger"
        confirmDisabled={isSubmitting}
        onConfirm={handleConfirmEmptyTrash}
      >
        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-800 space-y-2">
          <div className="flex items-center gap-2 font-bold text-rose-900">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>KONFIRMASI KOSONGKAN SAMPAH</span>
          </div>
          <p className="leading-relaxed">
            Seluruh <strong>{trashItems.length}</strong> arsip yang ada di folder Sampah Master akan dihapus permanen. Pastikan tidak ada data penting yang masih ingin dipulihkan.
          </p>
        </div>
      </Modal>
    </div>
  );
};
