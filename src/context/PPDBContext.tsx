import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  SchoolId,
  StudentRegistration,
  PaymentRecord,
  TestSchedule,
  UnitFormSchema,
  UserRole,
  AppUser,
  AcademicYear,
  UnitQuotaFee,
  LandingPageConfig,
  AuditLogItem,
  SystemStatusConfig,
  ExportFieldConfig,
  SmtpConfig,
  CloudflareConfig,
  UnitContactConfig,
  GroupLinkConfig,
  LetterConfig,
  TrashItem,
  BankAccountConfig,
} from '../types/ppdb';
import { isMasterUser, isParentUser, isSuperAdmin } from '../utils/rbac';
import { getAuthHeaders, setCsrfToken, clearCsrfToken, purgeLegacyStorageTokens, apiFetch } from '../utils/auth';
import {
  INITIAL_UNITS,
  INITIAL_STUDENTS,
  INITIAL_PAYMENTS,
  INITIAL_SCHEDULES,
  INITIAL_FORM_SCHEMAS,
  INITIAL_ROLES,
  INITIAL_USERS,
  INITIAL_ACADEMIC_YEARS,
  INITIAL_LANDING_CONFIG,
  INITIAL_AUDIT_LOGS,
  INITIAL_SYSTEM_STATUS,
  INITIAL_EXPORT_CONFIGS,
  INITIAL_SMTP_CONFIG,
  INITIAL_GROUP_LINKS,
  INITIAL_CLOUDFLARE_CONFIG,
  INITIAL_UNIT_CONTACTS,
  INITIAL_LETTER_CONFIGS,
} from '../data/initialData';


interface ToastState {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface DbStatus {
  connected: boolean;
  driver: string;
  host: string;
  port: string;
  database: string;
  statusMessage: string;
}

interface PPDBContextType {
  students: StudentRegistration[];
  payments: PaymentRecord[];
  schedules: TestSchedule[];
  formSchemas: UnitFormSchema[];
  roles: UserRole[];
  users: AppUser[];
  academicYears: AcademicYear[];
  units: UnitQuotaFee[];
  landingConfig: LandingPageConfig;
  auditLogs: AuditLogItem[];
  systemStatus: SystemStatusConfig;
  exportConfigs: ExportFieldConfig[];
  smtpConfig: SmtpConfig;
  groupLinks: GroupLinkConfig[];
  cloudflareConfig: CloudflareConfig;
  unitContacts: UnitContactConfig[];
  letterConfigs: LetterConfig[];
  bankAccounts: BankAccountConfig[];
  trashItems: TrashItem[];
  dbStatus: DbStatus | null;

  activeSchoolId: SchoolId;
  setActiveSchoolId: (id: SchoolId) => void;
  currentUser: AppUser | null;
  setCurrentUser: (u: AppUser | null) => void;
  login: (user: AppUser, optionToken?: string) => void;
  logout: () => void;
  loginModalOpen: boolean;
  setLoginModalOpen: (open: boolean) => void;
  loginModalTab: 'login' | 'register';
  setLoginModalTab: (tab: 'login' | 'register') => void;
  openLoginModal: (tab?: 'login' | 'register') => void;
  registerWizardOpen: boolean;
  setRegisterWizardOpen: (open: boolean) => void;
  pendingRegisterUnit: string | null;
  setPendingRegisterUnit: (unit: string | null) => void;
  desktopActiveMenu: string;
  setDesktopActiveMenu: (menu: string) => void;
  mobileActiveTab: 'beranda' | 'anak' | 'pembayaran' | 'admin' | 'profil';
  setMobileActiveTab: (tab: 'beranda' | 'anak' | 'pembayaran' | 'admin' | 'profil') => void;
  activeView: 'app' | 'landing';
  setActiveView: (v: 'app' | 'landing') => void;
  
  // Actions
  addStudent: (data: Partial<StudentRegistration>) => Promise<StudentRegistration>;
  updateStudent: (id: string, updates: Partial<StudentRegistration>) => Promise<boolean>;
  deleteStudent: (id: string) => Promise<boolean>;
  verifyStudentDocument: (id: string, approved: boolean, notes?: string) => Promise<boolean>;
  setStudentTestResult: (id: string, score: number, status: 'lulus' | 'tidak_lulus', publish: boolean) => Promise<boolean>;
  verifyPayment: (paymentId: string, approved: boolean, notes?: string, amount?: number) => Promise<boolean>;
  updatePaymentAmount: (paymentId: string, amount: number) => Promise<boolean>;
  verifyPaymentGroup: (paymentIds: string[], approved: boolean, notes?: string) => Promise<boolean>;
  addPaymentProof: (registrationId: string, proofUrl: string, amount: number, type: 'Formulir' | 'Daftar Ulang', bankAccountId?: string, paymentId?: string) => Promise<boolean>;
  refreshPayments: () => Promise<PaymentRecord[] | null>;
  addSchedule: (schedule: Omit<TestSchedule, 'id' | 'filled'>) => Promise<boolean>;
  updateSchedule: (id: string, updates: Partial<TestSchedule>) => Promise<boolean>;
  deleteSchedule: (id: string) => Promise<boolean>;
  createUnit: (data: {
    id: string;
    name: string;
    shortName: string;
    totalQuota: number;
    offlineCount?: number;
    formFee: number;
    reRegFee: number;
    isOpen?: boolean;
    closedNotice?: string;
    facilities?: string[];
  }) => Promise<boolean>;
  updateUnitQuotaFee: (
    unitId: string,
    quota: number,
    formFee: number,
    reRegFee: number,
    isOpen?: boolean,
    closedNotice?: string
  ) => Promise<boolean>;
  updateUnitOfflineCount: (unitId: string, offlineCount: number) => Promise<boolean>;
  updateUnitRegistrationStatus: (
    unitId: string,
    isOpen: boolean,
    closedNotice?: string
  ) => Promise<boolean>;
  reorderUnits: (orderedIds: string[]) => Promise<boolean>;
  updateFormSchema: (unitId: string, schema: UnitFormSchema) => Promise<boolean>;
  refreshFormSchemas: () => Promise<UnitFormSchema[] | null>;
  refreshSchedules: () => Promise<TestSchedule[] | null>;
  refreshStudentById: (id: string) => Promise<StudentRegistration | null>;
  addRole: (role: Omit<UserRole, 'id' | 'userCount'>) => Promise<boolean>;
  updateRole: (id: string, updates: Partial<UserRole>) => Promise<boolean>;
  deleteRole: (id: string) => Promise<boolean>;
  addUser: (user: Omit<AppUser, 'id' | 'lastLogin'>) => Promise<boolean>;
  updateUser: (id: string, updates: Partial<AppUser>) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
  resetUserPassword: (id: string) => Promise<boolean>;
  addAcademicYear: (year: Omit<AcademicYear, 'id' | 'isActive'>) => Promise<boolean>;
  activateAcademicYear: (id: string) => Promise<boolean>;
  updateLandingConfig: (config: LandingPageConfig) => Promise<boolean>;
  updateExportConfig: (config: ExportFieldConfig) => Promise<boolean>;
  updateSmtpConfig: (config: Partial<SmtpConfig>) => Promise<boolean>;
  testSmtpConnection: (testRecipient?: string, formOverrides?: { senderEmail?: string; authPassword?: string }) => Promise<{ success: boolean; message: string; isAuthError?: boolean }>;
  updateGroupLink: (config: GroupLinkConfig) => Promise<boolean>;
  updateUnitContact: (config: UnitContactConfig) => Promise<boolean>;
  updateLetterConfig: (config: LetterConfig) => Promise<boolean>;
  addBankAccount: (account: Omit<BankAccountConfig, 'id' | 'updatedAt' | 'updatedBy'>) => Promise<boolean>;
  updateBankAccount: (id: string, account: Partial<BankAccountConfig>) => Promise<boolean>;
  deleteBankAccount: (id: string) => Promise<boolean>;
  refreshBankAccounts: () => Promise<BankAccountConfig[] | null>;

  registerWaliAccount: (data: { name: string; email: string; phone: string; password: string; turnstileToken?: string }) => Promise<{ success: boolean; error?: string }>;
  sendEmailVerificationOtp: () => Promise<{ success: boolean; message?: string; error?: string; cooldownSeconds?: number; sentVia?: string }>;
  verifyEmailVerificationOtp: (otp: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  verifyCurrentWaliEmail: () => Promise<{ success: boolean; error?: string }>;
  addOfflineStudent: (data: Partial<StudentRegistration>) => Promise<StudentRegistration>;
  sendRegistrationEmailIfVerified: (studentId: string) => Promise<{ sent: boolean; message?: string; reason?: string }>;
  addAuditLog: (action: AuditLogItem['action'], schoolId: SchoolId, details: string) => Promise<void>;
  refreshAllData: () => Promise<void>;
  refreshTrashItems: () => Promise<TrashItem[]>;
  restoreTrashItem: (id: string) => Promise<boolean>;
  permanentlyDeleteTrashItem: (id: string) => Promise<boolean>;
  emptyTrash: () => Promise<boolean>;
  downloadMySqlDump: () => void;
  toasts: ToastState[];
  showToast: (message: string, type?: 'success' | 'error') => void;
  removeToast: (id: string) => void;
}

const PPDBContext = createContext<PPDBContextType | undefined>(undefined);

export const PPDBProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // All business datasets are hydrated exclusively from the backend/MySQL database.
  const [students, setStudents] = useState<StudentRegistration[]>(INITIAL_STUDENTS);
  const [payments, setPayments] = useState<PaymentRecord[]>(INITIAL_PAYMENTS);
  const [schedules, setSchedules] = useState<TestSchedule[]>(INITIAL_SCHEDULES);
  const [formSchemas, setFormSchemas] = useState<UnitFormSchema[]>(INITIAL_FORM_SCHEMAS);
  const [roles, setRoles] = useState<UserRole[]>(INITIAL_ROLES);
  const [users, setUsers] = useState<AppUser[]>(() =>
    INITIAL_USERS.map((u) => ({ ...u, emailVerified: Boolean(u.emailVerified) }))
  );
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>(INITIAL_ACADEMIC_YEARS);
  const [units, setUnits] = useState<UnitQuotaFee[]>(INITIAL_UNITS);
  const [landingConfig, setLandingConfig] = useState<LandingPageConfig>(INITIAL_LANDING_CONFIG);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(INITIAL_AUDIT_LOGS);
  const [exportConfigs, setExportConfigs] = useState<ExportFieldConfig[]>(INITIAL_EXPORT_CONFIGS);
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>(INITIAL_SMTP_CONFIG);
  const [groupLinks, setGroupLinks] = useState<GroupLinkConfig[]>(INITIAL_GROUP_LINKS);
  const [cloudflareConfig, setCloudflareConfig] = useState<CloudflareConfig>(INITIAL_CLOUDFLARE_CONFIG);
  const [unitContacts, setUnitContacts] = useState<UnitContactConfig[]>(INITIAL_UNIT_CONTACTS);
  const [letterConfigs, setLetterConfigs] = useState<LetterConfig[]>(INITIAL_LETTER_CONFIGS);
  const [bankAccounts, setBankAccounts] = useState<BankAccountConfig[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);

