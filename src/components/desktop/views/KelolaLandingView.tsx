import React, { useState } from 'react';
import {
  Globe,
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Upload,
  CheckCircle,
  Eye,
  Award,
  ShieldCheck,
  Sparkles,
  Layers,
  Search,
  Share2,
  FileCode,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { LandingPageConfig, HeroSlide } from '../../../types/ppdb';
import { hasActionPermission } from '../../../utils/rbac';
import { PlainNumberInput } from '../../common/FormattedNumberInputs';
import { compressAndResizeImage } from '../../../utils/imageOptimizer';
import { apiFetch, getAuthHeaders } from '../../../utils/auth';
import { getPublicAppUrl } from '../../../utils/appUrl';

export const KelolaLandingView: React.FC = () => {
  const { landingConfig, updateLandingConfig, setActiveView, currentUser, roles, showToast } = usePPDB();

  const canEdit = hasActionPermission(currentUser, 'Kelola Landing', 'edit', roles);

  const [activeTab, setActiveTab] = useState<'konten' | 'brand' | 'seo'>('konten');

  const [formData, setFormData] = useState<LandingPageConfig>({
    ...landingConfig,
    heroSlides: landingConfig.heroSlides && landingConfig.heroSlides.length > 0
      ? landingConfig.heroSlides
      : [
          {
            id: 'slide-1',
            imageUrl: '/src/assets/images/campus_arrisalah_aceh_1792900903501.jpg',
            upperPoints: ['Terakreditasi A & Berizin Resmi', 'Total 826+ Calon Siswa Mendaftar'],
            title: 'Pendidikan Holistik Islami',
            subtitle: 'Tahfidz 30 Juz & Kurikulum Internasional',
            icon: 'Award',
          },
        ],
  });

  // Sync formData whenever landingConfig changes in context
  React.useEffect(() => {
    if (landingConfig) {
      setFormData((prev) => ({
        ...landingConfig,
        heroSlides: landingConfig.heroSlides && landingConfig.heroSlides.length > 0
          ? landingConfig.heroSlides
          : prev.heroSlides,
      }));
    }
  }, [landingConfig]);

  const [uploadingSlideId, setUploadingSlideId] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    await updateLandingConfig(formData);
  };

  // -------------------------------------------------------------
  // Requirements Management
  // -------------------------------------------------------------
  const handleAddRequirement = () => {
    if (!canEdit) return;
    setFormData({
      ...formData,
      requirements: [...formData.requirements, 'Persyaratan pendaftaran baru'],
    });
  };

  const handleUpdateRequirement = (index: number, val: string) => {
    if (!canEdit) return;
    const updated = [...formData.requirements];
    updated[index] = val;
    setFormData({ ...formData, requirements: updated });
  };

  const handleDeleteRequirement = (index: number) => {
    if (!canEdit) return;
    setFormData({
      ...formData,
      requirements: formData.requirements.filter((_, i) => i !== index),
    });
  };

  // -------------------------------------------------------------
  // Alur Pendaftaran (Flow Steps) Management
  // -------------------------------------------------------------
  const handleAddStep = () => {
    if (!canEdit) return;
    const newStepNum = formData.flowSteps.length + 1;
    setFormData({
      ...formData,
      flowSteps: [
        ...formData.flowSteps,
        {
          step: newStepNum,
          title: `Langkah ${newStepNum}: Tahap Baru`,
          description: 'Penjelasan detail mengenai tahapan alur pendaftaran ini...',
        },
      ],
    });
    showToast(`Poin langkah pendaftaran ke-${newStepNum} berhasil ditambahkan!`, 'success');
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (!canEdit) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= formData.flowSteps.length) return;
    const newSteps = [...formData.flowSteps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIndex];
    newSteps[targetIndex] = temp;
    const renumbered = newSteps.map((step, idx) => ({ ...step, step: idx + 1 }));
    setFormData({ ...formData, flowSteps: renumbered });
  };

  const handleUpdateStep = (index: number, field: 'title' | 'description', val: string) => {
    if (!canEdit) return;
    const newSteps = [...formData.flowSteps];
    newSteps[index] = { ...newSteps[index], [field]: val };
    setFormData({ ...formData, flowSteps: newSteps });
  };

  const handleDeleteStep = (index: number) => {
    if (!canEdit) return;
    if (formData.flowSteps.length <= 1) {
      showToast('Minimal harus ada 1 alur langkah pendaftaran.', 'error');
      return;
    }
    const filtered = formData.flowSteps.filter((_, i) => i !== index);
    const renumbered = filtered.map((step, idx) => ({ ...step, step: idx + 1 }));
    setFormData({ ...formData, flowSteps: renumbered });
    showToast('Langkah pendaftaran berhasil dihapus.', 'success');
  };

  // -------------------------------------------------------------
  // Hero Slideshow Management
  // -------------------------------------------------------------
  const handleAddSlide = () => {
    if (!canEdit) return;
    const slides = formData.heroSlides || [];
    const newSlide: HeroSlide = {
      id: `slide-${Date.now()}`,
      imageUrl: '/src/assets/images/campus_arrisalah_aceh_1792900903501.jpg',
      upperPoints: ['Poin Informasi Atas Gambar 1', 'Poin Informasi Atas Gambar 2'],
      title: 'Judul Slide Hero Baru',
      subtitle: 'Keterangan ringkas keunggulan yayasan',
      icon: 'Award',
    };
    setFormData({ ...formData, heroSlides: [...slides, newSlide] });
    showToast('Slide hero baru berhasil ditambahkan.', 'success');
  };

  const handleDeleteSlide = (slideId: string) => {
    if (!canEdit) return;
    const slides = formData.heroSlides || [];
    if (slides.length <= 1) {
      showToast('Minimal harus terdapat 1 slide pada hero slideshow.', 'error');
      return;
    }
    setFormData({
      ...formData,
      heroSlides: slides.filter((s) => s.id !== slideId),
    });
    showToast('Slide hero berhasil dihapus.', 'success');
  };

  const handleMoveSlide = (index: number, direction: 'up' | 'down') => {
    if (!canEdit) return;
    const slides = formData.heroSlides || [];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= slides.length) return;
    const newSlides = [...slides];
    const temp = newSlides[index];
    newSlides[index] = newSlides[targetIndex];
    newSlides[targetIndex] = temp;
    setFormData({ ...formData, heroSlides: newSlides });
  };

  const handleUpdateSlide = (slideId: string, updates: Partial<HeroSlide>) => {
    if (!canEdit) return;
    const slides = formData.heroSlides || [];
    const updated = slides.map((s) => (s.id === slideId ? { ...s, ...updates } : s));
    setFormData({ ...formData, heroSlides: updated });
  };

  const handleAddSlidePoint = (slideId: string) => {
    if (!canEdit) return;
    const slides = formData.heroSlides || [];
    const slide = slides.find((s) => s.id === slideId);
    if (!slide) return;
    const updatedPoints = [...(slide.upperPoints || []), 'Poin keterangan baru di atas gambar'];
    handleUpdateSlide(slideId, { upperPoints: updatedPoints });
  };

  const handleUpdateSlidePoint = (slideId: string, pointIndex: number, val: string) => {
    if (!canEdit) return;
    const slides = formData.heroSlides || [];
    const slide = slides.find((s) => s.id === slideId);
    if (!slide) return;
    const updatedPoints = [...(slide.upperPoints || [])];
    updatedPoints[pointIndex] = val;
    handleUpdateSlide(slideId, { upperPoints: updatedPoints });
  };

  const handleDeleteSlidePoint = (slideId: string, pointIndex: number) => {
    if (!canEdit) return;
    const slides = formData.heroSlides || [];
    const slide = slides.find((s) => s.id === slideId);
    if (!slide) return;
    const updatedPoints = (slide.upperPoints || []).filter((_, i) => i !== pointIndex);
    handleUpdateSlide(slideId, { upperPoints: updatedPoints });
  };

  // Upload Slide Image
  const handleSlideImageUpload = async (slideId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingSlideId(slideId);
      showToast('Mengompresi & mengoptimasi gambar...', 'success');

      const compressed = await compressAndResizeImage(file, 1200, 1200, 0.82);

      const response = await apiFetch('/api/upload-asset', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          filename: file.name,
          data: compressed.base64,
          assetType: 'generic',
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Gagal menyimpan gambar di server.');
      }

      const slides = formData.heroSlides || [];
      const updatedSlides = slides.map((s) => (s.id === slideId ? { ...s, imageUrl: resData.url } : s));
      const updatedConfig: LandingPageConfig = { ...formData, heroSlides: updatedSlides };
      const ok = await updateLandingConfig(updatedConfig);
      if (ok) {
        setFormData(updatedConfig);
      }
    } catch (err: any) {
      console.error('[Upload Error]:', err);
      showToast(`Gagal mengunggah gambar: ${err.message}`, 'error');
    } finally {
      setUploadingSlideId(null);
    }
  };

  // Upload Logo Uploader Handler
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingLogo(true);
      showToast('Mengunggah & mengganti logo aplikasi di /uploads/logo.png...', 'success');

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64Data = ev.target?.result as string;
        if (!base64Data) return;

        const response = await apiFetch('/api/upload-asset', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            filename: file.name || 'logo.png',
            fileData: base64Data,
            data: base64Data,
            assetType: 'logo',
          }),
        });

        const resData = await response.json();
        if (!response.ok || !resData.success) {
          throw new Error(resData.error || 'Gagal mengunggah file logo.');
        }

        const newLogoUrl = resData.url;
        const updatedConfig: LandingPageConfig = {
          ...formData,
          logoUrl: newLogoUrl,
        };
        const ok = await updateLandingConfig(updatedConfig);
        if (ok) {
          setFormData(updatedConfig);
        }
        setIsUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('[Logo Upload Error]:', err);
      showToast(`Gagal mengunggah logo: ${err.message}`, 'error');
      setIsUploadingLogo(false);
    }
  };

  // Upload Favicon Uploader Handler
  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingFavicon(true);
      showToast('Mengunggah & mengganti favicon web di /uploads/favicon.ico...', 'success');

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64Data = ev.target?.result as string;
        if (!base64Data) return;

        const response = await apiFetch('/api/upload-asset', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            filename: file.name || 'favicon.ico',
            fileData: base64Data,
            data: base64Data,
            assetType: 'favicon',
          }),
        });

        const resData = await response.json();
        if (!response.ok || !resData.success) {
          throw new Error(resData.error || 'Gagal mengunggah file favicon.');
        }

        const newFaviconUrl = resData.url;
        const updatedConfig: LandingPageConfig = {
          ...formData,
          faviconUrl: newFaviconUrl,
        };
        const ok = await updateLandingConfig(updatedConfig);
        if (ok) {
          setFormData(updatedConfig);
        }
        setIsUploadingFavicon(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('[Favicon Upload Error]:', err);
      showToast(`Gagal mengunggah favicon: ${err.message}`, 'error');
      setIsUploadingFavicon(false);
    }
  };

  // Generate Default JSON-LD Structured Data
  const handleGenerateDefaultJsonLd = () => {
    const appOrigin = getPublicAppUrl(landingConfig?.appUrl);
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': formData.jsonLdType || 'EducationalOrganization',
      name: formData.appName || 'PPDB Ar-Risalah Aceh',
      description: formData.metaDescription || formData.heroSubtitle,
      url: appOrigin,
      logo: appOrigin + (formData.logoUrl || '/uploads/logo.png'),
      address: {
        '@type': 'PostalAddress',
        streetAddress: formData.contact.address,
        addressLocality: 'Banda Aceh',
        addressRegion: 'Aceh',
        postalCode: '23233',
        addressCountry: 'ID',
      },
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: formData.contact.whatsapp,
        contactType: 'customer service',
        email: formData.contact.email,
        availableLanguage: ['Indonesian'],
      },
    };

    setFormData({
      ...formData,
      structuredDataJson: JSON.stringify(jsonLd, null, 2),
    });
    showToast('Schema.org JSON-LD Structured Data berhasil digenerate otomatis!', 'success');
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-600" />
            <span>Kelola Landing Page Publik, Identity Brand & SEO Meta Editor</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Atur isi landing page, unggah logo & favicon web ke folder <code className="font-mono text-emerald-800 bg-emerald-50 px-1 rounded">/uploads</code>, dan sesuaikan SEO Meta Tag agar mudah ditemukan di mesin pencarian.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!canEdit && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">
              <Eye className="w-4 h-4 text-slate-500" />
              <span>Mode Baca (Lihat Saja)</span>
            </div>
          )}

          <button
            type="button"
            onClick={async () => {
              if (canEdit) {
                const ok = await updateLandingConfig(formData);
                if (!ok) return;
              }
              setActiveView('landing');
            }}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            Lihat Halaman Publik
          </button>

          {canEdit && (
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Perubahan</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80">
        <button
          type="button"
          onClick={() => setActiveTab('konten')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'konten'
              ? 'bg-white text-emerald-950 shadow-sm border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Globe className="w-4 h-4 text-emerald-600" />
          <span>Konten Landing & Slideshow</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('brand')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'brand'
              ? 'bg-white text-emerald-950 shadow-sm border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ImageIcon className="w-4 h-4 text-emerald-600" />
          <span>Upload Logo & Favicon Web</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('seo')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'seo'
              ? 'bg-white text-emerald-950 shadow-sm border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Search className="w-4 h-4 text-emerald-600" />
          <span>SEO Meta Editor & Structured Data</span>
        </button>
      </div>

      {/* TAB 1: KONTEN LANDING PAGE & SLIDESHOW */}
      {activeTab === 'konten' && (
        <div className="space-y-6 animate-in fade-in">
          {/* 1. Hero Text Banner */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              1. Teks Judul & Subjudul Hero
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nama Aplikasi / Brand Yayasan
                </label>
                <input
                  type="text"
                  value={formData.appName}
                  onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                  placeholder="e.g. PPDB Ar-Risalah"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Tagline / Sub-nama Yayasan
                </label>
                <input
                  type="text"
                  value={formData.appTagline || ''}
                  onChange={(e) => setFormData({ ...formData, appTagline: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                  placeholder="e.g. Yayasan Ar-Risalah Aceh"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Total Target Pendaftar (Stats Banner)
                </label>
                <PlainNumberInput
                  max={1000000}
                  value={formData.statsTotal}
                  onChange={(val) => setFormData({ ...formData, statsTotal: val })}
                  placeholder="Contoh: 800"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Judul Utama Hero (Hero Title)
              </label>
              <input
                type="text"
                value={formData.heroTitle}
                onChange={(e) => setFormData({ ...formData, heroTitle: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Subjudul Hero (Hero Subtitle)
              </label>
              <textarea
                rows={2}
                value={formData.heroSubtitle}
                onChange={(e) => setFormData({ ...formData, heroSubtitle: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              />
            </div>
          </div>

          {/* 2. Hero Slideshow & Custom Points */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>2. Kelola Slideshow Hero, Gambar & Poin Keterangan</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Custom gambar hero, poin bullet di atas gambar, serta floating card caption. Gambar disimpan ke folder <code className="font-mono text-emerald-800 bg-emerald-50 px-1 rounded">/public/uploads</code> dengan kompresi otomatis.
                </p>
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={handleAddSlide}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors border border-emerald-200 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Slide Baru</span>
                </button>
              )}
            </div>

            <div className="space-y-6">
              {(formData.heroSlides || []).map((slide, sIdx) => (
                <div
                  key={slide.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 relative"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-emerald-900 bg-emerald-100/80 px-2.5 py-1 rounded-lg">
                      Slide #{sIdx + 1}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveSlide(sIdx, 'up')}
                        disabled={sIdx === 0}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                        title="Pindah Slide ke Atas"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSlide(sIdx, 'down')}
                        disabled={sIdx === (formData.heroSlides || []).length - 1}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                        title="Pindah Slide ke Bawah"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSlide(slide.id)}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Hapus Slide Ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Poin-Poin Keterangan (Tampil di Atas Gambar)</span>
                      </label>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleAddSlidePoint(slide.id)}
                          className="text-[11px] text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Tambah Poin</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {(slide.upperPoints || []).map((pt, ptIdx) => (
                        <div key={ptIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={pt}
                            onChange={(e) => handleUpdateSlidePoint(slide.id, ptIdx, e.target.value)}
                            placeholder="Tulisan poin keterangan di atas gambar..."
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
                          />
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSlidePoint(slide.id, ptIdx)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-4">
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 h-36">
                        <img
                          src={slide.imageUrl}
                          alt={slide.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = '/src/assets/images/campus_arrisalah_aceh_1792900903501.jpg';
                          }}
                        />
                        {uploadingSlideId === slide.id && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-bold">
                            Mengunggah...
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-8 space-y-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          URL Gambar Slide
                        </label>
                        <input
                          type="text"
                          value={slide.imageUrl}
                          onChange={(e) => handleUpdateSlide(slide.id, { imageUrl: e.target.value })}
                          placeholder="/uploads/nama_gambar.jpg atau https://..."
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
                        />
                      </div>

                      {canEdit && (
                        <div className="pt-1">
                          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs">
                            <Upload className="w-4 h-4" />
                            <span>Unggah Gambar Baru (Simpan ke /uploads & Kompres)</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleSlideImageUpload(slide.id, e)}
                              className="hidden"
                              disabled={uploadingSlideId === slide.id}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1 text-xs">
                    <div className="md:col-span-5">
                      <label className="font-semibold text-slate-700 block mb-1">
                        Judul Overlay Card
                      </label>
                      <input
                        type="text"
                        value={slide.title}
                        onChange={(e) => handleUpdateSlide(slide.id, { title: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
                      />
                    </div>

                    <div className="md:col-span-5">
                      <label className="font-semibold text-slate-700 block mb-1">
                        Subjudul Overlay Card
                      </label>
                      <input
                        type="text"
                        value={slide.subtitle}
                        onChange={(e) => handleUpdateSlide(slide.id, { subtitle: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="font-semibold text-slate-700 block mb-1">
                        Ikon Card
                      </label>
                      <select
                        value={slide.icon || 'Award'}
                        onChange={(e) => handleUpdateSlide(slide.id, { icon: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
                      >
                        <option value="Award">Award (Penghargaan)</option>
                        <option value="ShieldCheck">ShieldCheck (Resmi)</option>
                        <option value="Sparkles">Sparkles (Istimewa)</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Alur Pendaftaran */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  3. Alur Pendaftaran Siswa Baru (Tambah Langkah Selanjutnya)
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tambah, edit, hapus, atau urutkan langkah-langkah alur pendaftaran siswa baru.
                </p>
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={handleAddStep}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Poin Selanjutnya</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              {formData.flowSteps.map((step, idx) => (
                <div
                  key={step.step}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3"
                >
                  <div className="w-7 h-7 rounded-full bg-[#16a34a] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    {step.step}
                  </div>

                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) => handleUpdateStep(idx, 'title', e.target.value)}
                      placeholder="Judul Langkah Alur Pendaftaran..."
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
                    />
                    <textarea
                      rows={2}
                      value={step.description}
                      onChange={(e) => handleUpdateStep(idx, 'description', e.target.value)}
                      placeholder="Penjelasan langkah pendaftaran ini..."
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
                    />
                  </div>

                  <div className="flex flex-col gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() => handleMoveStep(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                      title="Pindah ke atas"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveStep(idx, 'down')}
                      disabled={idx === formData.flowSteps.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                      title="Pindah ke bawah"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleDeleteStep(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Hapus Langkah Ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Syarat Pendaftaran */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-bold text-slate-900">
                4. Syarat & Dokumen Pendaftaran
              </h4>
              {canEdit && (
                <button
                  type="button"
                  onClick={handleAddRequirement}
                  className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Syarat</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {formData.requirements.map((req, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">{idx + 1}.</span>
                  <input
                    type="text"
                    value={req}
                    onChange={(e) => handleUpdateRequirement(idx, e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
                  />
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRequirement(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 5. Kontak Yayasan */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              5. Informasi Kontak & Alamat Yayasan
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Email Resmi
                </label>
                <input
                  type="email"
                  value={formData.contact.email}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contact: { ...formData.contact, email: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  WhatsApp Layanan PPDB
                </label>
                <input
                  type="text"
                  value={formData.contact.whatsapp}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contact: { ...formData.contact, whatsapp: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">
                  Alamat Kampus Yayasan Ar-Risalah
                </label>
                <input
                  type="text"
                  value={formData.contact.address}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contact: { ...formData.contact, address: e.target.value },
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
                />
              </div>
            </div>
          </div>

          {/* 6. Customisasi Teks Card Perlu Bantuan Wali */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              6. Kustomisasi Teks Card "Perlu Bantuan" di Portal Wali
            </h4>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Judul Card Bantuan
                </label>
                <input
                  type="text"
                  value={formData.helpTitle || 'Perlu Bantuan / Kendala Pendaftaran?'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      helpTitle: e.target.value,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Deskripsi / Keterangan Jam & Hari Kerja Panitia
                </label>
                <textarea
                  rows={2}
                  value={formData.helpSubtitle || 'Tim panitia PPDB Yayasan Ar-Risalah Aceh siap membantu Anda setiap Senin - Sabtu pukul 08:00 - 16:00 WIB.'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      helpSubtitle: e.target.value,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: UPLOAD LOGO & FAVICON WEB */}
      {activeTab === 'brand' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-slate-700 space-y-1">
            <h4 className="font-bold text-emerald-950 flex items-center gap-1.5 text-sm">
              <ImageIcon className="w-4 h-4 text-emerald-700" />
              <span>Manajemen Logo & Favicon Web Aplikasi</span>
            </h4>
            <p>
              Setiap berkas logo & favicon yang diunggah di halaman ini akan disimpan secara fisik ke folder internal aplikasi <code className="font-mono text-emerald-800 bg-emerald-100 px-1 rounded">/public/uploads/logo.png</code> dan <code className="font-mono text-emerald-800 bg-emerald-100 px-1 rounded">/public/uploads/favicon.ico</code>.
              Mengunggah berkas baru akan secara otomatis menggantikan file lama dan langsung mengupdate favicon tab browser web serta logo aplikasi untuk pengenalan SEO tinggi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo Uploader Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">1. Logo Utama Yayasan / Aplikasi</h4>
                  <p className="text-[11px] text-slate-500">Tampil pada Landing Page, Header Dashboard, dan Surat Resmi</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 font-mono text-[10px] font-bold">
                  PNG / SVG
                </span>
              </div>

              {/* Logo Preview */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center justify-center gap-3">
                <div className="w-24 h-24 rounded-2xl bg-white p-3 shadow-md border border-slate-200 flex items-center justify-center overflow-hidden">
                  <img
                    key={formData.logoUrl}
                    src={formData.logoUrl || '/uploads/logo.png'}
                    alt="Logo Yayasan"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      if (!e.currentTarget.src.includes('/uploads/logo.png')) {
                        e.currentTarget.src = '/uploads/logo.png';
                      }
                    }}
                  />
                </div>
                <span className="text-xs text-slate-500 font-mono text-center break-all">
                  URL Aktif: {formData.logoUrl || '/uploads/logo.png'}
                </span>
              </div>

              {/* Upload Action */}
              {canEdit && (
                <div className="space-y-3 pt-2">
                  <label className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm">
                    <Upload className="w-4 h-4" />
                    <span>{isUploadingLogo ? 'Mengunggah Logo Baru...' : 'Unggah Logo Baru (Format PNG/JPG/SVG)'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleLogoUpload}
                      disabled={isUploadingLogo}
                      className="hidden"
                    />
                  </label>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Atau Masukkan URL Logo Manual:
                    </label>
                    <input
                      type="text"
                      value={formData.logoUrl || ''}
                      onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                      placeholder="/uploads/logo.png atau https://..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Favicon Uploader Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">2. Icon Browser (Favicon .ico / .png)</h4>
                  <p className="text-[11px] text-slate-500">Ikon yang tampil di tab browser web & bookmark</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-lg bg-teal-100 text-teal-900 font-mono text-[10px] font-bold">
                  ICO / PNG
                </span>
              </div>

              {/* Favicon Preview */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-slate-900 p-2 shadow-md border border-slate-700 flex items-center justify-center overflow-hidden">
                  <img
                    key={formData.faviconUrl}
                    src={formData.faviconUrl || '/uploads/favicon.ico'}
                    alt="Favicon Web"
                    className="w-8 h-8 object-contain"
                    onError={(e) => {
                      if (!e.currentTarget.src.includes('logo_arrisalah_crest')) {
                        e.currentTarget.src = '/src/assets/images/logo_arrisalah_crest_1792900905994.jpg';
                      }
                    }}
                  />
                </div>
                <div className="text-center">
                  <span className="text-xs text-slate-600 font-bold block">Simulasi Tab Browser Web</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {formData.faviconUrl || '/uploads/favicon.ico'}
                  </span>
                </div>
              </div>

              {/* Upload Action */}
              {canEdit && (
                <div className="space-y-3 pt-2">
                  <label className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm">
                    <Upload className="w-4 h-4" />
                    <span>{isUploadingFavicon ? 'Mengunggah & Menggantikan...' : 'Unggah Favicon Baru (Replace /uploads/favicon.ico)'}</span>
                    <input
                      type="file"
                      accept="image/x-icon,image/vnd.microsoft.icon,image/png,image/jpeg"
                      onChange={handleFaviconUpload}
                      disabled={isUploadingFavicon}
                      className="hidden"
                    />
                  </label>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Atau Masukkan URL Favicon Manual:
                    </label>
                    <input
                      type="text"
                      value={formData.faviconUrl || ''}
                      onChange={(e) => setFormData({ ...formData, faviconUrl: e.target.value })}
                      placeholder="/uploads/favicon.ico atau https://..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SEO META EDITOR & STRUCTURED DATA */}
      {activeTab === 'seo' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-slate-700 space-y-1">
            <h4 className="font-bold text-indigo-950 flex items-center gap-1.5 text-sm">
              <Search className="w-4 h-4 text-indigo-700" />
              <span>Optimasi SEO (Search Engine Optimization) & Social Share Card</span>
            </h4>
            <p>
              Semua pengaturan meta title, meta description, OpenGraph share card, dan Schema.org JSON-LD structured data di bawah ini akan tersinkronisasi secara langsung ke elemen HTML <code className="font-mono text-indigo-900 bg-indigo-100 px-1 rounded">&lt;head&gt;</code> DOM browser sehingga aplikasi dapat terindeks dengan cepat dan menempati peringkat teratas di Google Search.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form Controls (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Basic Meta Tags */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                  1. Tag HTML Meta Utama Mesin Pencari
                </h4>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-800">
                      Meta Title (Judul Tab Browser & Google) *
                    </label>
                    <span className={`text-[11px] font-mono font-bold ${
                      (formData.metaTitle?.length || 0) > 60 ? 'text-amber-600' : 'text-slate-400'
                    }`}>
                      {formData.metaTitle?.length || 0} / 60 Karakter
                    </span>
                  </div>
                  <input
                    type="text"
                    value={formData.metaTitle || ''}
                    onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                    placeholder="PPDB Ar-Risalah Aceh | Penerimaan Peserta Didik Baru"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Saran: Gunakan judul spesifik yang mengandung nama sekolah, lokasi (Aceh), dan kata kunci PPDB.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-800">
                      Meta Description (Ringkasan Cuplikan Google) *
                    </label>
                    <span className={`text-[11px] font-mono font-bold ${
                      (formData.metaDescription?.length || 0) > 160 ? 'text-amber-600' : 'text-slate-400'
                    }`}>
                      {formData.metaDescription?.length || 0} / 160 Karakter
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={formData.metaDescription || ''}
                    onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                    placeholder="Sistem Penerimaan Peserta Didik Baru (PPDB) Yayasan Ar-Risalah Aceh untuk jenjang TK, SD, SMP, dan SMA dengan pendaftaran online..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Saran: Panjang ideal 120-160 karakter yang menarik minat orang tua wali murid untuk mengeklik.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      Meta Keywords (Kata Kunci Pisahkan Koma)
                    </label>
                    <input
                      type="text"
                      value={formData.metaKeywords || ''}
                      onChange={(e) => setFormData({ ...formData, metaKeywords: e.target.value })}
                      placeholder="PPDB Aceh, Sekolah Islam Banda Aceh, Tahfidz"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      Penulis / Institusi (Author)
                    </label>
                    <input
                      type="text"
                      value={formData.author || ''}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      placeholder="Yayasan Ar-Risalah Aceh"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Canonical URL (URL Resmi Utama Website)
                  </label>
                  <input
                    type="url"
                    value={formData.canonicalUrl || ''}
                    onChange={(e) => setFormData({ ...formData, canonicalUrl: e.target.value })}
                    placeholder="https://ppdb.arrisalah-aceh.sch.id"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                  />
                </div>
              </div>

              {/* OpenGraph & Social Media Sharing */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-emerald-600" />
                  <span>2. OpenGraph Card Meta (WhatsApp, Facebook, Twitter Sharing)</span>
                </h4>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    OpenGraph Title (Judul saat Bagikan Link di WhatsApp)
                  </label>
                  <input
                    type="text"
                    value={formData.ogTitle || ''}
                    onChange={(e) => setFormData({ ...formData, ogTitle: e.target.value })}
                    placeholder="PPDB Yayasan Ar-Risalah Aceh 2026/2027"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    OpenGraph Description (Keterangan Card WhatsApp)
                  </label>
                  <textarea
                    rows={2}
                    value={formData.ogDescription || ''}
                    onChange={(e) => setFormData({ ...formData, ogDescription: e.target.value })}
                    placeholder="Daftarkan ananda secara online sekarang juga untuk jenjang TK, SD, SMP, SMA Ar-Risalah Aceh."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    URL Gambar Card Social (og:image)
                  </label>
                  <input
                    type="text"
                    value={formData.ogImage || ''}
                    onChange={(e) => setFormData({ ...formData, ogImage: e.target.value })}
                    placeholder="/src/assets/images/campus_arrisalah_aceh_1792900903501.jpg"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                  />
                </div>
              </div>

              {/* Schema.org JSON-LD Editor */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-emerald-600" />
                    <span>3. Structured Data JSON-LD (Schema.org)</span>
                  </h4>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={handleGenerateDefaultJsonLd}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold border border-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Generate JSON-LD Otomatis</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      Tipe Organisasi Schema.org
                    </label>
                    <select
                      value={formData.jsonLdType || 'EducationalOrganization'}
                      onChange={(e) => setFormData({ ...formData, jsonLdType: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                    >
                      <option value="EducationalOrganization">EducationalOrganization</option>
                      <option value="School">School (Sekolah)</option>
                      <option value="Organization">Organization (Umum)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    Kode Mentah JSON-LD (&lt;script type=&quot;application/ld+json&quot;&gt;)
                  </label>
                  <textarea
                    rows={8}
                    value={formData.structuredDataJson || ''}
                    onChange={(e) => setFormData({ ...formData, structuredDataJson: e.target.value })}
                    className="w-full bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder='{ "@context": "https://schema.org", "@type": "EducationalOrganization", ... }'
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Live Snippet Previews (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="sticky top-6 space-y-6">
                {/* Google Search Live Preview */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block border-b border-slate-100 pb-2">
                    🔍 Live Pratinjau Hasil Pencarian Google
                  </span>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 font-sans">
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <div className="w-4 h-4 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[9px] font-bold">
                        A
                      </div>
                      <span className="truncate text-slate-600 font-medium">
                        {formData.canonicalUrl || 'https://ppdb.arrisalah-aceh.sch.id'}
                      </span>
                    </div>

                    <h5 className="text-sm font-bold text-[#1a0dab] hover:underline cursor-pointer line-clamp-1 leading-snug">
                      {formData.metaTitle || 'PPDB Ar-Risalah Aceh | Penerimaan Peserta Didik Baru'}
                    </h5>

                    <p className="text-xs text-[#4d5156] line-clamp-2 leading-relaxed">
                      {formData.metaDescription || 'Sistem Penerimaan Peserta Didik Baru (PPDB) Yayasan Ar-Risalah Aceh untuk jenjang TK, SD, SMP, dan SMA...'}
                    </p>
                  </div>
                </div>

                {/* WhatsApp & Social Media Live Preview Card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block border-b border-slate-100 pb-2">
                    💬 Live Pratinjau Card WhatsApp / Social Media
                  </span>

                  <div className="max-w-sm mx-auto rounded-2xl bg-[#efeae2] p-3 shadow-inner">
                    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
                      <div className="h-36 bg-slate-900 relative overflow-hidden">
                        <img
                          src={formData.ogImage || formData.heroSlides?.[0]?.imageUrl || '/src/assets/images/campus_arrisalah_aceh_1792900903501.jpg'}
                          alt="OpenGraph Image"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = '/src/assets/images/campus_arrisalah_aceh_1792900903501.jpg';
                          }}
                        />
                      </div>
                      <div className="p-3 bg-slate-100 space-y-1">
                        <span className="text-[10px] font-mono text-slate-400 block uppercase">
                          {window.location.hostname}
                        </span>
                        <h6 className="font-bold text-xs text-slate-900 line-clamp-1">
                          {formData.ogTitle || formData.metaTitle || 'PPDB Ar-Risalah Aceh'}
                        </h6>
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-tight">
                          {formData.ogDescription || formData.metaDescription || 'Informasi lengkap pendaftaran santri baru Yayasan Ar-Risalah Aceh.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};
