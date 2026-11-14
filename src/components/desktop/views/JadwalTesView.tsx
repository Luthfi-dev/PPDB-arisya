import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  Plus,
  Pencil,
  Trash2,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { UnitBadge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { Pagination } from '../../common/Pagination';
import { TestSchedule } from '../../../types/ppdb';
import { usePPDB } from '../../../context/PPDBContext';
import { hasActionPermission } from '../../../utils/rbac';
import { ExportDropdown } from '../../common/ExportDropdown';
import { PlainNumberInput } from '../../common/FormattedNumberInputs';

export const JadwalTesView: React.FC = () => {
  const { schedules, students, units, activeSchoolId, addSchedule, updateSchedule, deleteSchedule, currentUser } = usePPDB();

  const canAdd = hasActionPermission(currentUser, 'Jadwal', 'add');
  const canEdit = hasActionPermission(currentUser, 'Jadwal', 'edit');
  const canDelete = hasActionPermission(currentUser, 'Jadwal', 'delete');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<TestSchedule | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<TestSchedule | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(4);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const filteredSchedules = schedules.filter((s: TestSchedule) =>
    activeSchoolId === 'MASTER' ? true : s.unit === activeSchoolId
  );

  const initialCalDate = (() => {
    const firstDated = filteredSchedules.find((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date));
    if (firstDated) {
      const [y, m] = firstDated.date.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  })();

  const [calendarMonth, setCalendarMonth] = useState<Date>(initialCalDate);
  const todayIso = new Date().toISOString().slice(0, 10);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    unit: (units[0]?.id || 'TK01') as string,
    date: todayIso,
    startTime: '08:00',
    endTime: '12:00',
    room: '',
    examiner: '',
    quota: 50,
  });

  const dateFilteredSchedules = selectedDate
    ? filteredSchedules.filter((s) => s.date === selectedDate)
    : filteredSchedules;

  const paginatedSchedules = dateFilteredSchedules.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleOpenAdd = () => {
    setFormData({
      title: '',
      unit: activeSchoolId === 'MASTER' ? (units[0]?.id || 'TK01') : activeSchoolId,
      date: selectedDate || todayIso,
      startTime: '08:00',
      endTime: '12:00',
      room: '',
      examiner: '',
      quota: 40,
    });
    setIsAddModalOpen(true);
  };

  const handleCreateSchedule = async () => {
    if (!formData.title || !formData.room || !formData.examiner || !formData.quota || formData.quota < 1) return;
    const ok = await addSchedule(formData);
    if (ok) {
      setIsAddModalOpen(false);
    }
  };

  const handleOpenEdit = (sch: TestSchedule) => {
    setEditingSchedule(sch);
    setFormData({
      title: sch.title,
      unit: sch.unit,
      date: sch.date,
      startTime: sch.startTime,
      endTime: sch.endTime,
      room: sch.room,
      examiner: sch.examiner,
      quota: sch.quota,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingSchedule || !formData.quota || formData.quota < 1) return;
    const ok = await updateSchedule(editingSchedule.id, formData);
    if (ok) {
      setIsEditModalOpen(false);
      setEditingSchedule(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!scheduleToDelete) return;
    const ok = await deleteSchedule(scheduleToDelete.id);
    if (ok) {
      setIsDeleteModalOpen(false);
      setScheduleToDelete(null);
    }
  };

  // Dynamic real calendar matrix
  const calYear = calendarMonth.getFullYear();
  const calMonthIdx = calendarMonth.getMonth();
  const daysCount = new Date(calYear, calMonthIdx + 1, 0).getDate();
  const firstDayOffset = new Date(calYear, calMonthIdx, 1).getDay();
  const daysInMonth = Array.from({ length: daysCount }, (_, i) => i + 1);
  const leadingBlanks = Array.from({ length: firstDayOffset }, (_, i) => i);
  const monthTitle = calendarMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Top Header & Add Button */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 w-full">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Manajemen Jadwal Tes & Observasi Siswa</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola sesi tes pemetaan akademik, baca Al-Qur'an, dan observasi psikologis.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {canAdd && (
            <button
              onClick={handleOpenAdd}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Tambah Jadwal Baru</span>
            </button>
          )}

          <ExportDropdown
            moduleName="Jadwal"
            title="Jadwal Tes Seleksi & Observasi PPDB"
            filename="Jadwal_Tes_PPDB"
            headers={[
              'ID Sesi',
              'Judul Sesi Tes',
              'Unit',
              'Tanggal',
              'Waktu',
              'Ruangan',
              'Penguji',
              'Kapasitas Terisi',
              'Total Kuota',
            ]}
            rows={dateFilteredSchedules.map((sch) => {
              const actualFilled = students.filter((s) => s.testScheduleId === sch.id).length;
              const filledCount = actualFilled > 0 ? actualFilled : sch.filled;
              return [
                sch.id,
                sch.title,
                sch.unit,
                sch.date,
                `${sch.startTime} - ${sch.endTime}`,
                sch.room,
                sch.examiner,
                filledCount,
                sch.quota,
              ];
            })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar View Left */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-900 capitalize">
                {monthTitle}
              </h4>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date(calYear, calMonthIdx - 1, 1))}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                  title="Bulan Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                    setSelectedDate(null);
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 rounded-lg hover:bg-slate-100 text-[11px] font-semibold text-emerald-700 cursor-pointer"
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date(calYear, calMonthIdx + 1, 1))}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                  title="Bulan Berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-2">
              <span>MIN</span>
              <span>SEN</span>
              <span>SEL</span>
              <span>RAB</span>
              <span>KAM</span>
              <span>JUM</span>
              <span>SAB</span>
            </div>

            <div className="grid grid-cols-7 gap-1 text-xs">
              {leadingBlanks.map((b) => (
                <div key={`blank-${b}`} className="h-9" />
              ))}
              {daysInMonth.map((day) => {
                const dayStr = `${calYear}-${String(calMonthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const hasEvent = filteredSchedules.some((s: TestSchedule) => s.date === dayStr);
                const isSelected = selectedDate === dayStr;
                const isToday = dayStr === todayIso;

                return (
                  <button
                    type="button"
                    key={day}
                    onClick={() => {
                      setSelectedDate((prev) => (prev === dayStr ? null : dayStr));
                      setCurrentPage(1);
                    }}
                    className={`h-9 flex flex-col items-center justify-center rounded-xl font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-800 text-white font-bold ring-2 ring-emerald-300 shadow-sm'
                        : hasEvent
                        ? 'bg-emerald-600 text-white font-bold shadow-sm hover:bg-emerald-700'
                        : isToday
                        ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-300'
                        : 'text-slate-700 hover:bg-emerald-50'
                    }`}
                  >
                    <span>{day}</span>
                    {hasEvent && (
                      <span className="w-1 h-1 rounded-full bg-white mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <span>Ada Sesi Tes</span>
            </span>
            {selectedDate ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(null);
                  setCurrentPage(1);
                }}
                className="text-emerald-700 font-bold hover:underline cursor-pointer"
              >
                Filter: {selectedDate} (Reset)
              </button>
            ) : (
              <span>Total {filteredSchedules.length} Sesi Terjadwal</span>
            )}
          </div>
        </div>

        {/* Schedule List Right */}
        <div className="lg:col-span-7 space-y-4">
          {paginatedSchedules.map((sch: TestSchedule) => {
            const actualFilled = students.filter((s) => s.testScheduleId === sch.id).length;
            const filledCount = actualFilled > 0 ? actualFilled : sch.filled;
            const fillPercentage = Math.round((filledCount / sch.quota) * 100);

            return (
              <div
                key={sch.id}
                className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 hover:shadow-md transition-shadow relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <UnitBadge unit={sch.unit} />
                      <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        {sch.date}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      {sch.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <button
                        onClick={() => handleOpenEdit(sch)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Edit Jadwal"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => {
                          setScheduleToDelete(sch);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Hapus Jadwal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{sch.startTime} - {sch.endTime} WIB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">{sch.room}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">Penguji: {sch.examiner}</span>
                  </div>
                </div>

                {/* Quota Progress Bar */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="text-slate-500">Kapasitas Sesi:</span>
                    <span className="text-emerald-700 tabular-nums">
                      {filledCount} / {sch.quota} Terisi ({fillPercentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#16a34a] h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, fillPercentage)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination for Schedule Cards */}
          <div className="rounded-2xl overflow-hidden border border-emerald-100">
            <Pagination
              currentPage={currentPage}
              totalItems={dateFilteredSchedules.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[4, 8, 12, 20]}
            />
          </div>
        </div>
      </div>

      {/* Modal Tambah / Edit Jadwal */}
      <Modal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
        }}
        title={isEditModalOpen ? 'Edit Jadwal Tes' : 'Tambah Jadwal Tes Baru'}
        description="Atur tanggal, ruangan, penguji, dan kapasitas ruangan tes calon siswa."
        icon={<Calendar className="w-6 h-6 text-emerald-600" />}
        confirmLabel="Simpan Jadwal"
        onConfirm={isEditModalOpen ? handleSaveEdit : handleCreateSchedule}
        confirmDisabled={!formData.title || !formData.room || !formData.examiner || !formData.quota || formData.quota < 1}
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Judul Sesi Tes / Observasi *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Contoh: Tes Pemetaan Akademik & Al-Qur'an Gelombang 1"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Unit Sekolah *
              </label>
              <select
                value={formData.unit}
                onChange={(e) =>
                  setFormData({ ...formData, unit: e.target.value as any })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.shortName} ({u.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Tanggal Pelaksanaan *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Jam Mulai (WIB)
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: e.target.value })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Jam Selesai (WIB)
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) =>
                  setFormData({ ...formData, endTime: e.target.value })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Ruang / Tempat Ujian *
            </label>
            <input
              type="text"
              value={formData.room}
              onChange={(e) => setFormData({ ...formData, room: e.target.value })}
              placeholder="Contoh: Gedung Ibnu Sina Lt. 2 / Laboratorium Komputer"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Nama Penguji / Asesor *
            </label>
            <input
              type="text"
              value={formData.examiner}
              onChange={(e) => setFormData({ ...formData, examiner: e.target.value })}
              placeholder="Contoh: Ustadz Fahrurrazi, S.Pd & Tim Tahfidz"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Kapasitas / Kuota Maksimal Peserta
            </label>
            <PlainNumberInput
              max={10000}
              value={formData.quota}
              onChange={(val) => setFormData({ ...formData, quota: val })}
              placeholder="Contoh: 30"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Confirm Hapus Jadwal */}
      {scheduleToDelete && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Hapus Jadwal Tes?"
          description="Jadwal tes akan dihapus dari daftar aktif dan diarsipkan ke Sampah Master Admin agar dapat dipulihkan sewaktu-waktu jika diperlukan."
          confirmLabel="Hapus Jadwal"
          confirmVariant="danger"
          onConfirm={handleConfirmDelete}
        >
          <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-700">
            Jadwal: <strong>{scheduleToDelete.title}</strong> ({scheduleToDelete.date})
          </div>
        </Modal>
      )}
    </div>
  );
};
