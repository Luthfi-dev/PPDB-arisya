import React, { useState, useEffect } from 'react';
import { PPDBProvider, usePPDB } from './context/PPDBContext';
import { DesktopApp } from './components/desktop/DesktopApp';
import { MobileApp } from './components/mobile/MobileApp';
import { LandingPage } from './components/landing/LandingPage';
import { LoginModal } from './components/auth/LoginModal';
import { RegistrationWizard } from './components/mobile/RegistrationWizard';
import { ToastContainer } from './components/common/Toast';
import { VerifySignatureModal } from './components/common/VerifySignatureModal';
import { VerifyReceiptModal } from './components/common/VerifyReceiptModal';

import { isParentUser } from './utils/rbac';
import { WaliDashboard } from './components/wali/WaliDashboard';

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

  // 1. Halaman Depan: PPDB Landing Page Resmi Yayasan Ar-Risalah
  if (activeView === 'landing' || !currentUser) {
    return (
      <div className="min-h-screen w-full bg-[#f0fdf4]">
        <LandingPage />
        {loginModalOpen && <LoginModal />}
        {currentUser && registerWizardOpen && (
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
        <ToastContainer />
      </div>
    );
  }

  // 2. Akun Wali Siswa / Wali Santri: Langsung diarahkan ke Dashboard Portal Wali
  if (isParent) {
    return (
      <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#f0fdf4]">
        <WaliDashboard />
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
        <ToastContainer />
      </div>
    );
  }

  // 3. Akun Pengurus / Staff Sekolah & Yayasan: DesktopApp
  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-hidden bg-[#f0fdf4]">
      <div className="h-screen w-full overflow-hidden">
        <DesktopApp />
      </div>

      {/* Modal Autentikasi / Login Resmi PPDB */}
      {loginModalOpen && <LoginModal />}

      {/* Modal Wizard Pendaftaran Siswa Baru (Online) */}
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

      {/* Public Online TTD Verification Modal */}
      {verifyRegNumber !== null && (
        <VerifySignatureModal
          initialRegNumber={verifyRegNumber}
          onClose={() => setVerifyRegNumber(null)}
        />
      )}

      {/* Public Online Payment Receipt Verification Modal */}
      {verifyReceiptParams !== null && (
        <VerifyReceiptModal
          initialPaymentId={verifyReceiptParams.pid}
          initialRegNumber={verifyReceiptParams.reg}
          initialSignature={verifyReceiptParams.sig}
          onClose={() => setVerifyReceiptParams(null)}
        />
      )}

      {/* Global Toast Notification System */}
      <ToastContainer />
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
