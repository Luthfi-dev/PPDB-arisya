export type SchoolId = string;

export type RegistrationStatus = 'verifikasi' | 'tes' | 'lulus' | 'tidak_lulus' | 'terdaftar';

export type PaymentStatus = 'pending' | 'verifikasi' | 'lunas' | 'ditolak';

export type PaymentType = 'Formulir' | 'Daftar Ulang';

export interface StudentRegistration {
  id: string;
  registrationNumber: string;
  parentUserId?: string; // Foreign Key relation to users(id)
  fullName: string;
  nisn?: string;
  unit: string;
  gender: 'Laki-laki' | 'Perempuan';
  birthPlace: string;
  birthDate: string;
  address: string;
  parentName: string;
  parentPhone: string;
  parentJob: string;
  parentIncome: string;
  schoolOrigin?: string;
  status: RegistrationStatus;
  registeredAt: string;
  documents: Record<string, string>; // Dynamic uploaded documents map per unit schema
  dynamicAnswers?: Record<string, string>; // Dynamic form builder section field responses
  verificationNotes?: string;
  testScore?: number;
  testScheduleId?: string;
  testPublished?: boolean;
  avatarUrl?: string;
  isOffline?: boolean;
  track?: string;
}

export interface PaymentRecord {
  id: string;
  registrationId: string;
  registrationNumber: string;
  studentName: string;
  unit: string;
  type: PaymentType;
  amount: number;
  status: PaymentStatus;
  date: string;
  proofUrl: string;
  verifiedBy?: string;
  verificationNotes?: string;
  bankAccount: string;
  receiptSig?: string;
}

export interface TestSchedule {
  id: string;
  title: string;
  unit: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  examiner: string;
  quota: number;
  filled: number;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'dropdown' | 'file' | 'textarea';
  required: boolean;
  helpText?: string;
  options?: string[]; // for dropdown
  fileConfig?: {
    allowedTypes: string[];
    maxSizeMB: number;
  };
  systemKey?: 'fullName';
  locked?: boolean;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

export interface UnitFormSchema {
  unitId: string;
  sections: FormSection[];
}

export interface UserRole {
  id: string;
  name: string;
  schoolId: SchoolId;
  permissions: string[];
  description: string;
  userCount: number;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  schoolId: SchoolId;
  role: string;
  permissions: string[];
  isActive: boolean;
  lastLogin: string;
  studentId?: string;
  studentRegistrationNumber?: string;
  emailVerified?: boolean;
  childrenIds?: string[];
}

export interface AcademicYear {
  id: string;
  year: string; // e.g. "2025/2026"
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface UnitQuotaFee {
  id: string;
  name: string;
  shortName: string;
  totalQuota: number;
  filledQuota: number;
  onlineCount?: number;
  offlineCount?: number;
  formFee: number;
  reRegFee: number;
  facilities: string[];
  isOpen?: boolean;
  closedNotice?: string;
  sortOrder?: number;
}

export interface HeroSlide {
  id: string;
  imageUrl: string;
  upperPoints: string[];
  title: string;
  subtitle: string;
  icon?: string;
  buttonText?: string;
  buttonLink?: string;
}

export interface LandingPageConfig {
  appName: string;
  appTagline?: string;
  heroTitle: string;
  heroSubtitle: string;
  statsTotal: number;
  heroSlides?: HeroSlide[];
  flowSteps: {
    step: number;
    title: string;
    description: string;
  }[];
  requirements: string[];
  contact: {
    email: string;
    phone: string;
    whatsapp: string;
    address: string;
    instagram: string;
  };
  helpTitle?: string;
  helpSubtitle?: string;
  logoUrl?: string;
  faviconUrl?: string;
  customLogoBase64?: string;
  customFaviconBase64?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  author?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  jsonLdType?: string;
  structuredDataJson?: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  userEmail: string;
  action:
    | 'login'
    | 'logout'
    | 'create_pendaftar'
    | 'verifikasi'
    | 'block_akses'
    | 'update_status'
    | 'export_data'
    | 'update_kuota'
    | 'tambah_jadwal'
    | 'export_config'
    | 'smtp_config'
    | 'offline_register'
    | 'verify_email'
    | 'send_otp';
  schoolId: SchoolId;
  details: string;
  ipAddress: string;
  prevHash?: string;
  entryHash?: string;
}

export interface SystemStatusConfig {
  databaseConnected: boolean;
  csrfActive: boolean;
  sessionDuration: string;
  rateLimit: string;
  auditLogActive: boolean;
  securityHeadersActive: boolean;
  lastBackup: string;
}

export interface ExportFieldConfig {
  id: string;
  moduleName: string;
  roleId: string; // 'ALL' for Default Umum or specific role name
  allowedHeaders: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface SmtpAccount {
  id: string;
  senderEmail: string;
  senderName: string;
  authPassword?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  isActive: boolean;
  priority?: number; // 1 = utama, 2 = cadangan 1, etc.
  lastTested?: string;
  isVerified?: boolean;
}

export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  senderEmail: string;
  senderName: string;
  authPassword?: string;
  isVerified?: boolean;
  lastTested?: string;
  accounts?: SmtpAccount[]; // Multi-account failover / rotasi akun SMTP
}

export interface GroupLinkConfig {
  unitId: string;
  groupUrl: string;
  groupName: string;
  visibilityRule: 'always' | 'after_data' | 'after_payment';
}

export interface CloudflareConfig {
  enabled: boolean;
  siteKey: string;
  secretKey: string;
  mode: 'managed' | 'non-interactive' | 'invisible';
  appearance: 'always' | 'execute' | 'interaction-only';
  updatedAt?: string;
  updatedBy?: string;
}

export interface UnitContactConfig {
  unitId: SchoolId;
  unitName: string;
  contactPerson: string;
  phone: string;
  whatsapp: string;
  email: string;
  officeHours: string;
  address: string;
  notes?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface LetterCardFieldConfig {
  fieldId: string;
  label: string;
  sectionTitle?: string;
}

export interface LetterConfig {
  unitId: SchoolId;
  unitName: string;
  committeeChairName: string;
  committeeChairNip?: string;
  committeeRoleTitle?: string;
  letterHeaderTitle?: string;
  cardTitle?: string;
  issueLocation?: string;
  issueDate?: string;
  examInstructions?: string[];
  stampNote?: string;
  cardFields?: LetterCardFieldConfig[];
  updatedAt?: string;
  updatedBy?: string;
}

export interface BankAccountConfig {
  id: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  branch?: string;
  notes?: string;
  isActive: boolean;
  isPrimary?: boolean;
  sortOrder?: number;
  updatedAt?: string;
  updatedBy?: string;
}

export type TrashEntityType =
  | 'student'
  | 'schedule'
  | 'user'
  | 'role'
  | 'form_section'
  | 'form_field'
  | 'landing_slide'
  | 'landing_step'
  | 'landing_requirement'
  | 'smtp_account';

export interface TrashItem {
  id: string;
  entityType: TrashEntityType;
  entityId: string;
  unitId: SchoolId | 'MASTER' | string;
  title: string;
  subtitle?: string;
  deletedAt: string;
  deletedBy: string;
  deletedByRole?: string;
  snapshot: any;
}
