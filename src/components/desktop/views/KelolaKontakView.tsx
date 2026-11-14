import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  Save,
  Building2,
  Mail,
  MapPin,
  Clock,
  User,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  MessageCircle,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { UnitContactConfig, SchoolId } from '../../../types/ppdb';
import { hasActionPermission, isMasterUser } from '../../../utils/rbac';

export const KelolaKontakView: React.FC = () => {
  const { unitContacts, updateUnitContact, units, currentUser, roles, showToast, activeSchoolId } = usePPDB();

  const isMaster = isMasterUser(currentUser) || currentUser?.schoolId === 'MASTER' || currentUser?.role?.includes('Admin Yayasan');
  const userUnit: SchoolId = currentUser?.schoolId && currentUser.schoolId !== 'MASTER' ? currentUser.schoolId : 'MASTER';

  const [selectedUnit, setSelectedUnit] = useState<SchoolId>(isMaster ? 'MASTER' : userUnit);
  const [formData, setFormData] = useState<UnitContactConfig>({
    unitId: selectedUnit,
    unitName: '',
    contactPerson: '',
    phone: '',
    whatsapp: '',
    email: '',
    officeHours: '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    const found = unitContacts.find((c) => c.unitId === selectedUnit);
    if (found) {
      setFormData({ ...found });
    } else {
      const unitObj = units.find((u) => u.id === selectedUnit);
      setFormData({
        unitId: selectedUnit,
        unitName:
          selectedUnit === 'MASTER'
            ? 'Yayasan Ar-Risalah Aceh (Pusat)'
            : unitObj?.name || `${selectedUnit} Ar-Risalah Aceh`,
        contactPerson: '',
        phone: '',
        whatsapp: '',
        email: '',
        officeHours: 'Senin - Sabtu (08:00 - 15:00 WIB)',
        address: '',
        notes: '',
      });
    }
  }, [selectedUnit, unitContacts, units]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contactPerson || !formData.phone || !formData.whatsapp) {
      showToast('Nama Penanggung Jawab, Nomor Telepon, dan WhatsApp wajib diisi.', 'error');
      return;
    }
    await updateUnitContact(formData);
  };

  const unitsList: { id: SchoolId; label: string }[] = [
    { id: 'MASTER', label: 'Pusat Yayasan' },
    ...units.map((u) => ({ id: u.id as SchoolId, label: u.shortName })),
  ];

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header Card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-emerald-600" />
            <span>Manajemen Kontak Layanan Informasi PPDB</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Atur nomor WhatsApp, telepon, email, dan jam operasional panitia per unit untuk memudahkan calon wali siswa berkonsultasi.
          </p>
        </div>

        {/* Unit Selector for Master / Yayasan */}
        {isMaster && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">Pilih Unit:</span>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value as SchoolId)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            >
              {unitsList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label} ({u.id})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Contact Form */}
      <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <h4 className="text-sm font-bold text-slate-900">
              Pengaturan Kontak Unit: <span className="text-emerald-700">{formData.unitName || selectedUnit}</span>
            </h4>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
            ID Unit: {selectedUnit}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Instansi / Unit Sekolah *
            </label>
            <input
              type="text"
              value={formData.unitName}
              onChange={(e) => setFormData({ ...formData, unitName: e.target.value })}
              placeholder="Contoh: SDIT Ar-Risalah Aceh"
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-bold focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Panitia / Penanggung Jawab *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                placeholder="Contoh: Ustadz M. Husaini, M.Pd"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-800 font-bold focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nomor WhatsApp Panitia (Tanpa Spasi/Simbol) *
            </label>
            <div className="relative">
              <MessageCircle className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                placeholder="Contoh: 6281360998877"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-800 font-mono font-bold focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Gunakan format internasional awalan 62 (contoh: 62812...)</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nomor Telepon / HP Alternatif *
            </label>
            <div className="relative">
              <PhoneCall className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Contoh: 081360998877"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-800 font-mono font-bold focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Alamat Email Resmi Unit
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Contoh: sdit@arrisalahaceh.sch.id"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Jam Operasional Layanan
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={formData.officeHours}
                onChange={(e) => setFormData({ ...formData, officeHours: e.target.value })}
                placeholder="Contoh: Senin - Sabtu (08:00 - 15:00 WIB)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Alamat Lengkap / Lokasi Sekretariat PPDB
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <textarea
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Contoh: Jl. BTN Kupula Indah, Bireuen, Aceh"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Catatan / Panduan Singkat untuk Wali Siswa
          </label>
          <input
            type="text"
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Contoh: Hubungi via WhatsApp untuk konsultasi berkas pendaftaran."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Informasi Kontak</span>
          </button>
        </div>
      </form>
    </div>
  );
};
