import React, { useState, useEffect, Suspense, lazy } from 'react';
import { PPDBProvider, usePPDB } from './context/PPDBContext';
import { LandingPage } from './components/landing/LandingPage';
import { ToastContainer } from './components/common/Toast';
import { isParentUser } from './utils/rbac';

const DesktopApp = lazy(() =>
  import('./components/desktop/DesktopApp').then((m) => ({ default: m.DesktopApp }))
);
const WaliDashboard = lazy(() =>
  import('./components/wali/WaliDashboard').then((m) => ({ default: m.WaliDashboard }))
);
const LoginModal = lazy(() =>
  import('./components/auth/LoginModal').then((m) => ({ default: m.LoginModal }))
);
const RegistrationWizard = lazy(() =>
  import('./components/mobile/RegistrationWizard').then((m) => ({ default: m.RegistrationWizard }))
);
const VerifySignatureModal = lazy(() =>
  import('./components/common/VerifySignatureModal').then((m) => ({ default: m.VerifySignatureModal }))
);
const VerifyReceiptModal = lazy(() =>
  import('./components/common/VerifyReceiptModal').then((m) => ({ default: m.VerifyReceiptModal }))
);

const ScreenLoadingFallback: React.FC = () => (
  <div className="min-h-screen w-full bg-[#f0fdf4] flex items-center justify-center p-6">
    <div className="flex flex-col items-center gap-3 text-emerald-800">
      <div className="w-9 h-9 rounded-full border-3 border-emerald-200 border-t-emerald-600 animate-spin" />
      <p className="text-xs font-semibold tracking-wide text-emerald-700/80">Memuat halaman...</p>
    </div>
  </div>
);

const MainAppContent: React.FC = () => {
  const {
    activeView,
    currentUser,
    loginModalOpen,
    setLoginModalOpen,
    registerWizardOpen,
    setRegisterWizardOpen,
    pendingRegisterUnit,
    setPendingRegisterUnit,
    showToast,
  } = usePPDB();

  const isParent = isParentUser(currentUser);
  const [verifyRegNumber, setVerifyRegNumber] = useState<string | null>(null);
  const [verifyReceiptParams, setVerifyReceiptParams] = useState<{
    pid: string;
    reg?: string | null;
    sig?: string | null;
  } | null>(null);

  useEffect(() => {
    const parseUrlRoutes = () => {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const searchParams = new URLSearchParams(search);
      const hashQueryIdx = hash.indexOf('?');
      const hashParams = new URLSearchParams(hashQueryIdx >= 0 ? hash.slice(hashQueryIdx + 1) : '');

      if (hash.includes('verify-resi') || searchParams.has('pid') || hashParams.has('pid')) {
        const pid = hashParams.get('pid') || searchParams.get('pid') || '';
        const reg = hashParams.get('reg') || searchParams.get('reg');
        const sig = hashParams.get('sig') || searchParams.get('sig');
        setVerifyReceiptParams({ pid, reg, sig });
        setVerifyRegNumber(null);
      } else if (hash.includes('verify-ttd') || hash.includes('reg=') || search.includes('reg=')) {
        const match = hash.match(/reg=([^&]+)/) || search.match(/reg=([^&]+)/);
        if (match && match[1]) {
          setVerifyRegNumber(decodeURIComponent(match[1]));
        } else if (hash.includes('verify-ttd')) {
          setVerifyRegNumber('');
        }
      }

      if (searchParams.get('resetToken') || hash.includes('reset-password')) {
        setLoginModalOpen(true);
      }
    };

    parseUrlRoutes();
    window.addEventListener('hashchange', parseUrlRoutes);
    window.addEventListener('popstate', parseUrlRoutes);
    return () => {
      window.removeEventListener('hashchange', parseUrlRoutes);
      window.removeEventListener('popstate', parseUrlRoutes);
    };
  }, [setLoginModalOpen]);

  const sharedOverlays = (
    <>
      <Suspense fallback={null}>
        {loginModalOpen && <LoginModal />}
        {registerWizardOpen && (
          <RegistrationWizard
            initialUnit={pendingRegisterUnit || undefined}
            onClose={() => {
              setRegisterWizardOpen(false);
              setPendingRegisterUnit(null);
            }}
            onSuccess={(studentName) => {
              setRegisterWizardOpen(false);
              setPendingRegisterUnit(null);
              showToast(`Alhamdulillah, data pendaftaran ananda ${studentName} berhasil dikirim!`);
            }}
          />
        )}
        {verifyRegNumber !== null && (
          <VerifySignatureModal
            initialRegNumber={verifyRegNumber}
            onClose={() => setVerifyRegNumber(null)}
          />
        )}
        {verifyReceiptParams !== null && (
          <VerifyReceiptModal
            initialPaymentId={verifyReceiptParams.pid}
            initialRegNumber={verifyReceiptParams.reg}
            initialSignature={verifyReceiptParams.sig}
            onClose={() => setVerifyReceiptParams(null)}
          />
        )}
      </Suspense>
      <ToastContainer />
    </>
  );

  // 1. Halaman Depan: PPDB Landing Page Resmi Yayasan Ar-Risalah
  if (activeView === 'landing' || !currentUser) {
    return (
      <div className="min-h-screen w-full bg-[#f0fdf4]">
        <LandingPage />
        {sharedOverlays}
      </div>
    );
  }

  // 2. Akun Wali Siswa / Wali Santri: Langsung diarahkan ke Dashboard Portal Wali
  if (isParent) {
    return (
      <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#f0fdf4]">
        <Suspense fallback={<ScreenLoadingFallback />}>
          <WaliDashboard />
        </Suspense>
        {sharedOverlays}
      </div>
    );
  }

  // 3. Akun Pengurus / Staff Sekolah & Yayasan: DesktopApp
  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-hidden bg-[#f0fdf4]">
      <div className="h-screen w-full overflow-hidden">
        <Suspense fallback={<ScreenLoadingFallback />}>
          <DesktopApp />
        </Suspense>
      </div>
      {sharedOverlays}
    </div>
  );
};

export default function App() {
  return (
    <PPDBProvider>
      <MainAppContent />
    </PPDBProvider>
  );
}