  const [systemStatus] = useState<SystemStatusConfig>(INITIAL_SYSTEM_STATUS);
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [activeSchoolId, setActiveSchoolId] = useState<SchoolId>('MASTER');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    purgeLegacyStorageTokens();
    const saved = localStorage.getItem('ppdb_current_user');
    if (!saved) {
      return null;
    }
    try {
      const u: AppUser = JSON.parse(saved);
      const matchedRole = INITIAL_ROLES.find(
        (r) =>
          r.name === u.role ||
          r.id === u.role ||
          (u.email === 'adminyys@dev.com' && (r.id === 'role-admin-yys' || r.name.includes('Admin Yayasan'))) ||
          (u.email === 'master@dev.com' && (r.id === 'role-master' || r.name.includes('Super Admin')))
      );
      if (matchedRole && Array.isArray(matchedRole.permissions)) {
        u.permissions = [...matchedRole.permissions];
      }
      if (u.email === 'master@dev.com' || u.role === 'Super Admin Yayasan') {
        if (!u.permissions || u.permissions.length === 0 || !u.permissions.includes('Manajemen Role')) {
          u.permissions = [
            'Dashboard', 'Pendaftar', 'Verifikasi', 'Jadwal', 'Kelulusan', 'Pembayaran',
            'Laporan', 'Form Builder', 'Manajemen Role', 'Kelola Users', 'Tahun Ajaran',
            'Kuota & Biaya', 'Kelola Landing', 'Status Sistem', 'Audit Log'
          ];
        }
      }
      u.emailVerified = Boolean(u.emailVerified);
      return u;
    } catch (e) {
      return null;
    }
  });
  
  const isValidUnitCodeFormat = (raw?: string | null): boolean => {
    if (!raw) return false;
    const upper = raw.trim().toUpperCase();
    return /^[A-Z0-9]{2,12}$/.test(upper) && upper !== 'MASTER' && upper !== 'ALL';
  };

  const extractQrUnitFromUrl = (): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const rawParam =
        searchParams.get('daftar') ||
        searchParams.get('registerUnit') ||
        searchParams.get('unit');
      if (rawParam && isValidUnitCodeFormat(rawParam)) {
        return rawParam.trim().toUpperCase();
      }
      const hash = window.location.hash || '';
      const hashMatch = hash.match(/(?:daftar|registerUnit|unit)=([A-Za-z0-9]+)/i);
      if (hashMatch && hashMatch[1] && isValidUnitCodeFormat(hashMatch[1])) {
        return hashMatch[1].trim().toUpperCase();
      }
    } catch (e) {}
    return null;
  };

  const [pendingRegisterUnit, setPendingRegisterUnitState] = useState<string | null>(() => {
    const fromUrl = extractQrUnitFromUrl();
    if (fromUrl) {
      try {
        sessionStorage.setItem('ppdb_pending_register_unit', fromUrl);
      } catch (e) {}
      return fromUrl;
    }
    try {
      const saved = sessionStorage.getItem('ppdb_pending_register_unit');
      if (saved && isValidUnitCodeFormat(saved)) {
        return saved.trim().toUpperCase();
      }
    } catch (e) {}
    return null;
  });

  const setPendingRegisterUnit = useCallback((unit: string | null) => {
    const clean = unit && isValidUnitCodeFormat(unit) ? unit.trim().toUpperCase() : null;
    setPendingRegisterUnitState(clean);
    try {
      if (clean) {
        sessionStorage.setItem('ppdb_pending_register_unit', clean);
      } else {
        sessionStorage.removeItem('ppdb_pending_register_unit');
      }
    } catch (e) {}
  }, []);

  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginModalTab, setLoginModalTab] = useState<'login' | 'register'>('login');
  const [registerWizardOpen, setRegisterWizardOpen] = useState(false);

  const openLoginModal = (tab: 'login' | 'register' = 'login') => {
    setLoginModalTab(tab);
    setLoginModalOpen(true);
  };
  
  const [desktopActiveMenu, setDesktopActiveMenu] = useState<string>(() => {
    return localStorage.getItem('ppdb_desktop_active_menu') || 'dashboard';
  });
  
  const [mobileActiveTab, setMobileActiveTab] = useState<'beranda' | 'anak' | 'pembayaran' | 'admin' | 'profil'>(() => {
    return (localStorage.getItem('ppdb_mobile_active_tab') as any) || 'beranda';
  });
  
  const [activeView, setActiveView] = useState<'app' | 'landing'>(() => {
    const savedUser = localStorage.getItem('ppdb_current_user');
    const savedView = localStorage.getItem('ppdb_active_view');
    // Force 'app' only when a user session hint exists (verified immediately by /api/auth/me)
    return savedUser ? 'app' : ((savedView === 'landing' ? 'landing' : 'landing') as 'app' | 'landing');
  });

  // Handle QR Code Registration Deep Link (?daftar=TK01 / ?daftar=SD01 / etc.)
  useEffect(() => {
    const handleQrRoute = () => {
      const qrUnit = extractQrUnitFromUrl();
      if (!qrUnit) return;

      setPendingRegisterUnit(qrUnit);

      // Clean URL query parameter while preserving any non-daftar hash
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('daftar');
        url.searchParams.delete('registerUnit');
        url.searchParams.delete('unit');
        const nextHash = url.hash && url.hash.includes('daftar=') ? '' : url.hash;
        window.history.replaceState({}, document.title, url.pathname + url.search + nextHash);
      } catch (e) {}

      const hasSession = Boolean(currentUser || localStorage.getItem('ppdb_current_user'));
      if (hasSession) {
        setLoginModalOpen(false);
        setActiveView('app');
        setRegisterWizardOpen(true);
      } else {
        setRegisterWizardOpen(false);
        setLoginModalTab('register');
        setLoginModalOpen(true);
      }
    };

    handleQrRoute();
    window.addEventListener('hashchange', handleQrRoute);
    window.addEventListener('popstate', handleQrRoute);
    return () => {
      window.removeEventListener('hashchange', handleQrRoute);
      window.removeEventListener('popstate', handleQrRoute);
    };
  }, [currentUser, setPendingRegisterUnit]);

  const login = (user: AppUser, optionCsrfToken?: string) => {
    // Dynamically resolve permissions from server-synced roles
    const roleList: UserRole[] = roles && roles.length > 0 ? roles : INITIAL_ROLES;
    const matchedRole = roleList.find(
      (r) =>
        r.name === user.role ||
        r.id === user.role ||
        (user.email === 'adminyys@dev.com' && (r.id === 'role-admin-yys' || r.name.includes('Admin Yayasan'))) ||
        (user.email === 'master@dev.com' && (r.id === 'role-master' || r.name.includes('Super Admin')))
    );
    const resolvedUser: AppUser = {
      ...user,
      emailVerified: Boolean(user.emailVerified),
      permissions: matchedRole && Array.isArray(matchedRole.permissions) ? [...matchedRole.permissions] : user.permissions || [],
    };

    if (optionCsrfToken) {
      setCsrfToken(optionCsrfToken);
    }

    setCurrentUser(resolvedUser);
    localStorage.setItem('ppdb_current_user', JSON.stringify(resolvedUser));

    if (user.schoolId && user.schoolId !== 'MASTER') {
      setActiveSchoolId(user.schoolId);
    } else {
      setActiveSchoolId('MASTER');
    }

    // Role-specific intelligent routing
    let initialMenu = 'dashboard';
    let initialTab: 'beranda' | 'anak' | 'pembayaran' | 'admin' | 'profil' = 'admin';
    
    if (isParentUser(user)) {
      initialTab = 'anak';
      initialMenu = 'dashboard';
    } else if (user.role.includes('Bendahara')) {
      initialTab = 'admin';
      initialMenu = 'pembayaran';
    } else if (user.role.includes('Verifikator')) {
      initialTab = 'admin';
      initialMenu = 'verifikasi';
    } else if (user.role.includes('Admin Unit')) {
      initialTab = 'admin';
      initialMenu = 'dashboard';
    } else {
      // Super Admin
      initialTab = 'admin';
      initialMenu = 'dashboard';
    }

    setMobileActiveTab(initialTab);
    setDesktopActiveMenu(initialMenu);
    localStorage.setItem('ppdb_desktop_active_menu', initialMenu);
    localStorage.setItem('ppdb_mobile_active_tab', initialTab);

    setActiveView('app');
    localStorage.setItem('ppdb_active_view', 'app');
    
    setLoginModalOpen(false);
    // If came from a Unit QR scan, immediately launch that unit's registration form
    let activePending = pendingRegisterUnit;
    if (!activePending) {
      try {
        const stored = sessionStorage.getItem('ppdb_pending_register_unit');
        if (stored && isValidUnitCodeFormat(stored)) {
          activePending = stored.trim().toUpperCase();
        }
      } catch (e) {}
    }
    if (activePending) {
      setRegisterWizardOpen(true);
    }

    showToast(`Berhasil masuk sebagai ${user.name} (${user.role})`);
    authEpochRef.current += 1;
    justLoggedInAtRef.current = Date.now();
    setTimeout(() => refreshAllData(), 50);
  };

  const logout = () => {
    authEpochRef.current += 1;
    justLoggedInAtRef.current = 0;
    apiFetch('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders(),
    }).catch(() => {}).finally(() => {
      clearCsrfToken();
    });

    setCurrentUser(null);
    setStudents([]);
    setPayments([]);
    setUsers([]);
    setAuditLogs([]);
    setTrashItems([]);
    localStorage.removeItem('ppdb_current_user');
    
    setActiveView('landing');
    localStorage.removeItem('ppdb_active_view');
    localStorage.removeItem('ppdb_desktop_active_menu');
    localStorage.removeItem('ppdb_mobile_active_tab');
    
    setLoginModalOpen(false);
    showToast('Sesi telah ditutup. Kembali ke halaman utama PPDB.');
  };

  const [toasts, setToasts] = useState<ToastState[]>([]);

  const toastCounterRef = React.useRef(0);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    toastCounterRef.current += 1;
    const id = `${Date.now()}-${toastCounterRef.current}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // One-time cleanup of legacy business datasets cached in browser localStorage
  useEffect(() => {
    const legacyBusinessKeys = [
      'ppdb_students',
      'ppdb_payments',
      'ppdb_schedules',
      'ppdb_form_schemas',
      'ppdb_roles',
      'ppdb_users',
      'ppdb_years',
      'ppdb_units',
      'ppdb_landing',
      'ppdb_audit_logs',
      'ppdb_export_configs',
      'ppdb_smtp_config',
      'ppdb_group_links',
      'ppdb_cloudflare_config',
      'ppdb_unit_contacts',
      'ppdb_letter_configs',
    ];
    legacyBusinessKeys.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    });
  }, []);

  const lastRefreshAtRef = React.useRef<number>(0);
  const authEpochRef = React.useRef<number>(0);
  const justLoggedInAtRef = React.useRef<number>(0);

  // Fetch all data strictly from Express + MySQL Backend (Database Single Source of Truth)
  const refreshAllData = useCallback(async () => {
    const startEpoch = authEpochRef.current;
    lastRefreshAtRef.current = Date.now();
    try {
      purgeLegacyStorageTokens();

      let verifiedUser: AppUser | null = null;
      // 0. Verify active HttpOnly cookie session & sync CSRF token from Server DB (/api/auth/me)
      try {
        const meRes = await apiFetch('/api/auth/me', { cache: 'no-store' });
        // Ignore stale response if login() or logout() occurred while this request was in-flight
        if (startEpoch !== authEpochRef.current) {
          return;
        }
        if (meRes.ok) {
          const meData = await meRes.json();
          justLoggedInAtRef.current = 0;
          if (meData.csrfToken) {
            setCsrfToken(meData.csrfToken);
          }
          if (meData.user) {
            verifiedUser = meData.user;
            setCurrentUser(meData.user);
            localStorage.setItem('ppdb_current_user', JSON.stringify(meData.user));
          }
        } else {
          const wasJustLoggedIn =
            justLoggedInAtRef.current > 0 && Date.now() - justLoggedInAtRef.current < 10000;
          justLoggedInAtRef.current = 0;
          clearCsrfToken();
          localStorage.removeItem('ppdb_current_user');
          localStorage.removeItem('ppdb_active_view');
          setCurrentUser(null);
          setTrashItems([]);
          setActiveView('landing');
          if (wasJustLoggedIn) {
            showToast(
              'Sesi login tidak dapat disimpan karena browser memblokir cookie pada mode iframe. Silakan buka aplikasi di tab baru atau izinkan cookie.',
              'error'
            );
          }
        }
      } catch (e) {}

      const headers = getAuthHeaders();

      // 0b. Prioritize Yayasan Multi-Bank Accounts immediately so Wali & Wizard never flash stale bank info
      try {
        const baRes = await apiFetch('/api/bank-accounts', { headers, cache: 'no-store' });
        if (baRes.ok) {
          const baData = await baRes.json();
          if (Array.isArray(baData)) {
            setBankAccounts(baData);
          }
        }
      } catch (e) {}

      // 1. DB Status
      try {
        const dbRes = await apiFetch('/api/db-status', { headers, cache: 'no-store' });
        if (dbRes.ok) {
          const d = await dbRes.json();
          setDbStatus(d);
        }
      } catch (e) {}

      // 2 & 3. Protected Students & Payments (only when authenticated via verified HttpOnly session)
      if (verifiedUser) {
        try {
          const sRes = await apiFetch('/api/students', { headers, cache: 'no-store' });
          if (sRes.ok) {
            const s = await sRes.json();
            if (Array.isArray(s)) setStudents(s);
          }
        } catch (e) {}

        try {
          const pRes = await apiFetch('/api/payments', { headers, cache: 'no-store' });
          if (pRes.ok) {
            const p = await pRes.json();
            if (Array.isArray(p)) setPayments(p);
          }
        } catch (e) {}
      } else {
        setStudents([]);
        setPayments([]);
      }

      // 4. Schedules
      try {
        const scRes = await apiFetch('/api/schedules', { headers, cache: 'no-store' });
        if (scRes.ok) {
          const sc = await scRes.json();
          if (Array.isArray(sc)) setSchedules(sc);
        }
      } catch (e) {}

      // 5. Units
      try {
        const uRes = await apiFetch('/api/units', { headers, cache: 'no-store' });
        if (uRes.ok) {
          const u = await uRes.json();
          if (Array.isArray(u)) setUnits(u);
        }
      } catch (e) {}

      // 6. Academic Years
      try {
        const ayRes = await apiFetch('/api/academic-years', { headers, cache: 'no-store' });
        if (ayRes.ok) {
          const ay = await ayRes.json();
          if (Array.isArray(ay)) setAcademicYears(ay);
        }
      } catch (e) {}

      // 7. Landing Config
      try {
        const lRes = await apiFetch('/api/landing-config', { headers, cache: 'no-store' });
        if (lRes.ok) {
          const l = await lRes.json();
          if (l && l.appName) setLandingConfig(l);
        }
      } catch (e) {}

      // 8. Audit Logs (protected)
      if (verifiedUser) {
        try {
          const aRes = await apiFetch('/api/audit-logs', { headers, cache: 'no-store' });
          if (aRes.ok) {
            const a = await aRes.json();
            if (Array.isArray(a)) setAuditLogs(a);
          }
        } catch (e) {}
      } else {
        setAuditLogs([]);
      }

      // 9. Roles & Dynamic Access Sync
      try {
        const rRes = await apiFetch('/api/roles', { headers, cache: 'no-store' });
        if (rRes.ok) {
          const rList = await rRes.json();
          if (Array.isArray(rList) && rList.length > 0) {
            setRoles(rList);
            setCurrentUser((curr) => {
              if (!curr) return null;
              const matchedRole = rList.find(
                (r: UserRole) =>
                  r.name === curr.role ||
                  r.id === curr.role ||
                  (curr.email === 'adminyys@dev.com' && (r.id === 'role-admin-yys' || (r.name.includes('Admin Yayasan') && !r.name.includes('Super')))) ||
                  (curr.email === 'master@dev.com' && (r.id === 'role-master' || r.name.includes('Super Admin')))
              );
              if (matchedRole && Array.isArray(matchedRole.permissions)) {
                const updatedCurr = { ...curr, permissions: [...matchedRole.permissions] };
                localStorage.setItem('ppdb_current_user', JSON.stringify(updatedCurr));
                return updatedCurr;
              }
              return curr;
            });
          }
        }
      } catch (e) {}

      // 10. Users (Database Single Source of Truth & CurrentUser sync - protected)
      if (verifiedUser) {
        try {
          const usrRes = await apiFetch('/api/users', { headers, cache: 'no-store' });
          if (usrRes.ok) {
            const uList = await usrRes.json();
            if (Array.isArray(uList)) {
              setUsers(uList);
              setCurrentUser((curr) => {
                if (!curr) return null;
                const dbUser = uList.find((u: AppUser) => u.id === curr.id) || uList.find((u: AppUser) => u.email.toLowerCase() === curr.email.toLowerCase());
                if (dbUser) {
                  const updatedCurr = { ...curr, ...dbUser };
                  localStorage.setItem('ppdb_current_user', JSON.stringify(updatedCurr));
                  return updatedCurr;
                }
                return curr;
              });
            }
          }
        } catch (e) {}
      } else {
        setUsers([]);
      }

      // 11. SMTP Config (Admin protected)
      if (verifiedUser) {
        try {
          const smtpRes = await apiFetch('/api/smtp-config', { headers, cache: 'no-store' });
          if (smtpRes.ok) {
            const sConf = await smtpRes.json();
            if (sConf && typeof sConf === 'object') {
              setSmtpConfig(sConf);
            }
          }
        } catch (e) {}
      }

      // 12. Group Links Config
      try {
        const glRes = await apiFetch('/api/group-links', { headers, cache: 'no-store' });
        if (glRes.ok) {
          const glData = await glRes.json();
          if (Array.isArray(glData) && glData.length > 0) {
            setGroupLinks(glData);
          }
        }
      } catch (e) {}

      // 13. Export Field Configs
      try {
        const expRes = await apiFetch('/api/export-configs', { headers, cache: 'no-store' });
        if (expRes.ok) {
          const expData = await expRes.json();
          if (Array.isArray(expData) && expData.length > 0) {
            setExportConfigs(expData);
          }
        }
      } catch (e) {}

      // 14. Cloudflare Turnstile Config
      try {
        const cfRes = await apiFetch('/api/cloudflare-config', { headers, cache: 'no-store' });
        if (cfRes.ok) {
          const cfData = await cfRes.json();
          if (cfData && typeof cfData === 'object') {
            setCloudflareConfig((prev) => ({
              ...prev,
              ...cfData,
              secretKey: cfData.secretKey !== undefined && cfData.secretKey !== '' ? cfData.secretKey : prev.secretKey,
            }));
          }
        }
      } catch (e) {}

      // 15. Unit Contacts Config
      try {
        const ucRes = await apiFetch('/api/unit-contacts', { headers, cache: 'no-store' });
        if (ucRes.ok) {
          const ucData = await ucRes.json();
          if (Array.isArray(ucData) && ucData.length > 0) {
            setUnitContacts(ucData);
          }
        }
      } catch (e) {}

      // 16. Letter Configs
      try {
        const lcRes = await apiFetch('/api/letter-configs', { headers, cache: 'no-store' });
        if (lcRes.ok) {
          const lcData = await lcRes.json();
          if (Array.isArray(lcData) && lcData.length > 0) {
            setLetterConfigs(lcData);
          }
        }
      } catch (e) {}

      // (Bank Accounts already prioritized at step 0b)

      // 17. Form Schemas (Dynamic Form Builder definitions per unit)
      let latestUnitsSnapshot: UnitQuotaFee[] = [];
      setUnits((curr) => {
        latestUnitsSnapshot = curr;
        return curr;
      });
      try {
        const fsRes = await apiFetch('/api/form-schemas', { headers, cache: 'no-store' });
        if (fsRes.ok) {
          const fsData = await fsRes.json();
          if (Array.isArray(fsData) && fsData.length > 0) {
            const validSchemas = fsData
              .filter((s: UnitFormSchema) => Boolean(s && s.unitId && Array.isArray(s.sections)))
              .sort((a: UnitFormSchema, b: UnitFormSchema) => {
                const ia = latestUnitsSnapshot.findIndex((u) => u.id === a.unitId);
                const ib = latestUnitsSnapshot.findIndex((u) => u.id === b.unitId);
                return (ia >= 0 ? ia : 99) - (ib >= 0 ? ib : 99);
              });
            if (validSchemas.length > 0) {
              setFormSchemas(validSchemas);
            }
          }
        }
      } catch (e) {}
      // 18. Trash / Sampah Items (Super Admin Yayasan ONLY)
      if (verifiedUser && isSuperAdmin(verifiedUser)) {
        try {
          const trRes = await apiFetch('/api/trash', { headers, cache: 'no-store' });
          if (trRes.ok) {
            const trData = await trRes.json();
            if (Array.isArray(trData)) setTrashItems(trData);
          }
        } catch (e) {}
      } else {
        setTrashItems([]);
      }
    } catch (err) {
      console.error('[PPDB Frontend] Gagal menyinkronkan data dari server:', err);
    }
  }, []);

  const refreshTrashItems = useCallback(async (): Promise<TrashItem[]> => {
    try {
      const res = await apiFetch('/api/trash', {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data)) {
        setTrashItems(data);
        return data;
      }
    } catch (e) {}
    return [];
  }, []);

  const restoreTrashItem = async (id: string): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/trash/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal memulihkan data dari Sampah.', 'error');
        return false;
      }
      if (Array.isArray(data.trashItems)) {
        setTrashItems(data.trashItems);
      } else {
        setTrashItems((prev) => prev.filter((item) => item.id !== id));
      }
      await refreshAllData();
      showToast(data.message || 'Data berhasil dipulihkan dari Sampah!');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat memulihkan data.', 'error');
      return false;
    }
  };

  const permanentlyDeleteTrashItem = async (id: string): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/trash/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal menghapus permanen data dari Sampah.', 'error');
        return false;
      }
      if (Array.isArray(data.trashItems)) {
        setTrashItems(data.trashItems);
      } else {
        setTrashItems((prev) => prev.filter((item) => item.id !== id));
      }
      showToast(data.message || 'Data dihapus permanen dari Sampah.');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menghapus permanen item Sampah.', 'error');
      return false;
    }
  };

  const emptyTrash = async (): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/trash', {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Gagal mengosongkan Sampah.', 'error');
        return false;
      }
      setTrashItems([]);
      showToast(data.message || 'Seluruh data di Sampah berhasil dikosongkan.');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat mengosongkan Sampah.', 'error');
      return false;
    }
  };

  const refreshFormSchemas = useCallback(async (): Promise<UnitFormSchema[] | null> => {
    try {
      const res = await apiFetch('/api/form-schemas', {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const fsData = await res.json();
      if (Array.isArray(fsData) && fsData.length > 0) {
        const validSchemas = fsData.filter((s: UnitFormSchema) => Boolean(s && s.unitId && Array.isArray(s.sections)));
        if (validSchemas.length > 0) {
          setFormSchemas(validSchemas);
          return validSchemas;
        }
      }
    } catch (e) {}
    return null;
  }, []);

  const refreshSchedules = useCallback(async (): Promise<TestSchedule[] | null> => {
    try {
      const res = await apiFetch('/api/schedules', {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const scData = await res.json();
      if (Array.isArray(scData)) {
        setSchedules(scData);
        return scData;
      }
    } catch (e) {}
    return null;
  }, []);

  const refreshStudentById = useCallback(async (id: string): Promise<StudentRegistration | null> => {
    if (!id) return null;
    try {
      const res = await apiFetch(`/api/students/${encodeURIComponent(id)}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const fresh: StudentRegistration = await res.json();
      if (fresh && fresh.id) {
        setStudents((prev) => {
          const exists = prev.some((s) => s.id === fresh.id);
          return exists ? prev.map((s) => (s.id === fresh.id ? { ...s, ...fresh } : s)) : [fresh, ...prev];
        });
        return fresh;
      }
    } catch (e) {}
    return null;
  }, []);

  const lastBankRefreshAtRef = React.useRef<number>(0);

  const refreshBankAccounts = useCallback(async (): Promise<BankAccountConfig[] | null> => {
    lastBankRefreshAtRef.current = Date.now();
    try {
      const res = await apiFetch('/api/bank-accounts', {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const baData = await res.json();
      if (Array.isArray(baData)) {
        setBankAccounts(baData);
        return baData;
      }
    } catch (e) {}
    return null;
  }, []);

  const broadcastBankSync = useCallback(() => {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel('ppdb_sync');
        ch.postMessage({ type: 'bank_accounts_updated', ts: Date.now() });
        ch.close();
      }
    } catch (e) {}
    try {
      localStorage.setItem('ppdb_bank_sync_ts', String(Date.now()));
    } catch (e) {}
  }, []);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Cross-tab instant sync for dynamic configs (bankAccounts, etc.)
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('ppdb_sync');
        channel.onmessage = (ev) => {
          if (ev?.data?.type === 'bank_accounts_updated') {
            refreshBankAccounts();
          }
        };
      }
    } catch (e) {}

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === 'ppdb_bank_sync_ts') {
        refreshBankAccounts();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      if (channel) {
        try {
          channel.close();
        } catch (e) {}
      }
      window.removeEventListener('storage', onStorage);
    };
  }, [refreshBankAccounts]);

  // Auto-refresh when browser tab regains focus/visibility to stay synced with DB across sessions
  useEffect(() => {
    const maybeRefresh = () => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastRefreshAtRef.current >= 15000) {
        refreshAllData();
      } else if (now - lastBankRefreshAtRef.current >= 1500) {
        refreshBankAccounts();
      }
    };
    window.addEventListener('focus', maybeRefresh);
    document.addEventListener('visibilitychange', maybeRefresh);
    return () => {
      window.removeEventListener('focus', maybeRefresh);
      document.removeEventListener('visibilitychange', maybeRefresh);
    };
  }, [refreshAllData, refreshBankAccounts]);

  // Synchronize SEO & Social Metadata Tags in DOM <head> dynamically
  useEffect(() => {
    if (!landingConfig) return;

    // 1. Page Title & Meta Description
    const pageTitle = landingConfig.metaTitle || landingConfig.appName || 'PPDB Ar-Risalah Aceh';
    document.title = pageTitle;

    const pageDesc = landingConfig.metaDescription || landingConfig.heroSubtitle || '';
    if (pageDesc) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', pageDesc);
    }

    // 2. Keywords & Author
    if (landingConfig.metaKeywords) {
      let metaKeys = document.querySelector('meta[name="keywords"]');
      if (!metaKeys) {
        metaKeys = document.createElement('meta');
        metaKeys.setAttribute('name', 'keywords');
        document.head.appendChild(metaKeys);
      }
      metaKeys.setAttribute('content', landingConfig.metaKeywords);
    }

    if (landingConfig.author) {
      let metaAuthor = document.querySelector('meta[name="author"]');
      if (!metaAuthor) {
        metaAuthor = document.createElement('meta');
        metaAuthor.setAttribute('name', 'author');
        document.head.appendChild(metaAuthor);
      }
      metaAuthor.setAttribute('content', landingConfig.author);
    }

    // 3. OpenGraph & Twitter Social Sharing Cards
    const ogTitle = landingConfig.ogTitle || pageTitle;
    let ogTitleMeta = document.querySelector('meta[property="og:title"]');
    if (!ogTitleMeta) {
      ogTitleMeta = document.createElement('meta');
      ogTitleMeta.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitleMeta);
    }
    ogTitleMeta.setAttribute('content', ogTitle);

    const ogDesc = landingConfig.ogDescription || pageDesc;
    if (ogDesc) {
      let ogDescMeta = document.querySelector('meta[property="og:description"]');
      if (!ogDescMeta) {
        ogDescMeta = document.createElement('meta');
        ogDescMeta.setAttribute('property', 'og:description');
        document.head.appendChild(ogDescMeta);
      }
      ogDescMeta.setAttribute('content', ogDesc);
    }

    if (landingConfig.ogImage) {
      let ogImgMeta = document.querySelector('meta[property="og:image"]');
      if (!ogImgMeta) {
        ogImgMeta = document.createElement('meta');
        ogImgMeta.setAttribute('property', 'og:image');
        document.head.appendChild(ogImgMeta);
      }
      ogImgMeta.setAttribute('content', landingConfig.ogImage);
    }

    // 4. Favicon Icon URL (.ico / .png)
    if (landingConfig.faviconUrl) {
      let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.setAttribute('rel', 'icon');
        document.head.appendChild(faviconLink);
      }
      faviconLink.setAttribute('href', landingConfig.faviconUrl);
    }

    // 5. Canonical Link
    if (landingConfig.canonicalUrl) {
      let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!canonicalLink) {
        canonicalLink = document.createElement('link');
        canonicalLink.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.setAttribute('href', landingConfig.canonicalUrl);
    }

    // 6. Schema.org JSON-LD Structured Data
    if (landingConfig.structuredDataJson) {
      let jsonLdScript = document.getElementById('applet-seo-jsonld');
      if (!jsonLdScript) {
        jsonLdScript = document.createElement('script');
        jsonLdScript.id = 'applet-seo-jsonld';
        jsonLdScript.setAttribute('type', 'application/ld+json');
        document.head.appendChild(jsonLdScript);
      }
      jsonLdScript.textContent = landingConfig.structuredDataJson;
    }
  }, [landingConfig]);

  const addAuditLog = async (action: AuditLogItem['action'], schoolId: SchoolId, details: string) => {
    try {
      const res = await apiFetch('/api/audit-logs', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action, schoolId, details, userEmail: currentUser?.email || 'system@arrisalahaceh.or.id' }),
      });
      if (res.ok) {
        const log = await res.json();
        setAuditLogs((prev) => [log, ...prev]);
      }
    } catch (e) {
      console.error('[PPDB Context] Gagal mencatat audit log ke server.');
    }
  };

  // Student Actions
  const addStudent = async (data: Partial<StudentRegistration>): Promise<StudentRegistration> => {
    let createdStudent: StudentRegistration | null = null;
    try {
      const res = await apiFetch('/api/students', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.error || 'Gagal menyimpan data pendaftaran ke server.';
        showToast(errMsg, 'error');
        throw new Error(errMsg);
      }
      createdStudent = await res.json();
    } catch (e: any) {
      const errMsg = e?.message && !e.message.toLowerCase().includes('failed to fetch')
        ? e.message
        : 'Gagal terhubung ke server untuk menyimpan pendaftaran. Pastikan koneksi aktif dan coba lagi.';
      showToast(errMsg, 'error');
      throw new Error(errMsg);
    }

    if (!createdStudent) {
      const errMsg = 'Respons server tidak valid saat menyimpan pendaftaran.';
      showToast(errMsg, 'error');
      throw new Error(errMsg);
    }

    // Link created student to current user session state
    if (currentUser) {
      const updatedChildren = Array.from(new Set([...(currentUser.childrenIds || []), createdStudent.id]));
      const updatedUser: AppUser = {
        ...currentUser,
        studentId: currentUser.studentId || createdStudent.id,
        studentRegistrationNumber: currentUser.studentRegistrationNumber || createdStudent.registrationNumber,
        childrenIds: updatedChildren,
      };
      setCurrentUser(updatedUser);
      localStorage.setItem('ppdb_current_user', JSON.stringify(updatedUser));
    }

    const finalStudent = createdStudent;
    setStudents((prev) => [finalStudent, ...prev]);
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id !== finalStudent.unit) return u;
        const nextOnline = (u.onlineCount ?? Math.max(0, u.filledQuota - (u.offlineCount ?? 0))) + 1;
        return {
          ...u,
          onlineCount: nextOnline,
          filledQuota: nextOnline + (u.offlineCount ?? 0),
        };
      })
    );
    showToast(`Pendaftaran ${finalStudent.fullName} berhasil disimpan ke database`);
    refreshAllData();
    return finalStudent;
  };

  const updateStudent = async (id: string, updates: Partial<StudentRegistration>): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/students/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.error || 'Gagal menyimpan perubahan data siswa di database.';
        showToast(errMsg, 'error');
        return false;
      }
      const serverUpdated = await res.json().catch(() => null);
      setStudents((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...(serverUpdated || updates) } : s))
      );
      showToast('Data calon siswa berhasil diperbarui');
      return true;
    } catch (e: any) {
      const errMsg = 'Gagal terhubung ke server saat memperbarui data siswa.';
      showToast(errMsg, 'error');
      return false;
    }
  };

  const deleteStudent = async (id: string): Promise<boolean> => {
    const targetStudent = students.find((s) => s.id === id);
    try {
      const res = await apiFetch(`/api/students/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menghapus data pendaftar dari database.', 'error');
        return false;
      }
      setStudents((prev) => prev.filter((s) => s.id !== id));
      if (targetStudent) {
        setUnits((prev) =>
          prev.map((u) => {
            if (u.id !== targetStudent.unit) return u;
            const nextOnline = Math.max(0, (u.onlineCount ?? Math.max(0, u.filledQuota - (u.offlineCount ?? 0))) - 1);
            return {
              ...u,
              onlineCount: nextOnline,
              filledQuota: nextOnline + (u.offlineCount ?? 0),
            };
          })
        );
      }
      setPayments((prev) => prev.filter((p) => p.registrationId !== id));
      if (isSuperAdmin(currentUser)) refreshTrashItems();
      showToast('Pendaftar dihapus dan dipindahkan ke Sampah Master');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menghapus data pendaftar.', 'error');
      return false;
    }
  };

  const verifyStudentDocument = async (id: string, approved: boolean, notes?: string): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/students/${id}/verify`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ approved, notes }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menyimpan status verifikasi ke database.', 'error');
        return false;
      }
      const updated = await res.json().catch(() => null);
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id === id) {
            return updated && updated.id
              ? { ...s, ...updated }
              : {
                  ...s,
                  status: approved ? 'tes' : 'tidak_lulus',
                  verificationNotes: notes || (approved ? 'Berkas lengkap dan valid.' : 'Berkas ditolak.'),
                };
          }
          return s;
        })
      );
      showToast(approved ? 'Berkas pendaftar disetujui untuk tahap tes' : 'Berkas pendaftar ditolak');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat memverifikasi berkas.', 'error');
      return false;
    }
  };

  const setStudentTestResult = async (id: string, score: number, status: 'lulus' | 'tidak_lulus', publish: boolean): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/students/${id}/test-result`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ score, status, publish }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menyimpan hasil seleksi ke database.', 'error');
        return false;
      }
      const updated = await res.json().catch(() => null);
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id === id) {
            return updated && updated.id
              ? { ...s, ...updated }
              : { ...s, testScore: score, status, testPublished: publish };
          }
          return s;
        })
      );
      if (status === 'lulus') {
        try {
          const pRes = await apiFetch('/api/payments', { headers: getAuthHeaders(), cache: 'no-store' });
          if (pRes.ok) {
            const pList = await pRes.json();
            if (Array.isArray(pList)) setPayments(pList);
          }
        } catch (e) {}
      }
      showToast(`Status kelulusan berhasil disimpan: ${status === 'lulus' ? 'LULUS' : 'TIDAK LULUS'}`);
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menyimpan hasil seleksi.', 'error');
      return false;
    }
  };

  // Payments
  const refreshPayments = useCallback(async (): Promise<PaymentRecord[] | null> => {
    try {
      const res = await apiFetch('/api/payments', {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const pList = await res.json();
      if (Array.isArray(pList)) {
        setPayments(pList);
        return pList;
      }
    } catch (e) {}
    return null;
  }, []);

  const verifyPayment = async (paymentId: string, approved: boolean, notes?: string, amount?: number): Promise<boolean> => {
    try {
      const payload: Record<string, any> = {
        approved,
        notes,
        verifiedBy: currentUser?.email || 'admin@arrisalahaceh.or.id',
      };
      if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
        payload.amount = Math.round(amount);
      }
      const res = await apiFetch(`/api/payments/${paymentId}/verify`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menyimpan verifikasi pembayaran ke database.', 'error');
        return false;
      }
      const updated = await res.json().catch(() => null);
      setPayments((prev) =>
        prev.map((p) => {
          if (p.id === paymentId) {
            return updated && updated.id
              ? { ...p, ...updated }
              : {
                  ...p,
                  status: approved ? 'lunas' : 'ditolak',
                  verifiedBy: currentUser?.email || 'admin@arrisalahaceh.or.id',
                  verificationNotes: notes,
                  ...(payload.amount ? { amount: payload.amount } : {}),
                };
          }
          return p;
        })
      );
      showToast(approved ? 'Bukti transfer diverifikasi (LUNAS)' : 'Bukti transfer ditolak');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat memverifikasi pembayaran.', 'error');
      return false;
    }
  };

  const updatePaymentAmount = async (paymentId: string, amount: number): Promise<boolean> => {
    try {
      const cleanAmount = Math.round(Number(amount) || 0);
      if (!Number.isFinite(cleanAmount) || cleanAmount < 1) {
        showToast('Nominal pembayaran harus lebih dari Rp 0.', 'error');
        return false;
      }
      const res = await apiFetch(`/api/payments/${paymentId}/amount`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ amount: cleanAmount }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menyimpan nominal pembayaran ke database.', 'error');
        return false;
      }
      const updated = await res.json().catch(() => null);
      setPayments((prev) =>
        prev.map((p) => {
          if (p.id === paymentId) {
            return updated && updated.id ? { ...p, ...updated } : { ...p, amount: cleanAmount };
          }
          return p;
        })
      );
      showToast(`Nominal real berhasil disesuaikan menjadi Rp ${cleanAmount.toLocaleString('id-ID')}`);
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menyesuaikan nominal pembayaran.', 'error');
      return false;
    }
  };

  const verifyPaymentGroup = async (
    paymentIds: string[],
    approved: boolean,
    notes?: string
  ): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/payments/verify-group', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ paymentIds, approved, notes }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menyimpan verifikasi pembayaran ke database.', 'error');
        return false;
      }
      const resData = await res.json().catch(() => ({}));
      const updatedList: PaymentRecord[] = Array.isArray(resData.payments) ? resData.payments : [];
      const updatedMap = new Map(updatedList.map((u) => [u.id, u]));
      const idSet = new Set(paymentIds);
      setPayments((prev) =>
        prev.map((p) => {
          const fromServer = updatedMap.get(p.id);
          if (fromServer) return { ...p, ...fromServer };
          if (idSet.has(p.id)) {
            return {
              ...p,
              status: approved ? 'lunas' : 'ditolak',
              verifiedBy: currentUser?.email || 'admin@arrisalahaceh.or.id',
              verificationNotes: notes,
            };
          }
          return p;
        })
      );
      showToast(
        approved
          ? `${paymentIds.length} bukti pembayaran diverifikasi (LUNAS)`
          : `${paymentIds.length} bukti pembayaran ditolak`
      );
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat memverifikasi pembayaran.', 'error');
      return false;
    }
  };

  const addPaymentProof = async (
    registrationId: string,
    proofUrl: string,
    amount: number,
    type: 'Formulir' | 'Daftar Ulang',
    bankAccountId?: string,
    paymentId?: string
  ): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/payments/proof', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ registrationId, proofUrl, amount, type, bankAccountId, paymentId }),
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(resData.error || 'Gagal mengunggah bukti transfer ke server.', 'error');
        return false;
      }

      const savedPayment: PaymentRecord | undefined = resData.payment;
      if (savedPayment && savedPayment.id) {
        setPayments((prev) => {
          const idx = prev.findIndex((p) => p.id === savedPayment.id);
          if (idx >= 0) {
            return prev.map((p, i) => (i === idx ? savedPayment : p));
          }
          return [savedPayment, ...prev];
        });
      } else {
        await refreshPayments();
      }
      showToast('Bukti transfer berhasil disimpan ke database! Menunggu verifikasi bendahara.');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat mengunggah bukti pembayaran.', 'error');
      return false;
    }
  };

  // Schedules
  const addSchedule = async (scheduleData: Omit<TestSchedule, 'id' | 'filled'>): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/schedules', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(scheduleData),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menambahkan jadwal tes ke database.', 'error');
        return false;
      }
      const created = await res.json();
      setSchedules((prev) => [...prev, created]);
      showToast('Jadwal tes baru berhasil ditambahkan');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menambah jadwal tes.', 'error');
      return false;
    }
  };

  const updateSchedule = async (id: string, updates: Partial<TestSchedule>): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/schedules/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal memperbarui jadwal tes di database.', 'error');
        return false;
      }
      const updated = await res.json().catch(() => null);
      setSchedules((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...(updated || updates) } : s))
      );
      showToast('Jadwal tes berhasil diperbarui');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat memperbarui jadwal tes.', 'error');
      return false;
    }
  };

  const deleteSchedule = async (id: string): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/schedules/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menghapus jadwal tes dari database.', 'error');
        return false;
      }
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      if (isSuperAdmin(currentUser)) refreshTrashItems();
      showToast('Jadwal tes dihapus dan dipindahkan ke Sampah Master');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menghapus jadwal tes.', 'error');
      return false;
    }
  };

  // Units
  const createUnit = async (data: {
    id: string;
    name: string;
    shortName: string;
    totalQuota: number;
    offlineCount?: number;
    formFee: number;
    reRegFee: number;
    isOpen?: boolean;
    closedNotice?: string;
    facilities?: string[];
  }): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/units', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menambahkan unit sekolah baru ke database.', 'error');
        return false;
      }
      const created: UnitQuotaFee = await res.json();
      setUnits((prev) => [...prev, created]);
      await refreshAllData();
      showToast(`Unit sekolah baru ${created.shortName} (${created.id}) berhasil ditambahkan!`);
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menambahkan unit baru.', 'error');
      return false;
    }
  };

  const updateUnitQuotaFee = async (
    unitId: string,
    quota: number,
    formFee: number,
    reRegFee: number,
    isOpen?: boolean,
    closedNotice?: string
  ): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/units/${encodeURIComponent(unitId)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ quota, formFee, reRegFee, isOpen, closedNotice }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menyimpan pengaturan unit ke database.', 'error');
        return false;
      }
      const updated = await res.json().catch(() => null);
      setUnits((prev) =>
        prev.map((u) =>
          u.id === unitId
            ? updated && updated.id
              ? { ...u, ...updated }
              : {
                  ...u,
                  totalQuota: quota,
                  formFee,
                  reRegFee,
                  isOpen: isOpen !== undefined ? isOpen : (u.isOpen !== undefined ? u.isOpen : true),
                  closedNotice: closedNotice !== undefined ? closedNotice : u.closedNotice,
                }
            : u
        )
      );
      showToast(`Pengaturan Kuota, Biaya, & Status Pendaftaran ${unitId} berhasil disimpan`);
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menyimpan pengaturan unit.', 'error');
      return false;
    }
  };

  const updateUnitOfflineCount = async (unitId: string, offlineCount: number): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/units/${encodeURIComponent(unitId)}/offline-count`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ offlineCount }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal memperbarui angka pendaftar offline ke database.', 'error');
        return false;
      }
      const updated: UnitQuotaFee = await res.json();
      setUnits((prev) =>
        prev.map((u) => (u.id === unitId ? { ...u, ...updated } : u))
      );
      showToast(`Angka pendaftar offline unit ${unitId} diperbarui menjadi ${updated.offlineCount ?? offlineCount} siswa`);
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat memperbarui pendaftar offline.', 'error');
      return false;
    }
  };

  const updateUnitRegistrationStatus = async (
    unitId: string,
    isOpen: boolean,
    closedNotice?: string
  ): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/units/${encodeURIComponent(unitId)}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isOpen, closedNotice }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal memperbarui status aktivasi pendaftaran unit.', 'error');
        return false;
      }
      const updated = await res.json().catch(() => null);
      setUnits((prev) =>
        prev.map((u) =>
          u.id === unitId
            ? updated && updated.id
              ? { ...u, ...updated }
              : {
                  ...u,
                  isOpen,
                  closedNotice: closedNotice !== undefined ? closedNotice : u.closedNotice,
                }
            : u
        )
      );
      showToast(
        isOpen
          ? `Pendaftaran unit ${unitId} berhasil DIAKTIFKAN (Dibuka)!`
          : `Pendaftaran unit ${unitId} DINONAKTIFKAN (Belum Dibuka).`
      );
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat mengubah status pendaftaran unit.', 'error');
      return false;
    }
  };

  const reorderUnits = async (orderedIds: string[]): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/units/reorder', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ orderedIds }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menyimpan urutan posisi unit sekolah.', 'error');
        return false;
      }
      const updatedUnits = await res.json().catch(() => null);
      if (Array.isArray(updatedUnits)) {
        setUnits(updatedUnits);
      } else {
        setUnits((prev) =>
          prev
            .map((u) => {
              const idx = orderedIds.indexOf(u.id);
              return idx >= 0 ? { ...u, sortOrder: idx + 1 } : u;
            })
            .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99))
        );
      }
      showToast('Urutan posisi unit sekolah berhasil diperbarui!');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat mengurutkan unit sekolah.', 'error');
      return false;
    }
  };

  // Form Schema
  const updateFormSchema = async (unitId: string, schema: UnitFormSchema): Promise<boolean> => {
    if (!isMasterUser(currentUser) && currentUser?.schoolId !== unitId) {
      showToast(
        `Pelanggaran Batas Unit: Anda (${currentUser?.schoolId}) tidak memiliki izin mengubah formulir unit ${unitId}!`,
        'error'
      );
      addAuditLog(
        'unauthorized_access' as any,
        currentUser?.schoolId || 'MASTER',
        `Upaya ilegal mengubah form schema unit ${unitId} oleh ${currentUser?.email}`
      );
      return false;
    }

    try {
      const res = await apiFetch(`/api/form-schemas/${encodeURIComponent(unitId)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(schema),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Akses ditolak: Gagal menyimpan formulir di server.', 'error');
        return false;
      }

      const savedSchema: UnitFormSchema = await res.json().catch(() => schema);
      setFormSchemas((prev) => {
        const filtered = prev.filter((s) => s.unitId !== unitId);
        return [...filtered, savedSchema].sort((a, b) => {
          const ia = units.findIndex((u) => u.id === a.unitId);
          const ib = units.findIndex((u) => u.id === b.unitId);
          return (ia >= 0 ? ia : 99) - (ib >= 0 ? ib : 99);
        });
      });
      if (isSuperAdmin(currentUser)) refreshTrashItems();
      showToast(`Formulir pendaftaran unit ${unitId} berhasil disimpan permanen`);
      return true;
    } catch (e) {
      showToast('Terjadi kesalahan jaringan saat menyimpan formulir.', 'error');
      return false;
    }
  };

  // Roles & Users
  const addRole = async (roleData: Omit<UserRole, 'id' | 'userCount'>): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/roles', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(roleData),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menyimpan role baru ke database.', 'error');
        return false;
      }
      const created = await res.json();
      setRoles((prev) => [...prev, created]);
      showToast(`Role baru "${roleData.name}" berhasil dibuat`);
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menambahkan role.', 'error');
      return false;
    }
  };

  const updateRole = async (id: string, updates: Partial<UserRole>): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/roles/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menyimpan perubahan role di database.', 'error');
        return false;
      }
      const serverRole = await res.json().catch(() => null);
      const rolePatch = serverRole && serverRole.id ? serverRole : updates;

      let nextRoles: UserRole[] = [];
      setRoles((prev) => {
        nextRoles = prev.map((r) => (r.id === id ? { ...r, ...rolePatch } : r));
        return nextRoles;
      });

      setCurrentUser((curr) => {
        if (!curr) return null;
        const targetRole = nextRoles.find((r) => r.id === id) || (rolePatch.permissions ? rolePatch : null);
        let isMatch = false;
        if (curr.email === 'master@dev.com' || curr.role === 'Super Admin Yayasan') {
          isMatch = id === 'role-master' || Boolean((targetRole as any)?.name?.includes('Super Admin'));
        } else if (curr.email === 'adminyys@dev.com' || curr.role.includes('Admin Yayasan')) {
          isMatch = id === 'role-admin-yys' || Boolean((targetRole as any)?.name?.includes('Admin Yayasan'));
        } else {
          isMatch = curr.role === id || Boolean(targetRole && (targetRole as any).name === curr.role);
        }

        if (isMatch && targetRole && Array.isArray((targetRole as any).permissions)) {
          const updatedUser: AppUser = {
            ...curr,
            permissions: [...(targetRole as any).permissions],
          };
          localStorage.setItem('ppdb_current_user', JSON.stringify(updatedUser));
          return updatedUser;
        }
        return curr;
      });

      setUsers((prev) =>
        prev.map((u) => {
          let isMatch = false;
          if (u.email === 'master@dev.com' || u.role === 'Super Admin Yayasan') {
            isMatch = id === 'role-master' || Boolean(rolePatch.name && rolePatch.name.includes('Super Admin'));
          } else if (u.email === 'adminyys@dev.com' || u.role.includes('Admin Yayasan')) {
            isMatch = id === 'role-admin-yys' || Boolean(rolePatch.name && rolePatch.name.includes('Admin Yayasan'));
          } else {
            isMatch = u.role === id || Boolean(rolePatch.name && u.role === rolePatch.name);
          }
          if (isMatch && rolePatch.permissions) {
            return { ...u, permissions: [...rolePatch.permissions] };
          }
          return u;
        })
      );

      showToast('Perubahan role & izin akses berhasil disimpan');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat memperbarui role.', 'error');
      return false;
    }
  };

  const deleteRole = async (id: string): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/roles/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menghapus role dari database.', 'error');
        return false;
      }
      setRoles((prev) => prev.filter((r) => r.id !== id));
      if (isSuperAdmin(currentUser)) refreshTrashItems();
      showToast('Role dihapus dan dipindahkan ke Sampah Master');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menghapus role.', 'error');
      return false;
    }
  };

  const addUser = async (userData: Omit<AppUser, 'id' | 'lastLogin'>): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(userData),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal mendaftarkan user baru ke database.', 'error');
        return false;
      }
      const created = await res.json();
      setUsers((prev) => [...prev, created]);
      showToast(`Pengguna "${userData.name}" berhasil didaftarkan`);
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menambah pengguna.', 'error');
      return false;
    }
  };

  const updateUser = async (id: string, updates: Partial<AppUser>): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Gagal menyimpan perubahan user di database.', 'error');
        return false;
      }

      const serverUser = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...serverUser } : u)));

      setCurrentUser((curr) => {
        if (curr && (curr.id === id || curr.email === serverUser.email)) {
          const updatedUser = { ...curr, ...serverUser };
          localStorage.setItem('ppdb_current_user', JSON.stringify(updatedUser));
          return updatedUser;
        }
        return curr;
      });

      if (serverUser.name) {
        setStudents((prev) =>
          prev.map((s) => {
            if (
              s.parentUserId === id ||
              s.id === serverUser.studentId ||
              s.registrationNumber === serverUser.studentRegistrationNumber
            ) {
              return { ...s, parentName: serverUser.name, parentPhone: serverUser.phone || s.parentPhone };
            }
            return s;
          })
        );
      }

      showToast('Data pengguna berhasil diperbarui!');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat memperbarui data pengguna.', 'error');
      return false;
    }
  };

  const deleteUser = async (id: string): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menghapus user dari database.', 'error');
        return false;
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
      if (isSuperAdmin(currentUser)) refreshTrashItems();
      showToast('User dihapus dan dipindahkan ke Sampah Master');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menghapus user.', 'error');
      return false;
    }
  };

  const resetUserPassword = async (id: string): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/users/${id}/reset-password`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        showToast(data.error || 'Gagal mengirim tautan reset kata sandi.', 'error');
        return false;
      }
      showToast(data.message || 'Tautan reset kata sandi sekali pakai telah dikirim ke email pengguna.');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat mengirim tautan reset kata sandi.', 'error');
      return false;
    }
  };

  const addAcademicYear = async (yearData: Omit<AcademicYear, 'id' | 'isActive'>): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/academic-years', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(yearData),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menambahkan tahun ajaran ke database.', 'error');
        return false;
      }
      const created = await res.json();
      setAcademicYears((prev) => [created, ...prev]);
      showToast(`Tahun ajaran ${yearData.year} berhasil ditambahkan`);
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menambah tahun ajaran.', 'error');
      return false;
    }
  };

  const activateAcademicYear = async (id: string): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/academic-years/${id}/activate`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal mengaktifkan tahun ajaran di database.', 'error');
        return false;
      }
      setAcademicYears((prev) => prev.map((y) => ({ ...y, isActive: y.id === id })));
      const chosen = academicYears.find((y) => y.id === id);
      showToast(`Tahun ajaran ${chosen?.year || ''} sekarang AKTIF`);
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat mengaktifkan tahun ajaran.', 'error');
      return false;
    }
  };

  const updateLandingConfig = async (config: LandingPageConfig): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/landing-config', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menyimpan pengaturan landing page ke database.', 'error');
        return false;
      }

      const updated = await res.json().catch(() => config);
      setLandingConfig(updated && updated.appName ? updated : config);
      if (isSuperAdmin(currentUser)) refreshTrashItems();
      showToast('Pengaturan landing page berhasil disimpan ke database!');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menyimpan pengaturan landing page.', 'error');
      return false;
    }
  };

  const updateExportConfig = async (config: ExportFieldConfig): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/export-configs', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menyimpan aturan ekspor ke database.', 'error');
        return false;
      }
      const saved = await res.json().catch(() => config);
      setExportConfigs((prev) => {
        const idx = prev.findIndex((c) => c.moduleName === config.moduleName && c.roleId === config.roleId);
        const next = [...prev];
        if (idx >= 0) next[idx] = saved;
        else next.push(saved);
        return next;
      });
      showToast(`Aturan ekspor ${config.moduleName} untuk role ${config.roleId} berhasil disimpan!`);
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menyimpan aturan ekspor.', 'error');
      return false;
    }
  };

  const updateSmtpConfig = async (updates: Partial<SmtpConfig>): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/smtp-config', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menyimpan konfigurasi SMTP ke database.', 'error');
        return false;
      }
      const saved = await res.json();
      setSmtpConfig(saved);
      if (isSuperAdmin(currentUser)) refreshTrashItems();
      showToast('Konfigurasi SMTP Google berhasil disimpan!');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menyimpan konfigurasi SMTP.', 'error');
      return false;
    }
  };

  const testSmtpConnection = async (testRecipient?: string, formOverrides?: { senderEmail?: string; authPassword?: string }) => {
    try {
      const res = await apiFetch('/api/smtp-config/test', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          testRecipient,
          senderEmail: formOverrides?.senderEmail,
          authPassword: formOverrides?.authPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        const msg = data.message || data.error || 'Gagal menguji koneksi SMTP.';
        showToast(msg, 'error');
        return { success: false, message: msg, isAuthError: Boolean(data.isAuthError) };
      }
      showToast(data.message || 'Koneksi SMTP berhasil diverifikasi!');
      return { success: true, message: data.message };
    } catch (err: any) {
      showToast(err.message, 'error');
      return { success: false, message: err.message };
    }
  };

  const updateGroupLink = async (config: GroupLinkConfig): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/group-links', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menyimpan link grup ke database.', 'error');
        return false;
      }
      const saved = await res.json().catch(() => null);
      if (Array.isArray(saved)) {
        setGroupLinks(saved);
      } else {
        setGroupLinks((prev) => {
          const idx = prev.findIndex((g) => g.unitId === config.unitId);
          const next = [...prev];
          if (idx >= 0) next[idx] = config;
          else next.push(config);
          return next;
        });
      }
      showToast(`Link grup ${config.groupName} berhasil diperbarui!`);
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menyimpan link grup.', 'error');
      return false;
    }
  };

  const updateUnitContact = async (config: UnitContactConfig): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/unit-contacts/${config.unitId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menyimpan kontak unit ke database.', 'error');
        return false;
      }
      const saved = await res.json().catch(() => null);
      if (Array.isArray(saved)) {
        setUnitContacts(saved);
      } else {
        setUnitContacts((prev) => {
          const idx = prev.findIndex((c) => c.unitId === config.unitId);
          const next = [...prev];
          if (idx >= 0) next[idx] = config;
          else next.push(config);
          return next;
        });
      }
      showToast(`Kontak informasi unit ${config.unitName} berhasil diperbarui!`, 'success');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menyimpan kontak unit.', 'error');
      return false;
    }
  };

  const updateLetterConfig = async (config: LetterConfig): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/letter-configs/${config.unitId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || 'Gagal menyimpan format surat ke database.', 'error');
        return false;
      }
      const saved = await res.json().catch(() => null);
      if (Array.isArray(saved)) {
        setLetterConfigs(saved);
      } else {
        setLetterConfigs((prev) => {
          const idx = prev.findIndex((l) => l.unitId === config.unitId);
          const next = [...prev];
          if (idx >= 0) next[idx] = config;
          else next.push(config);
          return next;
        });
      }
      showToast(`Format surat & ketua panitia unit ${config.unitName} berhasil diperbarui!`, 'success');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menyimpan format surat.', 'error');
      return false;
    }
  };

  const addBankAccount = async (
    account: Omit<BankAccountConfig, 'id' | 'updatedAt' | 'updatedBy'>
  ): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/bank-accounts', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(account),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json.error || 'Gagal menambahkan rekening bank yayasan.', 'error');
        return false;
      }
      if (Array.isArray(json)) {
        setBankAccounts(json);
      }
      broadcastBankSync();
      showToast(`Rekening ${account.bankCode || account.bankName} berhasil ditambahkan!`, 'success');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menambahkan rekening bank.', 'error');
      return false;
    }
  };

  const updateBankAccount = async (id: string, updates: Partial<BankAccountConfig>): Promise<boolean> => {
    try {
      const existing = bankAccounts.find((b) => b.id === id);
      const payload = existing ? { ...existing, ...updates } : updates;
      const res = await apiFetch(`/api/bank-accounts/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json.error || 'Gagal memperbarui rekening bank yayasan.', 'error');
        return false;
      }
      if (Array.isArray(json)) {
        setBankAccounts(json);
      }
      broadcastBankSync();
      showToast('Rekening bank yayasan berhasil diperbarui!', 'success');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat memperbarui rekening bank.', 'error');
      return false;
    }
  };

  const deleteBankAccount = async (id: string): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/bank-accounts/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json.error || 'Gagal menghapus rekening bank yayasan.', 'error');
        return false;
      }
      if (Array.isArray(json)) {
        setBankAccounts(json);
      }
      broadcastBankSync();
      showToast('Rekening bank yayasan berhasil dihapus.', 'success');
      return true;
    } catch (e) {
      showToast('Gagal terhubung ke server saat menghapus rekening bank.', 'error');
      return false;
    }
  };

  const registerWaliAccount = async (data: { name: string; email: string; phone: string; password: string; turnstileToken?: string }) => {
    try {
      const res = await apiFetch('/api/auth/register-wali', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Pendaftaran akun gagal.' };
      }

      if (json.csrfToken) setCsrfToken(json.csrfToken);
      login(json.user, json.csrfToken);
      setUsers((prev) => [...prev, json.user]);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Gagal terhubung ke server untuk mendaftarkan akun. Pastikan koneksi internet aktif dan coba lagi.' };
    }
  };

  const sendEmailVerificationOtp = async () => {
    try {
      const res = await apiFetch('/api/auth/send-verification-otp', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Gagal mengirim kode OTP.' };
      }
      return {
        success: true,
        message: data.message,
        cooldownSeconds: data.cooldownSeconds || 60,
        sentVia: data.sentVia,
      };
    } catch (e: any) {
      return { success: false, error: 'Gagal terhubung ke server untuk mengirim kode OTP.' };
    }
  };

  const verifyEmailVerificationOtp = async (otp: string) => {
    try {
      const res = await apiFetch('/api/auth/verify-verification-otp', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Kode OTP tidak cocok.' };
      }
      if (data.user) {
        setCurrentUser(data.user);
        localStorage.setItem('ppdb_current_user', JSON.stringify(data.user));
        setUsers((prev) => prev.map((u) => (u.id === data.user.id ? data.user : u)));
      }
      showToast('Alhamdulillah, email Anda berhasil diverifikasi resmi!');
      return { success: true, message: data.message };
    } catch (e: any) {
      return { success: false, error: 'Gagal memverifikasi kode OTP ke server.' };
    }
  };

  const verifyCurrentWaliEmail = async () => {
    try {
      const res = await apiFetch('/api/auth/verify-email', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Gagal memverifikasi email di server.' };
      }
      if (data.user) {
        setCurrentUser(data.user);
        localStorage.setItem('ppdb_current_user', JSON.stringify(data.user));
        setUsers((prev) => prev.map((u) => (u.id === data.user.id ? data.user : u)));
      }
      showToast('Alhamdulillah, email Anda berhasil diverifikasi!');
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Gagal terhubung ke server saat memverifikasi email.' };
    }
  };

  const addOfflineStudent = async (data: Partial<StudentRegistration>): Promise<StudentRegistration> => {
    try {
      const res = await apiFetch('/api/students/offline', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.error || 'Gagal mencatat pendaftaran offline di database.';
        showToast(errMsg, 'error');
        throw new Error(errMsg);
      }
      const created = await res.json();
      setStudents((prev) => [created, ...prev]);
      showToast(`Pendaftar offline an. ${created.fullName} berhasil dicatat ke database!`);
      refreshAllData();
      return created;
    } catch (e: any) {
      const errMsg = e?.message && !e.message.toLowerCase().includes('failed to fetch')
        ? e.message
        : 'Gagal terhubung ke server saat mencatat pendaftaran offline.';
      showToast(errMsg, 'error');
      throw new Error(errMsg);
    }
  };

  const sendRegistrationEmailIfVerified = async (studentId: string) => {
    try {
      const res = await apiFetch('/api/mail/send-card', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ studentId }),
      });
      const data = await res.json();
      return data;
    } catch (e: any) {
      return { sent: false, reason: e.message };
    }
  };

  // Download MySQL Database Dump
  const downloadMySqlDump = async () => {
    try {
      showToast('Memulai pengunduhan skema & data MySQL...');
      const res = await apiFetch('/api/database/sql-dump', {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Gagal mengunduh (Status ${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ppdb_arrisalah_mysql.sql';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      showToast('File SQL MySQL berhasil diunduh!');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengunduh file SQL.', 'error');
    }
  };

  const syncedUnits = React.useMemo(() => {
    const defaultOrder: Record<string, number> = { TK01: 1, SD01: 2, SMP01: 3, SMA01: 4 };
    const isStaffScope = Boolean(currentUser && !isParentUser(currentUser));
    return [...units]
      .sort((a, b) => {
        const oa = typeof a.sortOrder === 'number' && a.sortOrder > 0 ? a.sortOrder : (defaultOrder[a.id] ?? 99);
        const ob = typeof b.sortOrder === 'number' && b.sortOrder > 0 ? b.sortOrder : (defaultOrder[b.id] ?? 99);
        return oa - ob;
      })
      .map((u) => {
        const offlineCount = Math.max(0, Number(u.offlineCount) || 0);
        // Server always computes onlineCount and filledQuota across ALL applicants in DB.
        // Only fall back to local students filter if server didn't provide onlineCount (and user is Master staff).
        const serverOnline = typeof u.onlineCount === 'number' ? u.onlineCount : null;
        const onlineCount =
          serverOnline !== null
            ? serverOnline
            : isStaffScope && isMasterUser(currentUser)
            ? students.filter((s) => s.unit === u.id && !s.isOffline).length
            : Math.max(0, (Number(u.filledQuota) || 0) - offlineCount);
        const filledQuota =
          typeof u.filledQuota === 'number' ? Math.max(u.filledQuota, onlineCount + offlineCount) : onlineCount + offlineCount;
        return {
          ...u,
          onlineCount,
          offlineCount,
          filledQuota,
        };
      });
  }, [units, students, currentUser]);

  return (
    <PPDBContext.Provider
      value={{
        students,
        payments,
        schedules,
        formSchemas,
        roles,
        users,
        academicYears,
        units: syncedUnits,
        landingConfig,
        auditLogs,
        systemStatus,
        exportConfigs,
        smtpConfig,
        groupLinks,
        cloudflareConfig,
        unitContacts,
        letterConfigs,
        bankAccounts,
        trashItems,
        dbStatus,
        activeSchoolId,
        setActiveSchoolId,
        currentUser,
        setCurrentUser,
        login,
        logout,
        loginModalOpen,
        setLoginModalOpen,
        loginModalTab,
        setLoginModalTab,
        openLoginModal,
        registerWizardOpen,
        setRegisterWizardOpen,
        pendingRegisterUnit,
        setPendingRegisterUnit,
        desktopActiveMenu,
        setDesktopActiveMenu,
        mobileActiveTab,
        setMobileActiveTab,
        activeView,
        setActiveView,
        addStudent,
        updateStudent,
        deleteStudent,
        verifyStudentDocument,
        setStudentTestResult,
        verifyPayment,
        updatePaymentAmount,
        verifyPaymentGroup,
        addPaymentProof,
        refreshPayments,
        addSchedule,
        updateSchedule,
        deleteSchedule,
        createUnit,
        updateUnitQuotaFee,
        updateUnitOfflineCount,
        updateUnitRegistrationStatus,
        reorderUnits,
        updateFormSchema,
        refreshFormSchemas,
        refreshSchedules,
        refreshStudentById,
        addRole,
        updateRole,
        deleteRole,
        addUser,
        updateUser,
        deleteUser,
        resetUserPassword,
        addAcademicYear,
        activateAcademicYear,
        updateLandingConfig,
        updateExportConfig,
        updateSmtpConfig,
        testSmtpConnection,
        updateGroupLink,
        updateUnitContact,
        updateLetterConfig,
        addBankAccount,
        updateBankAccount,
        deleteBankAccount,
        refreshBankAccounts,

        registerWaliAccount,
        sendEmailVerificationOtp,
        verifyEmailVerificationOtp,
        verifyCurrentWaliEmail,
        addOfflineStudent,
        sendRegistrationEmailIfVerified,
        addAuditLog,
        refreshAllData,
        refreshTrashItems,
        restoreTrashItem,
        permanentlyDeleteTrashItem,
        emptyTrash,
        downloadMySqlDump,
        toasts,
        showToast,
        removeToast,
      }}
    >
      {children}
    </PPDBContext.Provider>
  );
};

export const usePPDB = () => {
  const context = useContext(PPDBContext);
  if (!context) {
    throw new Error('usePPDB must be used within a PPDBProvider');
  }
  return context;
};
