import React, { useState, useEffect } from 'react';
import {
  School,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  Award,
  Users,
  Smartphone,
  Laptop,
  Coins,
  Search,
  LogIn,
  UserPlus,
  LogOut,
  Sparkles,
  Check,
  ChevronLeft,
  ChevronRight,
  PhoneCall,
  MessageCircle,
  Lock,
} from 'lucide-react';
import { usePPDB } from '../../context/PPDBContext';
import { UnitBadge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { getActiveAcademicYearLabel } from '../../utils/studentFieldResolver';
import { DeveloperFooter } from '../common/DeveloperFooter';

export const LandingPage: React.FC = () => {
  const {
    landingConfig,
    units,
    academicYears,
    currentUser,
    logout,
    setActiveView,
    setLoginModalOpen,
    openLoginModal,
    setRegisterWizardOpen,
    setPendingRegisterUnit,
    unitContacts,
    showToast,
  } = usePPDB();

  const activeAcademicYearLabel = getActiveAcademicYearLabel(academicYears);
  const currentCalendarYear = new Date().getFullYear();

  const [checkNisnOrReg, setCheckNisnOrReg] = useState('');
  const [searchedStudent, setSearchedStudent] = useState<any | null>(null);
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Hero Slideshow State
  const heroSlides = landingConfig.heroSlides && landingConfig.heroSlides.length > 0
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
      ];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  useEffect(() => {
    if (!isAutoPlay || heroSlides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isAutoPlay, heroSlides.length]);

  useEffect(() => {
    if (currentSlide >= heroSlides.length) {
      setCurrentSlide(0);
    }
  }, [heroSlides.length, currentSlide]);

  const activeSlide = heroSlides[currentSlide] || heroSlides[0];

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY || document.documentElement.scrollTop || 0;
      const maxScroll = (document.documentElement.scrollHeight || document.body.scrollHeight || 0) - window.innerHeight;
      setShowBackToTop(maxScroll > 100 && scrolled >= maxScroll * 0.3);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [isSearchingStatus, setIsSearchingStatus] = useState(false);

  const handleSearchRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = checkNisnOrReg.trim();
    const cleanQ = q.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    if (!q || cleanQ.length < 6) {
      showToast('Masukkan Nomor Pendaftaran resmi atau NISN minimal 6 karakter alfanumerik.', 'error');
      return;
    }

    setIsSearchingStatus(true);

    try {
      const res = await fetch(`/api/students/check-status?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data && data.success && data.student) {
        setSearchedStudent(data.student);
      } else {
        setSearchedStudent('NOT_FOUND');
        if (!res.ok && data?.message) {
          showToast(data.message, 'error');
        }
      }
      setIsSearchingStatus(false);
      setIsCheckModalOpen(true);
    } catch (err) {
      setSearchedStudent('NOT_FOUND');
      setIsSearchingStatus(false);
      showToast('Gagal menghubungi server untuk memeriksa status pendaftaran.', 'error');
    }
  };

  const handleStartRegister = (unitId?: string) => {
    if (unitId) {
      const targetUnit = units.find((u) => u.id === unitId);
      if (targetUnit && targetUnit.isOpen === false) {
        showToast(
          targetUnit.closedNotice || `Pendaftaran ${targetUnit.shortName} belum dibuka.`,
          'error'
        );
        return;
      }
      if (targetUnit && targetUnit.totalQuota - targetUnit.filledQuota <= 0) {
        showToast(
          `Mohon maaf, kuota pendaftaran online ${targetUnit.shortName} telah terpenuhi seluruhnya.`,
          'error'
        );
        return;
      }
      setPendingRegisterUnit(unitId);
    } else {
      setPendingRegisterUnit(null);
    }

    if (!currentUser) {
      openLoginModal('register');
      showToast('Silakan buat akun orang tua / wali terlebih dahulu untuk mendaftarkan ananda.', 'success');
    } else {
      setRegisterWizardOpen(true);
    }
  };

  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [landingConfig?.logoUrl]);

  const logoSrc = landingConfig?.logoUrl || '/uploads/1794360625078_my_new_logo.png';
  const fallbackInitial = landingConfig?.appName ? landingConfig.appName.charAt(0).toUpperCase() : 'P';

  return (
    <div className="min-h-screen w-full max-w-full bg-[#f0fdf4] text-slate-800 relative">
      {/* 1. Top Bar Contract: 3 Zones */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md px-3.5 sm:px-6 lg:px-12 py-3.5 sm:py-4 border-b border-emerald-100 flex items-center justify-between gap-3 sm:gap-8 shadow-sm w-full max-w-full">
        {/* Zone 1: Single text element wordmark with customizable name and tagline */}
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm shrink-0 border border-emerald-200 overflow-hidden p-0.5">
            {logoSrc && !logoError ? (
              <img
                src={logoSrc}
                alt={landingConfig.appName || 'Logo PPDB'}
                className="w-full h-full object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-full h-full bg-[#14532d] text-white flex items-center justify-center font-extrabold text-lg">
                {fallbackInitial}
              </div>
            )}
          </div>
          <div>
            <span className="text-base font-extrabold text-[#0f172a] tracking-tight block">
              {landingConfig.appName || 'PPDB Ar-Risalah'}
            </span>
            <span className="text-[11px] text-emerald-700 font-semibold block leading-none">
              {landingConfig.appTagline || 'Yayasan Ar-Risalah Aceh'}
            </span>
          </div>
        </div>

        {/* Zone 2: 4-5 Clean Nav Links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-600">
          <a href="#jenjang" className="hover:text-emerald-700 transition-colors whitespace-nowrap">
            Jenjang Pendidikan
          </a>
          <a href="#alur" className="hover:text-emerald-700 transition-colors whitespace-nowrap">
            Alur Pendaftaran
          </a>
          <a href="#syarat" className="hover:text-emerald-700 transition-colors whitespace-nowrap">
            Syarat Berkas
          </a>
          <a href="#biaya" className="hover:text-emerald-700 transition-colors whitespace-nowrap">
            Biaya & Kuota
          </a>
          <a href="#kontak" className="hover:text-emerald-700 transition-colors whitespace-nowrap">
            Kontak Yayasan
          </a>
        </nav>

        {/* Zone 3: Standard Auth & Registration Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {currentUser ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveView('app')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={logout}
                title="Keluar dari Sesi"
                className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 text-xs font-bold transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => openLoginModal('login')}
                className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs transition-all"
              >
                <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Masuk (Login)</span>
                <span className="inline sm:hidden">Masuk</span>
              </button>
              <button
                onClick={() => handleStartRegister()}
                className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-700/20 active:scale-[0.98] transition-all"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Daftar Sekarang</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative px-6 lg:px-12 py-12 lg:py-16 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Text */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-900 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>PPDB Online Tahun Ajaran {activeAcademicYearLabel} Resmi Dibuka</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15] text-balance">
              {landingConfig.heroTitle}
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              {landingConfig.heroSubtitle}
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <button
                onClick={() => handleStartRegister()}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-[#16a34a] hover:bg-emerald-700 text-white text-sm font-extrabold shadow-lg shadow-emerald-700/25 active:scale-[0.98] transition-all"
              >
                <UserPlus className="w-5 h-5 shrink-0" />
                <span>Daftar Siswa Baru (Online)</span>
              </button>

              <button
                onClick={() => {
                  if (currentUser) {
                    setActiveView('app');
                  } else {
                    setLoginModalOpen(true);
                  }
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-white hover:bg-emerald-50 border border-emerald-200 text-[#14532d] text-sm font-bold shadow-xs active:scale-[0.98] transition-all"
              >
                <LogIn className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{currentUser ? 'Buka Dashboard' : 'Masuk ke Akun / Dashboard'}</span>
              </button>
            </div>

            {/* Quick Check Form */}
            <form
              id="cek-status-box"
              onSubmit={handleSearchRegistration}
              className="bg-white p-2.5 rounded-2xl border border-emerald-100 shadow-md flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-lg w-full"
            >
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={checkNisnOrReg}
                  onChange={(e) => setCheckNisnOrReg(e.target.value)}
                  placeholder="Cek status (No. Registrasi Resmi / NISN, min. 6 karakter)..."
                  className="w-full bg-slate-50 sm:bg-transparent pl-9 pr-3 py-2.5 sm:py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none rounded-xl sm:rounded-none"
                />
              </div>
              <button
                type="submit"
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs shrink-0 flex items-center justify-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5 sm:hidden" />
                <span>Cek Status</span>
              </button>
            </form>
          </div>

          {/* Right Hero Interactive Slideshow */}
          <div
            className="lg:col-span-5 relative space-y-4"
            onMouseEnter={() => setIsAutoPlay(false)}
            onMouseLeave={() => setIsAutoPlay(true)}
          >
            {/* Dynamic Upper Bullet Points */}
            {activeSlide.upperPoints && activeSlide.upperPoints.length > 0 && (
              <div className="space-y-2 mb-2">
                {activeSlide.upperPoints.map((pt, pIdx) => (
                  <div
                    key={pIdx}
                    className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 bg-white/90 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-emerald-100 shadow-2xs transition-all animate-fadeIn"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{pt}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Main Slideshow Image Box */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-slate-900 group">
              <img
                src={activeSlide.imageUrl}
                alt={activeSlide.title}
                className="w-full h-80 lg:h-96 object-cover transition-all duration-700 group-hover:scale-105"
                onError={(e) => {
                  e.currentTarget.src = '/src/assets/images/campus_arrisalah_aceh_1792900903501.jpg';
                }}
              />

              {/* Slide Navigation Overlay (if > 1 slide) */}
              {heroSlides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs transition-colors shadow-md z-10"
                    title="Slide Sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentSlide((prev) => (prev + 1) % heroSlides.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs transition-colors shadow-md z-10"
                    title="Slide Selanjutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {/* Indicator Dots */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-xs text-white text-[10px] font-bold z-10">
                    {heroSlides.map((_, dotIdx) => (
                      <button
                        type="button"
                        key={dotIdx}
                        onClick={() => setCurrentSlide(dotIdx)}
                        className={`h-2 rounded-full transition-all ${
                          dotIdx === currentSlide ? 'bg-emerald-400 w-4' : 'bg-white/60 hover:bg-white w-2'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Floating Overlay Caption Card */}
            <div className="absolute -bottom-6 -left-3 sm:-left-5 bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl shadow-xl border border-emerald-100 max-w-xs z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                  {activeSlide.icon === 'ShieldCheck' ? (
                    <ShieldCheck className="w-5 h-5" />
                  ) : activeSlide.icon === 'Sparkles' ? (
                    <Sparkles className="w-5 h-5" />
                  ) : (
                    <Award className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h5 className="font-bold text-xs text-slate-900 leading-snug">
                    {activeSlide.title}
                  </h5>
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                    {activeSlide.subtitle}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Jenjang Pendidikan (Unit Cards Dinamis) */}
      <section id="jenjang" className="px-6 lg:px-12 py-12 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-xl mx-auto mb-10">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
            Pilihan Pendidikan
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            {units.length} Unit Sekolah Yayasan Ar-Risalah Aceh
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            Dari usia dini hingga jenjang menengah atas dengan asrama (boarding school) yang representatif.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {units.map((unit) => {
            const remaining = Math.max(0, unit.totalQuota - unit.filledQuota);
            const isOpen = unit.isOpen !== false;
            const isFull = remaining <= 0;
            const canRegister = isOpen && !isFull;

            return (
              <div
                key={unit.id}
                aria-disabled={!canRegister}
                className={`p-6 rounded-2xl border transition-all flex flex-col justify-between ${
                  canRegister
                    ? 'bg-white border-emerald-100 shadow-sm hover:shadow-md'
                    : 'bg-slate-100 border-slate-200 text-slate-400 opacity-85 cursor-not-allowed select-none'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <UnitBadge unit={unit.id} />
                    {!isOpen ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-extrabold inline-flex items-center gap-1 border border-slate-300">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Belum Dibuka</span>
                      </span>
                    ) : isFull ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold inline-flex items-center gap-1 border border-amber-200">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Kuota Penuh</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                        Dibuka
                      </span>
                    )}
                  </div>

                  <h3 className={`text-base font-bold mt-2 leading-tight ${canRegister ? 'text-slate-900' : 'text-slate-500'}`}>
                    {unit.name}
                  </h3>
                  <div className={`mt-3 p-3 rounded-xl text-xs space-y-1 ${canRegister ? 'bg-slate-50' : 'bg-slate-200/70'}`}>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Biaya Formulir:</span>
                      <span className={`font-bold font-mono ${canRegister ? 'text-emerald-800' : 'text-slate-500'}`}>
                        {formatRupiah(unit.formFee)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Sisa Kuota:</span>
                      <span className={`font-bold tabular-nums ${canRegister ? 'text-slate-900' : 'text-slate-500'}`}>
                        {remaining} kursi
                      </span>
                    </div>
                  </div>

                  {!isOpen ? (
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-200/80 border border-slate-300/80 text-[11px] text-slate-600 font-medium leading-snug">
                      {unit.closedNotice || 'Pendaftaran untuk unit ini belum dibuka.'}
                    </div>
                  ) : isFull ? (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-medium leading-snug">
                      Kuota pendaftaran online unit ini telah terpenuhi seluruhnya.
                    </div>
                  ) : null}

                  <div className={`mt-4 space-y-1.5 text-xs ${canRegister ? 'text-slate-600' : 'text-slate-400'}`}>
                    {unit.facilities.map((fac, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className={`font-bold ${canRegister ? 'text-emerald-600' : 'text-slate-400'}`}>•</span>
                        <span>{fac}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {canRegister ? (
                  <button
                    type="button"
                    onClick={() => handleStartRegister(unit.id)}
                    className="mt-6 w-full py-2.5 rounded-xl bg-[#16a34a] hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Pilih & Daftar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-6 w-full py-2.5 rounded-xl bg-slate-200 text-slate-500 border border-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{!isOpen ? 'Belum Dibuka' : 'Kuota Penuh'}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Alur 5 Langkah */}
      <section id="alur" className="bg-white px-6 lg:px-12 py-12 border-y border-emerald-100">
        <div className="max-w-7xl mx-auto w-full">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              Tahapan Mudah
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              Alur Pendaftaran Siswa Baru (PPDB)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              Lima langkah mudah pendaftaran secara daring melalui portal PPDB Ar-Risalah Aceh.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {landingConfig.flowSteps.map((step) => (
              <div
                key={step.step}
                className="p-5 rounded-2xl bg-[#f0fdf4] border border-emerald-100 flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-full bg-[#16a34a] text-white flex items-center justify-center font-extrabold text-xs mb-3 shadow-xs">
                    {step.step}
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">
                    {step.title}
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Syarat Berkas */}
      <section id="syarat" className="px-6 lg:px-12 py-12 max-w-7xl mx-auto w-full">
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-emerald-100 shadow-sm space-y-6">
          <div className="max-w-2xl">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              Persyaratan Administrasi
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              Dokumen Persyaratan yang Diperlukan
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Pastikan Anda telah menyiapkan dokumen berikut sebelum mengisi formulir pendaftaran online:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {landingConfig.requirements.map((req, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3.5 bg-[#f0fdf4] rounded-2xl border border-emerald-100/80 shadow-2xs text-xs font-semibold text-slate-800 transition-all hover:border-emerald-200"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{req}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5.5. Daftar Kontak Layanan Informasi Setiap Sekolah & Yayasan */}
      <section id="daftar-kontak" className="px-6 lg:px-12 py-12 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
            Pusat Bantuan & Layanan
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">
            Daftar Kontak Panitia Per Unit Sekolah
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            Silakan hubungi kontak panitia unit di bawah ini jika Anda memiliki pertanyaan atau kendala seputar pendaftaran:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...unitContacts]
            .sort((a, b) => {
              if (a.unitId === 'MASTER') return -1;
              if (b.unitId === 'MASTER') return 1;
              const idxA = units.findIndex((u) => u.id === a.unitId);
              const idxB = units.findIndex((u) => u.id === b.unitId);
              return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
            })
            .map((contact) => {
              const matchedUnit = units.find((u) => u.id === contact.unitId);
              const sectionLabel =
                contact.unitId === 'MASTER'
                  ? 'Kontak Admin Pusat Yayasan'
                  : `Kontak Admin ${matchedUnit?.shortName || contact.unitId}`;

            return (
              <div
                key={contact.unitId}
                className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-2xs space-y-3 flex flex-col justify-between hover:shadow-md transition-all"
              >
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 inline-block">
                    {sectionLabel}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-500">{contact.unitName}</h4>
                    <p className="text-sm font-extrabold text-slate-900 mt-0.5">{contact.contactPerson}</p>
                    <p className="text-xs font-mono font-bold text-emerald-700 mt-1">{contact.phone}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <a
                    href={`https://wa.me/${(contact.whatsapp || landingConfig.contact.whatsapp || '').replace(/[^0-9]/g, '')}?text=Assalamu%2rayaikum%20Panitia%20PPDB%20${encodeURIComponent(contact.unitName)},%20saya%20ingin%20bertanya...`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-all"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Footer & Kontak Yayasan */}
      <footer id="kontak" className="bg-[#14532d] text-white px-6 lg:px-12 py-12 border-t border-emerald-950">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-8 text-xs">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-white text-[#14532d] flex items-center justify-center font-extrabold text-base">
                A
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">
                  Yayasan Ar-Risalah Aceh
                </h4>
                <p className="text-[11px] text-emerald-300">
                  Lembaga Pendidikan Islam Terpadu
                </p>
              </div>
            </div>
            <p className="text-emerald-200/90 leading-relaxed">
              Mendidik generasi bertaqwa, berakhlakul karimah, berwawasan global, dan berprestasi unggul demi kejayaan ummat.
            </p>
          </div>

          <div className="space-y-2">
            <h5 className="font-bold text-emerald-300 uppercase tracking-wider text-[11px]">
              Alamat Sekretariat PPDB
            </h5>
            <p className="text-emerald-100 flex items-start gap-2">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{landingConfig.contact.address}</span>
            </p>
            <p className="text-emerald-100 flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{landingConfig.contact.email}</span>
            </p>
            <p className="text-emerald-100 flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{landingConfig.contact.whatsapp}</span>
            </p>
          </div>

          <div className="space-y-3">
            <h5 className="font-bold text-emerald-300 uppercase tracking-wider text-[11px]">
              Layanan Cepat
            </h5>
            <button
              onClick={() => handleStartRegister()}
              className="w-full py-2.5 rounded-xl bg-[#16a34a] hover:bg-emerald-600 text-white font-bold text-xs shadow-sm transition-colors text-center block"
            >
              Mulai Pendaftaran Online
            </button>
            <button
              onClick={() => setActiveView('app')}
              className="w-full py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-emerald-200 font-semibold text-xs border border-emerald-700 transition-colors block text-center"
            >
              Masuk ke Akun Portal
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto w-full mt-8 pt-4 border-t border-emerald-900/60 flex flex-wrap items-center justify-between text-[11px] text-emerald-400">
          <p>© {currentCalendarYear} Yayasan Ar-Risalah Aceh. Hak Cipta Dilindungi Undang-Undang.</p>
          <div className="flex items-center gap-4">
            <a href="https://arrisalahaceh.or.id" target="_blank" rel="noreferrer" className="hover:text-white">
              arrisalahaceh.or.id
            </a>
            <a href="https://ppdb.arrisalahaceh.or.id" target="_blank" rel="noreferrer" className="hover:text-white">
              ppdb.arrisalahaceh.or.id
            </a>
          </div>
        </div>

        <DeveloperFooter variant="green" className="max-w-7xl mx-auto w-full mt-4 pt-3 border-t border-emerald-900/40" />
      </footer>

      {/* Modal Cek Status Pendaftaran */}
      <Modal
        isOpen={isCheckModalOpen}
        onClose={() => setIsCheckModalOpen(false)}
        title="Hasil Pemeriksaan Status PPDB"
        description="Hasil pemeriksaan status pendaftaran berdasarkan nomor registrasi resmi atau NISN."
        maxWidth="md"
        hideFooter
      >
        <div className="py-2 text-xs">
          {isSearchingStatus ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-slate-600 font-semibold">Mencari data pendaftaran dalam sistem database...</p>
            </div>
          ) : searchedStudent === 'NOT_FOUND' ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-200">
                <Search className="w-6 h-6" />
              </div>
              <span className="text-rose-600 font-extrabold text-base block">
                Data Tidak Ditemukan
              </span>
              <p className="text-slate-500 text-xs leading-relaxed max-w-sm mx-auto">
                Nomor pendaftaran resmi atau NISN yang Anda masukkan (<strong>{checkNisnOrReg}</strong>) tidak ditemukan dalam database resmi PPDB {activeAcademicYearLabel}.
              </p>
            </div>
          ) : searchedStudent ? (
            <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200 space-y-3">
              <div className="flex justify-between items-center pb-2.5 border-b border-emerald-200/80">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Calon Siswa</span>
                  <span className="font-extrabold text-slate-900 text-base block">
                    {searchedStudent.fullName}
                  </span>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 bg-emerald-700 text-white font-extrabold rounded-lg text-xs font-mono inline-block shadow-2xs">
                    {searchedStudent.unit}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-emerald-100">
                  <span className="text-slate-500 text-[11px] block">No. Pendaftaran:</span>
                  <span className="font-mono font-bold text-slate-900 block mt-0.5">
                    {searchedStudent.registrationNumber}
                  </span>
                </div>
                {searchedStudent.parentName && searchedStudent.parentName !== '-' && (
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-100">
                    <span className="text-slate-500 text-[11px] block">Orang Tua / Wali:</span>
                    <span className="font-bold text-slate-900 block mt-0.5 truncate">
                      {searchedStudent.parentName}
                    </span>
                  </div>
                )}
                {searchedStudent.nisn && (
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-100">
                    <span className="text-slate-500 text-[11px] block">NISN:</span>
                    <span className="font-mono font-bold text-slate-900 block mt-0.5">
                      {searchedStudent.nisn}
                    </span>
                  </div>
                )}
                <div className="p-2.5 bg-white rounded-xl border border-emerald-100">
                  <span className="text-slate-500 text-[11px] block">Status Pendaftaran:</span>
                  <span className="font-bold text-emerald-800 uppercase block mt-0.5">
                    {searchedStudent.status || searchedStudent.documentsStatus || 'Terdaftar'}
                  </span>
                </div>
              </div>

              {(searchedStudent.selectionResult || searchedStudent.passStatus || searchedStudent.testScore) && (
                <div className="p-3 bg-white rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Hasil Seleksi:</span>
                    <span className="font-bold text-emerald-900 text-sm">
                      {searchedStudent.selectionResult || searchedStudent.passStatus || 'Proses Seleksi'}
                    </span>
                  </div>
                  {searchedStudent.testScore !== undefined && (
                    <div className="text-right">
                      <span className="text-slate-500 text-[11px] block">Nilai Ujian:</span>
                      <span className="font-extrabold text-emerald-700 text-base font-mono">
                        {searchedStudent.testScore} <span className="text-xs text-slate-400">/ 100</span>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}

          <button
            onClick={() => setIsCheckModalOpen(false)}
            className="w-full mt-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-colors"
          >
            Tutup
          </button>
        </div>
      </Modal>

      {/* Floating Back to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-6 right-6 z-50 p-3 rounded-full bg-[#16a34a] text-white shadow-xl hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center cursor-pointer ${
          showBackToTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
        } duration-300`}
        title="Kembali ke atas"
      >
        <ArrowRight className="w-5 h-5 -rotate-90" />
      </button>
    </div>
  );
};
