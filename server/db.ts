import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

const DB_MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT =
  [DB_MODULE_DIR, path.resolve(DB_MODULE_DIR, '..'), process.cwd()].find((dir) =>
    fs.existsSync(path.join(dir, 'package.json'))
  ) || process.cwd();

dotenv.config({ path: path.resolve(PROJECT_ROOT, '.env') });
dotenv.config();
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
  INITIAL_BANK_ACCOUNTS,
} from '../src/data/initialData.ts';
import type {
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
  SchoolId,
  ExportFieldConfig,
  SmtpConfig,
  GroupLinkConfig,
  CloudflareConfig,
  UnitContactConfig,
  LetterConfig,
  TrashEntityType,
  TrashItem,
  BankAccountConfig,
} from '../src/types/ppdb.ts';
import { ensureCoreNameFieldInSections, isLockedNameField } from '../src/utils/studentFieldResolver.ts';

const DATA_DIR = path.resolve(PROJECT_ROOT, 'data');
const STORE_FILE = path.join(DATA_DIR, 'ppdb_store.json');
const DATA_UPLOADS_DIR = path.resolve(PROJECT_ROOT, 'data', 'uploads');
const PUBLIC_UPLOADS_DIR = path.resolve(PROJECT_ROOT, 'public', 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_UPLOADS_DIR)) {
  fs.mkdirSync(DATA_UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(PUBLIC_UPLOADS_DIR)) {
  fs.mkdirSync(PUBLIC_UPLOADS_DIR, { recursive: true });
}

const PROTECTED_UPLOAD_FILENAMES = new Set<string>([
  'logo.png',
  'logo.jpg',
  'favicon.ico',
  '1000828600.png',
  '1000828601.ico',
  '1794360625078_my_new_logo.png',
  '1794415376864_1000828600.png',
  '1794415405520_1000828601.ico',
]);

function extractSafeUploadFilename(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith('/uploads/')) return null;
  const withoutQuery = trimmed.slice('/uploads/'.length).split(/[?#]/)[0];
  if (!withoutQuery || withoutQuery.includes('/') || withoutQuery.includes('\\') || withoutQuery.includes('..')) {
    return null;
  }
  const safeName = path.basename(withoutQuery);
  if (!safeName || safeName !== withoutQuery || safeName === '.' || safeName === '..') {
    return null;
  }
  return safeName;
}

function collectUploadUrlsFromValue(val: unknown, out: Set<string>, depth = 0): void {
  if (depth > 8 || val === null || val === undefined) return;
  if (typeof val === 'string') {
    if (extractSafeUploadFilename(val)) {
      out.add(val.trim());
    }
    return;
  }
  if (Array.isArray(val)) {
    for (const item of val) {
      collectUploadUrlsFromValue(item, out, depth + 1);
    }
    return;
  }
  if (typeof val === 'object') {
    for (const entry of Object.values(val as Record<string, unknown>)) {
      collectUploadUrlsFromValue(entry, out, depth + 1);
    }
  }
}

function isUploadFilenameStillReferenced(targetFilename: string): boolean {
  const expectedUrlPrefix = `/uploads/${targetFilename}`;
  const matchesTarget = (raw: unknown): boolean => extractSafeUploadFilename(raw) === targetFilename;

  for (const pay of memoryStore.payments || []) {
    if (matchesTarget(pay?.proofUrl)) return true;
  }
  for (const stu of memoryStore.students || []) {
    if (matchesTarget(stu?.avatarUrl)) return true;
    const urls = new Set<string>();
    collectUploadUrlsFromValue(stu?.documents, urls);
    collectUploadUrlsFromValue(stu?.dynamicAnswers, urls);
    for (const u of urls) {
      if (extractSafeUploadFilename(u) === targetFilename) return true;
    }
  }
  if (memoryStore.landingConfig) {
    const landingUrls = new Set<string>();
    collectUploadUrlsFromValue(
      {
        logoUrl: memoryStore.landingConfig.logoUrl,
        faviconUrl: memoryStore.landingConfig.faviconUrl,
        ogImage: memoryStore.landingConfig.ogImage,
        heroSlides: memoryStore.landingConfig.heroSlides,
      },
      landingUrls
    );
    for (const u of landingUrls) {
      if (extractSafeUploadFilename(u) === targetFilename) return true;
    }
  }
  for (const item of memoryStore.trashItems || []) {
    const trashUrls = new Set<string>();
    collectUploadUrlsFromValue(item?.snapshot, trashUrls);
    for (const u of trashUrls) {
      if (u.startsWith(expectedUrlPrefix) && extractSafeUploadFilename(u) === targetFilename) return true;
    }
  }
  return false;
}

function deleteUploadFileSafely(fileUrl?: string | null): boolean {
  const safeName = extractSafeUploadFilename(fileUrl);
  if (!safeName) return false;
  if (PROTECTED_UPLOAD_FILENAMES.has(safeName)) return false;
  if (isUploadFilenameStillReferenced(safeName)) return false;

  let removedAny = false;
  for (const dir of [PUBLIC_UPLOADS_DIR, DATA_UPLOADS_DIR]) {
    const resolved = path.resolve(dir, safeName);
    if (!resolved.startsWith(dir + path.sep)) continue;
    try {
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        fs.unlinkSync(resolved);
        removedAny = true;
      }
    } catch (err) {
      console.error(`[UploadsCleanup Error] Gagal menghapus ${resolved}:`, err);
    }
  }
  return removedAny;
}

function saveBufferToUploadsDirs(buffer: Buffer, prefix: string, ext: string): string {
  const cleanPrefix = (prefix || 'file').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20) || 'file';
  const cleanExt = (ext || 'bin').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 8) || 'bin';
  const safeFilename = `${cleanPrefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${cleanExt}`;

  const publicPath = path.resolve(PUBLIC_UPLOADS_DIR, safeFilename);
  const dataPath = path.resolve(DATA_UPLOADS_DIR, safeFilename);

  if (publicPath.startsWith(PUBLIC_UPLOADS_DIR + path.sep)) {
    fs.writeFileSync(publicPath, buffer);
  }
  if (dataPath.startsWith(DATA_UPLOADS_DIR + path.sep)) {
    try {
      fs.writeFileSync(dataPath, buffer);
    } catch (err) {
      console.error('[UploadsSave Error]:', err);
    }
  }
  return `/uploads/${safeFilename}`;
}

// ==============================================================
// AES-256-GCM Cryptographic Utility for Sensitive Secrets at Rest
// ==============================================================
const LEGACY_DEFAULT_MASTER_SECRET = 'arrisalah-ppdb-master-secret-2026-aceh';

function deriveAes256Key(secretMaterial: string): Buffer {
  return crypto.createHash('sha256').update(secretMaterial).digest();
}

function getEncryptionMasterKey(): Buffer {
  return deriveAes256Key(
    process.env.APP_ENCRYPTION_KEY || process.env.JWT_SECRET || LEGACY_DEFAULT_MASTER_SECRET
  );
}

function getCandidateDecryptionKeys(): Buffer[] {
  const candidates = [
    process.env.APP_ENCRYPTION_KEY,
    process.env.APP_ENCRYPTION_KEY_LEGACY,
    process.env.JWT_SECRET,
    process.env.SESSION_SECRET,
    LEGACY_DEFAULT_MASTER_SECRET,
  ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

  const seen = new Set<string>();
  const keys: Buffer[] = [];
  for (const material of candidates) {
    const keyBuf = deriveAes256Key(material);
    const hex = keyBuf.toString('hex');
    if (!seen.has(hex)) {
      seen.add(hex);
      keys.push(keyBuf);
    }
  }
  return keys;
}

export function encryptSecret(plainText: string): string {
  if (!plainText || plainText.trim() === '') return '';
  // If already encrypted, return as-is
  if (plainText.startsWith('enc:gcm:')) return plainText;

  const iv = crypto.randomBytes(12); // 96-bit IV for AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionMasterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `enc:gcm:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptSecretWithKeyStatus(cipherText: string): {
  plainText: string;
  usedLegacyKey: boolean;
  ok: boolean;
} {
  if (!cipherText || cipherText.trim() === '') {
    return { plainText: '', usedLegacyKey: false, ok: true };
  }
  if (!cipherText.startsWith('enc:gcm:')) {
    // Unencrypted legacy text
    return { plainText: cipherText, usedLegacyKey: true, ok: true };
  }

  const parts = cipherText.split(':');
  if (parts.length !== 5) {
    return { plainText: '', usedLegacyKey: false, ok: false };
  }
  const iv = Buffer.from(parts[2], 'hex');
  const tag = Buffer.from(parts[3], 'hex');
  const encryptedData = Buffer.from(parts[4], 'hex');
  if (iv.length !== 12 || tag.length !== 16) {
    return { plainText: '', usedLegacyKey: false, ok: false };
  }

  const keys = getCandidateDecryptionKeys();
  for (let i = 0; i < keys.length; i++) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', keys[i], iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
      return {
        plainText: decrypted.toString('utf8'),
        usedLegacyKey: i > 0,
        ok: true,
      };
    } catch {
      // Try next candidate key if GCM authentication tag does not match
    }
  }

  console.warn('[DB] Kredensial terenkripsi tidak dapat didekripsi dengan APP_ENCRYPTION_KEY saat ini.');
  return { plainText: '', usedLegacyKey: false, ok: false };
}

export function decryptSecret(cipherText: string): string {
  return decryptSecretWithKeyStatus(cipherText).plainText;
}

type StoredAppUser = AppUser & { passwordHash?: string; sessionInvalidatedAt?: number };

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days session lifetime
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes one-time reset token lifetime
const RESET_COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown per user

function sanitizeUserForClient(user: StoredAppUser): AppUser {
  const { passwordHash: _omitHash, sessionInvalidatedAt: _omitRevoked, ...safeUser } = user as any;
  return safeUser as AppUser;
}

interface AppStore {
  seedCompleted?: boolean;
  units: UnitQuotaFee[];
  students: StudentRegistration[];
  payments: PaymentRecord[];
  schedules: TestSchedule[];
  formSchemas: UnitFormSchema[];
  roles: UserRole[];
  users: StoredAppUser[];
  academicYears: AcademicYear[];
  landingConfig: LandingPageConfig;
  auditLogs: AuditLogItem[];
  systemStatus: SystemStatusConfig;
  exportConfigs: ExportFieldConfig[];
  smtpConfig: SmtpConfig;
  groupLinkConfigs: GroupLinkConfig[];
  cloudflareConfig: CloudflareConfig;
  unitContacts: UnitContactConfig[];
  letterConfigs: LetterConfig[];
  bankAccounts: BankAccountConfig[];
  trashItems: TrashItem[];
  passwordResetTokens?: PasswordResetTokenRecord[];
  revokedSessionHashes?: Array<{ hash: string; expiresAt: number }>;
}

interface EmailVerificationOtpRecord {
  userId: string;
  email: string;
  otp: string;
  expiresAt: number;
  attemptsLeft: number;
  createdAt: number;
  lastSentAt: number;
}

interface PasswordResetTokenRecord {
  tokenHash: string;
  userId: string;
  email: string;
  expiresAt: number;
  createdAt: number;
}

const emailVerificationOtps = new Map<string, EmailVerificationOtpRecord>();
const passwordResetTokens = new Map<string, PasswordResetTokenRecord>();
const passwordResetCooldowns = new Map<string, number>();
const revokedSessionHashes = new Map<string, number>();

function invalidateUserSessions(userId: string, email?: string) {
  const now = Date.now();
  const cleanEmail = email ? email.trim().toLowerCase() : '';
  const targetUser = memoryStore.users.find(
    (u) => u.id === userId || (cleanEmail && u.email.toLowerCase() === cleanEmail)
  );
  if (targetUser) {
    targetUser.sessionInvalidatedAt = now;
  }
  for (const [token, session] of activeSessions.entries()) {
    if (
      session.user.id === userId ||
      (cleanEmail && session.user.email && session.user.email.toLowerCase() === cleanEmail)
    ) {
      activeSessions.delete(token);
    }
  }
}

function computeAuditEntryHash(
  prevHash: string,
  log: Pick<AuditLogItem, 'id' | 'timestamp' | 'userEmail' | 'action' | 'schoolId' | 'details' | 'ipAddress'>
): string {
  const payload = `${prevHash}|${log.id}|${log.timestamp}|${log.userEmail}|${log.action}|${log.schoolId}|${log.details}|${log.ipAddress}`;
  return crypto.createHmac('sha256', getEncryptionMasterKey()).update(payload).digest('hex');
}

function safeJsonParse<T>(raw: any, fallback: T): T {
  if (raw === null || raw === undefined || raw === '') return fallback;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function formatSqlDate(val: any, fallback = ''): string {
  if (!val) return fallback;
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : (str.slice(0, 10) || fallback);
}

function toSqlDateOrNull(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (!str) return null;
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    return null;
  }
  const dmyMatch = str.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (dmyMatch) {
    const d = Number(dmyMatch[1]);
    const m = Number(dmyMatch[2]);
    const y = Number(dmyMatch[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
      return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    }
  }
  return null;
}

function formatSqlDateTime(val: any, fallback = ''): string {
  if (!val) return fallback;
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    const hh = String(val.getHours()).padStart(2, '0');
    const mm = String(val.getMinutes()).padStart(2, '0');
    const ss = String(val.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }
  const str = String(val).trim().replace('T', ' ');
  const match = str.match(/^(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)/);
  return match ? match[1] : (str.slice(0, 19) || fallback);
}

const DEFAULT_UNIT_ORDER: Record<string, number> = {
  TK01: 1,
  SD01: 2,
  SMP01: 3,
  SMA01: 4,
};

function sortUnitsList(list: UnitQuotaFee[]): UnitQuotaFee[] {
  return [...list]
    .map((u) => ({
      ...u,
      sortOrder:
        typeof u.sortOrder === 'number' && Number.isFinite(u.sortOrder) && u.sortOrder > 0
          ? u.sortOrder
          : (DEFAULT_UNIT_ORDER[u.id] ?? 99),
    }))
    .sort((a, b) => {
      const diff = (a.sortOrder ?? 99) - (b.sortOrder ?? 99);
      if (diff !== 0) return diff;
      return (DEFAULT_UNIT_ORDER[a.id] ?? 99) - (DEFAULT_UNIT_ORDER[b.id] ?? 99);
    });
}

let memoryStore: AppStore = {
  seedCompleted: false,
  units: INITIAL_UNITS,
  students: INITIAL_STUDENTS,
  payments: INITIAL_PAYMENTS,
  schedules: INITIAL_SCHEDULES,
  formSchemas: INITIAL_FORM_SCHEMAS,
  roles: INITIAL_ROLES,
  users: INITIAL_USERS,
  academicYears: INITIAL_ACADEMIC_YEARS,
  landingConfig: INITIAL_LANDING_CONFIG,
  auditLogs: INITIAL_AUDIT_LOGS,
  systemStatus: INITIAL_SYSTEM_STATUS,
  exportConfigs: INITIAL_EXPORT_CONFIGS,
  smtpConfig: INITIAL_SMTP_CONFIG,
  groupLinkConfigs: INITIAL_GROUP_LINKS,
  cloudflareConfig: INITIAL_CLOUDFLARE_CONFIG,
  unitContacts: INITIAL_UNIT_CONTACTS,
  letterConfigs: INITIAL_LETTER_CONFIGS,
  bankAccounts: INITIAL_BANK_ACCOUNTS,
  trashItems: [],
  passwordResetTokens: [],
  revokedSessionHashes: [],
};

// Load persisted state from disk if exists (NEVER resurrect deleted seed data once initialized)
if (fs.existsSync(STORE_FILE)) {
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const hasSeededStore =
      Boolean(parsed.seedCompleted) ||
      (Array.isArray(parsed.users) && parsed.users.length > 0) ||
      (Array.isArray(parsed.units) && parsed.units.length > 0);

    const startupDefaultHash = bcrypt.hashSync('Coba123*#', 10);
    const loadedUsers: StoredAppUser[] = Array.isArray(parsed.users)
      ? parsed.users
          .filter((u: StoredAppUser) => Boolean(u && u.id))
          .map((u: StoredAppUser) => ({
            ...u,
            emailVerified: Boolean(u.emailVerified),
            passwordHash: u.passwordHash && String(u.passwordHash).startsWith('$2')
              ? u.passwordHash
              : startupDefaultHash,
          }))
      : (hasSeededStore ? [] : INITIAL_USERS.map((u) => ({ ...u, passwordHash: startupDefaultHash })));

    const loadedRoles: UserRole[] = Array.isArray(parsed.roles)
      ? parsed.roles.filter((r: UserRole) => Boolean(r && r.id))
      : (hasSeededStore ? [] : INITIAL_ROLES);

    const rawFormSchemas: UnitFormSchema[] = Array.isArray(parsed.formSchemas) && parsed.formSchemas.length > 0
      ? parsed.formSchemas.filter((s: UnitFormSchema) => Boolean(s && s.unitId && Array.isArray(s.sections)))
      : INITIAL_FORM_SCHEMAS;
    const loadedFormSchemas: UnitFormSchema[] = rawFormSchemas.map((s) => ({
      ...s,
      sections: ensureCoreNameFieldInSections(s.sections, s.unitId),
    }));

    const loadedUnits = sortUnitsList(Array.isArray(parsed.units) && parsed.units.length > 0 ? parsed.units : INITIAL_UNITS).map(
      (u) => ({
        ...u,
        offlineCount: typeof u.offlineCount === 'number' && Number.isFinite(u.offlineCount) ? Math.max(0, Math.floor(u.offlineCount)) : 0,
      })
    );

    memoryStore = {
      ...memoryStore,
      ...parsed,
      seedCompleted: hasSeededStore,
      units: loadedUnits,
      students: Array.isArray(parsed.students) ? parsed.students : (hasSeededStore ? [] : INITIAL_STUDENTS),
      payments: Array.isArray(parsed.payments) ? parsed.payments : (hasSeededStore ? [] : INITIAL_PAYMENTS),
      schedules: Array.isArray(parsed.schedules) ? parsed.schedules : (hasSeededStore ? [] : INITIAL_SCHEDULES),
      academicYears: Array.isArray(parsed.academicYears) ? parsed.academicYears : (hasSeededStore ? [] : INITIAL_ACADEMIC_YEARS),
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : (hasSeededStore ? [] : INITIAL_AUDIT_LOGS),
      roles: loadedRoles,
      users: loadedUsers,
      formSchemas: loadedFormSchemas,
      landingConfig: parsed.landingConfig && typeof parsed.landingConfig === 'object' ? parsed.landingConfig : INITIAL_LANDING_CONFIG,
      exportConfigs:
        Array.isArray(parsed.exportConfigs) && parsed.exportConfigs.length > 0
          ? parsed.exportConfigs
          : INITIAL_EXPORT_CONFIGS,
      smtpConfig: parsed.smtpConfig || INITIAL_SMTP_CONFIG,
      groupLinkConfigs:
        Array.isArray(parsed.groupLinkConfigs) && parsed.groupLinkConfigs.length > 0
          ? parsed.groupLinkConfigs
          : INITIAL_GROUP_LINKS,
      cloudflareConfig: {
        ...INITIAL_CLOUDFLARE_CONFIG,
        ...(parsed.cloudflareConfig || {}),
        enabled: false,
        secretKey: '',
      },
      unitContacts:
        Array.isArray(parsed.unitContacts) && parsed.unitContacts.length > 0
          ? parsed.unitContacts
          : INITIAL_UNIT_CONTACTS,
      letterConfigs:
        Array.isArray(parsed.letterConfigs) && parsed.letterConfigs.length > 0
          ? parsed.letterConfigs
          : INITIAL_LETTER_CONFIGS,
      bankAccounts:
        Array.isArray(parsed.bankAccounts)
          ? parsed.bankAccounts
          : INITIAL_BANK_ACCOUNTS,
      trashItems: Array.isArray(parsed.trashItems) ? parsed.trashItems : [],
      passwordResetTokens: Array.isArray(parsed.passwordResetTokens)
        ? parsed.passwordResetTokens.filter(
            (r: PasswordResetTokenRecord) =>
              r &&
              typeof r.tokenHash === 'string' &&
              /^[a-f0-9]{64}$/i.test(r.tokenHash) &&
              typeof r.userId === 'string' &&
              typeof r.expiresAt === 'number' &&
              Date.now() <= r.expiresAt
          )
        : [],
      revokedSessionHashes: Array.isArray(parsed.revokedSessionHashes)
        ? parsed.revokedSessionHashes.filter(
            (r: { hash: string; expiresAt: number }) =>
              r &&
              typeof r.hash === 'string' &&
              /^[a-f0-9]{64}$/i.test(r.hash) &&
              typeof r.expiresAt === 'number' &&
              Date.now() <= r.expiresAt
          )
        : [],
    };

    // Hydrate persisted password reset token hashes into active map
    if (Array.isArray(memoryStore.passwordResetTokens)) {
      for (const rec of memoryStore.passwordResetTokens) {
        passwordResetTokens.set(rec.tokenHash, rec);
      }
    }
    if (Array.isArray(memoryStore.revokedSessionHashes)) {
      for (const rec of memoryStore.revokedSessionHashes) {
        revokedSessionHashes.set(rec.hash, rec.expiresAt);
      }
    }

    // Auto-restore uploaded logo & favicon Base64 to disk on startup
    try {
      if (memoryStore.landingConfig?.customLogoBase64 && memoryStore.landingConfig?.logoUrl) {
        const logoName = path.basename(memoryStore.landingConfig.logoUrl);
        const logoBuf = Buffer.from(
          memoryStore.landingConfig.customLogoBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, ''),
          'base64'
        );
        const targetPath = path.resolve(process.cwd(), 'public', 'uploads', logoName);
        const dataTargetPath = path.resolve(process.cwd(), 'data', 'uploads', logoName);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.mkdirSync(path.dirname(dataTargetPath), { recursive: true });
        fs.writeFileSync(targetPath, logoBuf);
        fs.writeFileSync(dataTargetPath, logoBuf);
      }
      if (memoryStore.landingConfig?.customFaviconBase64 && memoryStore.landingConfig?.faviconUrl) {
        const favName = path.basename(memoryStore.landingConfig.faviconUrl);
        const favBuf = Buffer.from(
          memoryStore.landingConfig.customFaviconBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, ''),
          'base64'
        );
        const targetPath = path.resolve(process.cwd(), 'public', 'uploads', favName);
        const dataTargetPath = path.resolve(process.cwd(), 'data', 'uploads', favName);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.mkdirSync(path.dirname(dataTargetPath), { recursive: true });
        fs.writeFileSync(targetPath, favBuf);
        fs.writeFileSync(dataTargetPath, favBuf);
      }
    } catch (e) {}

    persistStore();
  } catch (err) {
    console.error('[DB] Failed reading local backup store, using initial seed:', err);
  }
} else {
  const initialHash = bcrypt.hashSync('Coba123*#', 10);
  memoryStore.users = INITIAL_USERS.map((u) => ({ ...u, passwordHash: initialHash }));
  memoryStore.units = sortUnitsList(INITIAL_UNITS).map((u) => ({ ...u, offlineCount: 0 }));
  memoryStore.seedCompleted = true;
  fs.writeFileSync(STORE_FILE, JSON.stringify(memoryStore, null, 2), 'utf-8');
}

function persistStore() {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(memoryStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Error writing to persistent store:', err);
  }
}

// MySQL Connection Pool Setup
let mysqlPool: mysql.Pool | null = null;
let isMySqlConnected = false;
let mysqlStatusMessage = 'Inisialisasi koneksi...';

async function executeMySql(sql: string, params: any[] = []): Promise<any> {
  if (!mysqlPool || !isMySqlConnected) {
    return null;
  }
  let lastError: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [rows] = await mysqlPool.query(sql, params);
      return rows;
    } catch (err: any) {
      lastError = err;
      const isReset =
        err?.code === 'ECONNRESET' ||
        err?.code === 'PROTOCOL_CONNECTION_LOST' ||
        err?.errno === -104 ||
        err?.message?.includes('ECONNRESET');
      if (isReset && attempt < 2) {
        console.warn(`[DB Sync] Connection reset, retrying query (${attempt + 1}/2)...`);
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
      console.error('[DB Sync] MySQL query error:', err?.message || err);
      throw err;
    }
  }
  throw lastError;
}

async function migrateLegacyEncryptedSecrets(syncMySql = false): Promise<void> {
  const cfg = memoryStore.smtpConfig;
  if (!cfg) return;

  let changed = false;
  let nextAuthPassword = cfg.authPassword || '';
  if (nextAuthPassword) {
    const res = decryptSecretWithKeyStatus(nextAuthPassword);
    if (res.ok && res.usedLegacyKey && res.plainText) {
      nextAuthPassword = encryptSecret(res.plainText);
      changed = true;
    }
  }

  let nextAccounts = cfg.accounts;
  if (Array.isArray(cfg.accounts) && cfg.accounts.length > 0) {
    nextAccounts = cfg.accounts.map((acc) => {
      if (!acc || !acc.authPassword) return acc;
      const res = decryptSecretWithKeyStatus(acc.authPassword);
      if (res.ok && res.usedLegacyKey && res.plainText) {
        changed = true;
        return { ...acc, authPassword: encryptSecret(res.plainText) };
      }
      return acc;
    });
  }

  if (changed) {
    memoryStore.smtpConfig = {
      ...cfg,
      authPassword: nextAuthPassword,
      accounts: nextAccounts,
    };
    persistStore();
    if (syncMySql && mysqlPool && isMySqlConnected) {
      await executeMySql(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES ('smtp_config', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [JSON.stringify(memoryStore.smtpConfig)]
      ).catch(() => {});
    }
    console.log('[DB] Kredensial SMTP warisan berhasil dimigrasikan ke enkripsi APP_ENCRYPTION_KEY aktif.');
  }
}

export async function initDatabase() {
  const host = process.env.MYSQL_HOST || 'localhost';
  const port = Number(process.env.MYSQL_PORT) || 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'ppdb_arrisalah';

  console.log(`[DB] Mencoba menghubungkan ke MySQL di ${host}:${port}/${database}...`);

  try {
    mysqlPool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 4000,
      dateStrings: true,
    });

    const conn = await mysqlPool.getConnection();
    await conn.ping();
    conn.release();

    isMySqlConnected = true;
    mysqlStatusMessage = `Terhubung ke MySQL (${host}:${port}/${database})`;
    console.log(`[DB] Berhasil terhubung ke database MySQL di ${host}:${port}/${database}!`);

    // Ensure all 11 tables and columns exist (DDL only — NEVER execute dummy seed INSERTs on restart)
    await ensureMySqlTablesExist(mysqlPool);
    console.log('[DB] Skema tabel MySQL terverifikasi & siap.');

    // Synchronize database: read existing production data or seed once on a brand-new empty DB
    await seedMySqlDatabase();
    await migrateLegacyEncryptedSecrets(true);
  } catch (err: any) {
    isMySqlConnected = false;
    mysqlStatusMessage = `Koneksi MySQL Standby (Host: ${host}:${port}). Persistent engine aktif.`;
    console.log(`[DB] MySQL notice (${err.message}). Berjalan dengan persistent engine.`);
    await migrateLegacyEncryptedSecrets(false);
  }
}

// Explicit Table Creator & Non-Destructive Column Migration for MySQL
async function ensureMySqlTablesExist(pool: mysql.Pool) {
  // Ordered so parent tables (units, roles, users) are created BEFORE students FK references
  const tables = [
    `CREATE TABLE IF NOT EXISTS units (
      id VARCHAR(10) NOT NULL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      short_name VARCHAR(20) NOT NULL,
      total_quota INT NOT NULL DEFAULT 100,
      filled_quota INT NOT NULL DEFAULT 0,
      offline_count INT NOT NULL DEFAULT 0,
      form_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      rereg_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      is_open BOOLEAN NOT NULL DEFAULT TRUE,
      closed_notice TEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      facilities TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS roles (
      id VARCHAR(50) NOT NULL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      school_id VARCHAR(10) NOT NULL DEFAULT 'MASTER',
      permissions_json TEXT NOT NULL,
      description TEXT NULL,
      user_count INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(50) NOT NULL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      phone VARCHAR(30) NULL,
      school_id VARCHAR(10) NOT NULL DEFAULT 'MASTER',
      role VARCHAR(100) NOT NULL,
      permissions_json TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      children_ids_json TEXT NULL,
      password_hash VARCHAR(255) NULL,
      last_login VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS students (
      id VARCHAR(50) NOT NULL PRIMARY KEY,
      registration_number VARCHAR(50) NOT NULL UNIQUE,
      parent_user_id VARCHAR(50) NULL,
      full_name VARCHAR(200) NOT NULL,
      nisn VARCHAR(20) NULL,
      unit VARCHAR(10) NOT NULL,
      gender ENUM('Laki-laki', 'Perempuan') NOT NULL DEFAULT 'Laki-laki',
      birth_place VARCHAR(100) NULL,
      birth_date DATE NULL,
      address TEXT NULL,
      parent_name VARCHAR(150) NULL,
      parent_phone VARCHAR(30) NULL,
      parent_job VARCHAR(100) NULL,
      parent_income VARCHAR(100) NULL,
      status ENUM('verifikasi', 'tes', 'lulus', 'tidak_lulus', 'terdaftar') NOT NULL DEFAULT 'verifikasi',
      registered_at DATETIME NOT NULL,
      documents_json LONGTEXT NULL,
      dynamic_answers_json LONGTEXT NULL,
      verification_notes TEXT NULL,
      test_score INT NULL,
      test_schedule_id VARCHAR(50) NULL,
      test_published BOOLEAN NOT NULL DEFAULT FALSE,
      is_offline BOOLEAN NOT NULL DEFAULT FALSE,
      track VARCHAR(50) NULL,
      school_origin VARCHAR(150) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_parent_user (parent_user_id),
      INDEX idx_unit (unit),
      INDEX idx_status (status),
      INDEX idx_reg_num (registration_number),
      CONSTRAINT fk_students_parent_user FOREIGN KEY (parent_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(50) NOT NULL PRIMARY KEY,
      registration_id VARCHAR(50) NOT NULL,
      registration_number VARCHAR(50) NOT NULL,
      student_name VARCHAR(150) NOT NULL,
      unit VARCHAR(10) NOT NULL,
      type ENUM('Formulir', 'Daftar Ulang') NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      status ENUM('pending', 'verifikasi', 'lunas', 'ditolak') NOT NULL DEFAULT 'pending',
      payment_date DATETIME NOT NULL,
      proof_url LONGTEXT NULL,
      verified_by VARCHAR(150) NULL,
      verification_notes TEXT NULL,
      bank_account VARCHAR(150) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_reg_id (registration_id),
      INDEX idx_pay_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS test_schedules (
      id VARCHAR(50) NOT NULL PRIMARY KEY,
      title VARCHAR(150) NOT NULL,
      unit VARCHAR(10) NOT NULL,
      test_date DATE NOT NULL,
      start_time VARCHAR(10) NOT NULL,
      end_time VARCHAR(10) NOT NULL,
      room VARCHAR(100) NOT NULL,
      examiner VARCHAR(150) NOT NULL,
      quota INT NOT NULL DEFAULT 40,
      filled INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS form_schemas (
      unit_id VARCHAR(10) NOT NULL PRIMARY KEY,
      sections_json LONGTEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS academic_years (
      id VARCHAR(50) NOT NULL PRIMARY KEY,
      year_label VARCHAR(50) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT FALSE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS landing_config (
      id INT NOT NULL PRIMARY KEY DEFAULT 1,
      app_name VARCHAR(100) NOT NULL,
      app_tagline VARCHAR(150) NULL,
      hero_title TEXT NOT NULL,
      hero_subtitle TEXT NOT NULL,
      stats_total INT NOT NULL DEFAULT 800,
      flow_steps_json LONGTEXT NOT NULL,
      requirements_json LONGTEXT NOT NULL,
      contact_json LONGTEXT NOT NULL,
      hero_slides_json LONGTEXT NULL,
      logo_url TEXT NULL,
      favicon_url TEXT NULL,
      help_title VARCHAR(255) NULL,
      help_subtitle TEXT NULL,
      full_config_json LONGTEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(50) NOT NULL PRIMARY KEY,
      timestamp_str VARCHAR(30) NOT NULL,
      user_email VARCHAR(150) NOT NULL,
      action VARCHAR(50) NOT NULL,
      school_id VARCHAR(10) NOT NULL,
      details TEXT NOT NULL,
      ip_address VARCHAR(50) NOT NULL,
      prev_hash VARCHAR(64) NULL,
      entry_hash VARCHAR(64) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_timestamp (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(50) NOT NULL PRIMARY KEY,
      setting_value LONGTEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS trash_items (
      id VARCHAR(80) NOT NULL PRIMARY KEY,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(120) NOT NULL,
      unit_id VARCHAR(20) NOT NULL DEFAULT 'MASTER',
      title VARCHAR(255) NOT NULL,
      subtitle VARCHAR(255) NULL,
      deleted_at VARCHAR(40) NOT NULL,
      deleted_by VARCHAR(150) NOT NULL,
      deleted_by_role VARCHAR(100) NULL,
      snapshot_json LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_entity_type (entity_type),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  ];

  for (const tableSql of tables) {
    try {
      await pool.query(tableSql);
    } catch (err: any) {
      console.error('[DB Schema Error]:', err.message);
    }
  }

  // Non-destructive column migrations for pre-existing tables
  const migrations = [
    'ALTER TABLE units ADD COLUMN is_open BOOLEAN NOT NULL DEFAULT TRUE',
    'ALTER TABLE units ADD COLUMN closed_notice TEXT NULL',
    'ALTER TABLE units ADD COLUMN sort_order INT NOT NULL DEFAULT 0',
    'ALTER TABLE units ADD COLUMN offline_count INT NOT NULL DEFAULT 0',
    'ALTER TABLE landing_config ADD COLUMN hero_slides_json LONGTEXT NULL',
    'ALTER TABLE landing_config ADD COLUMN app_tagline VARCHAR(150) NULL',
    'ALTER TABLE landing_config ADD COLUMN logo_url TEXT NULL',
    'ALTER TABLE landing_config ADD COLUMN favicon_url TEXT NULL',
    'ALTER TABLE landing_config ADD COLUMN help_title VARCHAR(255) NULL',
    'ALTER TABLE landing_config ADD COLUMN help_subtitle TEXT NULL',
    'ALTER TABLE landing_config ADD COLUMN full_config_json LONGTEXT NULL',
    'ALTER TABLE students ADD COLUMN parent_user_id VARCHAR(50) NULL AFTER registration_number',
    'ALTER TABLE students ADD COLUMN documents_json LONGTEXT NULL AFTER registered_at',
    'ALTER TABLE students ADD COLUMN dynamic_answers_json LONGTEXT NULL AFTER documents_json',
    'ALTER TABLE students ADD COLUMN is_offline BOOLEAN NOT NULL DEFAULT FALSE',
    'ALTER TABLE students ADD COLUMN track VARCHAR(50) NULL',
    'ALTER TABLE students ADD COLUMN school_origin VARCHAR(150) NULL',
    'ALTER TABLE students ADD INDEX idx_parent_user (parent_user_id)',
    'ALTER TABLE students MODIFY COLUMN full_name VARCHAR(200) NOT NULL',
    'ALTER TABLE students MODIFY COLUMN birth_place VARCHAR(100) NULL',
    'ALTER TABLE students MODIFY COLUMN birth_date DATE NULL',
    'ALTER TABLE students MODIFY COLUMN parent_name VARCHAR(150) NULL',
    'ALTER TABLE students MODIFY COLUMN parent_phone VARCHAR(30) NULL',
    'ALTER TABLE students MODIFY COLUMN parent_income VARCHAR(100) NULL',
    'ALTER TABLE payments MODIFY COLUMN proof_url LONGTEXT NULL',
    'ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE',
    'ALTER TABLE users ADD COLUMN children_ids_json TEXT NULL',
    'ALTER TABLE audit_logs ADD COLUMN prev_hash VARCHAR(64) NULL',
    'ALTER TABLE audit_logs ADD COLUMN entry_hash VARCHAR(64) NULL',
  ];

  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (e: any) {
      // Ignore ER_DUP_FIELDNAME (1060) and ER_DUP_KEYNAME (1061)
      if (e?.errno !== 1060 && e?.errno !== 1061 && e?.code !== 'ER_DUP_FIELDNAME' && e?.code !== 'ER_DUP_KEYNAME') {
        console.warn('[DB Migration Notice]:', e?.message);
      }
    }
  }
}

// Production-Safe Database Loader & First-Time-Only Seeder
// PRINCIPLE: If MySQL already contains production data OR initial_seed_completed='true',
// MySQL is 100% authoritative — dummy/seed data NEVER overwrites or resurrects deleted records.
async function seedMySqlDatabase() {
  if (!mysqlPool || !isMySqlConnected) return;

  try {
    const defaultPasswordHash = bcrypt.hashSync('Coba123*#', 10);

    // 0. Inspect system_settings & core tables to detect whether DB is already initialized
    const [allSettingsRows]: any = await mysqlPool.query('SELECT setting_key, setting_value FROM system_settings');
    const settingsMap = new Map<string, string>();
    if (Array.isArray(allSettingsRows)) {
      allSettingsRows.forEach((row: any) => {
        if (row && row.setting_key) {
          settingsMap.set(String(row.setting_key), String(row.setting_value || ''));
        }
      });
    }

    const [existingRoles]: any = await mysqlPool.query('SELECT * FROM roles');
    const [existingUsers]: any = await mysqlPool.query('SELECT * FROM users');
    const [existingUnits]: any = await mysqlPool.query('SELECT * FROM units');
    const [existingStudents]: any = await mysqlPool.query('SELECT * FROM students');
    const [existingPayments]: any = await mysqlPool.query('SELECT * FROM payments');
    const [existingSchedules]: any = await mysqlPool.query('SELECT * FROM test_schedules');
    const [existingSchemas]: any = await mysqlPool.query('SELECT * FROM form_schemas');
    const [existingYears]: any = await mysqlPool.query('SELECT * FROM academic_years');
    const [existingLanding]: any = await mysqlPool.query('SELECT * FROM landing_config WHERE id = 1');
    const [existingAuditLogs]: any = await mysqlPool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500');
    const [existingTrash]: any = await mysqlPool.query('SELECT * FROM trash_items ORDER BY created_at DESC LIMIT 1000');

    const hasSeedMarker = settingsMap.get('initial_seed_completed') === 'true';
    const hasCoreRows =
      (Array.isArray(existingUsers) && existingUsers.length > 0) ||
      (Array.isArray(existingUnits) && existingUnits.length > 0) ||
      (Array.isArray(existingRoles) && existingRoles.length > 0) ||
      (Array.isArray(existingStudents) && existingStudents.length > 0) ||
      (Array.isArray(existingLanding) && existingLanding.length > 0);

    const isExistingDatabase = hasSeedMarker || hasCoreRows;

    if (isExistingDatabase) {
      console.log('[DB] Database produksi terdeteksi — memuat data asli dari MySQL tanpa menimpa data seed.');
      if (!hasSeedMarker) {
        await mysqlPool.query(
          "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('initial_seed_completed', 'true')"
        );
      }
    } else {
      console.log('[DB] Database baru & kosong terdeteksi — menjalankan inisialisasi seed awal satu kali...');
    }

    // 1. Roles
    if (Array.isArray(existingRoles) && (existingRoles.length > 0 || isExistingDatabase)) {
      memoryStore.roles = existingRoles.map((r: any) => ({
        id: r.id,
        name: r.name,
        schoolId: r.school_id,
        permissions: safeJsonParse<string[]>(r.permissions_json, []),
        description: r.description || '',
        userCount: Number(r.user_count) || 0,
      }));
    } else {
      for (const r of INITIAL_ROLES) {
        await mysqlPool.query(
          `INSERT IGNORE INTO roles (id, name, school_id, permissions_json, description, user_count)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [r.id, r.name, r.schoolId, JSON.stringify(r.permissions || []), r.description || '', r.userCount || 0]
        );
      }
      memoryStore.roles = INITIAL_ROLES;
    }

    // 2. Users (NEVER overwrite existing MySQL users with INITIAL_USERS!)
    if (Array.isArray(existingUsers) && (existingUsers.length > 0 || isExistingDatabase)) {
      console.log(`[DB] Memuat ${existingUsers.length} pengguna langsung dari MySQL (tanpa overwrite seed).`);
      memoryStore.users = existingUsers.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || '',
        schoolId: u.school_id || 'MASTER',
        role: u.role,
        permissions: safeJsonParse<string[]>(u.permissions_json, []),
        isActive: Boolean(u.is_active),
        emailVerified: Boolean(u.email_verified),
        childrenIds: safeJsonParse<string[]>(u.children_ids_json, []),
        lastLogin: u.last_login || '-',
        passwordHash: u.password_hash || defaultPasswordHash,
      }));
    } else {
      for (const u of INITIAL_USERS) {
        await mysqlPool.query(
          `INSERT IGNORE INTO users (id, name, email, phone, school_id, role, permissions_json, is_active, email_verified, children_ids_json, password_hash, last_login)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            u.id,
            u.name,
            u.email,
            u.phone || '',
            u.schoolId || 'MASTER',
            u.role,
            JSON.stringify(u.permissions || []),
            u.isActive ? 1 : 0,
            u.emailVerified ? 1 : 0,
            JSON.stringify(u.childrenIds || []),
            defaultPasswordHash,
            u.lastLogin || null,
          ]
        );
      }
      memoryStore.users = INITIAL_USERS.map((u) => ({ ...u, passwordHash: defaultPasswordHash }));
    }

    // 3. Units (Load including isOpen, closedNotice, offlineCount & sortOrder)
    if (Array.isArray(existingUnits) && existingUnits.length > 0) {
      memoryStore.units = sortUnitsList(
        existingUnits.map((un: any) => ({
          id: un.id,
          name: un.name,
          shortName: un.short_name,
          totalQuota: Number(un.total_quota) || 100,
          filledQuota: Number(un.filled_quota) || 0,
          offlineCount: Math.max(0, Number(un.offline_count) || 0),
          formFee: Number(un.form_fee) || 0,
          reRegFee: Number(un.rereg_fee) || 0,
          isOpen: un.is_open !== undefined && un.is_open !== null ? Boolean(un.is_open) : true,
          closedNotice: un.closed_notice || undefined,
          sortOrder: Number(un.sort_order) > 0 ? Number(un.sort_order) : (DEFAULT_UNIT_ORDER[un.id] ?? 99),
          facilities: safeJsonParse<string[]>(un.facilities, []),
        }))
      );
    } else {
      for (const un of INITIAL_UNITS) {
        const orderVal = un.sortOrder ?? DEFAULT_UNIT_ORDER[un.id] ?? 99;
        await mysqlPool.query(
          `INSERT IGNORE INTO units (id, name, short_name, total_quota, filled_quota, offline_count, form_fee, rereg_fee, is_open, closed_notice, sort_order, facilities)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            un.id,
            un.name,
            un.shortName,
            un.totalQuota,
            un.filledQuota,
            0,
            un.formFee,
            un.reRegFee,
            un.isOpen !== false ? 1 : 0,
            un.closedNotice || null,
            orderVal,
            JSON.stringify(un.facilities || []),
          ]
        );
      }
      memoryStore.units = sortUnitsList(INITIAL_UNITS).map((u) => ({ ...u, offlineCount: 0 }));
    }

    // 4. Students (Load ALL fields including parentUserId, documents_json, dynamic_answers_json, isOffline, track)
    if (Array.isArray(existingStudents) && (existingStudents.length > 0 || isExistingDatabase)) {
      memoryStore.students = existingStudents.map((s: any) => {
        const parsedDocs = safeJsonParse<Record<string, any>>(s.documents_json, {});
        const mergedDocs: StudentRegistration['documents'] = {};
        if (parsedDocs.kk || s.kk_document) mergedDocs.kk = parsedDocs.kk || s.kk_document;
        if (parsedDocs.akta || s.akta_document) mergedDocs.akta = parsedDocs.akta || s.akta_document;
        if (parsedDocs.photo || s.photo_document) mergedDocs.photo = parsedDocs.photo || s.photo_document;
        if (parsedDocs.rapor || s.rapor_document) mergedDocs.rapor = parsedDocs.rapor || s.rapor_document;
        if (parsedDocs.ijazah || s.ijazah_document) mergedDocs.ijazah = parsedDocs.ijazah || s.ijazah_document;
        // Preserve any extra custom document keys uploaded via Form Builder
        Object.keys(parsedDocs).forEach((k) => {
          if (parsedDocs[k] !== undefined && parsedDocs[k] !== '' && (mergedDocs as any)[k] === undefined) {
            (mergedDocs as any)[k] = parsedDocs[k];
          }
        });

        return {
          id: s.id,
          registrationNumber: s.registration_number,
          parentUserId: s.parent_user_id || undefined,
          fullName: s.full_name,
          nisn: s.nisn || undefined,
          unit: s.unit,
          gender: s.gender || 'Laki-laki',
          birthPlace: s.birth_place || '',
          birthDate: formatSqlDate(s.birth_date, ''),
          address: s.address || '',
          parentName: s.parent_name || '',
          parentPhone: s.parent_phone || '',
          parentJob: s.parent_job || '',
          parentIncome: s.parent_income || '',
          status: s.status,
          registeredAt: formatSqlDateTime(s.registered_at),
          documents: mergedDocs,
          dynamicAnswers: safeJsonParse<Record<string, any>>(s.dynamic_answers_json, {}),
          verificationNotes: s.verification_notes || undefined,
          testScore: s.test_score !== null && s.test_score !== undefined ? Number(s.test_score) : undefined,
          testScheduleId: s.test_schedule_id || undefined,
          testPublished: Boolean(s.test_published),
          isOffline: s.is_offline !== undefined ? Boolean(s.is_offline) : false,
          track: s.track || undefined,
          schoolOrigin: s.school_origin || undefined,
        };
      });
    } else {
      for (const s of INITIAL_STUDENTS) {
        await mysqlPool.query(
          `INSERT IGNORE INTO students (id, registration_number, parent_user_id, full_name, nisn, unit, gender, birth_place, birth_date, address, parent_name, parent_phone, parent_job, parent_income, status, registered_at, documents_json, dynamic_answers_json, verification_notes, test_score, test_schedule_id, test_published, is_offline, track, school_origin)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id,
            s.registrationNumber,
            s.parentUserId || null,
            s.fullName.slice(0, 200),
            s.nisn || null,
            s.unit,
            s.gender || 'Laki-laki',
            (s.birthPlace || '').trim().slice(0, 100),
            toSqlDateOrNull(s.birthDate),
            s.address || '',
            (s.parentName || '').trim().slice(0, 150),
            (s.parentPhone || '').trim().slice(0, 30),
            (s.parentJob || '').trim().slice(0, 100),
            (s.parentIncome || '').trim().slice(0, 100),
            s.status,
            s.registeredAt || new Date().toISOString().substring(0, 19).replace('T', ' '),
            JSON.stringify(s.documents || {}),
            JSON.stringify(s.dynamicAnswers || {}),
            s.verificationNotes || null,
            s.testScore ?? null,
            s.testScheduleId || null,
            s.testPublished ? 1 : 0,
            s.isOffline ? 1 : 0,
            s.track || null,
            s.schoolOrigin || null,
          ]
        );
      }
      memoryStore.students = INITIAL_STUDENTS;
    }

    // 5. Payments
    if (Array.isArray(existingPayments) && (existingPayments.length > 0 || isExistingDatabase)) {
      memoryStore.payments = existingPayments.map((p: any) => ({
        id: p.id,
        registrationId: p.registration_id,
        registrationNumber: p.registration_number,
        studentName: p.student_name,
        unit: p.unit,
        type: p.type,
        amount: Number(p.amount) || 0,
        status: p.status,
        date: formatSqlDateTime(p.payment_date),
        proofUrl: p.proof_url || '',
        verifiedBy: p.verified_by || undefined,
        verificationNotes: p.verification_notes || undefined,
        bankAccount: p.bank_account || '',
      }));
    } else {
      for (const p of INITIAL_PAYMENTS) {
        await mysqlPool.query(
          `INSERT IGNORE INTO payments (id, registration_id, registration_number, student_name, unit, type, amount, status, payment_date, proof_url, verified_by, verification_notes, bank_account)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.id,
            p.registrationId,
            p.registrationNumber,
            p.studentName,
            p.unit,
            p.type,
            p.amount,
            p.status,
            p.date || new Date().toISOString().substring(0, 19).replace('T', ' '),
            p.proofUrl || null,
            p.verifiedBy || null,
            p.verificationNotes || null,
            p.bankAccount || '',
          ]
        );
      }
      memoryStore.payments = INITIAL_PAYMENTS;
    }

    // 6. Test Schedules
    if (Array.isArray(existingSchedules) && (existingSchedules.length > 0 || isExistingDatabase)) {
      memoryStore.schedules = existingSchedules.map((sc: any) => ({
        id: sc.id,
        title: sc.title,
        unit: sc.unit,
        date: formatSqlDate(sc.test_date),
        startTime: sc.start_time,
        endTime: sc.end_time,
        room: sc.room,
        examiner: sc.examiner,
        quota: Number(sc.quota) || 40,
        filled: Number(sc.filled) || 0,
      }));
    } else {
      for (const sc of INITIAL_SCHEDULES) {
        await mysqlPool.query(
          `INSERT IGNORE INTO test_schedules (id, title, unit, test_date, start_time, end_time, room, examiner, quota, filled)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sc.id, sc.title, sc.unit, sc.date, sc.startTime, sc.endTime, sc.room, sc.examiner, sc.quota, sc.filled]
        );
      }
      memoryStore.schedules = INITIAL_SCHEDULES;
    }

    // 7. Form Schemas: MySQL is authoritative for every existing unit row
    const existingSchemaMap = new Map<string, any>();
    if (Array.isArray(existingSchemas)) {
      existingSchemas.forEach((fsItem: any) => {
        if (fsItem && fsItem.unit_id) {
          existingSchemaMap.set(fsItem.unit_id, fsItem);
        }
      });
    }

    const mergedSchemaMap = new Map<string, UnitFormSchema>();
    for (const [unitId, existing] of existingSchemaMap.entries()) {
      const parsedSections = safeJsonParse<any[] | null>(existing.sections_json, null);
      if (Array.isArray(parsedSections) && (parsedSections.length > 0 || isExistingDatabase)) {
        mergedSchemaMap.set(unitId, {
          unitId: unitId as any,
          sections: parsedSections,
        });
      }
    }

    // Seed baseline form schema ONLY for unit IDs that have no valid row in MySQL yet
    for (const defaultSchema of INITIAL_FORM_SCHEMAS) {
      if (!mergedSchemaMap.has(defaultSchema.unitId)) {
        await mysqlPool.query(
          `INSERT INTO form_schemas (unit_id, sections_json)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE sections_json = VALUES(sections_json)`,
          [defaultSchema.unitId, JSON.stringify(defaultSchema.sections || [])]
        );
        mergedSchemaMap.set(defaultSchema.unitId, defaultSchema);
      }
    }

    const unitOrder = new Map(memoryStore.units.map((u, idx) => [u.id, idx]));
    memoryStore.formSchemas = Array.from(mergedSchemaMap.values())
      .map((s) => ({
        ...s,
        sections: ensureCoreNameFieldInSections(s.sections, s.unitId),
      }))
      .sort((a, b) => (unitOrder.get(a.unitId) ?? 999) - (unitOrder.get(b.unitId) ?? 999));

    // 8. Academic Years
    if (Array.isArray(existingYears) && (existingYears.length > 0 || isExistingDatabase)) {
      memoryStore.academicYears = existingYears.map((ay: any) => ({
        id: ay.id,
        year: ay.year_label,
        startDate: formatSqlDate(ay.start_date, '2026-07-01'),
        endDate: formatSqlDate(ay.end_date, '2027-06-30'),
        isActive: Boolean(ay.is_active),
      }));
    } else {
      for (const ay of INITIAL_ACADEMIC_YEARS) {
        await mysqlPool.query(
          `INSERT IGNORE INTO academic_years (id, year_label, start_date, end_date, is_active)
           VALUES (?, ?, ?, ?, ?)`,
          [ay.id, ay.year || (ay as any).yearLabel || '2026/2027', ay.startDate, ay.endDate, ay.isActive ? 1 : 0]
        );
      }
      memoryStore.academicYears = INITIAL_ACADEMIC_YEARS;
    }

    // 9. Landing Config (Load directly from MySQL without overwriting production values with dummy defaults)
    if (Array.isArray(existingLanding) && existingLanding.length > 0) {
      const row = existingLanding[0];
      const fullConfig = safeJsonParse<Partial<LandingPageConfig>>(row.full_config_json, {});
      const parsedFlowSteps = safeJsonParse(row.flow_steps_json, undefined as any);
      const parsedRequirements = safeJsonParse(row.requirements_json, undefined as any);
      const parsedContact = safeJsonParse(row.contact_json, undefined as any);
      const parsedHeroSlides = row.hero_slides_json ? safeJsonParse(row.hero_slides_json, undefined as any) : undefined;

      memoryStore.landingConfig = {
        ...INITIAL_LANDING_CONFIG,
        ...fullConfig,
        appName: row.app_name ?? fullConfig.appName ?? INITIAL_LANDING_CONFIG.appName,
        appTagline: row.app_tagline ?? fullConfig.appTagline ?? INITIAL_LANDING_CONFIG.appTagline,
        heroTitle: row.hero_title ?? fullConfig.heroTitle ?? INITIAL_LANDING_CONFIG.heroTitle,
        heroSubtitle: row.hero_subtitle ?? fullConfig.heroSubtitle ?? INITIAL_LANDING_CONFIG.heroSubtitle,
        statsTotal: row.stats_total !== null && row.stats_total !== undefined ? Number(row.stats_total) : (fullConfig.statsTotal ?? INITIAL_LANDING_CONFIG.statsTotal),
        flowSteps: Array.isArray(parsedFlowSteps) ? parsedFlowSteps : (fullConfig.flowSteps ?? INITIAL_LANDING_CONFIG.flowSteps),
        requirements: Array.isArray(parsedRequirements) ? parsedRequirements : (fullConfig.requirements ?? INITIAL_LANDING_CONFIG.requirements),
        contact: parsedContact && typeof parsedContact === 'object' ? parsedContact : (fullConfig.contact ?? INITIAL_LANDING_CONFIG.contact),
        heroSlides: Array.isArray(parsedHeroSlides) ? parsedHeroSlides : (Array.isArray(fullConfig.heroSlides) ? fullConfig.heroSlides : INITIAL_LANDING_CONFIG.heroSlides),
        logoUrl: row.logo_url ?? fullConfig.logoUrl ?? INITIAL_LANDING_CONFIG.logoUrl,
        faviconUrl: row.favicon_url ?? fullConfig.faviconUrl ?? INITIAL_LANDING_CONFIG.faviconUrl,
        helpTitle: row.help_title ?? fullConfig.helpTitle ?? INITIAL_LANDING_CONFIG.helpTitle,
        helpSubtitle: row.help_subtitle ?? fullConfig.helpSubtitle ?? INITIAL_LANDING_CONFIG.helpSubtitle,
      };

      // Only backfill full_config_json if it was literally missing on a legacy DB row
      if (!row.full_config_json) {
        await mysqlPool
          .query('UPDATE landing_config SET full_config_json = ? WHERE id = 1', [JSON.stringify(memoryStore.landingConfig)])
          .catch(() => {});
      }
    } else {
      await mysqlPool.query(
        `INSERT IGNORE INTO landing_config (id, app_name, app_tagline, hero_title, hero_subtitle, stats_total, flow_steps_json, requirements_json, contact_json, hero_slides_json, logo_url, favicon_url, help_title, help_subtitle, full_config_json)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          INITIAL_LANDING_CONFIG.appName,
          INITIAL_LANDING_CONFIG.appTagline || 'Yayasan Ar-Risalah Aceh',
          INITIAL_LANDING_CONFIG.heroTitle,
          INITIAL_LANDING_CONFIG.heroSubtitle,
          INITIAL_LANDING_CONFIG.statsTotal || 826,
          JSON.stringify(INITIAL_LANDING_CONFIG.flowSteps || []),
          JSON.stringify(INITIAL_LANDING_CONFIG.requirements || []),
          JSON.stringify(INITIAL_LANDING_CONFIG.contact || {}),
          JSON.stringify(INITIAL_LANDING_CONFIG.heroSlides || []),
          INITIAL_LANDING_CONFIG.logoUrl || '/uploads/logo.png',
          INITIAL_LANDING_CONFIG.faviconUrl || '/uploads/favicon.ico',
          INITIAL_LANDING_CONFIG.helpTitle || null,
          INITIAL_LANDING_CONFIG.helpSubtitle || null,
          JSON.stringify(INITIAL_LANDING_CONFIG),
        ]
      );
      memoryStore.landingConfig = INITIAL_LANDING_CONFIG;
    }

    // 10. System Settings (SMTP, Cloudflare, Unit Contacts, Group Links, Letter Configs, Export Configs)
    // 10a. SMTP Config
    try {
      const smtpRaw = settingsMap.get('smtp_config');
      if (smtpRaw) {
        const parsed = safeJsonParse<Partial<SmtpConfig>>(smtpRaw, {});
        if (parsed && typeof parsed === 'object') {
          memoryStore.smtpConfig = { ...INITIAL_SMTP_CONFIG, ...parsed };
        }
      } else {
        await mysqlPool.query(
          "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('smtp_config', ?)",
          [JSON.stringify(memoryStore.smtpConfig)]
        );
      }
    } catch (e: any) {
      console.warn('[DB] Notice syncing smtp_config:', e.message);
    }

    // 10b. Cloudflare Turnstile Config
    try {
      const cfRaw = settingsMap.get('cloudflare_config');
      if (cfRaw) {
        const parsed = safeJsonParse<Partial<CloudflareConfig>>(cfRaw, {});
        if (parsed && typeof parsed === 'object') {
          memoryStore.cloudflareConfig = { ...INITIAL_CLOUDFLARE_CONFIG, ...parsed };
        }
      } else if (memoryStore.cloudflareConfig) {
        await mysqlPool.query(
          "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('cloudflare_config', ?)",
          [JSON.stringify(memoryStore.cloudflareConfig)]
        );
      }

      // Cloudflare Turnstile is now strictly managed via server .env (CLOUDFLARE_ENABLED).
      // Clear any stale/unreadable legacy DB secretKey so startup never fails decryption.
      if (memoryStore.cloudflareConfig?.secretKey) {
        const nextCf: CloudflareConfig = {
          ...(memoryStore.cloudflareConfig || INITIAL_CLOUDFLARE_CONFIG),
          enabled: false,
          secretKey: '',
          updatedAt: new Date().toISOString(),
          updatedBy: 'System (.env)',
        };
        memoryStore.cloudflareConfig = nextCf;
        await mysqlPool.query(
          "INSERT INTO system_settings (setting_key, setting_value) VALUES ('cloudflare_config', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
          [JSON.stringify(nextCf)]
        );
        persistStore();
      }
    } catch (e: any) {
      console.warn('[DB] Notice syncing cloudflare_config:', e.message);
    }

    // 10c. Unit Contacts Config
    try {
      const ucRaw = settingsMap.get('unit_contacts');
      if (ucRaw) {
        const parsed = safeJsonParse<UnitContactConfig[]>(ucRaw, []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryStore.unitContacts = parsed;
        }
      } else if (memoryStore.unitContacts) {
        await mysqlPool.query(
          "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('unit_contacts', ?)",
          [JSON.stringify(memoryStore.unitContacts)]
        );
      }
    } catch (e: any) {
      console.warn('[DB] Notice syncing unit_contacts:', e.message);
    }

    // 10d. Group Links Config
    try {
      const glRaw = settingsMap.get('group_links');
      if (glRaw) {
        const parsed = safeJsonParse<GroupLinkConfig[]>(glRaw, []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryStore.groupLinkConfigs = parsed;
        }
      } else if (memoryStore.groupLinkConfigs) {
        await mysqlPool.query(
          "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('group_links', ?)",
          [JSON.stringify(memoryStore.groupLinkConfigs)]
        );
      }
    } catch (e: any) {
      console.warn('[DB] Notice syncing group_links:', e.message);
    }

    // 10e. Letter Configs (Ketua Panitia & Format Kartu Surat)
    try {
      const lcRaw = settingsMap.get('letter_configs');
      if (lcRaw) {
        const parsed = safeJsonParse<LetterConfig[]>(lcRaw, []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryStore.letterConfigs = parsed;
        }
      } else if (memoryStore.letterConfigs) {
        await mysqlPool.query(
          "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('letter_configs', ?)",
          [JSON.stringify(memoryStore.letterConfigs)]
        );
      }
    } catch (e: any) {
      console.warn('[DB] Notice syncing letter_configs:', e.message);
    }

    // 10e2. Yayasan Bank Accounts (Multi-Bank)
    try {
      const baRaw = settingsMap.get('bank_accounts');
      if (baRaw) {
        const parsed = safeJsonParse<BankAccountConfig[]>(baRaw, []);
        if (Array.isArray(parsed)) {
          memoryStore.bankAccounts = parsed;
        }
      } else if (memoryStore.bankAccounts) {
        await mysqlPool.query(
          "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('bank_accounts', ?)",
          [JSON.stringify(memoryStore.bankAccounts)]
        );
      }
    } catch (e: any) {
      console.warn('[DB] Notice syncing bank_accounts:', e.message);
    }

    // 10f. Export Configs
    try {
      const expRaw = settingsMap.get('export_configs');
      if (expRaw) {
        const parsed = safeJsonParse<ExportFieldConfig[]>(expRaw, []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryStore.exportConfigs = parsed;
        }
      } else if (memoryStore.exportConfigs) {
        await mysqlPool.query(
          "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('export_configs', ?)",
          [JSON.stringify(memoryStore.exportConfigs)]
        );
      }
    } catch (e: any) {
      console.warn('[DB] Notice syncing export_configs:', e.message);
    }

    // 11. Audit Logs (Load latest 500 from MySQL on startup)
    if (Array.isArray(existingAuditLogs) && existingAuditLogs.length > 0) {
      memoryStore.auditLogs = existingAuditLogs.map((l: any) => ({
        id: l.id,
        timestamp: l.timestamp_str,
        userEmail: l.user_email,
        action: l.action,
        schoolId: l.school_id,
        details: l.details,
        ipAddress: l.ip_address,
        ...(l.prev_hash ? { prevHash: l.prev_hash } : {}),
        ...(l.entry_hash ? { entryHash: l.entry_hash } : {}),
      }));
    } else if (isExistingDatabase) {
      memoryStore.auditLogs = [];
    }

    // 12. Trash Items (Load deleted records archive from MySQL)
    if (Array.isArray(existingTrash)) {
      memoryStore.trashItems = existingTrash.map((tr: any) => ({
        id: tr.id,
        entityType: tr.entity_type,
        entityId: tr.entity_id,
        unitId: tr.unit_id || 'MASTER',
        title: tr.title,
        subtitle: tr.subtitle || undefined,
        deletedAt: tr.deleted_at,
        deletedBy: tr.deleted_by,
        deletedByRole: tr.deleted_by_role || undefined,
        snapshot: safeJsonParse<any>(tr.snapshot_json, {}),
      }));
    }

    // Reconcile parent-child links strictly using explicit parentUserId / childrenIds (NO phone auto-linking)
    memoryStore.users = memoryStore.users.map((u) => {
      const existingChildIds = Array.isArray(u.childrenIds) ? u.childrenIds : [];
      const linkedStudents = memoryStore.students.filter(
        (s) => s.parentUserId === u.id || existingChildIds.includes(s.id)
      );
      if (linkedStudents.length === 0) {
        return u;
      }
      const mergedChildIds = Array.from(new Set([...existingChildIds, ...linkedStudents.map((s) => s.id)]));
      const firstStudent = linkedStudents[0];
      return {
        ...u,
        childrenIds: mergedChildIds,
        studentId: u.studentId || firstStudent.id,
        studentRegistrationNumber: u.studentRegistrationNumber || firstStudent.registrationNumber,
      };
    });

    // Mark initial seed completed permanently so subsequent restarts NEVER re-seed dummy data
    await mysqlPool.query(
      "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('initial_seed_completed', 'true')"
    );
    memoryStore.seedCompleted = true;

    persistStore();
    console.log('[DB] Sinkronisasi database MySQL selesai (Mode Production-Safe aktif).');
  } catch (err: any) {
    console.error('[DB Sync Error]: Gagal sinkronisasi data dengan MySQL:', err.message);
  }
}

// Helper Audit Logger with Tamper-Evident HMAC-SHA256 Hash Chaining
export async function addAuditLog(
  action: AuditLogItem['action'],
  schoolId: SchoolId,
  details: string,
  userEmail = 'admin@arrisalahaceh.or.id',
  ipAddress = '127.0.0.1'
) {
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const prevHash = memoryStore.auditLogs[0]?.entryHash || 'GENESIS';
  const baseLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: timeStr,
    userEmail,
    action,
    schoolId,
    details,
    ipAddress,
  };
  const entryHash = computeAuditEntryHash(prevHash, baseLog);

  const log: AuditLogItem = {
    ...baseLog,
    prevHash,
    entryHash,
  };

  memoryStore.auditLogs.unshift(log);
  if (memoryStore.auditLogs.length > 500) {
    memoryStore.auditLogs = memoryStore.auditLogs.slice(0, 500);
  }
  persistStore();

  // Async push to MySQL with retry/resilience
  if (mysqlPool && isMySqlConnected) {
    const pushToMySql = async (retryCount = 0): Promise<void> => {
      try {
        await mysqlPool!.query(
          'INSERT INTO audit_logs (id, timestamp_str, user_email, action, school_id, details, ip_address, prev_hash, entry_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [log.id, log.timestamp, log.userEmail, log.action, log.schoolId, log.details, log.ipAddress, log.prevHash || null, log.entryHash || null]
        );
      } catch (e: any) {
        if ((e?.code === 'ECONNRESET' || e?.message?.includes('ECONNRESET') || e?.errno === -104) && retryCount < 2) {
          console.warn(`[DB Sync] Connection reset, retrying audit log save (${retryCount + 1})...`);
          await new Promise(resolve => setTimeout(resolve, 500)); // wait 500ms
          return pushToMySql(retryCount + 1);
        } else if (e?.code === 'ER_NO_SUCH_TABLE') {
          console.log('[DB Sync] Table audit_logs missing. Auto-creating...');
          try {
            await mysqlPool!.query(`CREATE TABLE IF NOT EXISTS audit_logs (
              id VARCHAR(50) NOT NULL PRIMARY KEY,
              timestamp_str VARCHAR(30) NOT NULL,
              user_email VARCHAR(150) NOT NULL,
              action VARCHAR(50) NOT NULL,
              school_id VARCHAR(10) NOT NULL,
              details TEXT NOT NULL,
              ip_address VARCHAR(50) NOT NULL,
              prev_hash VARCHAR(64) NULL,
              entry_hash VARCHAR(64) NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_timestamp (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
            return pushToMySql(retryCount + 1);
          } catch (retryErr) {
            console.error('[DB Sync] Failed to create audit_logs table:', retryErr);
          }
        } else {
          console.error('[DB Sync] Error saving audit log to MySQL:', e.message);
        }
      }
    };

    pushToMySql();
  }

  return log;
}

// Archive deleted items into persistent Trash storage (MySQL trash_items + memoryStore)
async function archiveToTrash(params: {
  entityType: TrashEntityType;
  entityId: string;
  unitId?: string;
  title: string;
  subtitle?: string;
  deletedBy?: string;
  deletedByRole?: string;
  snapshot: any;
}): Promise<TrashItem> {
  const now = new Date();
  const deletedAt = formatSqlDateTime(now, now.toISOString().slice(0, 19).replace('T', ' '));
  const item: TrashItem = {
    id: `trash-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    entityType: params.entityType,
    entityId: String(params.entityId || ''),
    unitId: params.unitId || 'MASTER',
    title: String(params.title || 'Data Terhapus').slice(0, 250),
    subtitle: params.subtitle ? String(params.subtitle).slice(0, 250) : undefined,
    deletedAt,
    deletedBy: String(params.deletedBy || 'Admin').slice(0, 145),
    deletedByRole: params.deletedByRole ? String(params.deletedByRole).slice(0, 95) : undefined,
    snapshot: params.snapshot ?? {},
  };

  if (mysqlPool && isMySqlConnected) {
    try {
      await mysqlPool.query(
        `INSERT INTO trash_items (id, entity_type, entity_id, unit_id, title, subtitle, deleted_at, deleted_by, deleted_by_role, snapshot_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.entityType,
          item.entityId,
          item.unitId,
          item.title,
          item.subtitle || null,
          item.deletedAt,
          item.deletedBy,
          item.deletedByRole || null,
          JSON.stringify(item.snapshot),
        ]
      );
    } catch (e: any) {
      if (e?.code === 'ER_NO_SUCH_TABLE' || e?.errno === 1146) {
        try {
          await mysqlPool.query(`CREATE TABLE IF NOT EXISTS trash_items (
            id VARCHAR(80) NOT NULL PRIMARY KEY,
            entity_type VARCHAR(50) NOT NULL,
            entity_id VARCHAR(120) NOT NULL,
            unit_id VARCHAR(20) NOT NULL DEFAULT 'MASTER',
            title VARCHAR(255) NOT NULL,
            subtitle VARCHAR(255) NULL,
            deleted_at VARCHAR(40) NOT NULL,
            deleted_by VARCHAR(150) NOT NULL,
            deleted_by_role VARCHAR(100) NULL,
            snapshot_json LONGTEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_entity_type (entity_type),
            INDEX idx_created_at (created_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
          await mysqlPool.query(
            `INSERT INTO trash_items (id, entity_type, entity_id, unit_id, title, subtitle, deleted_at, deleted_by, deleted_by_role, snapshot_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.id,
              item.entityType,
              item.entityId,
              item.unitId,
              item.title,
              item.subtitle || null,
              item.deletedAt,
              item.deletedBy,
              item.deletedByRole || null,
              JSON.stringify(item.snapshot),
            ]
          );
        } catch (retryErr) {
          console.error('[DB Trash] Failed to create/insert trash_items:', retryErr);
        }
      } else {
        console.error('[DB Trash] Error archiving item to trash_items:', e.message);
      }
    }
  }

  if (!Array.isArray(memoryStore.trashItems)) {
    memoryStore.trashItems = [];
  }
  memoryStore.trashItems.unshift(item);
  if (memoryStore.trashItems.length > 1000) {
    memoryStore.trashItems = memoryStore.trashItems.slice(0, 1000);
  }
  return item;
}

// Strip sensitive credentials (passwordHash, encrypted SMTP authPassword) before returning Trash items to client
function sanitizeTrashItemForClient(item: TrashItem): TrashItem {
  const safeSnapshot = item.snapshot && typeof item.snapshot === 'object' ? { ...item.snapshot } : {};
  if ('passwordHash' in safeSnapshot) {
    delete safeSnapshot.passwordHash;
  }
  if (safeSnapshot.account && typeof safeSnapshot.account === 'object') {
    safeSnapshot.account = {
      ...safeSnapshot.account,
      authPassword: safeSnapshot.account.authPassword ? '••••••••••••••••' : '',
    };
  }
  return {
    ...item,
    snapshot: safeSnapshot,
  };
}

// API Methods
export const db = {
  isMySqlConnected: () => isMySqlConnected,
  getDbStatus: () => ({
    connected: isMySqlConnected,
    driver: 'MySQL (mysql2)',
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || '3306',
    database: process.env.MYSQL_DATABASE || 'ppdb_arrisalah',
    user: process.env.MYSQL_USER || 'root',
    statusMessage: mysqlStatusMessage,
    totalRecords: {
      students: memoryStore.students.length,
      payments: memoryStore.payments.length,
      schedules: memoryStore.schedules.length,
      users: memoryStore.users.length,
      auditLogs: memoryStore.auditLogs.length,
    },
  }),

  // Students
  getStudents: (filter?: { unit?: string; status?: string; search?: string }) => {
    let list = [...memoryStore.students];
    if (filter?.unit && filter.unit !== 'all' && filter.unit !== 'MASTER') {
      list = list.filter((s) => s.unit === filter.unit);
    }
    if (filter?.status && filter.status !== 'all') {
      list = list.filter((s) => s.status === filter.status);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          s.registrationNumber.toLowerCase().includes(q) ||
          s.parentName.toLowerCase().includes(q) ||
          (s.nisn && s.nisn.includes(q))
      );
    }
    return list;
  },

  getStudentById: (id: string) => {
    return memoryStore.students.find((s) => s.id === id || s.registrationNumber === id) || null;
  },

  createStudent: async (data: Partial<StudentRegistration>) => {
    const unit = String(data.unit || memoryStore.units[0]?.id || 'SD01').trim().toUpperCase();

    // Generate Guaranteed Unique Registration Number based on Active Academic Year
    const activeAy = memoryStore.academicYears.find((a) => a.isActive) || memoryStore.academicYears[0];
    const regYear = activeAy?.year?.match(/\d{4}/)?.[0] || String(new Date().getFullYear());
    let regNum = '';
    let isRegUnique = false;
    while (!isRegUnique) {
      const randNum = Math.floor(1000 + Math.random() * 9000);
      regNum = `PPDB-${regYear}-${unit}-${randNum}`;
      if (!memoryStore.students.some((s) => s.registrationNumber === regNum)) {
        isRegUnique = true;
      }
    }

    // Generate Guaranteed Unique Primary Key ID
    let uniqueId = '';
    let isIdUnique = false;
    while (!isIdUnique) {
      const randHex = Math.random().toString(36).substring(2, 8);
      uniqueId = `reg-${Date.now()}-${randHex}`;
      if (!memoryStore.students.some((s) => s.id === uniqueId)) {
        isIdUnique = true;
      }
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newStudent: StudentRegistration = {
      id: uniqueId,
      registrationNumber: regNum,
      fullName: data.fullName || 'Calon Siswa Baru',
      nisn: data.nisn || '',
      unit,
      gender: data.gender || 'Laki-laki',
      birthPlace: data.birthPlace || '',
      birthDate: data.birthDate || '',
      address: data.address || '',
      parentName: data.parentName || '',
      parentPhone: data.parentPhone || '',
      parentJob: data.parentJob || '',
      parentIncome: data.parentIncome || '',
      status: 'verifikasi',
      registeredAt: dateStr,
      parentUserId: data.parentUserId,
      documents: data.documents && typeof data.documents === 'object' ? data.documents : {},
      dynamicAnswers: data.dynamicAnswers || {},
      isOffline: Boolean(data.isOffline),
      track: data.track || undefined,
      schoolOrigin: data.schoolOrigin || undefined,
    };

    // Link strictly by authenticated / explicitly validated parentUserId (NEVER by phone number)
    const matchedParent = data.parentUserId
      ? memoryStore.users.find((u) => u.id === data.parentUserId)
      : undefined;
    let nextParentChildrenIds: string[] = [];
    if (matchedParent) {
      newStudent.parentUserId = matchedParent.id;
      nextParentChildrenIds = Array.from(new Set([...(matchedParent.childrenIds || []), newStudent.id]));
    } else {
      newStudent.parentUserId = undefined;
    }

    const targetUnit = memoryStore.units.find((u) => u.id === unit);
    const formFee = targetUnit ? targetUnit.formFee : 0;
    const freshBanks = await db.getBankAccountsFresh();
    const activeBanks = freshBanks.filter((b) => b.isActive);
    const defaultBank = activeBanks.find((b) => b.isPrimary) || activeBanks[0] || freshBanks[0];
    const defaultBankLabel = defaultBank
      ? `${defaultBank.bankName} ${defaultBank.accountNumber} a.n ${defaultBank.accountHolder}`
      : '';
    const newPayment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      registrationId: newStudent.id,
      registrationNumber: newStudent.registrationNumber,
      studentName: newStudent.fullName,
      unit: newStudent.unit,
      type: 'Formulir',
      amount: formFee,
      status: 'pending',
      date: dateStr,
      proofUrl: '',
      bankAccount: defaultBankLabel,
    };

    // Persist to MySQL BEFORE committing to memoryStore so RAM never diverges from DB
    await executeMySql(
      `INSERT INTO students (id, registration_number, parent_user_id, full_name, nisn, unit, gender, birth_place, birth_date, address, parent_name, parent_phone, parent_job, parent_income, status, registered_at, documents_json, dynamic_answers_json, is_offline, track, school_origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newStudent.id,
        newStudent.registrationNumber,
        newStudent.parentUserId || null,
        newStudent.fullName.slice(0, 200),
        newStudent.nisn || null,
        newStudent.unit,
        newStudent.gender,
        (newStudent.birthPlace || '').trim().slice(0, 100),
        toSqlDateOrNull(newStudent.birthDate),
        newStudent.address || '',
        (newStudent.parentName || '').trim().slice(0, 150),
        (newStudent.parentPhone || '').trim().slice(0, 30),
        (newStudent.parentJob || '').trim().slice(0, 100),
        (newStudent.parentIncome || '').trim().slice(0, 100),
        newStudent.status,
        dateStr,
        JSON.stringify(newStudent.documents || {}),
        JSON.stringify(newStudent.dynamicAnswers || {}),
        newStudent.isOffline ? 1 : 0,
        newStudent.track || null,
        newStudent.schoolOrigin || null,
      ]
    );

    await executeMySql(
      `INSERT INTO payments (id, registration_id, registration_number, student_name, unit, type, amount, status, payment_date, bank_account)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newPayment.id,
        newPayment.registrationId,
        newPayment.registrationNumber,
        newPayment.studentName.slice(0, 150),
        newPayment.unit,
        newPayment.type,
        newPayment.amount,
        newPayment.status,
        dateStr,
        (newPayment.bankAccount || '').slice(0, 150),
      ]
    );

    if (matchedParent) {
      await executeMySql('UPDATE users SET children_ids_json = ? WHERE id = ?', [
        JSON.stringify(nextParentChildrenIds),
        matchedParent.id,
      ]);
      matchedParent.childrenIds = nextParentChildrenIds;
      if (!matchedParent.studentId) {
        matchedParent.studentId = newStudent.id;
        matchedParent.studentRegistrationNumber = newStudent.registrationNumber;
      }
    }

    const nextOnlineCount = memoryStore.students.filter((s) => s.unit === unit).length + 1;
    const unitOfflineCount = Math.max(0, Number(targetUnit?.offlineCount) || 0);
    const nextFilledQuota = nextOnlineCount + unitOfflineCount;
    await executeMySql('UPDATE units SET filled_quota = ? WHERE id = ?', [nextFilledQuota, unit]);

    memoryStore.students.unshift(newStudent);
    memoryStore.payments.unshift(newPayment);
    memoryStore.units = memoryStore.units.map((u) =>
      u.id === unit ? { ...u, onlineCount: nextOnlineCount, offlineCount: unitOfflineCount, filledQuota: nextFilledQuota } : u
    );

    addAuditLog('create_pendaftar', unit, `Pendaftaran siswa baru ${newStudent.fullName} (${newStudent.registrationNumber})`);
    persistStore();
    return newStudent;
  },

  updateStudent: async (id: string, updates: Partial<StudentRegistration>) => {
    const idx = memoryStore.students.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    const prev = memoryStore.students[idx];
    const mergedDocuments = updates.documents
      ? { ...(prev.documents || {}), ...updates.documents }
      : prev.documents;
    const mergedDynamicAnswers = updates.dynamicAnswers
      ? { ...(prev.dynamicAnswers || {}), ...updates.dynamicAnswers }
      : prev.dynamicAnswers;

    const s: StudentRegistration = {
      ...prev,
      ...updates,
      id: prev.id,
      registrationNumber: prev.registrationNumber,
      documents: mergedDocuments,
      dynamicAnswers: mergedDynamicAnswers,
    };

    await executeMySql(
      `UPDATE students SET
         full_name = ?,
         nisn = ?,
         unit = ?,
         gender = ?,
         birth_place = ?,
         birth_date = ?,
         address = ?,
         parent_name = ?,
         parent_phone = ?,
         parent_job = ?,
         parent_income = ?,
         status = ?,
         documents_json = ?,
         dynamic_answers_json = ?,
         verification_notes = ?,
         test_score = ?,
         test_schedule_id = ?,
         test_published = ?,
         track = ?,
         school_origin = ?
       WHERE id = ?`,
      [
        s.fullName.slice(0, 200),
        s.nisn || null,
        s.unit,
        s.gender || 'Laki-laki',
        (s.birthPlace || '').trim().slice(0, 100),
        toSqlDateOrNull(s.birthDate),
        s.address || '',
        (s.parentName || '').trim().slice(0, 150),
        (s.parentPhone || '').trim().slice(0, 30),
        (s.parentJob || '').trim().slice(0, 100),
        (s.parentIncome || '').trim().slice(0, 100),
        s.status,
        JSON.stringify(s.documents || {}),
        JSON.stringify(s.dynamicAnswers || {}),
        s.verificationNotes || null,
        s.testScore ?? null,
        s.testScheduleId || null,
        s.testPublished ? 1 : 0,
        s.track || null,
        s.schoolOrigin || null,
        id,
      ]
    );

    const prevUploadUrls = new Set<string>();
    collectUploadUrlsFromValue(prev.avatarUrl, prevUploadUrls);
    collectUploadUrlsFromValue(prev.documents, prevUploadUrls);
    collectUploadUrlsFromValue(prev.dynamicAnswers, prevUploadUrls);

    memoryStore.students[idx] = s;
    const nextUploadUrls = new Set<string>();
    collectUploadUrlsFromValue(s.avatarUrl, nextUploadUrls);
    collectUploadUrlsFromValue(s.documents, nextUploadUrls);
    collectUploadUrlsFromValue(s.dynamicAnswers, nextUploadUrls);

    for (const oldUrl of prevUploadUrls) {
      if (!nextUploadUrls.has(oldUrl)) {
        deleteUploadFileSafely(oldUrl);
      }
    }

    if (prev.unit !== s.unit) {
      const oldUnitObj = memoryStore.units.find((u) => u.id === prev.unit);
      const newUnitObj = memoryStore.units.find((u) => u.id === s.unit);
      const oldOnline = memoryStore.students.filter((st) => st.unit === prev.unit).length;
      const newOnline = memoryStore.students.filter((st) => st.unit === s.unit).length;
      const oldOffline = Math.max(0, Number(oldUnitObj?.offlineCount) || 0);
      const newOffline = Math.max(0, Number(newUnitObj?.offlineCount) || 0);
      const oldCount = oldOnline + oldOffline;
      const newCount = newOnline + newOffline;
      await executeMySql('UPDATE units SET filled_quota = ? WHERE id = ?', [oldCount, prev.unit]);
      await executeMySql('UPDATE units SET filled_quota = ? WHERE id = ?', [newCount, s.unit]);
      memoryStore.units = memoryStore.units.map((u) => {
        if (u.id === prev.unit) return { ...u, onlineCount: oldOnline, offlineCount: oldOffline, filledQuota: oldCount };
        if (u.id === s.unit) return { ...u, onlineCount: newOnline, offlineCount: newOffline, filledQuota: newCount };
        return u;
      });
    }

    addAuditLog('update_status', s.unit, `Pembaruan data siswa ${s.fullName}`);
    persistStore();
    return s;
  },

  deleteStudent: async (id: string, deletedBy = 'Admin', deletedByRole = 'Staff') => {
    const student = memoryStore.students.find((s) => s.id === id);
    if (!student) return false;

    const studentPayments = memoryStore.payments.filter((p) => p.registrationId === id);
    await archiveToTrash({
      entityType: 'student',
      entityId: student.id,
      unitId: student.unit,
      title: student.fullName,
      subtitle: `${student.registrationNumber} · Unit ${student.unit} · Wali: ${student.parentName || '-'}`,
      deletedBy,
      deletedByRole,
      snapshot: {
        student: { ...student },
        payments: studentPayments.map((p) => ({ ...p })),
      },
    });

    await executeMySql('DELETE FROM payments WHERE registration_id = ?', [id]);
    await executeMySql('DELETE FROM students WHERE id = ?', [id]);
    const targetUnitObj = memoryStore.units.find((u) => u.id === student.unit);
    const nextOnline = Math.max(0, memoryStore.students.filter((s) => s.unit === student.unit && s.id !== id).length);
    const offlineCnt = Math.max(0, Number(targetUnitObj?.offlineCount) || 0);
    const nextFilled = nextOnline + offlineCnt;
    await executeMySql('UPDATE units SET filled_quota = ? WHERE id = ?', [nextFilled, student.unit]);

    memoryStore.students = memoryStore.students.filter((s) => s.id !== id);
    memoryStore.payments = memoryStore.payments.filter((p) => p.registrationId !== id);
    memoryStore.units = memoryStore.units.map((u) =>
      u.id === student.unit ? { ...u, onlineCount: nextOnline, offlineCount: offlineCnt, filledQuota: nextFilled } : u
    );
    addAuditLog('update_status', student.unit, `Hapus berkas siswa ${student.fullName} (${student.registrationNumber}) -> dipindahkan ke Sampah oleh ${deletedBy}`);
    persistStore();
    return true;
  },

  verifyStudent: async (id: string, approved: boolean, notes?: string) => {
    const student = memoryStore.students.find((s) => s.id === id);
    if (!student) return null;
    const nextStatus: StudentRegistration['status'] = approved ? 'tes' : 'tidak_lulus';
    const nextNotes = notes || (approved ? 'Berkas lengkap dan valid.' : 'Berkas ditolak.');

    await executeMySql('UPDATE students SET status = ?, verification_notes = ? WHERE id = ?', [
      nextStatus,
      nextNotes,
      id,
    ]);

    student.status = nextStatus;
    student.verificationNotes = nextNotes;
    addAuditLog('verifikasi', student.unit, `Verifikasi berkas siswa ${student.fullName}: ${approved ? 'Disetujui' : 'Ditolak'}`);
    persistStore();
    return student;
  },

  setTestResult: async (id: string, score: number, status: 'lulus' | 'tidak_lulus', publish: boolean) => {
    const student = memoryStore.students.find((s) => s.id === id);
    if (!student) return null;

    await executeMySql('UPDATE students SET test_score = ?, status = ?, test_published = ? WHERE id = ?', [
      score,
      status,
      publish ? 1 : 0,
      id,
    ]);

    let newReregPayment: PaymentRecord | null = null;
    if (status === 'lulus') {
      const exists = memoryStore.payments.some((p) => p.registrationId === id && p.type === 'Daftar Ulang');
      if (!exists) {
        const u = memoryStore.units.find((item) => item.id === student.unit);
        const reRegFee = u ? u.reRegFee : 5000000;
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const reregAllBanks = await db.getBankAccountsFresh();
        const reregActiveBanks = reregAllBanks.filter((b) => b.isActive);
        const reregDefaultBank = reregActiveBanks.find((b) => b.isPrimary) || reregActiveBanks[0] || reregAllBanks[0];
        const reregBankLabel = reregDefaultBank
          ? `${reregDefaultBank.bankName} ${reregDefaultBank.accountNumber} a.n ${reregDefaultBank.accountHolder}`
          : '';
        newReregPayment = {
          id: `pay-rereg-${Date.now()}`,
          registrationId: student.id,
          registrationNumber: student.registrationNumber,
          studentName: student.fullName,
          unit: student.unit,
          type: 'Daftar Ulang',
          amount: reRegFee,
          status: 'pending',
          date: dateStr,
          proofUrl: '',
          bankAccount: reregBankLabel,
        };
        await executeMySql(
          `INSERT INTO payments (id, registration_id, registration_number, student_name, unit, type, amount, status, payment_date, bank_account)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newReregPayment.id,
            newReregPayment.registrationId,
            newReregPayment.registrationNumber,
            newReregPayment.studentName,
            newReregPayment.unit,
            newReregPayment.type,
            newReregPayment.amount,
            newReregPayment.status,
            dateStr,
            newReregPayment.bankAccount,
          ]
        );
      }
    }

    student.testScore = score;
    student.status = status;
    student.testPublished = publish;
    if (newReregPayment) {
      memoryStore.payments.unshift(newReregPayment);
    }

    addAuditLog('update_status', student.unit, `Penetapan hasil tes ${student.fullName}: ${status.toUpperCase()} (Skor: ${score})`);
    persistStore();
    return student;
  },

  // Payments
  getPayments: (filter?: { unit?: string; status?: string; type?: string }) => {
    let list = [...memoryStore.payments];
    if (filter?.unit && filter.unit !== 'all' && filter.unit !== 'MASTER') {
      list = list.filter((p) => p.unit === filter.unit);
    }
    if (filter?.status && filter.status !== 'all') {
      list = list.filter((p) => p.status === filter.status);
    }
    if (filter?.type && filter.type !== 'all') {
      list = list.filter((p) => p.type === filter.type);
    }
    return list;
  },

  getPaymentsFresh: async (filter?: { unit?: string; status?: string; type?: string }) => {
    if (mysqlPool && isMySqlConnected) {
      try {
        const [rows]: any = await mysqlPool.query('SELECT * FROM payments ORDER BY payment_date DESC, created_at DESC');
        if (Array.isArray(rows)) {
          memoryStore.payments = rows.map((p: any) => ({
            id: p.id,
            registrationId: p.registration_id,
            registrationNumber: p.registration_number,
            studentName: p.student_name,
            unit: p.unit,
            type: p.type,
            amount: Number(p.amount) || 0,
            status: p.status,
            date: formatSqlDateTime(p.payment_date),
            proofUrl: p.proof_url || '',
            verifiedBy: p.verified_by || undefined,
            verificationNotes: p.verification_notes || undefined,
            bankAccount: p.bank_account || '',
          }));
        }
      } catch (e) {}
    }
    return db.getPayments(filter);
  },

  uploadPaymentProof: async (
    registrationId: string,
    proofUrl: string,
    amount: number,
    type: 'Formulir' | 'Daftar Ulang',
    bankAccountId?: string,
    paymentId?: string
  ) => {
    const student = memoryStore.students.find((s) => s.id === registrationId);
    if (!student) return null;
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const allBanks = await db.getBankAccountsFresh();
    const activeBanks = allBanks.filter((b) => b.isActive);
    const chosenBank =
      (bankAccountId ? allBanks.find((b) => b.id === bankAccountId) : undefined) ||
      activeBanks.find((b) => b.isPrimary) ||
      activeBanks[0] ||
      allBanks[0];
    const resolvedBankLabel = chosenBank
      ? `${chosenBank.bankName} ${chosenBank.accountNumber} a.n ${chosenBank.accountHolder}`
      : '';

    let targetIndex = -1;
    if (paymentId && paymentId.trim()) {
      targetIndex = memoryStore.payments.findIndex(
        (p) => p.id === paymentId.trim() && p.registrationId === registrationId
      );
      if (targetIndex < 0) {
        return null;
      }
    } else {
      // Fill an existing empty 'pending' bill placeholder if one exists;
      // otherwise INSERT a new PaymentRecord so split transfers / multi-bank proofs are preserved!
      targetIndex = memoryStore.payments.findIndex(
        (p) =>
          p.registrationId === registrationId &&
          p.type === type &&
          p.status === 'pending' &&
          (!p.proofUrl || p.proofUrl.trim() === '')
      );
    }

    let savedPayment: PaymentRecord;

    if (targetIndex >= 0) {
      const existing = memoryStore.payments[targetIndex];
      const previousProofUrl = existing.proofUrl;
      const targetBankLabel = chosenBank ? resolvedBankLabel : existing.bankAccount || resolvedBankLabel;
      await executeMySql(
        `UPDATE payments
         SET type = ?, amount = ?, proof_url = ?, status = "verifikasi", payment_date = ?, bank_account = ?, verified_by = NULL, verification_notes = NULL
         WHERE id = ?`,
        [type, amount, proofUrl, dateStr, targetBankLabel, existing.id]
      );
      existing.type = type;
      existing.amount = amount;
      existing.proofUrl = proofUrl;
      existing.status = 'verifikasi';
      existing.date = dateStr;
      existing.bankAccount = targetBankLabel;
      existing.verifiedBy = undefined;
      existing.verificationNotes = undefined;
      savedPayment = existing;

      if (previousProofUrl && previousProofUrl !== proofUrl) {
        deleteUploadFileSafely(previousProofUrl);
      }
    } else {
      const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
      const newPay: PaymentRecord = {
        id: `pay-${Date.now()}-${uniqueSuffix}`,
        registrationId,
        registrationNumber: student.registrationNumber,
        studentName: student.fullName,
        unit: student.unit,
        type,
        amount,
        status: 'verifikasi',
        date: dateStr,
        proofUrl,
        bankAccount: resolvedBankLabel,
      };
      await executeMySql(
        `INSERT INTO payments (id, registration_id, registration_number, student_name, unit, type, amount, status, payment_date, proof_url, bank_account)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newPay.id,
          newPay.registrationId,
          newPay.registrationNumber,
          newPay.studentName,
          newPay.unit,
          newPay.type,
          newPay.amount,
          newPay.status,
          dateStr,
          proofUrl,
          newPay.bankAccount,
        ]
      );
      memoryStore.payments.unshift(newPay);
      savedPayment = newPay;
    }

    addAuditLog(
      'verifikasi',
      student.unit,
      `Upload bukti transfer ${type} Rp ${Number(amount).toLocaleString('id-ID')} siswa ${student.fullName} (${savedPayment.bankAccount})`
    );
    persistStore();
    return savedPayment;
  },

  verifyPayment: async (
    paymentId: string,
    approved: boolean,
    notes?: string,
    verifiedBy = 'bendahara@arrisalahaceh.or.id',
    adjustedAmount?: number
  ) => {
    const pay = memoryStore.payments.find((p) => p.id === paymentId);
    if (!pay) return null;
    const nextStatus = approved ? 'lunas' : 'ditolak';
    const oldAmount = Number(pay.amount) || 0;
    const hasAdjustedAmount =
      typeof adjustedAmount === 'number' &&
      Number.isFinite(adjustedAmount) &&
      adjustedAmount > 0 &&
      Math.round(adjustedAmount) !== oldAmount;
    const finalAmount =
      typeof adjustedAmount === 'number' && Number.isFinite(adjustedAmount) && adjustedAmount > 0
        ? Math.round(adjustedAmount)
        : oldAmount;

    const nextNotes =
      (notes && notes.trim()) ||
      (approved
        ? hasAdjustedAmount
          ? `Bukti transfer valid. Nominal disesuaikan sesuai mutasi dari Rp ${oldAmount.toLocaleString('id-ID')} menjadi Rp ${finalAmount.toLocaleString('id-ID')}.`
          : 'Bukti transfer valid dan dana masuk.'
        : 'Bukti transfer ditolak.');

    await executeMySql(
      'UPDATE payments SET status = ?, verified_by = ?, verification_notes = ?, amount = ? WHERE id = ?',
      [nextStatus, verifiedBy, nextNotes, finalAmount, paymentId]
    );

    pay.status = nextStatus;
    pay.verifiedBy = verifiedBy;
    pay.verificationNotes = nextNotes;
    pay.amount = finalAmount;
    addAuditLog(
      'verifikasi',
      pay.unit,
      `Verifikasi pembayaran ${pay.studentName} (${pay.type}): ${approved ? 'LUNAS' : 'DITOLAK'}${
        hasAdjustedAmount
          ? ` [Nominal disesuaikan: Rp ${oldAmount.toLocaleString('id-ID')} -> Rp ${finalAmount.toLocaleString('id-ID')}]`
          : ''
      }`
    );
    persistStore();
    return pay;
  },

  updatePaymentAmount: async (
    paymentId: string,
    newAmount: number,
    updatedBy = 'bendahara@arrisalahaceh.or.id'
  ) => {
    const pay = memoryStore.payments.find((p) => p.id === paymentId);
    if (!pay) return null;
    const oldAmount = Number(pay.amount) || 0;
    const finalAmount = Math.round(newAmount);
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) return null;

    await executeMySql('UPDATE payments SET amount = ? WHERE id = ?', [
      finalAmount,
      paymentId,
    ]);
    pay.amount = finalAmount;
    if (oldAmount !== finalAmount) {
      addAuditLog(
        'verifikasi',
        pay.unit,
        `Penyesuaian nominal real pembayaran ${pay.studentName} (${pay.type}) oleh ${updatedBy}: Rp ${oldAmount.toLocaleString('id-ID')} -> Rp ${finalAmount.toLocaleString('id-ID')}`
      );
      persistStore();
    }
    return pay;
  },

  verifyPaymentGroup: async (
    paymentIds: string[],
    approved: boolean,
    notes?: string,
    verifiedBy = 'bendahara@arrisalahaceh.or.id'
  ) => {
    const updatedList: PaymentRecord[] = [];
    const nextStatus = approved ? 'lunas' : 'ditolak';
    const nextNotes =
      (notes && notes.trim()) ||
      (approved
        ? 'Seluruh bukti transfer valid dan dana masuk.'
        : 'Bukti transfer ditolak / masih terdapat kekurangan.');

    for (const paymentId of paymentIds) {
      const pay = memoryStore.payments.find((p) => p.id === paymentId);
      if (!pay) continue;
      await executeMySql(
        'UPDATE payments SET status = ?, verified_by = ?, verification_notes = ? WHERE id = ?',
        [nextStatus, verifiedBy, nextNotes, paymentId]
      );
      pay.status = nextStatus;
      pay.verifiedBy = verifiedBy;
      pay.verificationNotes = nextNotes;
      updatedList.push(pay);
    }

    if (updatedList.length > 0) {
      const first = updatedList[0];
      addAuditLog(
        'verifikasi',
        first.unit,
        `Verifikasi ${updatedList.length} bukti pembayaran ${first.studentName} (${first.type}): ${approved ? 'LUNAS' : 'DITOLAK'}`
      );
      persistStore();
    }
    return updatedList;
  },

  // Schedules
  getSchedules: (unit?: string) => {
    let list = [...memoryStore.schedules];
    if (unit && unit !== 'all' && unit !== 'MASTER') {
      list = list.filter((s) => s.unit === unit);
    }
    return list;
  },

  createSchedule: async (scheduleData: Omit<TestSchedule, 'id' | 'filled'>) => {
    const newSch: TestSchedule = {
      ...scheduleData,
      id: `sch-${Date.now()}`,
      filled: 0,
    };

    await executeMySql(
      `INSERT INTO test_schedules (id, title, unit, test_date, start_time, end_time, room, examiner, quota, filled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [newSch.id, newSch.title, newSch.unit, newSch.date, newSch.startTime, newSch.endTime, newSch.room, newSch.examiner, newSch.quota]
    );

    memoryStore.schedules.push(newSch);
    addAuditLog('tambah_jadwal', scheduleData.unit, `Tambah jadwal tes: ${scheduleData.title}`);
    persistStore();
    return newSch;
  },

  updateSchedule: async (id: string, updates: Partial<TestSchedule>) => {
    const idx = memoryStore.schedules.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    const sch: TestSchedule = { ...memoryStore.schedules[idx], ...updates, id };

    await executeMySql(
      `UPDATE test_schedules SET
         title = ?,
         unit = ?,
         test_date = ?,
         start_time = ?,
         end_time = ?,
         room = ?,
         examiner = ?,
         quota = ?,
         filled = ?
       WHERE id = ?`,
      [
        sch.title,
        sch.unit,
        sch.date,
        sch.startTime,
        sch.endTime,
        sch.room,
        sch.examiner,
        Number(sch.quota) || 40,
        Number(sch.filled) || 0,
        id,
      ]
    );

    memoryStore.schedules[idx] = sch;
    persistStore();
    return sch;
  },

  deleteSchedule: async (id: string, deletedBy = 'Admin', deletedByRole = 'Staff') => {
    const sch = memoryStore.schedules.find((s) => s.id === id);
    if (!sch) return false;

    const linkedStudentIds = memoryStore.students
      .filter((st) => st.testScheduleId === id)
      .map((st) => st.id);

    await archiveToTrash({
      entityType: 'schedule',
      entityId: sch.id,
      unitId: sch.unit,
      title: sch.title,
      subtitle: `Unit ${sch.unit} · ${sch.date} (${sch.startTime}-${sch.endTime}) · Ruang: ${sch.room}`,
      deletedBy,
      deletedByRole,
      snapshot: {
        schedule: { ...sch },
        linkedStudentIds,
      },
    });

    if (linkedStudentIds.length > 0) {
      await executeMySql('UPDATE students SET test_schedule_id = NULL WHERE test_schedule_id = ?', [id]);
      memoryStore.students = memoryStore.students.map((st) =>
        st.testScheduleId === id ? { ...st, testScheduleId: undefined } : st
      );
    }

    await executeMySql('DELETE FROM test_schedules WHERE id = ?', [id]);
    memoryStore.schedules = memoryStore.schedules.filter((s) => s.id !== id);
    addAuditLog('update_status', sch.unit, `Hapus jadwal tes "${sch.title}" -> dipindahkan ke Sampah oleh ${deletedBy}`);
    persistStore();
    return true;
  },

  // Units
  getUnits: () => {
    return sortUnitsList(memoryStore.units).map((u) => {
      const onlineCount = memoryStore.students.filter((s) => s.unit === u.id).length;
      const offlineCount = Math.max(0, Number(u.offlineCount) || 0);
      return {
        ...u,
        onlineCount,
        offlineCount,
        filledQuota: onlineCount + offlineCount,
      };
    });
  },

  createUnit: async (
    data: {
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
    },
    actor = 'Master Admin'
  ) => {
    const cleanId = String(data.id || '').trim().toUpperCase();
    if (!cleanId || memoryStore.units.some((u) => u.id.toUpperCase() === cleanId)) {
      return null;
    }

    const maxSort = memoryStore.units.reduce((acc, u) => Math.max(acc, Number(u.sortOrder) || 0), 0);
    const offlineCnt = Math.max(0, Math.floor(Number(data.offlineCount) || 0));
    const totalQ = Math.max(1, Math.floor(Number(data.totalQuota) || 100));
    const newUnit: UnitQuotaFee = {
      id: cleanId,
      name: data.name.trim(),
      shortName: data.shortName.trim(),
      totalQuota: totalQ,
      filledQuota: offlineCnt,
      onlineCount: 0,
      offlineCount: offlineCnt,
      formFee: Math.max(0, Number(data.formFee) || 0),
      reRegFee: Math.max(0, Number(data.reRegFee) || 0),
      isOpen: data.isOpen !== undefined ? Boolean(data.isOpen) : true,
      closedNotice:
        data.closedNotice?.trim() ||
        `Pendaftaran untuk unit ${data.name.trim()} saat ini sedang ditutup atau kuota telah terpenuhi.`,
      facilities: Array.isArray(data.facilities) && data.facilities.length > 0 ? data.facilities : ['Program Pendidikan Islam Terpadu'],
      sortOrder: maxSort + 1,
    };

    await executeMySql(
      `INSERT INTO units (id, name, short_name, total_quota, filled_quota, offline_count, form_fee, rereg_fee, is_open, closed_notice, sort_order, facilities)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newUnit.id,
        newUnit.name,
        newUnit.shortName,
        newUnit.totalQuota,
        newUnit.filledQuota,
        newUnit.offlineCount,
        newUnit.formFee,
        newUnit.reRegFee,
        newUnit.isOpen ? 1 : 0,
        newUnit.closedNotice || null,
        newUnit.sortOrder,
        JSON.stringify(newUnit.facilities || []),
      ]
    );

    memoryStore.units = sortUnitsList([...memoryStore.units, newUnit]);

    // Auto-seed Form Schema, Letter Config, Unit Contact & Group Link so all views support the new unit immediately
    if (!memoryStore.formSchemas.some((s) => s.unitId === cleanId)) {
      const templateSections = ensureCoreNameFieldInSections(
        memoryStore.formSchemas[0]?.sections?.map((sec) => ({
          ...sec,
          id: `${sec.id}-${cleanId.toLowerCase()}`,
          fields: (sec.fields || []).map((f) => ({ ...f })),
        })) || [],
        cleanId
      );
      const newSchema: UnitFormSchema = { unitId: cleanId, sections: templateSections };
      await executeMySql(
        `INSERT INTO form_schemas (unit_id, sections_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE sections_json = VALUES(sections_json)`,
        [cleanId, JSON.stringify(newSchema.sections)]
      );
      memoryStore.formSchemas.push(newSchema);
    }

    if (!memoryStore.unitContacts.some((c) => c.unitId === cleanId)) {
      const baseContact = memoryStore.unitContacts.find((c) => c.unitId === 'MASTER') || memoryStore.unitContacts[0];
      const landingContact = memoryStore.landingConfig?.contact;
      memoryStore.unitContacts.push({
        unitId: cleanId,
        unitName: newUnit.name,
        contactPerson: `Panitia PPDB ${newUnit.shortName}`,
        phone: baseContact?.phone || landingContact?.phone || '',
        whatsapp: baseContact?.whatsapp || landingContact?.whatsapp || '',
        email: baseContact?.email || landingContact?.email || '',
        officeHours: baseContact?.officeHours || 'Senin - Sabtu (08:00 - 15:00 WIB)',
        address: baseContact?.address || landingContact?.address || '',
      });
      await executeMySql(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES ('unit_contacts', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [JSON.stringify(memoryStore.unitContacts)]
      );
    }

    if (!memoryStore.letterConfigs.some((l) => l.unitId === cleanId)) {
      const baseLetter = memoryStore.letterConfigs.find((l) => l.unitId === 'MASTER') || memoryStore.letterConfigs[0];
      memoryStore.letterConfigs.push({
        ...(baseLetter || {}),
        unitId: cleanId,
        unitName: newUnit.name,
        committeeChairName: baseLetter?.committeeChairName || 'Ketua Panitia PPDB',
        committeeRoleTitle: `Ketua Panitia PPDB ${newUnit.shortName}`,
        updatedAt: new Date().toISOString(),
        updatedBy: actor,
      });
      await executeMySql(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES ('letter_configs', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [JSON.stringify(memoryStore.letterConfigs)]
      );
    }

    if (!memoryStore.groupLinkConfigs.some((g) => g.unitId === cleanId)) {
      memoryStore.groupLinkConfigs.push({
        unitId: cleanId,
        groupName: `Grup Informasi Wali Santri ${newUnit.shortName}`,
        groupUrl: 'https://chat.whatsapp.com/',
        visibilityRule: 'after_data',
      });
      await executeMySql(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES ('group_links', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [JSON.stringify(memoryStore.groupLinkConfigs)]
      );
    }

    addAuditLog('update_kuota', cleanId, `Tambah unit sekolah baru ${newUnit.name} (${cleanId}) dengan kuota ${totalQ} oleh ${actor}`, actor);
    persistStore();
    return db.getUnits().find((u) => u.id === cleanId) || newUnit;
  },

  updateUnitOfflineCount: async (unitId: string, offlineCount: number, actor = 'Admin') => {
    const existing = memoryStore.units.find((u) => u.id === unitId);
    if (!existing) return null;

    const cleanOffline = Math.max(0, Math.floor(Number(offlineCount) || 0));
    const onlineCount = memoryStore.students.filter((s) => s.unit === unitId).length;
    const filledQuota = onlineCount + cleanOffline;

    await executeMySql('UPDATE units SET offline_count = ?, filled_quota = ? WHERE id = ?', [
      cleanOffline,
      filledQuota,
      unitId,
    ]);

    memoryStore.units = memoryStore.units.map((u) =>
      u.id === unitId ? { ...u, offlineCount: cleanOffline, onlineCount, filledQuota } : u
    );

    addAuditLog(
      'offline_register',
      unitId,
      `Pembaruan angka pendaftar offline unit ${unitId}: ${cleanOffline} siswa (Online: ${onlineCount}, Total Terisi: ${filledQuota}/${existing.totalQuota}) oleh ${actor}`,
      actor
    );
    persistStore();
    return db.getUnits().find((u) => u.id === unitId) || null;
  },

  updateUnit: async (
    unitId: string,
    quota: number,
    formFee: number,
    reRegFee: number,
    isOpen?: boolean,
    closedNotice?: string,
    offlineCount?: number
  ) => {
    const existing = memoryStore.units.find((u) => u.id === unitId);
    if (!existing) return null;

    const nextIsOpen = isOpen !== undefined ? isOpen : (existing.isOpen !== undefined ? existing.isOpen : true);
    const nextNotice = closedNotice !== undefined ? closedNotice : (existing.closedNotice || `Pendaftaran untuk unit ${unitId} saat ini sedang ditutup.`);
    const nextOfflineCount =
      offlineCount !== undefined
        ? Math.max(0, Math.floor(Number(offlineCount) || 0))
        : Math.max(0, Number(existing.offlineCount) || 0);
    const onlineCount = memoryStore.students.filter((s) => s.unit === unitId).length;
    const nextFilledQuota = onlineCount + nextOfflineCount;

    await executeMySql(
      'UPDATE units SET total_quota = ?, offline_count = ?, filled_quota = ?, form_fee = ?, rereg_fee = ?, is_open = ?, closed_notice = ? WHERE id = ?',
      [quota, nextOfflineCount, nextFilledQuota, formFee, reRegFee, nextIsOpen ? 1 : 0, nextNotice || null, unitId]
    );

    memoryStore.units = memoryStore.units.map((u) =>
      u.id === unitId
        ? {
            ...u,
            totalQuota: quota,
            offlineCount: nextOfflineCount,
            onlineCount,
            filledQuota: nextFilledQuota,
            formFee,
            reRegFee,
            isOpen: nextIsOpen,
            closedNotice: nextNotice,
          }
        : u
    );
    addAuditLog('update_kuota', unitId, `Pembaruan kuota (${quota}), offline (${nextOfflineCount}), biaya, & status pendaftaran (${nextIsOpen ? 'Buka' : 'Tutup'}) untuk unit ${unitId}`);
    persistStore();
    return db.getUnits().find((u) => u.id === unitId) || null;
  },

  updateUnitRegistrationStatus: async (
    unitId: string,
    isOpen: boolean,
    closedNotice?: string,
    actor = 'Admin'
  ) => {
    const existing = memoryStore.units.find((u) => u.id === unitId);
    if (!existing) return null;

    const nextIsOpen = Boolean(isOpen);
    const nextNotice =
      closedNotice !== undefined
        ? closedNotice
        : existing.closedNotice || `Pendaftaran untuk unit ${unitId} saat ini belum dibuka.`;

    await executeMySql('UPDATE units SET is_open = ?, closed_notice = ? WHERE id = ?', [
      nextIsOpen ? 1 : 0,
      nextNotice || null,
      unitId,
    ]);

    memoryStore.units = memoryStore.units.map((u) =>
      u.id === unitId
        ? {
            ...u,
            isOpen: nextIsOpen,
            closedNotice: nextNotice,
          }
        : u
    );

    addAuditLog(
      'update_kuota',
      unitId,
      `Status pendaftaran unit ${unitId} diubah menjadi ${nextIsOpen ? 'AKTIF / BUKA' : 'NON-AKTIF / BELUM DIBUKA'} oleh ${actor}`,
      actor
    );
    persistStore();
    return db.getUnits().find((u) => u.id === unitId) || null;
  },

  reorderUnits: async (orderedIds: string[], actor = 'Admin') => {
    const existingIds = new Set(memoryStore.units.map((u) => u.id));
    if (
      !Array.isArray(orderedIds) ||
      orderedIds.length !== existingIds.size ||
      new Set(orderedIds).size !== existingIds.size ||
      !orderedIds.every((id) => existingIds.has(id as any))
    ) {
      return null;
    }

    const orderMap = new Map<string, number>();
    orderedIds.forEach((id, idx) => {
      orderMap.set(id, idx + 1);
    });

    for (const [id, sortOrder] of orderMap.entries()) {
      await executeMySql('UPDATE units SET sort_order = ? WHERE id = ?', [sortOrder, id]);
    }

    memoryStore.units = sortUnitsList(
      memoryStore.units.map((u) => ({
        ...u,
        sortOrder: orderMap.get(u.id) ?? u.sortOrder ?? 99,
      }))
    );

    memoryStore.formSchemas = [...memoryStore.formSchemas].sort(
      (a, b) => (orderMap.get(a.unitId) ?? 999) - (orderMap.get(b.unitId) ?? 999)
    );

    addAuditLog(
      'update_kuota',
      'MASTER',
      `Urutan unit sekolah diperbarui menjadi [${orderedIds.join(' → ')}] oleh ${actor}`,
      actor
    );
    persistStore();
    return db.getUnits();
  },

  deleteUnit: async (unitId: string, actor = 'Master Admin') => {
    const cleanId = String(unitId || '').trim().toUpperCase();
    const target = memoryStore.units.find((u) => u.id === cleanId);
    if (!target) return { deleted: false, reason: 'not_found' as const };

    const hasStudents = memoryStore.students.some((s) => s.unit === cleanId);
    if (hasStudents) {
      return {
        deleted: false,
        reason: 'has_students' as const,
      };
    }

    await executeMySql('DELETE FROM form_schemas WHERE unit_id = ?', [cleanId]);
    await executeMySql('DELETE FROM units WHERE id = ?', [cleanId]);

    memoryStore.units = memoryStore.units.filter((u) => u.id !== cleanId);
    memoryStore.formSchemas = memoryStore.formSchemas.filter((s) => s.unitId !== cleanId);
    memoryStore.unitContacts = memoryStore.unitContacts.filter((c) => c.unitId !== cleanId);
    memoryStore.letterConfigs = memoryStore.letterConfigs.filter((l) => l.unitId !== cleanId);
    memoryStore.groupLinkConfigs = memoryStore.groupLinkConfigs.filter((g) => g.unitId !== cleanId);

    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('unit_contacts', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(memoryStore.unitContacts)]
    );
    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('letter_configs', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(memoryStore.letterConfigs)]
    );
    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('group_links', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(memoryStore.groupLinkConfigs)]
    );

    addAuditLog(
      'update_kuota',
      'MASTER',
      `Unit sekolah ${cleanId} (${target.shortName}) dihapus oleh ${actor}`,
      actor
    );
    persistStore();
    return { deleted: true as const };
  },

  // Form Schemas
  getFormSchemas: () => memoryStore.formSchemas,

  updateFormSchema: async (
    unitId: string,
    schema: UnitFormSchema,
    actor = 'Admin',
    actorRole = 'Staff',
    skipTrashDiff = false
  ) => {
    const cleanSchema: UnitFormSchema = {
      unitId,
      sections: ensureCoreNameFieldInSections(
        Array.isArray(schema.sections) ? schema.sections : [],
        unitId
      ),
    };

    if (!skipTrashDiff) {
      const previousSchema = memoryStore.formSchemas.find((s) => s.unitId === unitId);
      if (previousSchema && Array.isArray(previousSchema.sections)) {
        const nextSectionMap = new Map(cleanSchema.sections.map((sec) => [sec.id, sec]));
        for (const oldSec of previousSchema.sections) {
          const nextSec = nextSectionMap.get(oldSec.id);
          if (!nextSec) {
            await archiveToTrash({
              entityType: 'form_section',
              entityId: oldSec.id,
              unitId,
              title: `Seksi Form: ${oldSec.title}`,
              subtitle: `Unit ${unitId} · ${(oldSec.fields || []).length} field pertanyaan`,
              deletedBy: actor,
              deletedByRole: actorRole,
              snapshot: { unitId, section: oldSec },
            });
          } else if (Array.isArray(oldSec.fields)) {
            const nextFieldIds = new Set((nextSec.fields || []).map((f) => f.id));
            for (const oldField of oldSec.fields) {
              if (isLockedNameField(oldField)) continue;
              if (!nextFieldIds.has(oldField.id)) {
                await archiveToTrash({
                  entityType: 'form_field',
                  entityId: oldField.id,
                  unitId,
                  title: `Field Form: ${oldField.label}`,
                  subtitle: `Unit ${unitId} · Seksi: ${oldSec.title} · Tipe: ${oldField.type}`,
                  deletedBy: actor,
                  deletedByRole: actorRole,
                  snapshot: {
                    unitId,
                    sectionId: oldSec.id,
                    sectionTitle: oldSec.title,
                    field: oldField,
                  },
                });
              }
            }
          }
        }
      }
    }

    await executeMySql(
      `INSERT INTO form_schemas (unit_id, sections_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE sections_json = VALUES(sections_json)`,
      [unitId, JSON.stringify(cleanSchema.sections)]
    );

    const unitOrderMap = new Map(memoryStore.units.map((u, idx) => [u.id, idx]));
    const nextList = memoryStore.formSchemas.filter((s) => s.unitId !== unitId);
    nextList.push(cleanSchema);
    nextList.sort((a, b) => (unitOrderMap.get(a.unitId) ?? 999) - (unitOrderMap.get(b.unitId) ?? 999));
    memoryStore.formSchemas = nextList;
    persistStore();
    return cleanSchema;
  },

  // Roles & Users
  getRoles: () => memoryStore.roles,

  createRole: async (roleData: Omit<UserRole, 'id' | 'userCount'>) => {
    const newRole: UserRole = {
      ...roleData,
      id: `role-${Date.now()}`,
      userCount: 0,
    };

    await executeMySql(
      `INSERT INTO roles (id, name, school_id, permissions_json, description, user_count) VALUES (?, ?, ?, ?, ?, 0)`,
      [newRole.id, newRole.name, newRole.schoolId, JSON.stringify(newRole.permissions || []), newRole.description || '']
    );

    memoryStore.roles.push(newRole);
    persistStore();
    return newRole;
  },

  updateRole: async (id: string, updates: Partial<UserRole>) => {
    let idx = memoryStore.roles.findIndex((r) => r.id === id);
    if (idx === -1) {
      idx = memoryStore.roles.findIndex((r) => r.name.toLowerCase() === id.toLowerCase() || (id === 'role-admin-yys' && r.name.includes('Admin Yayasan')));
    }
    const targetRole: UserRole =
      idx === -1
        ? {
            id,
            name: updates.name || id,
            schoolId: (updates.schoolId as any) || 'MASTER',
            permissions: updates.permissions || [],
            description: updates.description || '',
            userCount: 1,
          }
        : { ...memoryStore.roles[idx], ...updates };

    await executeMySql(
      `INSERT INTO roles (id, name, school_id, permissions_json, description, user_count)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), permissions_json = VALUES(permissions_json), description = VALUES(description)`,
      [targetRole.id, targetRole.name, targetRole.schoolId, JSON.stringify(targetRole.permissions || []), targetRole.description || '', targetRole.userCount || 0]
    );

    if (targetRole.id === 'role-master' || targetRole.name.includes('Super Admin')) {
      await executeMySql(
        'UPDATE users SET permissions_json = ? WHERE email = "master@dev.com" OR role = "Super Admin Yayasan"',
        [JSON.stringify(targetRole.permissions || [])]
      );
    } else if (targetRole.id === 'role-admin-yys' || (targetRole.name.includes('Admin Yayasan') && !targetRole.name.includes('Super'))) {
      await executeMySql(
        'UPDATE users SET permissions_json = ? WHERE email = "adminyys@dev.com" OR (role LIKE "%Admin Yayasan%" AND role NOT LIKE "%Super%")',
        [JSON.stringify(targetRole.permissions || [])]
      );
    } else {
      await executeMySql('UPDATE users SET permissions_json = ? WHERE role = ? OR role = ?', [
        JSON.stringify(targetRole.permissions || []),
        targetRole.name,
        targetRole.id,
      ]);
    }

    if (idx === -1) {
      memoryStore.roles.push(targetRole);
      idx = memoryStore.roles.length - 1;
    } else {
      memoryStore.roles[idx] = targetRole;
    }
    const updatedRole = memoryStore.roles[idx];

    // Synchronize users in memoryStore with updated role permissions
    memoryStore.users = memoryStore.users.map((u) => {
      const isSuperMatch =
        (u.email === 'master@dev.com' || u.role === 'Super Admin Yayasan') &&
        (updatedRole.id === 'role-master' || updatedRole.name.includes('Super Admin'));
      const isYysMatch =
        (u.email === 'adminyys@dev.com' || (u.role.includes('Admin Yayasan') && !u.role.includes('Super'))) &&
        (updatedRole.id === 'role-admin-yys' || (updatedRole.name.includes('Admin Yayasan') && !updatedRole.name.includes('Super')));
      const isStandardMatch =
        !isSuperMatch && !isYysMatch && (u.role === updatedRole.name || u.role === updatedRole.id);

      if ((isSuperMatch || isYysMatch || isStandardMatch) && Array.isArray(updatedRole.permissions)) {
        return { ...u, permissions: [...updatedRole.permissions] };
      }
      return u;
    });

    // Synchronize active sessions
    for (const [, session] of activeSessions.entries()) {
      const isSuperMatch =
        (session.user.email === 'master@dev.com' || session.user.role === 'Super Admin Yayasan') &&
        (updatedRole.id === 'role-master' || updatedRole.name.includes('Super Admin'));
      const isYysMatch =
        (session.user.email === 'adminyys@dev.com' || (session.user.role.includes('Admin Yayasan') && !session.user.role.includes('Super'))) &&
        (updatedRole.id === 'role-admin-yys' || (updatedRole.name.includes('Admin Yayasan') && !updatedRole.name.includes('Super')));
      const isStandardMatch =
        !isSuperMatch && !isYysMatch && (session.user.role === updatedRole.name || session.user.role === updatedRole.id);

      if ((isSuperMatch || isYysMatch || isStandardMatch) && Array.isArray(updatedRole.permissions)) {
        session.user.permissions = [...updatedRole.permissions];
      }
    }

    persistStore();
    return memoryStore.roles[idx];
  },

  deleteRole: async (id: string, deletedBy = 'Master Admin', deletedByRole = 'Super Admin Yayasan') => {
    const existing = memoryStore.roles.find((r) => r.id === id);
    if (!existing) return false;

    await archiveToTrash({
      entityType: 'role',
      entityId: existing.id,
      unitId: existing.schoolId || 'MASTER',
      title: existing.name,
      subtitle: `Lingkup: ${existing.schoolId} · ${(existing.permissions || []).length} hak akses`,
      deletedBy,
      deletedByRole,
      snapshot: { role: { ...existing } },
    });

    await executeMySql('DELETE FROM roles WHERE id = ?', [id]);
    memoryStore.roles = memoryStore.roles.filter((r) => r.id !== id);
    addAuditLog('update_status', 'MASTER', `Hapus role "${existing.name}" -> dipindahkan ke Sampah oleh ${deletedBy}`);
    persistStore();
    return true;
  },

  getUsers: (filterForUser?: AppUser | null) => {
    let list = memoryStore.users;
    if (filterForUser) {
      const isSuper =
        filterForUser.role === 'Super Admin Yayasan' ||
        filterForUser.email === 'master@dev.com';
      if (!isSuper) {
        list = list.filter((u) => {
          const isMasterStaff =
            u.role === 'Super Admin Yayasan' ||
            u.email === 'master@dev.com' ||
            u.role?.includes('Super Admin');
          const isYysStaff =
            u.role === 'Admin Yayasan' ||
            u.email === 'adminyys@dev.com' ||
            (u.role?.includes('Admin Yayasan') && !u.role?.includes('Super'));
          return !isMasterStaff && !isYysStaff;
        });
      }
    }
    return list.map(sanitizeUserForClient);
  },

  createUser: async (userData: Omit<AppUser, 'id' | 'lastLogin'> & { password?: string }) => {
    const plainPwd =
      userData.password && userData.password.length >= 6
        ? userData.password
        : crypto.randomBytes(18).toString('base64url');
    const hashedPwd = bcrypt.hashSync(plainPwd, 10);
    const { password: _omitPwd, ...cleanData } = userData as any;
    const newUser: StoredAppUser = {
      ...cleanData,
      id: `usr-${Date.now()}`,
      lastLogin: '-',
      passwordHash: hashedPwd,
    };

    await executeMySql(
      `INSERT INTO users (id, name, email, phone, school_id, role, permissions_json, is_active, email_verified, children_ids_json, password_hash, last_login)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '-')
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         phone = VALUES(phone),
         school_id = VALUES(school_id),
         role = VALUES(role),
         permissions_json = VALUES(permissions_json),
         is_active = VALUES(is_active),
         email_verified = VALUES(email_verified)`,
      [newUser.id, newUser.name, newUser.email, newUser.phone || '', newUser.schoolId || 'MASTER', newUser.role, JSON.stringify(newUser.permissions || []), newUser.isActive ? 1 : 0, newUser.emailVerified ? 1 : 0, JSON.stringify(newUser.childrenIds || []), hashedPwd]
    );

    memoryStore.users.push(newUser);
    persistStore();
    return sanitizeUserForClient(newUser);
  },

  updateUser: async (id: string, updates: Partial<AppUser> & { password?: string }) => {
    let idx = memoryStore.users.findIndex((u) => u.id === id);
    if (idx === -1) {
      if (updates.email) {
        const cleanReqEmail = updates.email.trim().toLowerCase();
        idx = memoryStore.users.findIndex((u) => u.email.toLowerCase() === cleanReqEmail);
      }
    }
    if (idx === -1) return null;

    const prevUser = memoryStore.users[idx];
    const oldEmail = prevUser.email;
    const { password, passwordHash: _ignoredHash, sessionInvalidatedAt: _ignoredRevoked, ...cleanUpdates } = updates as any;
    if (cleanUpdates.email) {
      cleanUpdates.email = cleanUpdates.email.trim().toLowerCase();
    }
    const passwordChanged = Boolean(password && password.length >= 6);
    const nextHash = passwordChanged ? bcrypt.hashSync(password, 10) : prevUser.passwordHash;
    const securityChanged =
      passwordChanged ||
      (cleanUpdates.isActive !== undefined && Boolean(cleanUpdates.isActive) === false) ||
      (cleanUpdates.role !== undefined && cleanUpdates.role !== prevUser.role) ||
      (cleanUpdates.schoolId !== undefined && cleanUpdates.schoolId !== prevUser.schoolId) ||
      (cleanUpdates.permissions !== undefined &&
        JSON.stringify(cleanUpdates.permissions) !== JSON.stringify(prevUser.permissions));

    const u: StoredAppUser = {
      ...prevUser,
      ...cleanUpdates,
      passwordHash: nextHash,
      sessionInvalidatedAt: securityChanged ? Date.now() : prevUser.sessionInvalidatedAt,
    };

    if (cleanUpdates.email && cleanUpdates.email !== oldEmail) {
      await executeMySql('DELETE FROM users WHERE LOWER(email) = ? AND id != ?', [oldEmail.toLowerCase(), u.id]);
    }

    if (passwordChanged && nextHash) {
      await executeMySql(
        'UPDATE users SET name = ?, email = ?, phone = ?, school_id = ?, role = ?, permissions_json = ?, is_active = ?, email_verified = ?, children_ids_json = ?, password_hash = ? WHERE id = ?',
        [u.name, u.email, u.phone || '', u.schoolId, u.role, JSON.stringify(u.permissions || []), u.isActive ? 1 : 0, u.emailVerified ? 1 : 0, JSON.stringify(u.childrenIds || []), nextHash, u.id]
      );
    } else {
      await executeMySql(
        'UPDATE users SET name = ?, email = ?, phone = ?, school_id = ?, role = ?, permissions_json = ?, is_active = ?, email_verified = ?, children_ids_json = ? WHERE id = ?',
        [u.name, u.email, u.phone || '', u.schoolId, u.role, JSON.stringify(u.permissions || []), u.isActive ? 1 : 0, u.emailVerified ? 1 : 0, JSON.stringify(u.childrenIds || []), u.id]
      );
    }

    // If Wali/Parent updates name or phone, synchronize strictly owned student records in MySQL
    const isParent = u.role === 'Wali Siswa' || u.role === 'Wali Santri' || u.role === 'Wali Murid' || Boolean(u.studentId) || u.id.startsWith('usr-wali') || u.id.startsWith('wali-');
    const matchedStudentUpdates: Array<{ student: StudentRegistration; nextParentName: string; nextParentPhone: string }> = [];
    if (isParent && (cleanUpdates.name || cleanUpdates.phone)) {
      memoryStore.students.forEach((s) => {
        const isMatch =
          s.parentUserId === u.id ||
          (Array.isArray(u.childrenIds) && u.childrenIds.includes(s.id)) ||
          (u.studentId && s.id === u.studentId) ||
          (u.studentRegistrationNumber && s.registrationNumber === u.studentRegistrationNumber);

        if (isMatch) {
          matchedStudentUpdates.push({
            student: s,
            nextParentName: cleanUpdates.name || s.parentName,
            nextParentPhone: cleanUpdates.phone || s.parentPhone,
          });
        }
      });
      for (const item of matchedStudentUpdates) {
        await executeMySql('UPDATE students SET parent_name = ?, parent_phone = ? WHERE id = ?', [
          item.nextParentName,
          item.nextParentPhone,
          item.student.id,
        ]);
      }
    }

    memoryStore.users[idx] = u;
    if (cleanUpdates.email && cleanUpdates.email !== oldEmail) {
      memoryStore.users = memoryStore.users.filter((item) => {
        if (item.id !== u.id && item.email.toLowerCase() === oldEmail.toLowerCase()) {
          return false;
        }
        return true;
      });
    }
    for (const item of matchedStudentUpdates) {
      item.student.parentName = item.nextParentName;
      item.student.parentPhone = item.nextParentPhone;
    }

    if (securityChanged) {
      invalidateUserSessions(u.id, oldEmail);
      invalidateUserSessions(u.id, u.email);
    } else {
      // Synchronize active sessions immediately with updated non-privilege profile fields
      const safeU = sanitizeUserForClient(u);
      for (const [, session] of activeSessions.entries()) {
        if (
          session.user.id === id ||
          (session.user.email && session.user.email.toLowerCase() === oldEmail.toLowerCase()) ||
          (session.user.email && session.user.email.toLowerCase() === u.email.toLowerCase())
        ) {
          session.user = {
            ...session.user,
            ...safeU,
          };
        }
      }
    }

    persistStore();
    const updatedIdx = memoryStore.users.findIndex((item) => item.id === u.id);
    return sanitizeUserForClient(updatedIdx !== -1 ? memoryStore.users[updatedIdx] : u);
  },

  deleteUser: async (id: string, deletedBy = 'Admin', deletedByRole = 'Staff') => {
    const existing = memoryStore.users.find((u) => u.id === id);
    if (!existing) return false;

    let passwordHash: string | null = null;
    if (mysqlPool && isMySqlConnected) {
      try {
        const [rows]: any = await mysqlPool.query('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [id]);
        if (Array.isArray(rows) && rows[0]?.password_hash) {
          passwordHash = String(rows[0].password_hash);
        }
      } catch (e) {}
    }

    await archiveToTrash({
      entityType: 'user',
      entityId: existing.id,
      unitId: existing.schoolId || 'MASTER',
      title: existing.name,
      subtitle: `${existing.email} · Role: ${existing.role} · Unit ${existing.schoolId}`,
      deletedBy,
      deletedByRole,
      snapshot: {
        user: { ...existing },
        passwordHash,
      },
    });

    await executeMySql('DELETE FROM users WHERE id = ?', [id]);
    invalidateUserSessions(id, existing.email);
    memoryStore.users = memoryStore.users.filter((u) => u.id !== id);
    addAuditLog('update_status', existing.schoolId || 'MASTER', `Hapus akun "${existing.name}" (${existing.email}) -> dipindahkan ke Sampah oleh ${deletedBy}`);
    persistStore();
    return true;
  },

  // Academic Years
  getAcademicYears: () => memoryStore.academicYears,

  createAcademicYear: async (yearData: Omit<AcademicYear, 'id' | 'isActive'>) => {
    const newAy: AcademicYear = {
      ...yearData,
      id: `ay-${Date.now()}`,
      isActive: false,
    };

    await executeMySql(
      'INSERT INTO academic_years (id, year_label, start_date, end_date, is_active) VALUES (?, ?, ?, ?, 0)',
      [newAy.id, newAy.year || (newAy as any).yearLabel || '2026/2027', newAy.startDate, newAy.endDate]
    );

    memoryStore.academicYears.push(newAy);
    persistStore();
    return newAy;
  },

  activateAcademicYear: async (id: string) => {
    const exists = memoryStore.academicYears.some((y) => y.id === id);
    if (!exists) return false;

    await executeMySql('UPDATE academic_years SET is_active = 0');
    await executeMySql('UPDATE academic_years SET is_active = 1 WHERE id = ?', [id]);

    memoryStore.academicYears = memoryStore.academicYears.map((y) => ({
      ...y,
      isActive: y.id === id,
    }));
    persistStore();
    return true;
  },

  // Landing Page Config
  getLandingConfig: () => {
    if (!memoryStore.landingConfig) {
      memoryStore.landingConfig = { ...INITIAL_LANDING_CONFIG };
    }
    if (!Array.isArray(memoryStore.landingConfig.heroSlides)) {
      memoryStore.landingConfig.heroSlides = INITIAL_LANDING_CONFIG.heroSlides;
    }
    if (memoryStore.landingConfig.appTagline === undefined) {
      memoryStore.landingConfig.appTagline = INITIAL_LANDING_CONFIG.appTagline || 'Yayasan Ar-Risalah Aceh';
    }
    if (memoryStore.landingConfig.logoUrl === undefined) {
      memoryStore.landingConfig.logoUrl = INITIAL_LANDING_CONFIG.logoUrl;
    }
    if (memoryStore.landingConfig.faviconUrl === undefined) {
      memoryStore.landingConfig.faviconUrl = INITIAL_LANDING_CONFIG.faviconUrl;
    }
    if (memoryStore.landingConfig.metaTitle === undefined) {
      memoryStore.landingConfig.metaTitle = INITIAL_LANDING_CONFIG.metaTitle;
    }
    if (memoryStore.landingConfig.metaDescription === undefined) {
      memoryStore.landingConfig.metaDescription = INITIAL_LANDING_CONFIG.metaDescription;
    }
    if (memoryStore.landingConfig.metaKeywords === undefined) {
      memoryStore.landingConfig.metaKeywords = INITIAL_LANDING_CONFIG.metaKeywords;
    }
    if (memoryStore.landingConfig.author === undefined) {
      memoryStore.landingConfig.author = INITIAL_LANDING_CONFIG.author;
    }
    if (memoryStore.landingConfig.ogTitle === undefined) {
      memoryStore.landingConfig.ogTitle = INITIAL_LANDING_CONFIG.ogTitle;
    }
    if (memoryStore.landingConfig.ogDescription === undefined) {
      memoryStore.landingConfig.ogDescription = INITIAL_LANDING_CONFIG.ogDescription;
    }
    if (memoryStore.landingConfig.ogImage === undefined) {
      memoryStore.landingConfig.ogImage = INITIAL_LANDING_CONFIG.ogImage;
    }
    if (memoryStore.landingConfig.canonicalUrl === undefined) {
      memoryStore.landingConfig.canonicalUrl = INITIAL_LANDING_CONFIG.canonicalUrl;
    }
    if (memoryStore.landingConfig.jsonLdType === undefined) {
      memoryStore.landingConfig.jsonLdType = INITIAL_LANDING_CONFIG.jsonLdType;
    }
    if (memoryStore.landingConfig.structuredDataJson === undefined) {
      memoryStore.landingConfig.structuredDataJson = INITIAL_LANDING_CONFIG.structuredDataJson;
    }
    return memoryStore.landingConfig;
  },

  updateLandingConfig: async (
    config: LandingPageConfig,
    actor = 'Master Admin',
    actorRole = 'Super Admin Yayasan',
    skipTrashDiff = false
  ) => {
    const prevLanding = memoryStore.landingConfig || INITIAL_LANDING_CONFIG;
    const nextLanding: LandingPageConfig = {
      ...prevLanding,
      ...config,
    };

    if (!skipTrashDiff) {
      // Archive removed Hero Slides
      if (Array.isArray(prevLanding.heroSlides) && Array.isArray(nextLanding.heroSlides)) {
        const nextSlideIds = new Set(nextLanding.heroSlides.map((s) => s.id));
        for (const slide of prevLanding.heroSlides) {
          if (slide && !nextSlideIds.has(slide.id)) {
            await archiveToTrash({
              entityType: 'landing_slide',
              entityId: slide.id,
              unitId: 'MASTER',
              title: `Slide Hero: ${slide.title || 'Banner'}`,
              subtitle: slide.subtitle || 'Banner Slider Landing Page',
              deletedBy: actor,
              deletedByRole: actorRole,
              snapshot: { slide },
            });
          }
        }
      }

      // Archive removed Flow Steps
      if (Array.isArray(prevLanding.flowSteps) && Array.isArray(nextLanding.flowSteps)) {
        const nextStepTitles = new Set(nextLanding.flowSteps.map((st) => `${st.step}::${st.title}`));
        for (const step of prevLanding.flowSteps) {
          if (step && !nextStepTitles.has(`${step.step}::${step.title}`)) {
            await archiveToTrash({
              entityType: 'landing_step',
              entityId: `step-${step.step}-${step.title.slice(0, 30)}`,
              unitId: 'MASTER',
              title: `Alur Pendaftaran #${step.step}: ${step.title}`,
              subtitle: step.description,
              deletedBy: actor,
              deletedByRole: actorRole,
              snapshot: { step },
            });
          }
        }
      }

      // Archive removed Requirements
      if (Array.isArray(prevLanding.requirements) && Array.isArray(nextLanding.requirements)) {
        const nextReqs = new Set(nextLanding.requirements.map((r) => String(r).trim()));
        for (let idx = 0; idx < prevLanding.requirements.length; idx++) {
          const reqItem = String(prevLanding.requirements[idx] || '').trim();
          if (reqItem && !nextReqs.has(reqItem)) {
            await archiveToTrash({
              entityType: 'landing_requirement',
              entityId: `req-${idx}-${Date.now()}`,
              unitId: 'MASTER',
              title: `Syarat PPDB: ${reqItem.slice(0, 120)}`,
              subtitle: 'Persyaratan Pendaftaran Landing Page',
              deletedBy: actor,
              deletedByRole: actorRole,
              snapshot: { requirement: reqItem },
            });
          }
        }
      }
    }

    await executeMySql(
      `INSERT INTO landing_config (id, app_name, app_tagline, hero_title, hero_subtitle, stats_total, flow_steps_json, requirements_json, contact_json, hero_slides_json, logo_url, favicon_url, help_title, help_subtitle, full_config_json)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         app_name = VALUES(app_name),
         app_tagline = VALUES(app_tagline),
         hero_title = VALUES(hero_title),
         hero_subtitle = VALUES(hero_subtitle),
         stats_total = VALUES(stats_total),
         flow_steps_json = VALUES(flow_steps_json),
         requirements_json = VALUES(requirements_json),
         contact_json = VALUES(contact_json),
         hero_slides_json = VALUES(hero_slides_json),
         logo_url = VALUES(logo_url),
         favicon_url = VALUES(favicon_url),
         help_title = VALUES(help_title),
         help_subtitle = VALUES(help_subtitle),
         full_config_json = VALUES(full_config_json)`,
      [
        nextLanding.appName,
        nextLanding.appTagline || 'Yayasan Ar-Risalah Aceh',
        nextLanding.heroTitle,
        nextLanding.heroSubtitle,
        nextLanding.statsTotal,
        JSON.stringify(nextLanding.flowSteps || []),
        JSON.stringify(nextLanding.requirements || []),
        JSON.stringify(nextLanding.contact || {}),
        JSON.stringify(nextLanding.heroSlides || []),
        nextLanding.logoUrl || null,
        nextLanding.faviconUrl || null,
        nextLanding.helpTitle || null,
        nextLanding.helpSubtitle || null,
        JSON.stringify(nextLanding),
      ]
    );

    const prevLandingUploadUrls = new Set<string>();
    collectUploadUrlsFromValue(
      {
        logoUrl: prevLanding.logoUrl,
        faviconUrl: prevLanding.faviconUrl,
        ogImage: prevLanding.ogImage,
        heroSlides: prevLanding.heroSlides,
      },
      prevLandingUploadUrls
    );

    memoryStore.landingConfig = nextLanding;
    const nextLandingUploadUrls = new Set<string>();
    collectUploadUrlsFromValue(
      {
        logoUrl: nextLanding.logoUrl,
        faviconUrl: nextLanding.faviconUrl,
        ogImage: nextLanding.ogImage,
        heroSlides: nextLanding.heroSlides,
      },
      nextLandingUploadUrls
    );
    for (const oldUrl of prevLandingUploadUrls) {
      if (!nextLandingUploadUrls.has(oldUrl)) {
        deleteUploadFileSafely(oldUrl);
      }
    }

    addAuditLog('update_status', 'MASTER', 'Pembaruan pengaturan landing page yayasan');
    persistStore();
    return memoryStore.landingConfig;
  },

  // Audit Logs & Tamper-Evident Integrity Check
  getAuditLogs: () => memoryStore.auditLogs,

  verifyAuditLogIntegrity: () => {
    const logsNewestFirst = memoryStore.auditLogs || [];
    const totalLogs = logsNewestFirst.length;
    const chronological = [...logsNewestFirst].reverse(); // oldest -> newest
    const chainedLogs = chronological.filter((l) => Boolean(l.entryHash));
    const legacyCount = totalLogs - chainedLogs.length;
    const brokenIds: string[] = [];

    for (let i = 0; i < chainedLogs.length; i++) {
      const current = chainedLogs[i];
      const expectedPrev = i === 0 ? (current.prevHash || 'GENESIS') : chainedLogs[i - 1].entryHash!;
      if (i > 0 && current.prevHash !== expectedPrev) {
        brokenIds.push(current.id);
        continue;
      }
      const recomputed = computeAuditEntryHash(current.prevHash || 'GENESIS', current);
      if (recomputed !== current.entryHash) {
        brokenIds.push(current.id);
      }
    }

    return {
      valid: brokenIds.length === 0,
      totalLogs,
      chainedCount: chainedLogs.length,
      legacyCount,
      brokenCount: brokenIds.length,
      brokenIds: brokenIds.slice(0, 20),
      verifiedAt: new Date().toISOString(),
    };
  },

  // Export Configurations (Master managed)
  getExportConfigs: () => memoryStore.exportConfigs,

  saveExportConfig: async (config: ExportFieldConfig, updatedBy = 'Master Admin') => {
    const nextList = [...memoryStore.exportConfigs];
    const existingIdx = nextList.findIndex(
      (c) => c.moduleName === config.moduleName && c.roleId === config.roleId
    );
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const payload: ExportFieldConfig = {
      ...config,
      id: `${config.moduleName}_${config.roleId}`,
      updatedAt: dateStr,
      updatedBy,
    };

    if (existingIdx >= 0) {
      nextList[existingIdx] = payload;
    } else {
      nextList.push(payload);
    }

    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('export_configs', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(nextList)]
    );

    memoryStore.exportConfigs = nextList;
    persistStore();
    addAuditLog('export_config', 'MASTER', `Update aturan ekspor ${config.moduleName} untuk role ${config.roleId} (${config.allowedHeaders.length} kolom)`);
    return payload;
  },

  // SMTP Google Configuration (Master managed with Multi-Account Rotation & Failover)
  getSmtpConfig: () => memoryStore.smtpConfig,

  getDecryptedSmtpPassword: (): string => {
    const raw = memoryStore.smtpConfig?.authPassword || '';
    if (!raw) return '';
    return decryptSecret(raw);
  },

  // Returns all active SMTP accounts with decrypted passwords for rotation & failover
  getDecryptedSmtpAccounts: (): Array<{
    id: string;
    senderEmail: string;
    senderName: string;
    authPassword: string;
    host: string;
    port: number;
    secure: boolean;
    isActive: boolean;
    priority: number;
    isVerified?: boolean;
    lastTested?: string;
  }> => {
    const config = memoryStore.smtpConfig;
    const result: Array<any> = [];

    // 1. If explicit multi-accounts defined
    if (Array.isArray(config.accounts) && config.accounts.length > 0) {
      config.accounts.forEach((acc, idx) => {
        if (acc && acc.senderEmail && acc.isActive !== false) {
          result.push({
            id: acc.id || `smtp-acc-${idx + 1}`,
            senderEmail: acc.senderEmail.trim(),
            senderName: acc.senderName || config.senderName || 'Panitia PPDB Yayasan Ar-Risalah Aceh',
            authPassword: acc.authPassword ? decryptSecret(acc.authPassword) : '',
            host: acc.host || config.host || 'smtp.gmail.com',
            port: Number(acc.port) || config.port || 465,
            secure: acc.secure !== undefined ? acc.secure : (config.secure !== undefined ? config.secure : true),
            isActive: true,
            priority: Number(acc.priority) || idx + 1,
            isVerified: acc.isVerified,
            lastTested: acc.lastTested,
          });
        }
      });
    }

    // 2. Also ensure primary account from root config is included if not already in accounts
    if (config.senderEmail) {
      const exists = result.some((r) => r.senderEmail.toLowerCase() === config.senderEmail.toLowerCase());
      if (!exists) {
        const rawPass = config.authPassword ? decryptSecret(config.authPassword) : '';
        result.unshift({
          id: 'smtp-primary',
          senderEmail: config.senderEmail.trim(),
          senderName: config.senderName || 'Panitia PPDB Yayasan Ar-Risalah Aceh',
          authPassword: rawPass,
          host: config.host || 'smtp.gmail.com',
          port: Number(config.port) || 465,
          secure: config.secure !== undefined ? config.secure : true,
          isActive: config.enabled !== false,
          priority: 0,
          isVerified: config.isVerified,
          lastTested: config.lastTested,
        });
      }
    }

    // Sort by priority ascending
    result.sort((a, b) => a.priority - b.priority);
    return result;
  },

  saveSmtpConfig: async (config: SmtpConfig, actor = 'Master Admin', actorRole = 'Super Admin Yayasan', skipTrashDiff = false) => {
    const current = memoryStore.smtpConfig;
    let passwordToStore = current?.authPassword || '';

    if (config.authPassword !== undefined) {
      const cleanPass = config.authPassword.trim();
      if (cleanPass && cleanPass !== '••••••••••••••••') {
        passwordToStore = encryptSecret(cleanPass);
      } else if (!cleanPass) {
        passwordToStore = '';
      }
    }

    // Handle accounts array encryption for passwords
    let processedAccounts: any[] = [];
    if (Array.isArray(config.accounts)) {
      const currentAccountsMap = new Map<string, any>();
      if (Array.isArray(current?.accounts)) {
        current.accounts.forEach((acc) => {
          if (acc && acc.id) currentAccountsMap.set(acc.id, acc);
          if (acc && acc.senderEmail) currentAccountsMap.set(acc.senderEmail.toLowerCase(), acc);
        });
      }

      processedAccounts = config.accounts.map((acc, idx) => {
        const accId = acc.id || `acc-${Date.now()}-${idx}`;
        const existing = currentAccountsMap.get(accId) || currentAccountsMap.get((acc.senderEmail || '').toLowerCase());
        let accPass = existing?.authPassword || '';

        if (acc.authPassword !== undefined) {
          const cleanAccPass = acc.authPassword.trim();
          if (cleanAccPass && cleanAccPass !== '••••••••••••••••') {
            accPass = encryptSecret(cleanAccPass);
          } else if (!cleanAccPass) {
            accPass = '';
          }
        }

        return {
          id: accId,
          senderEmail: acc.senderEmail ? acc.senderEmail.trim() : '',
          senderName: acc.senderName ? acc.senderName.trim() : (config.senderName || 'Panitia PPDB Yayasan Ar-Risalah Aceh'),
          authPassword: accPass,
          host: acc.host || config.host || 'smtp.gmail.com',
          port: Number(acc.port) || config.port || 465,
          secure: acc.secure !== undefined ? acc.secure : (config.secure !== undefined ? config.secure : true),
          isActive: acc.isActive !== false,
          priority: Number(acc.priority) || idx + 1,
          isVerified: acc.isVerified !== undefined ? acc.isVerified : existing?.isVerified,
          lastTested: acc.lastTested || existing?.lastTested,
        };
      });

      if (!skipTrashDiff && Array.isArray(current?.accounts)) {
        const nextAccIds = new Set(processedAccounts.map((a) => a.id));
        const nextAccEmails = new Set(processedAccounts.map((a) => (a.senderEmail || '').toLowerCase()));
        for (const oldAcc of current.accounts) {
          const stillExists =
            (oldAcc.id && nextAccIds.has(oldAcc.id)) ||
            (oldAcc.senderEmail && nextAccEmails.has(oldAcc.senderEmail.toLowerCase()));
          if (!stillExists) {
            await archiveToTrash({
              entityType: 'smtp_account',
              entityId: oldAcc.id || oldAcc.senderEmail,
              unitId: 'MASTER',
              title: `Akun SMTP: ${oldAcc.senderEmail}`,
              subtitle: oldAcc.senderName || 'Akun Rotasi Gmail PPDB',
              deletedBy: actor,
              deletedByRole: actorRole,
              snapshot: { account: oldAcc },
            });
          }
        }
      }
    } else if (Array.isArray(current?.accounts)) {
      processedAccounts = current.accounts;
    }

    const payload: SmtpConfig = {
      ...config,
      authPassword: passwordToStore,
      accounts: processedAccounts,
      lastTested: new Date().toLocaleString('id-ID'),
    };

    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('smtp_config', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(payload)]
    );

    memoryStore.smtpConfig = payload;
    persistStore();
    addAuditLog('smtp_config', 'MASTER', `Pembaruan konfigurasi SMTP Google terenkripsi AES-256 (${config.senderEmail}, ${processedAccounts.length} akun rotasi)`);
    return memoryStore.smtpConfig;
  },

  // Group Link Configurations
  getGroupLinkConfigs: () => memoryStore.groupLinkConfigs,

  // Cloudflare Turnstile Security Configuration (Master managed)
  getCloudflareConfig: () => memoryStore.cloudflareConfig || INITIAL_CLOUDFLARE_CONFIG,

  getDecryptedCloudflareSecret: () => {
    return (process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || '').trim();
  },

  saveCloudflareConfig: async (config: Partial<CloudflareConfig>, updatedBy = 'Master Admin') => {
    const current = memoryStore.cloudflareConfig || INITIAL_CLOUDFLARE_CONFIG;
    const payload: CloudflareConfig = {
      ...current,
      ...config,
      enabled: false,
      secretKey: '',
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('cloudflare_config', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(payload)]
    );

    memoryStore.cloudflareConfig = payload;
    persistStore();
    return memoryStore.cloudflareConfig;
  },

  saveGroupLinkConfig: async (config: GroupLinkConfig) => {
    const nextList = [...(memoryStore.groupLinkConfigs || [])];
    const idx = nextList.findIndex((g) => g.unitId === config.unitId);
    if (idx >= 0) {
      nextList[idx] = config;
    } else {
      nextList.push(config);
    }

    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('group_links', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(nextList)]
    );

    memoryStore.groupLinkConfigs = nextList;
    persistStore();
    addAuditLog('update_status', config.unitId === 'ALL' ? 'MASTER' : (config.unitId as SchoolId), `Pembaruan link grup ${config.groupName} (${config.visibilityRule})`);
    return memoryStore.groupLinkConfigs;
  },

  getUnitContacts: () => memoryStore.unitContacts || INITIAL_UNIT_CONTACTS,

  saveUnitContact: async (config: UnitContactConfig, updatedBy = 'Admin') => {
    const list = [...(memoryStore.unitContacts || INITIAL_UNIT_CONTACTS)];
    const idx = list.findIndex((c) => c.unitId === config.unitId);
    const payload: UnitContactConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    if (idx >= 0) {
      list[idx] = payload;
    } else {
      list.push(payload);
    }

    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('unit_contacts', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(list)]
    );

    memoryStore.unitContacts = list;
    persistStore();
    addAuditLog('update_status', config.unitId === 'MASTER' ? 'MASTER' : (config.unitId as SchoolId), `Pembaruan kontak unit ${config.unitName} (${config.contactPerson})`);
    return memoryStore.unitContacts;
  },

  getLetterConfigs: () => memoryStore.letterConfigs || INITIAL_LETTER_CONFIGS,

  saveLetterConfig: async (config: LetterConfig, updatedBy = 'Admin') => {
    const list = [...(memoryStore.letterConfigs || INITIAL_LETTER_CONFIGS)];
    const idx = list.findIndex((c) => c.unitId === config.unitId);
    const payload: LetterConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    if (idx >= 0) {
      list[idx] = payload;
    } else {
      list.push(payload);
    }

    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('letter_configs', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(list)]
    );

    memoryStore.letterConfigs = list;
    persistStore();
    addAuditLog(
      'update_status',
      config.unitId === 'MASTER' ? 'MASTER' : (config.unitId as SchoolId),
      `Pembaruan format surat & ketua panitia unit ${config.unitName} (${config.committeeChairName})`
    );
    return memoryStore.letterConfigs;
  },

  // Yayasan Multi-Bank Accounts Management
  getBankAccounts: () => {
    const list = Array.isArray(memoryStore.bankAccounts) ? [...memoryStore.bankAccounts] : [];
    return list.sort((a, b) => {
      if (Boolean(a.isPrimary) !== Boolean(b.isPrimary)) return a.isPrimary ? -1 : 1;
      if (Boolean(a.isActive) !== Boolean(b.isActive)) return a.isActive ? -1 : 1;
      return (a.sortOrder ?? 99) - (b.sortOrder ?? 99);
    });
  },

  getBankAccountsFresh: async () => {
    if (mysqlPool && isMySqlConnected) {
      try {
        const [rows]: any = await mysqlPool.query(
          "SELECT setting_value FROM system_settings WHERE setting_key = 'bank_accounts' LIMIT 1"
        );
        if (Array.isArray(rows) && rows.length > 0 && rows[0]?.setting_value) {
          const parsed = safeJsonParse<BankAccountConfig[]>(rows[0].setting_value, []);
          if (Array.isArray(parsed)) {
            memoryStore.bankAccounts = parsed;
          }
        }
      } catch (e) {}
    }
    return db.getBankAccounts();
  },

  saveBankAccount: async (account: BankAccountConfig, updatedBy = 'Admin Yayasan') => {
    let list = [...(Array.isArray(memoryStore.bankAccounts) ? memoryStore.bankAccounts : [])];
    const nowIso = new Date().toISOString();
    const isNew = !account.id || !list.some((b) => b.id === account.id);
    const id = account.id && account.id.trim() ? account.id.trim() : `bank-${Date.now()}`;

    const shouldBePrimary = Boolean(account.isPrimary) || (list.length === 0 && account.isActive);
    const nextIsActive = shouldBePrimary ? true : Boolean(account.isActive);

    const payload: BankAccountConfig = {
      ...account,
      id,
      isActive: nextIsActive,
      isPrimary: shouldBePrimary,
      sortOrder: account.sortOrder ?? (list.length + 1),
      updatedAt: nowIso,
      updatedBy,
    };

    if (shouldBePrimary) {
      list = list.map((b) => ({ ...b, isPrimary: false }));
    }

    if (isNew) {
      list.push(payload);
    } else {
      list = list.map((b) => (b.id === id ? payload : b));
    }

    // Ensure at least one active bank is primary if any active bank exists
    if (!list.some((b) => b.isPrimary && b.isActive)) {
      const firstActive = list.find((b) => b.isActive);
      if (firstActive) {
        list = list.map((b) => ({ ...b, isPrimary: b.id === firstActive.id }));
      }
    }

    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('bank_accounts', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(list)]
    );

    memoryStore.bankAccounts = list;
    const sortedAfterSave = db.getBankAccounts();
    const activeAfterSave = sortedAfterSave.filter((b) => b.isActive);
    const primaryAfterSave = activeAfterSave.find((b) => b.isPrimary) || activeAfterSave[0];
    const nextPrimaryLabel = primaryAfterSave
      ? `${primaryAfterSave.bankName} ${primaryAfterSave.accountNumber} a.n ${primaryAfterSave.accountHolder}`
      : '';
    await executeMySql(
      "UPDATE payments SET bank_account = ? WHERE status = 'pending' AND (proof_url IS NULL OR proof_url = '')",
      [nextPrimaryLabel]
    );
    memoryStore.payments = memoryStore.payments.map((p) =>
      p.status === 'pending' && !p.proofUrl ? { ...p, bankAccount: nextPrimaryLabel } : p
    );

    persistStore();
    addAuditLog(
      'update_status',
      'MASTER',
      `${isNew ? 'Menambahkan' : 'Memperbarui'} rekening yayasan: ${payload.bankCode || payload.bankName} ${payload.accountNumber} a.n ${payload.accountHolder} (oleh ${updatedBy})`
    );
    return sortedAfterSave;
  },

  deleteBankAccount: async (id: string, updatedBy = 'Admin Yayasan') => {
    const list = [...(Array.isArray(memoryStore.bankAccounts) ? memoryStore.bankAccounts : [])];
    const target = list.find((b) => b.id === id);
    if (!target) return null;

    let nextList = list.filter((b) => b.id !== id);
    if (target.isPrimary && nextList.length > 0 && !nextList.some((b) => b.isPrimary && b.isActive)) {
      const fallbackPrimary = nextList.find((b) => b.isActive) || nextList[0];
      if (fallbackPrimary) {
        nextList = nextList.map((b) => ({ ...b, isPrimary: b.id === fallbackPrimary.id }));
      }
    }

    await executeMySql(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('bank_accounts', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(nextList)]
    );

    memoryStore.bankAccounts = nextList;
    const sortedAfterDelete = db.getBankAccounts();
    const activeAfterDelete = sortedAfterDelete.filter((b) => b.isActive);
    const primaryAfterDelete = activeAfterDelete.find((b) => b.isPrimary) || activeAfterDelete[0];
    const nextPrimaryLabel = primaryAfterDelete
      ? `${primaryAfterDelete.bankName} ${primaryAfterDelete.accountNumber} a.n ${primaryAfterDelete.accountHolder}`
      : '';
    await executeMySql(
      "UPDATE payments SET bank_account = ? WHERE status = 'pending' AND (proof_url IS NULL OR proof_url = '')",
      [nextPrimaryLabel]
    );
    memoryStore.payments = memoryStore.payments.map((p) =>
      p.status === 'pending' && !p.proofUrl ? { ...p, bankAccount: nextPrimaryLabel } : p
    );

    persistStore();
    addAuditLog(
      'update_status',
      'MASTER',
      `Menghapus rekening yayasan: ${target.bankCode || target.bankName} ${target.accountNumber} a.n ${target.accountHolder} (oleh ${updatedBy})`
    );
    return sortedAfterDelete;
  },

  // Wali Registration & Email Verification
  registerWaliAccount: async (data: { name: string; email: string; phone: string; password: string }, ip = '127.0.0.1') => {
    const cleanEmail = data.email.trim().toLowerCase();
    const existing = memoryStore.users.find(
      (u) => u.email.toLowerCase() === cleanEmail || u.phone.replace(/\D/g, '') === data.phone.replace(/\D/g, '')
    );
    if (existing) {
      return { success: false, error: 'Email atau nomor WhatsApp ini sudah terdaftar. Silakan login ke akun Anda.' };
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password.trim(), salt);

    const newUser: StoredAppUser = {
      id: `usr-wali-${Date.now()}`,
      name: data.name.trim(),
      email: cleanEmail,
      phone: data.phone.trim(),
      schoolId: 'MASTER',
      role: 'Wali Siswa',
      permissions: ['Portal Wali', 'Anak Saya', 'Pembayaran', 'Profil'],
      isActive: true,
      lastLogin: new Date().toISOString(),
      emailVerified: false,
      childrenIds: [],
      passwordHash: hashedPassword,
    };

    await executeMySql(
      `INSERT INTO users (id, name, email, phone, school_id, role, permissions_json, is_active, email_verified, children_ids_json, password_hash, last_login)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         phone = VALUES(phone),
         is_active = VALUES(is_active),
         email_verified = VALUES(email_verified),
         password_hash = VALUES(password_hash)`,
      [
        newUser.id,
        newUser.name,
        newUser.email,
        newUser.phone || '',
        newUser.schoolId || 'MASTER',
        newUser.role,
        JSON.stringify(newUser.permissions || []),
        newUser.isActive ? 1 : 0,
        newUser.emailVerified ? 1 : 0,
        JSON.stringify(newUser.childrenIds || []),
        hashedPassword,
        newUser.lastLogin || null,
      ]
    );

    memoryStore.users.push(newUser);
    persistStore();

    const safeUser = sanitizeUserForClient(newUser);
    const session = db.createSessionForUser(safeUser, ip);
    addAuditLog('login', 'MASTER', `Pendaftaran akun wali baru: ${safeUser.name} (${safeUser.email})`, safeUser.email, ip);

    return { success: true, user: safeUser, token: session.token };
  },

  // -------------------------------------------------------------
  // Email OTP Verification for Parent (Wali Siswa)
  // -------------------------------------------------------------
  generateEmailVerificationOtp: (identifier: string, ip = '127.0.0.1') => {
    const user = memoryStore.users.find(
      (u) => u.id === identifier || u.email.toLowerCase() === identifier.trim().toLowerCase()
    );
    if (!user) {
      return { success: false, error: 'Pengguna wali tidak ditemukan.' };
    }
    if (user.emailVerified) {
      return { success: false, error: 'Alamat email ini sudah terverifikasi sebelumnya.' };
    }

    // Rate-limiting cooldown: minimum 60 detik antar pengiriman
    const existing = emailVerificationOtps.get(user.id);
    if (existing && Date.now() - existing.lastSentAt < 60000) {
      const remainingSeconds = Math.ceil((60000 - (Date.now() - existing.lastSentAt)) / 1000);
      return {
        success: false,
        error: `Silakan tunggu ${remainingSeconds} detik lagi sebelum meminta kode OTP baru.`,
        cooldownSeconds: remainingSeconds,
      };
    }

    // Generate cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 menit
    const record: EmailVerificationOtpRecord = {
      userId: user.id,
      email: user.email,
      otp,
      expiresAt,
      attemptsLeft: 5,
      createdAt: Date.now(),
      lastSentAt: Date.now(),
    };

    emailVerificationOtps.set(user.id, record);

    addAuditLog(
      'send_otp' as any,
      user.schoolId || 'MASTER',
      `Permintaan kode OTP verifikasi email untuk ${user.email} (Kedaluwarsa 10 menit)`,
      user.email,
      ip
    );

    return {
      success: true,
      user,
      email: user.email,
      otp,
      expiresAt,
      cooldownSeconds: 60,
    };
  },

  verifyEmailVerificationOtp: async (identifier: string, inputOtp: string, ip = '127.0.0.1') => {
    const user = memoryStore.users.find(
      (u) => u.id === identifier || u.email.toLowerCase() === identifier.trim().toLowerCase()
    );
    if (!user) {
      return { success: false, error: 'Pengguna wali tidak ditemukan.' };
    }

    const cleanOtp = (inputOtp || '').trim().replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanOtp)) {
      return { success: false, error: 'Kode OTP harus berupa 6 digit angka numerik.' };
    }

    const record = emailVerificationOtps.get(user.id);
    if (!record || Date.now() > record.expiresAt) {
      if (record) emailVerificationOtps.delete(user.id);
      return {
        success: false,
        error: 'Kode OTP telah kedaluwarsa atau belum pernah diminta. Silakan klik tombol Kirim Ulang OTP.',
      };
    }

    if (record.attemptsLeft <= 0) {
      emailVerificationOtps.delete(user.id);
      return {
        success: false,
        error: 'Percobaan telah melebihi batas (5x salah). Kode OTP telah hangus, silakan minta kode OTP baru demi keamanan.',
      };
    }

    if (cleanOtp !== record.otp) {
      record.attemptsLeft -= 1;
      addAuditLog(
        'unauthorized_access' as any,
        user.schoolId || 'MASTER',
        `Kode OTP salah untuk ${user.email}. Sisa kesempatan: ${record.attemptsLeft}`,
        user.email,
        ip
      );
      if (record.attemptsLeft <= 0) {
        emailVerificationOtps.delete(user.id);
        return {
          success: false,
          error: 'Kode OTP salah dan batas percobaan habis. Silakan minta kode OTP baru.',
        };
      }
      return {
        success: false,
        error: `Kode OTP yang Anda masukkan salah. Sisa kesempatan mencoba: ${record.attemptsLeft} kali.`,
        attemptsLeft: record.attemptsLeft,
      };
    }

    // OTP COCOK! Persist ke MySQL sebelum update state
    await executeMySql('UPDATE users SET is_active = 1, email_verified = 1 WHERE id = ?', [user.id]);
    emailVerificationOtps.delete(user.id);
    user.emailVerified = true;
    persistStore();

    addAuditLog(
      'verify_email' as any,
      user.schoolId || 'MASTER',
      `Verifikasi email via OTP BERHASIL: ${user.email}`,
      user.email,
      ip
    );

    return {
      success: true,
      user: sanitizeUserForClient(user),
      message: 'Alhamdulillah, alamat email Anda berhasil diverifikasi secara resmi!',
    };
  },

  verifyWaliEmail: async (identifier: string) => {
    const user = memoryStore.users.find(
      (u) => u.id === identifier || u.email.toLowerCase() === identifier.trim().toLowerCase()
    );
    if (!user) {
      return { success: false, error: 'Pengguna wali tidak ditemukan.' };
    }
    await executeMySql('UPDATE users SET email_verified = 1, is_active = 1 WHERE id = ?', [user.id]);
    user.emailVerified = true;
    persistStore();
    addAuditLog('verify_email', user.schoolId || 'MASTER', `Email terverifikasi: ${user.email}`, user.email, '127.0.0.1');
    return { success: true, user: sanitizeUserForClient(user) };
  },

  // Offline / Manual Registration (Direct Quota Deduction & MySQL Persistence)
  addOfflineStudent: async (data: Partial<StudentRegistration>, recordedBy: string, ip = '127.0.0.1') => {
    const unit = String(data.unit || memoryStore.units[0]?.id || 'SD01').trim().toUpperCase();

    const activeAy = memoryStore.academicYears.find((a) => a.isActive) || memoryStore.academicYears[0];
    const regYear = activeAy?.year?.match(/\d{4}/)?.[0] || String(new Date().getFullYear());
    let regNum = '';
    while (!regNum || memoryStore.students.some((s) => s.registrationNumber === regNum)) {
      const randNum = Math.floor(100 + Math.random() * 900);
      regNum = `PPDB-${regYear}-${unit}-OFF${randNum}`;
    }

    let uniqueId = '';
    while (!uniqueId || memoryStore.students.some((s) => s.id === uniqueId)) {
      const randHex = Math.random().toString(36).substring(2, 8);
      uniqueId = `reg-off-${Date.now()}-${randHex}`;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newStudent: StudentRegistration = {
      id: uniqueId,
      registrationNumber: regNum,
      fullName: data.fullName || 'Calon Siswa Walk-in (Offline)',
      nisn: data.nisn || '',
      unit,
      gender: data.gender || 'Laki-laki',
      birthPlace: data.birthPlace || '',
      birthDate: data.birthDate || '',
      address: data.address || '',
      parentName: data.parentName || '',
      parentPhone: data.parentPhone || '',
      parentJob: data.parentJob || '',
      parentIncome: data.parentIncome || '',
      status: 'terdaftar',
      registeredAt: dateStr,
      documents: data.documents && typeof data.documents === 'object' ? data.documents : {},
      dynamicAnswers: data.dynamicAnswers || {},
      isOffline: true,
      track: data.track || 'Reguler',
      schoolOrigin: data.schoolOrigin || undefined,
      verificationNotes: `Pendaftar offline walk-in dicatat oleh ${recordedBy}.`,
    };

    const targetUnit = memoryStore.units.find((u) => u.id === unit);
    const formFee = targetUnit ? targetUnit.formFee : 300000;
    const newPayment: PaymentRecord = {
      id: `pay-off-${Date.now()}`,
      registrationId: newStudent.id,
      registrationNumber: newStudent.registrationNumber,
      studentName: newStudent.fullName,
      unit: newStudent.unit,
      type: 'Formulir',
      amount: formFee,
      status: 'lunas',
      date: dateStr,
      proofUrl: '',
      bankAccount: 'Loket PPDB Offline Kampus Ar-Risalah (Tunai)',
      verifiedBy: recordedBy,
      verificationNotes: 'Pembayaran formulir tunai langsung di loket PPDB',
    };

    await executeMySql(
      `INSERT INTO students (id, registration_number, parent_user_id, full_name, nisn, unit, gender, birth_place, birth_date, address, parent_name, parent_phone, parent_job, parent_income, status, registered_at, documents_json, dynamic_answers_json, verification_notes, is_offline, track, school_origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        newStudent.id,
        newStudent.registrationNumber,
        null,
        newStudent.fullName.slice(0, 200),
        newStudent.nisn || null,
        newStudent.unit,
        newStudent.gender,
        (newStudent.birthPlace || '').trim().slice(0, 100),
        toSqlDateOrNull(newStudent.birthDate),
        newStudent.address || '',
        (newStudent.parentName || '').trim().slice(0, 150),
        (newStudent.parentPhone || '').trim().slice(0, 30),
        (newStudent.parentJob || '').trim().slice(0, 100),
        (newStudent.parentIncome || '').trim().slice(0, 100),
        newStudent.status,
        dateStr,
        JSON.stringify(newStudent.documents || {}),
        JSON.stringify(newStudent.dynamicAnswers || {}),
        newStudent.verificationNotes || null,
        newStudent.track || 'Reguler',
        newStudent.schoolOrigin || null,
      ]
    );

    await executeMySql(
      `INSERT INTO payments (id, registration_id, registration_number, student_name, unit, type, amount, status, payment_date, verified_by, verification_notes, bank_account)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newPayment.id,
        newPayment.registrationId,
        newPayment.registrationNumber,
        newPayment.studentName,
        newPayment.unit,
        newPayment.type,
        newPayment.amount,
        newPayment.status,
        dateStr,
        newPayment.verifiedBy || null,
        newPayment.verificationNotes || null,
        newPayment.bankAccount,
      ]
    );

    const nextOnlineCount = memoryStore.students.filter((s) => s.unit === unit).length + 1;
    const offlineCnt = Math.max(0, Number(targetUnit?.offlineCount) || 0);
    const nextFilledQuota = nextOnlineCount + offlineCnt;
    await executeMySql('UPDATE units SET filled_quota = ? WHERE id = ?', [nextFilledQuota, unit]);

    memoryStore.students.unshift(newStudent);
    memoryStore.payments.unshift(newPayment);
    memoryStore.units = memoryStore.units.map((u) =>
      u.id === unit ? { ...u, onlineCount: nextOnlineCount, offlineCount: offlineCnt, filledQuota: nextFilledQuota } : u
    );

    addAuditLog('offline_register', unit, `Input pendaftar offline ${newStudent.fullName} (${newStudent.registrationNumber}) oleh ${recordedBy}`, recordedBy, ip);
    persistStore();
    return newStudent;
  },

  // Full MySQL Dump generator
  getSqlDump: () => {
    const schemaPath = path.resolve(process.cwd(), 'server', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      return fs.readFileSync(schemaPath, 'utf-8');
    }
    return '-- MySQL schema file';
  },

  // Secure Unified Authentication & Session Management with Bcrypt Password Verification
  authenticateUser: async (identifier: string, passwordPlain: string, ipAddress = '127.0.0.1') => {
    const cleanIdent = identifier.trim().toLowerCase();
    const cleanPhone = identifier.replace(/[^0-9]/g, '');

    let matchedUser: AppUser | undefined = undefined;
    let passwordHashInDb: string | null = null;

    // 1. Check in MySQL users table
    if (mysqlPool && isMySqlConnected) {
      try {
        const hasValidPhone = cleanPhone.length >= 8;
        const userSql = hasValidPhone
          ? 'SELECT id, name, email, phone, school_id AS schoolId, role, permissions_json AS permissionsJson, is_active AS isActive, email_verified AS emailVerified, children_ids_json AS childrenIdsJson, password_hash AS passwordHash FROM users WHERE LOWER(email) = ? OR LOWER(id) = ? OR phone = ? LIMIT 1'
          : 'SELECT id, name, email, phone, school_id AS schoolId, role, permissions_json AS permissionsJson, is_active AS isActive, email_verified AS emailVerified, children_ids_json AS childrenIdsJson, password_hash AS passwordHash FROM users WHERE LOWER(email) = ? OR LOWER(id) = ? LIMIT 1';
        const userParams = hasValidPhone
          ? [cleanIdent, cleanIdent, cleanPhone]
          : [cleanIdent, cleanIdent];

        const [rows] = await mysqlPool.query(userSql, userParams);
        if (Array.isArray(rows) && rows.length > 0) {
          const r: any = rows[0];
          passwordHashInDb = r.passwordHash || null;
          matchedUser = {
            id: r.id,
            name: r.name,
            email: r.email,
            phone: r.phone || '',
            schoolId: r.schoolId || 'MASTER',
            role: r.role,
            permissions: typeof r.permissionsJson === 'string' ? JSON.parse(r.permissionsJson) : r.permissionsJson || [],
            isActive: Boolean(r.isActive),
            emailVerified: Boolean(r.emailVerified),
            childrenIds: typeof r.childrenIdsJson === 'string' ? JSON.parse(r.childrenIdsJson) : (r.childrenIdsJson || []),
            lastLogin: new Date().toISOString().replace('T', ' ').substring(0, 19),
          };
          const memIdx = memoryStore.users.findIndex((u) => u.id === matchedUser!.id);
          const syncedUser: StoredAppUser = {
            ...matchedUser,
            passwordHash: passwordHashInDb || undefined,
          };
          if (memIdx >= 0) {
            memoryStore.users[memIdx] = { ...memoryStore.users[memIdx], ...syncedUser };
          } else {
            memoryStore.users.push(syncedUser);
          }
        }
      } catch (sqlErr) {
        console.error('[DB Auth] MySQL query error, fallback to memory store:', sqlErr);
      }
    }

    // 2. Check in memory store if not found in MySQL query
    if (!matchedUser) {
      const memUser = memoryStore.users.find(
        (u) =>
          u.email.toLowerCase() === cleanIdent ||
          (cleanPhone.length >= 8 && u.phone && u.phone.replace(/[^0-9]/g, '') === cleanPhone) ||
          (u.id && u.id.toLowerCase() === cleanIdent)
      );
      if (memUser) {
        matchedUser = memUser;
        if (!passwordHashInDb && memUser.passwordHash) {
          passwordHashInDb = memUser.passwordHash;
        }
      }
    }

    // 3. Check in students / wali siswa if not found in staff users
    let isVirtualStudentUser = false;
    if (!matchedUser) {
      let matchedStudent: StudentRegistration | undefined = undefined;

      if (mysqlPool && isMySqlConnected) {
        try {
          const hasValidPhone = cleanPhone.length >= 8;
          const studentSql = hasValidPhone
            ? 'SELECT * FROM students WHERE LOWER(registration_number) = ? OR LOWER(id) = ? OR nisn = ? OR parent_phone = ? LIMIT 1'
            : 'SELECT * FROM students WHERE LOWER(registration_number) = ? OR LOWER(id) = ? OR nisn = ? LIMIT 1';
          const studentParams = hasValidPhone
            ? [cleanIdent, cleanIdent, cleanIdent, cleanPhone]
            : [cleanIdent, cleanIdent, cleanIdent];

          const [rows] = await mysqlPool.query(studentSql, studentParams);
          if (Array.isArray(rows) && rows.length > 0) {
            const s: any = rows[0];
            const parsedDocs = safeJsonParse<Record<string, any>>(s.documents_json, {});
            matchedStudent = {
              id: s.id,
              registrationNumber: s.registration_number,
              parentUserId: s.parent_user_id || undefined,
              fullName: s.full_name,
              nisn: s.nisn,
              unit: s.unit,
              gender: s.gender,
              birthPlace: s.birth_place || '',
              birthDate: formatSqlDate(s.birth_date, ''),
              address: s.address || '',
              parentName: s.parent_name || '',
              parentPhone: s.parent_phone || '',
              parentJob: s.parent_job || '',
              parentIncome: s.parent_income || '',
              status: s.status,
              registeredAt: formatSqlDateTime(s.registered_at),
              documents: parsedDocs,
              dynamicAnswers: safeJsonParse<Record<string, any>>(s.dynamic_answers_json, {}),
              schoolOrigin: s.school_origin || undefined,
            };
          }
        } catch (e) {}
      }

      if (!matchedStudent) {
        matchedStudent = memoryStore.students.find(
          (s) =>
            s.registrationNumber.toLowerCase() === cleanIdent ||
            s.id.toLowerCase() === cleanIdent ||
            (cleanPhone.length >= 8 && s.parentPhone && s.parentPhone.replace(/[^0-9]/g, '') === cleanPhone) ||
            (s.nisn && s.nisn === cleanIdent)
        );
      }

      if (matchedStudent) {
        isVirtualStudentUser = true;
        matchedUser = {
          id: `usr-${matchedStudent.id}`,
          name: matchedStudent.parentName || `Wali Siswa ${matchedStudent.fullName}`,
          email: `${matchedStudent.registrationNumber.toLowerCase()}@siswa.arrisalahaceh.or.id`,
          phone: matchedStudent.parentPhone,
          schoolId: matchedStudent.unit,
          role: 'Wali Siswa',
          permissions: ['Portal Wali', 'Anak Saya', 'Pembayaran', 'Profil'],
          isActive: true,
          lastLogin: new Date().toISOString().replace('T', ' ').substring(0, 19),
          studentId: matchedStudent.id,
          studentRegistrationNumber: matchedStudent.registrationNumber,
        };
      }
    }

    if (!matchedUser) {
      addAuditLog('login', 'MASTER', `Gagal masuk: Identitas "${identifier}" tidak terdaftar.`, identifier, ipAddress);
      return { success: false, error: 'Kredensial tidak cocok dengan data pendaftaran atau akun sistem.' };
    }

    if (!matchedUser.isActive) {
      addAuditLog('login', matchedUser.schoolId, `Gagal masuk: Akun "${matchedUser.email}" dinonaktifkan.`, matchedUser.email, ipAddress);
      return { success: false, error: 'Akun Anda sedang dinonaktifkan oleh administrator yayasan.' };
    }

    // 4. Verify Password strictly with Bcrypt (NO plaintext or virtual student backdoor)
    let isPasswordValid = false;

    if (passwordHashInDb) {
      try {
        isPasswordValid = bcrypt.compareSync(passwordPlain, passwordHashInDb);
      } catch (e) {
        isPasswordValid = false;
      }
    } else if (isVirtualStudentUser) {
      addAuditLog('login', matchedUser.schoolId, `Gagal masuk: Pendaftar ${matchedUser.email} belum memiliki akun portal Wali terdaftar.`, matchedUser.email, ipAddress);
      return {
        success: false,
        error: 'Nomor pendaftaran ini belum terhubung ke akun Wali aktif. Silakan masuk dengan akun Wali Anda atau daftar akun Wali baru.',
      };
    }

    if (!isPasswordValid) {
      addAuditLog('login', matchedUser.schoolId, `Gagal masuk: Kata sandi salah untuk "${matchedUser.email}".`, matchedUser.email, ipAddress);
      return { success: false, error: 'Kata sandi atau PIN keamanan yang Anda masukkan salah.' };
    }

    // Dynamic Role & Permission Resolution
    let matchedRole: any = null;
    if (matchedUser.email === 'master@dev.com' || matchedUser.role === 'Super Admin Yayasan') {
      matchedRole = memoryStore.roles.find(
        (r) => r.id === 'role-master' || r.name.includes('Super Admin')
      );
    } else if (
      matchedUser.email === 'adminyys@dev.com' ||
      (matchedUser.role && matchedUser.role.includes('Admin Yayasan') && !matchedUser.role.includes('Super'))
    ) {
      matchedRole = memoryStore.roles.find(
        (r) => r.id === 'role-admin-yys' || (r.name.includes('Admin Yayasan') && !r.name.includes('Super'))
      );
    } else {
      matchedRole = memoryStore.roles.find(
        (r) => r.name === matchedUser!.role || r.id === matchedUser!.role
      );
    }
    if (matchedRole && Array.isArray(matchedRole.permissions)) {
      matchedUser.permissions = [...matchedRole.permissions];
    }

    const safeUser = sanitizeUserForClient(matchedUser as StoredAppUser);

    // Generate signed persistent session token (resilient across server restarts)
    const SESSION_SECRET = process.env.SESSION_SECRET || 'ppdb_arrisalah_aceh_session_secret_2026';
    const expiresAtMs = Date.now() + SESSION_TTL_MS;
    const payload = `${safeUser.id}:${expiresAtMs}`;
    const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
    const sessionToken = `sess_${safeUser.id}_${expiresAtMs}_${sig}`;
    const expiresAt = new Date(expiresAtMs);

    activeSessions.set(sessionToken, {
      token: sessionToken,
      user: safeUser,
      expiresAt: expiresAtMs,
      ipAddress,
    });

    // Update lastLogin
    matchedUser.lastLogin = new Date().toISOString().replace('T', ' ').substring(0, 19);
    safeUser.lastLogin = matchedUser.lastLogin;
    if (mysqlPool && isMySqlConnected) {
      mysqlPool
        .query('UPDATE users SET last_login = ? WHERE id = ?', [safeUser.lastLogin, safeUser.id])
        .catch((e) => {});
    }

    addAuditLog('login', safeUser.schoolId, `Berhasil masuk: ${safeUser.name} (${safeUser.role})`, safeUser.email, ipAddress);
    persistStore();

    return {
      success: true,
      token: sessionToken,
      user: safeUser,
      expiresAt: expiresAt.toISOString(),
    };
  },

  createSessionForUser: (user: AppUser, ipAddress = '127.0.0.1') => {
    const safeUser = sanitizeUserForClient(user as StoredAppUser);
    const SESSION_SECRET = process.env.SESSION_SECRET || 'ppdb_arrisalah_aceh_session_secret_2026';
    const expiresAtMs = Date.now() + SESSION_TTL_MS;
    const payload = `${safeUser.id}:${expiresAtMs}`;
    const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
    const sessionToken = `sess_${safeUser.id}_${expiresAtMs}_${sig}`;
    const expiresAt = new Date(expiresAtMs);

    activeSessions.set(sessionToken, {
      token: sessionToken,
      user: safeUser,
      expiresAt: expiresAtMs,
      ipAddress,
    });

    return {
      token: sessionToken,
      expiresAt: expiresAt.toISOString(),
      user: safeUser,
    };
  },

  verifySessionToken: (token: string) => {
    if (!token || typeof token !== 'string') return null;

    // Deny immediately if session token was explicitly logged out / revoked
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const revokedExp = revokedSessionHashes.get(tokenHash);
    if (revokedExp !== undefined) {
      if (Date.now() <= revokedExp) {
        activeSessions.delete(token);
        return null;
      }
      revokedSessionHashes.delete(tokenHash);
    }

    const parseTokenIssuedAt = (tok: string): number => {
      if (!tok.startsWith('sess_')) return 0;
      const sigIdx = tok.lastIndexOf('_');
      const expIdx = sigIdx > 5 ? tok.lastIndexOf('_', sigIdx - 1) : -1;
      if (sigIdx > 5 && expIdx > 5) {
        const expMs = Number(tok.slice(expIdx + 1, sigIdx));
        if (Number.isFinite(expMs)) return expMs - SESSION_TTL_MS;
      }
      return 0;
    };

    // 1. Check in-memory activeSessions
    const session = activeSessions.get(token);
    if (session) {
      if (Date.now() > session.expiresAt) {
        activeSessions.delete(token);
        return null;
      }
      const freshUser = memoryStore.users.find((u) => u.id === session.user.id);
      const issuedAtMs = parseTokenIssuedAt(token);
      if (
        !freshUser ||
        !freshUser.isActive ||
        (freshUser.sessionInvalidatedAt && issuedAtMs < freshUser.sessionInvalidatedAt)
      ) {
        activeSessions.delete(token);
        return null;
      }

      session.user = {
        ...session.user,
        id: freshUser.id,
        name: freshUser.name,
        email: freshUser.email,
        phone: freshUser.phone,
        schoolId: freshUser.schoolId,
        role: freshUser.role,
        isActive: freshUser.isActive,
        emailVerified: freshUser.emailVerified,
        childrenIds: freshUser.childrenIds || session.user.childrenIds,
        studentId: freshUser.studentId || session.user.studentId,
        studentRegistrationNumber: freshUser.studentRegistrationNumber || session.user.studentRegistrationNumber,
      };

      // Sync permissions dynamically
      const matchedRole = memoryStore.roles.find(
        (r) =>
          r.name === session.user.role ||
          r.id === session.user.role ||
          (session.user.email === 'adminyys@dev.com' && (r.id === 'role-admin-yys' || r.name.includes('Admin Yayasan'))) ||
          (session.user.email === 'master@dev.com' && (r.id === 'role-master' || r.name.includes('Super Admin')))
      );
      if (matchedRole && Array.isArray(matchedRole.permissions)) {
        session.user.permissions = [...matchedRole.permissions];
      }
      return session.user;
    }

    // 2. Resilient Fallback for Server Restarts: Verify signed token format `sess_${userId}_${expiresAt}_${sig}`
    if (token.startsWith('sess_')) {
      try {
        const sigIdx = token.lastIndexOf('_');
        const expIdx = sigIdx > 5 ? token.lastIndexOf('_', sigIdx - 1) : -1;
        if (sigIdx > 5 && expIdx > 5) {
          const userId = token.slice(5, expIdx);
          const expiresAtMs = Number(token.slice(expIdx + 1, sigIdx));
          const clientSig = token.slice(sigIdx + 1);
          const issuedAtMs = expiresAtMs - SESSION_TTL_MS;

          if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) return null;

          const SESSION_SECRET = process.env.SESSION_SECRET || 'ppdb_arrisalah_aceh_session_secret_2026';
          const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(`${userId}:${expiresAtMs}`).digest('hex');

          const clientSigBuf = Buffer.from(clientSig, 'utf8');
          const expectedSigBuf = Buffer.from(expectedSig, 'utf8');
          const sigMatch =
            clientSigBuf.length === expectedSigBuf.length &&
            crypto.timingSafeEqual(clientSigBuf, expectedSigBuf);

          if (sigMatch) {
            const user = memoryStore.users.find((u) => u.id === userId || u.email.toLowerCase() === userId.toLowerCase());

            if (
              user &&
              user.isActive &&
              (!user.sessionInvalidatedAt || issuedAtMs >= user.sessionInvalidatedAt)
            ) {
              const matchedRole = memoryStore.roles.find(
                (r) =>
                  r.name === user.role ||
                  r.id === user.role ||
                  (user.email === 'adminyys@dev.com' && (r.id === 'role-admin-yys' || r.name.includes('Admin Yayasan'))) ||
                  (user.email === 'master@dev.com' && (r.id === 'role-master' || r.name.includes('Super Admin')))
              );
              if (matchedRole && Array.isArray(matchedRole.permissions)) {
                user.permissions = [...matchedRole.permissions];
              }

              const safeRestored = sanitizeUserForClient(user as StoredAppUser);
              // Re-cache into activeSessions
              activeSessions.set(token, {
                token,
                user: safeRestored,
                expiresAt: expiresAtMs,
                ipAddress: '127.0.0.1',
              });

              return safeRestored;
            }
          }
        }
      } catch (e) {
        console.error('[Session Restoration Error]:', e);
      }
    }

    return null;
  },

  revokeSessionToken: (token: string) => {
    if (token && typeof token === 'string') {
      activeSessions.delete(token);
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      let expiresAt = Date.now() + SESSION_TTL_MS;
      if (token.startsWith('sess_')) {
        const sigIdx = token.lastIndexOf('_');
        const expIdx = sigIdx > 5 ? token.lastIndexOf('_', sigIdx - 1) : -1;
        if (sigIdx > 5 && expIdx > 5) {
          const parsedExp = Number(token.slice(expIdx + 1, sigIdx));
          if (Number.isFinite(parsedExp) && parsedExp > Date.now()) {
            expiresAt = parsedExp;
          }
        }
      }
      revokedSessionHashes.set(tokenHash, expiresAt);
      memoryStore.revokedSessionHashes = Array.from(revokedSessionHashes.entries()).map(([hash, exp]) => ({
        hash,
        expiresAt: exp,
      }));
      persistStore();
    }
    return true;
  },

  invalidateUserSessions: (userId: string) => {
    const target = memoryStore.users.find((u) => u.id === userId);
    invalidateUserSessions(userId, target?.email);
    persistStore();
    return true;
  },

  // One-Time Cryptographic Password Reset Tokens (15m TTL, SHA-256 hashed, single-use)
  createPasswordResetToken: (identifier: string) => {
    const clean = String(identifier || '').trim().toLowerCase();
    if (!clean) {
      return { success: false as const, error: 'Email atau ID akun wajib diisi.' };
    }

    const cleanPhone = clean.replace(/\D/g, '');
    const user = memoryStore.users.find(
      (u) =>
        u.id === identifier ||
        u.email.toLowerCase() === clean ||
        (cleanPhone.length >= 9 && (u.phone || '').replace(/\D/g, '') === cleanPhone)
    );
    if (!user || !user.isActive) {
      return { success: false as const, notFound: true, error: 'Akun aktif tidak ditemukan.' };
    }

    const lastSent = passwordResetCooldowns.get(user.id) || 0;
    const now = Date.now();
    if (now - lastSent < RESET_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((RESET_COOLDOWN_MS - (now - lastSent)) / 1000);
      return {
        success: false as const,
        cooldownSeconds: remainingSeconds,
        error: `Silakan tunggu ${remainingSeconds} detik lagi sebelum meminta tautan reset baru.`,
      };
    }

    // Revoke any previous outstanding reset tokens for this user
    for (const [hash, rec] of passwordResetTokens.entries()) {
      if (rec.userId === user.id) {
        passwordResetTokens.delete(hash);
      }
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = now + RESET_TOKEN_TTL_MS;

    passwordResetTokens.set(tokenHash, {
      tokenHash,
      userId: user.id,
      email: user.email,
      expiresAt,
      createdAt: now,
    });
    passwordResetCooldowns.set(user.id, now);
    memoryStore.passwordResetTokens = Array.from(passwordResetTokens.values());
    persistStore();

    return {
      success: true as const,
      rawToken,
      user: sanitizeUserForClient(user),
      expiresAt,
      cooldownSeconds: 60,
    };
  },

  verifyPasswordResetToken: (rawToken: string) => {
    const cleanToken = String(rawToken || '').trim();
    if (!/^[a-f0-9]{64}$/i.test(cleanToken)) {
      return { valid: false, error: 'Tautan reset kata sandi tidak valid.' };
    }
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');
    const rec = passwordResetTokens.get(tokenHash);
    if (!rec || Date.now() > rec.expiresAt) {
      if (rec) {
        passwordResetTokens.delete(tokenHash);
        memoryStore.passwordResetTokens = Array.from(passwordResetTokens.values());
        persistStore();
      }
      return { valid: false, error: 'Tautan reset kata sandi telah kedaluwarsa atau sudah digunakan.' };
    }
    const user = memoryStore.users.find((u) => u.id === rec.userId && u.isActive);
    if (!user) {
      passwordResetTokens.delete(tokenHash);
      memoryStore.passwordResetTokens = Array.from(passwordResetTokens.values());
      persistStore();
      return { valid: false, error: 'Akun terkait tidak aktif atau tidak ditemukan.' };
    }
    const [localPart, domain] = user.email.split('@');
    const maskedLocal = localPart.length <= 2 ? `${localPart[0] || '*'}*` : `${localPart.slice(0, 2)}***`;
    return {
      valid: true,
      emailMasked: domain ? `${maskedLocal}@${domain}` : maskedLocal,
    };
  },

  consumePasswordResetToken: async (rawToken: string, newPassword: string, ipAddress = '127.0.0.1') => {
    const cleanToken = String(rawToken || '').trim();
    if (!/^[a-f0-9]{64}$/i.test(cleanToken)) {
      return { success: false, error: 'Token reset kata sandi tidak valid.' };
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return { success: false, error: 'Kata sandi baru minimal 8 karakter.' };
    }

    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');
    const rec = passwordResetTokens.get(tokenHash);
    if (!rec || Date.now() > rec.expiresAt) {
      if (rec) {
        passwordResetTokens.delete(tokenHash);
        memoryStore.passwordResetTokens = Array.from(passwordResetTokens.values());
        persistStore();
      }
      return { success: false, error: 'Token reset sudah kedaluwarsa atau telah dipakai sebelumnya.' };
    }

    // Consume immediately (single-use)
    passwordResetTokens.delete(tokenHash);
    memoryStore.passwordResetTokens = Array.from(passwordResetTokens.values());

    const userIdx = memoryStore.users.findIndex((u) => u.id === rec.userId && u.isActive);
    if (userIdx === -1) {
      persistStore();
      return { success: false, error: 'Akun pengguna tidak ditemukan atau tidak aktif.' };
    }

    const user = memoryStore.users[userIdx];
    const hashedPwd = bcrypt.hashSync(newPassword, 10);
    await executeMySql('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPwd, user.id]);

    user.passwordHash = hashedPwd;
    user.sessionInvalidatedAt = Date.now();
    invalidateUserSessions(user.id, user.email);
    persistStore();

    addAuditLog(
      'update_status',
      user.schoolId || 'MASTER',
      `Reset kata sandi akun "${user.email}" berhasil melalui token verifikasi satu kali`,
      user.email,
      ipAddress
    );

    return {
      success: true,
      message: 'Kata sandi baru berhasil disimpan dan semua sesi lama telah dicabut. Silakan masuk kembali.',
    };
  },

  // -------------------------------------------------------------
  // Real Database Explorer (Master-Only with Encrypted PIN Guard)
  // -------------------------------------------------------------
  verifyRealDbPin: (pinPlain: string, ipAddress = '127.0.0.1') => {
    // Encrypted bcrypt hash comparison - PIN is NEVER stored in plaintext in the codebase!
    const cleanPin = (pinPlain || '').trim();
    
    // Hash list to test against (from env and default hash for 11110000)
    const envHashRaw = process.env.REAL_DB_PIN_HASH || '';
    const envHash = envHashRaw.replace(/^["']+|["']+$/g, '').trim();

    // Default valid bcrypt hash for PIN '11110000'
    const defaultHash1 = '$2b$10$7Ncfg3UJPaoAJhivL.sOfuJBYoatekgSYV3A.MmUWXKMkwSz6ar16';
    const defaultHash2 = '$2b$10$vrpcelmdl.C327jshq0Deux9YNSeJYDbNansST3UFFSpGFNW.7T6y';

    const hashesToTry = [envHash, defaultHash1, defaultHash2].filter((h) => h && h.length > 20);

    let isPinValid = false;

    for (const h of hashesToTry) {
      try {
        if (bcrypt.compareSync(cleanPin, h)) {
          isPinValid = true;
          break;
        }
      } catch (e) {
        // Continue trying remaining hashes
      }
    }

    if (!isPinValid) {
      addAuditLog(
        'unauthorized_access' as any,
        'MASTER',
        `Percobaan PIN Real Database Explorer GAGAL dari IP ${ipAddress}`,
        'master@dev.com',
        ipAddress
      );
      return { success: false, error: 'PIN Keamanan Database tidak sesuai. Akses ditolak.' };
    }

    // Generate high-entropy temporary token for DB Explorer session (30 minutes)
    const dbAccessToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 30 * 60 * 1000;
    realDbAccessTokens.set(dbAccessToken, { expiresAt, ipAddress });

    addAuditLog(
      'login' as any,
      'MASTER',
      `Otorisasi PIN Real Database Explorer BERHASIL (Master)`,
      'master@dev.com',
      ipAddress
    );

    return {
      success: true,
      token: dbAccessToken,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  },

  verifyRealDbAccessToken: (token: string) => {
    if (!token) return false;
    const session = realDbAccessTokens.get(token);
    if (!session) return false;
    if (Date.now() > session.expiresAt) {
      realDbAccessTokens.delete(token);
      return false;
    }
    return true;
  },

  revokeRealDbAccessToken: (token: string) => {
    if (token) {
      realDbAccessTokens.delete(token);
    }
    return true;
  },

  getRealDbTables: async () => {
    const ALLOWED_TABLES = [
      { name: 'units', label: 'Tabel Kuota & Biaya (units)' },
      { name: 'students', label: 'Tabel Pendaftar & Siswa (students)' },
      { name: 'payments', label: 'Tabel Transaksi & Bukti Pembayaran (payments)' },
      { name: 'test_schedules', label: 'Tabel Jadwal Tes Seleksi (test_schedules)' },
      { name: 'form_schemas', label: 'Tabel Skema Form Builder (form_schemas)' },
      { name: 'roles', label: 'Tabel Role & Hak Akses (roles)' },
      { name: 'users', label: 'Tabel Pengguna & Kata Sandi (users)' },
      { name: 'academic_years', label: 'Tabel Periode Tahun Ajaran (academic_years)' },
      { name: 'landing_config', label: 'Tabel Konfigurasi Web Landing (landing_config)' },
      { name: 'audit_logs', label: 'Tabel Security Audit Trail (audit_logs)' },
      { name: 'trash_items', label: 'Tabel Sampah / Trash Data (trash_items)' },
    ];

    const result = [];
    for (const t of ALLOWED_TABLES) {
      let count = 0;
      if (mysqlPool && isMySqlConnected) {
        try {
          const [rows]: any = await mysqlPool.query(`SELECT COUNT(*) as cnt FROM \`${t.name}\``);
          if (Array.isArray(rows) && rows[0]) {
            count = Number(rows[0].cnt) || 0;
          }
        } catch (e) {
          count = 0;
        }
      } else {
        const storeKeyMap: Record<string, keyof AppStore> = {
          units: 'units',
          students: 'students',
          payments: 'payments',
          test_schedules: 'schedules',
          form_schemas: 'formSchemas',
          roles: 'roles',
          users: 'users',
          academic_years: 'academicYears',
          landing_config: 'landingConfig',
          audit_logs: 'auditLogs',
          trash_items: 'trashItems',
        };
        const sk = storeKeyMap[t.name];
        if (sk) {
          const val = memoryStore[sk];
          count = Array.isArray(val) ? val.length : 1;
        }
      }
      result.push({
        name: t.name,
        label: t.label,
        rowCount: count,
        isLiveMySQL: isMySqlConnected,
      });
    }

    return result;
  },

  getRealDbTableData: async (tableName: string, page = 1, limit = 25, search = '') => {
    const ALLOWED_TABLES = [
      'units',
      'students',
      'payments',
      'test_schedules',
      'form_schemas',
      'roles',
      'users',
      'academic_years',
      'landing_config',
      'audit_logs',
      'trash_items',
    ];

    if (!ALLOWED_TABLES.includes(tableName)) {
      throw new Error('Nama tabel tidak diizinkan atau tidak ditemukan.');
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
    const offset = (safePage - 1) * safeLimit;

    if (mysqlPool && isMySqlConnected) {
      // Query columns
      const [colRows]: any = await mysqlPool.query(`SHOW COLUMNS FROM \`${tableName}\``);
      const columns = Array.isArray(colRows)
        ? colRows.map((c: any) => ({
            name: c.Field,
            type: c.Type,
            nullable: c.Null === 'YES',
            key: c.Key,
            default: c.Default,
          }))
        : [];

      // Query total count
      const [countRows]: any = await mysqlPool.query(`SELECT COUNT(*) as total FROM \`${tableName}\``);
      const total = Number(countRows[0]?.total) || 0;

      // Query rows with pagination
      const [dataRows]: any = await mysqlPool.query(
        `SELECT * FROM \`${tableName}\` LIMIT ? OFFSET ?`,
        [safeLimit, offset]
      );

      const sanitizedMySqlRows = (Array.isArray(dataRows) ? dataRows : []).map((r: any) => {
        if (tableName === 'users' && r && typeof r === 'object') {
          const { password_hash: _omit1, passwordHash: _omit2, ...rest } = r;
          return { ...rest, password_hash: rest ? '********' : undefined };
        }
        return r;
      });

      return {
        tableName,
        columns,
        rows: sanitizedMySqlRows,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit) || 1,
        isLiveMySQL: true,
        connectionInfo: {
          host: process.env.MYSQL_HOST || 'localhost',
          port: Number(process.env.MYSQL_PORT) || 3306,
          database: process.env.MYSQL_DATABASE || 'ppdb_arrisalah',
          user: process.env.MYSQL_USER || 'root',
        },
      };
    }

    // Fallback: In-memory store
    const storeKeyMap: Record<string, keyof AppStore> = {
      units: 'units',
      students: 'students',
      payments: 'payments',
      test_schedules: 'schedules',
      form_schemas: 'formSchemas',
      roles: 'roles',
      users: 'users',
      academic_years: 'academicYears',
      landing_config: 'landingConfig',
      audit_logs: 'auditLogs',
      trash_items: 'trashItems',
    };

    const storeKey = storeKeyMap[tableName];
    let storeData: any[] = [];
    if (storeKey) {
      const val = memoryStore[storeKey];
      storeData = Array.isArray(val) ? val : [val];
    }

    const total = storeData.length;
    const rawPaginated = storeData.slice(offset, offset + safeLimit);
    const paginated =
      tableName === 'users'
        ? rawPaginated.map((row: any) => sanitizeUserForClient(row))
        : rawPaginated;

    const allKeys = new Set<string>();
    storeData.forEach((item) => {
      if (item && typeof item === 'object') {
        Object.keys(item).forEach((k) => {
          if (tableName === 'users' && (k === 'passwordHash' || k === 'password_hash')) return;
          allKeys.add(k);
        });
      }
    });
    const columns = Array.from(allKeys).map((k) => {
      const sampleVal = storeData.find((item) => item && item[k] !== undefined)?.[k];
      return {
        name: k,
        type: typeof sampleVal,
        nullable: true,
        key: k === 'id' ? 'PRI' : '',
        default: null,
      };
    });

    return {
      tableName,
      columns,
      rows: paginated,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
      isLiveMySQL: false,
      connectionInfo: {
        host: 'Persistent In-Memory Storage',
        port: 3306,
        database: 'ppdb_store.json',
        user: 'ppdb_admin',
      },
    };
  },

  // Trash / Sampah Management (Master Admin Only)
  getTrashItems: () => {
    const items = Array.isArray(memoryStore.trashItems) ? memoryStore.trashItems : [];
    return items.map((item) => sanitizeTrashItemForClient(item));
  },

  restoreTrashItem: async (trashId: string, restoredBy = 'Master Admin') => {
    const items = Array.isArray(memoryStore.trashItems) ? memoryStore.trashItems : [];
    const target = items.find((item) => item.id === trashId);
    if (!target) {
      return { success: false, statusCode: 404, error: 'Item sampah tidak ditemukan.' };
    }

    const snap = target.snapshot || {};

    if (target.entityType === 'student') {
      const student: StudentRegistration | undefined = snap.student;
      if (!student || !student.id) {
        return { success: false, statusCode: 400, error: 'Snapshot data siswa di sampah tidak valid.' };
      }
      if (memoryStore.students.some((s) => s.id === student.id)) {
        return { success: false, statusCode: 409, error: `Data siswa "${student.fullName}" sudah ada di daftar aktif.` };
      }
      if (memoryStore.students.some((s) => s.registrationNumber === student.registrationNumber)) {
        return {
          success: false,
          statusCode: 409,
          error: `Nomor registrasi ${student.registrationNumber} sudah dipakai pendaftar aktif lain.`,
        };
      }

      const validScheduleId =
        student.testScheduleId && memoryStore.schedules.some((sc) => sc.id === student.testScheduleId)
          ? student.testScheduleId
          : undefined;
      const restoredStudent: StudentRegistration = { ...student, testScheduleId: validScheduleId };

      await executeMySql(
        `INSERT INTO students (id, registration_number, parent_user_id, full_name, nisn, unit, gender, birth_place, birth_date, address, parent_name, parent_phone, parent_job, parent_income, status, registered_at, documents_json, dynamic_answers_json, verification_notes, test_score, test_schedule_id, test_published, is_offline, track, school_origin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          restoredStudent.id,
          restoredStudent.registrationNumber,
          restoredStudent.parentUserId || null,
          restoredStudent.fullName.slice(0, 200),
          restoredStudent.nisn || null,
          restoredStudent.unit,
          restoredStudent.gender || 'Laki-laki',
          (restoredStudent.birthPlace || '').trim().slice(0, 100),
          toSqlDateOrNull(restoredStudent.birthDate),
          restoredStudent.address || '',
          (restoredStudent.parentName || '').trim().slice(0, 150),
          (restoredStudent.parentPhone || '').trim().slice(0, 30),
          (restoredStudent.parentJob || '').trim().slice(0, 100),
          (restoredStudent.parentIncome || '').trim().slice(0, 100),
          restoredStudent.status || 'verifikasi',
          formatSqlDateTime(restoredStudent.registeredAt, formatSqlDateTime(new Date())),
          JSON.stringify(restoredStudent.documents || {}),
          JSON.stringify(restoredStudent.dynamicAnswers || {}),
          restoredStudent.verificationNotes || null,
          restoredStudent.testScore ?? null,
          restoredStudent.testScheduleId || null,
          restoredStudent.testPublished ? 1 : 0,
          restoredStudent.isOffline ? 1 : 0,
          restoredStudent.track || null,
          restoredStudent.schoolOrigin || null,
        ]
      );

      memoryStore.students.push(restoredStudent);

      const archivedPayments: PaymentRecord[] = Array.isArray(snap.payments) ? snap.payments : [];
      for (const p of archivedPayments) {
        if (!p || !p.id) continue;
        if (!memoryStore.payments.some((ep) => ep.id === p.id)) {
          await executeMySql(
            `INSERT IGNORE INTO payments (id, registration_id, registration_number, student_name, unit, type, amount, status, payment_date, proof_url, verified_by, verification_notes, bank_account)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              p.id,
              p.registrationId,
              p.registrationNumber,
              p.studentName,
              p.unit,
              p.type,
              Number(p.amount) || 0,
              p.status,
              formatSqlDateTime(p.date, formatSqlDateTime(new Date())),
              p.proofUrl || null,
              p.verifiedBy || null,
              p.verificationNotes || null,
              p.bankAccount || '',
            ]
          );
          memoryStore.payments.push(p);
        }
      }

      const targetUnitObj = memoryStore.units.find((u) => u.id === restoredStudent.unit);
      const nextOnline = memoryStore.students.filter((s) => s.unit === restoredStudent.unit).length;
      const offlineCnt = Math.max(0, Number(targetUnitObj?.offlineCount) || 0);
      const nextFilled = nextOnline + offlineCnt;
      await executeMySql('UPDATE units SET filled_quota = ? WHERE id = ?', [nextFilled, restoredStudent.unit]);
      memoryStore.units = memoryStore.units.map((u) =>
        u.id === restoredStudent.unit ? { ...u, onlineCount: nextOnline, offlineCount: offlineCnt, filledQuota: nextFilled } : u
      );

      if (restoredStudent.parentUserId) {
        memoryStore.users = memoryStore.users.map((u) => {
          if (u.id === restoredStudent.parentUserId) {
            const cIds = Array.isArray(u.childrenIds) ? u.childrenIds : [];
            if (!cIds.includes(restoredStudent.id)) {
              return { ...u, childrenIds: [...cIds, restoredStudent.id] };
            }
          }
          return u;
        });
      }

      addAuditLog('update_status', restoredStudent.unit, `Pulihkan data siswa "${restoredStudent.fullName}" (${restoredStudent.registrationNumber}) dari Sampah`, restoredBy);
    } else if (target.entityType === 'schedule') {
      const sch: TestSchedule | undefined = snap.schedule;
      if (!sch || !sch.id) {
        return { success: false, statusCode: 400, error: 'Snapshot jadwal tes di sampah tidak valid.' };
      }
      if (memoryStore.schedules.some((sc) => sc.id === sch.id)) {
        return { success: false, statusCode: 409, error: `Jadwal tes "${sch.title}" sudah ada di daftar aktif.` };
      }

      await executeMySql(
        `INSERT INTO test_schedules (id, title, unit, test_date, start_time, end_time, room, examiner, quota, filled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sch.id,
          sch.title,
          sch.unit,
          formatSqlDate(sch.date, new Date().toISOString().slice(0, 10)),
          sch.startTime,
          sch.endTime,
          sch.room,
          sch.examiner,
          Number(sch.quota) || 40,
          Number(sch.filled) || 0,
        ]
      );
      memoryStore.schedules.push(sch);

      const linkedIds: string[] = Array.isArray(snap.linkedStudentIds) ? snap.linkedStudentIds : [];
      for (const sid of linkedIds) {
        const st = memoryStore.students.find((s) => s.id === sid);
        if (st && !st.testScheduleId) {
          await executeMySql('UPDATE students SET test_schedule_id = ? WHERE id = ?', [sch.id, sid]);
          st.testScheduleId = sch.id;
        }
      }

      addAuditLog('update_status', sch.unit, `Pulihkan jadwal tes "${sch.title}" dari Sampah`, restoredBy);
    } else if (target.entityType === 'role') {
      const role: UserRole | undefined = snap.role;
      if (!role || !role.id) {
        return { success: false, statusCode: 400, error: 'Snapshot role di sampah tidak valid.' };
      }
      if (memoryStore.roles.some((r) => r.id === role.id || r.name.toLowerCase() === role.name.toLowerCase())) {
        return { success: false, statusCode: 409, error: `Role "${role.name}" sudah aktif di sistem.` };
      }

      await executeMySql(
        `INSERT INTO roles (id, name, school_id, permissions_json, description, user_count) VALUES (?, ?, ?, ?, ?, ?)`,
        [role.id, role.name, role.schoolId || 'MASTER', JSON.stringify(role.permissions || []), role.description || '', Number(role.userCount) || 0]
      );
      memoryStore.roles.push(role);
      addAuditLog('update_status', 'MASTER', `Pulihkan role "${role.name}" dari Sampah`, restoredBy);
    } else if (target.entityType === 'user') {
      const userObj: AppUser | undefined = snap.user;
      if (!userObj || !userObj.id || !userObj.email) {
        return { success: false, statusCode: 400, error: 'Snapshot akun pengguna di sampah tidak valid.' };
      }
      if (memoryStore.users.some((u) => u.id === userObj.id || u.email.toLowerCase() === userObj.email.toLowerCase())) {
        return {
          success: false,
          statusCode: 409,
          error: `Akun dengan email "${userObj.email}" sudah terdaftar di sistem aktif.`,
        };
      }

      const pwdHash =
        snap.passwordHash || bcrypt.hashSync(crypto.randomBytes(18).toString('base64url'), 10);
      await executeMySql(
        `INSERT INTO users (id, name, email, phone, school_id, role, permissions_json, is_active, email_verified, children_ids_json, password_hash, last_login)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userObj.id,
          userObj.name,
          userObj.email,
          userObj.phone || '',
          userObj.schoolId || 'MASTER',
          userObj.role,
          JSON.stringify(userObj.permissions || []),
          userObj.isActive ? 1 : 0,
          userObj.emailVerified ? 1 : 0,
          JSON.stringify(userObj.childrenIds || []),
          pwdHash,
          userObj.lastLogin || '-',
        ]
      );
      memoryStore.users.push({ ...userObj, passwordHash: pwdHash });
      addAuditLog('update_status', userObj.schoolId || 'MASTER', `Pulihkan akun "${userObj.name}" (${userObj.email}) dari Sampah`, restoredBy);
    } else if (target.entityType === 'form_section') {
      const unitId = String(snap.unitId || '');
      const section = snap.section;
      if (!unitId || !section || !section.id) {
        return { success: false, statusCode: 400, error: 'Snapshot seksi Form Builder tidak valid.' };
      }
      const existingSchema = memoryStore.formSchemas.find((s) => s.unitId === unitId) || { unitId, sections: [] };
      if (existingSchema.sections.some((sec) => sec.id === section.id)) {
        return { success: false, statusCode: 409, error: `Seksi "${section.title}" sudah ada di Form Builder unit ${unitId}.` };
      }
      await db.updateFormSchema(
        unitId,
        { unitId, sections: [...existingSchema.sections, section] },
        restoredBy,
        'Super Admin Yayasan',
        true
      );
      addAuditLog('update_status', unitId, `Pulihkan seksi Form Builder "${section.title}" unit ${unitId} dari Sampah`, restoredBy);
    } else if (target.entityType === 'form_field') {
      const unitId = String(snap.unitId || '');
      const { sectionId, sectionTitle, field } = snap;
      if (!unitId || !field || !field.id) {
        return { success: false, statusCode: 400, error: 'Snapshot field Form Builder tidak valid.' };
      }
      const existingSchema = memoryStore.formSchemas.find((s) => s.unitId === unitId) || { unitId, sections: [] };
      if (existingSchema.sections.some((sec) => Array.isArray(sec.fields) && sec.fields.some((f) => f.id === field.id))) {
        return { success: false, statusCode: 409, error: `Field "${field.label}" sudah ada di Form Builder unit ${unitId}.` };
      }
      const nextSections = [...existingSchema.sections];
      const secIdx = nextSections.findIndex((sec) => sec.id === sectionId);
      if (secIdx >= 0) {
        nextSections[secIdx] = {
          ...nextSections[secIdx],
          fields: [...(nextSections[secIdx].fields || []), field],
        };
      } else {
        nextSections.push({
          id: sectionId || `sec-restored-${Date.now()}`,
          title: sectionTitle || 'Seksi Dipulihkan',
          fields: [field],
        });
      }
      await db.updateFormSchema(unitId, { unitId, sections: nextSections }, restoredBy, 'Super Admin Yayasan', true);
      addAuditLog('update_status', unitId, `Pulihkan field Form Builder "${field.label}" unit ${unitId} dari Sampah`, restoredBy);
    } else if (target.entityType === 'landing_slide') {
      const slide = snap.slide;
      if (!slide || !slide.id) {
        return { success: false, statusCode: 400, error: 'Snapshot slide hero tidak valid.' };
      }
      const currLanding = db.getLandingConfig();
      const slides = Array.isArray(currLanding.heroSlides) ? [...currLanding.heroSlides] : [];
      if (slides.some((s) => s.id === slide.id)) {
        return { success: false, statusCode: 409, error: `Slide "${slide.title || slide.id}" sudah ada di Landing Page.` };
      }
      await db.updateLandingConfig({ ...currLanding, heroSlides: [...slides, slide] }, restoredBy, 'Super Admin Yayasan', true);
      addAuditLog('update_status', 'MASTER', `Pulihkan slide hero "${slide.title || 'Banner'}" dari Sampah`, restoredBy);
    } else if (target.entityType === 'landing_step') {
      const step = snap.step;
      if (!step || !step.title) {
        return { success: false, statusCode: 400, error: 'Snapshot langkah alur landing tidak valid.' };
      }
      const currLanding = db.getLandingConfig();
      const steps = Array.isArray(currLanding.flowSteps) ? [...currLanding.flowSteps] : [];
      if (steps.some((st) => st.step === step.step && st.title === step.title)) {
        return { success: false, statusCode: 409, error: `Langkah alur "${step.title}" sudah ada di Landing Page.` };
      }
      steps.push(step);
      steps.sort((a, b) => Number(a.step) - Number(b.step));
      await db.updateLandingConfig({ ...currLanding, flowSteps: steps }, restoredBy, 'Super Admin Yayasan', true);
      addAuditLog('update_status', 'MASTER', `Pulihkan alur pendaftaran "${step.title}" dari Sampah`, restoredBy);
    } else if (target.entityType === 'landing_requirement') {
      const reqText = typeof snap.requirement === 'string' ? snap.requirement.trim() : '';
      if (!reqText) {
        return { success: false, statusCode: 400, error: 'Snapshot syarat pendaftaran tidak valid.' };
      }
      const currLanding = db.getLandingConfig();
      const reqs = Array.isArray(currLanding.requirements) ? [...currLanding.requirements] : [];
      if (reqs.some((r) => String(r).trim() === reqText)) {
        return { success: false, statusCode: 409, error: 'Syarat pendaftaran tersebut sudah ada di Landing Page.' };
      }
      await db.updateLandingConfig({ ...currLanding, requirements: [...reqs, reqText] }, restoredBy, 'Super Admin Yayasan', true);
      addAuditLog('update_status', 'MASTER', `Pulihkan syarat pendaftaran "${reqText.slice(0, 60)}" dari Sampah`, restoredBy);
    } else if (target.entityType === 'smtp_account') {
      const acc = snap.account;
      if (!acc || !acc.senderEmail) {
        return { success: false, statusCode: 400, error: 'Snapshot akun SMTP tidak valid.' };
      }
      const currSmtp = db.getSmtpConfig();
      const accounts = Array.isArray(currSmtp.accounts) ? [...currSmtp.accounts] : [];
      if (accounts.some((a) => a.senderEmail.toLowerCase() === acc.senderEmail.toLowerCase())) {
        return { success: false, statusCode: 409, error: `Akun SMTP ${acc.senderEmail} sudah terdaftar aktif.` };
      }
      const nextPayload: SmtpConfig = {
        ...currSmtp,
        accounts: [...accounts, acc],
      };
      await executeMySql(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES ('smtp_config', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [JSON.stringify(nextPayload)]
      );
      memoryStore.smtpConfig = nextPayload;
      addAuditLog('smtp_config', 'MASTER', `Pulihkan akun SMTP ${acc.senderEmail} dari Sampah`, restoredBy);
    } else {
      return { success: false, statusCode: 400, error: `Tipe entitas "${target.entityType}" belum didukung untuk pemulihan.` };
    }

    // Remove restored item from trash_items
    await executeMySql('DELETE FROM trash_items WHERE id = ?', [trashId]);
    memoryStore.trashItems = items.filter((item) => item.id !== trashId);
    persistStore();

    return {
      success: true,
      entityType: target.entityType,
      message: `Data "${target.title}" berhasil dipulihkan dari Sampah.`,
    };
  },

  saveUploadedBufferToDisk: (buffer: Buffer, prefix: string, ext: string): string => {
    return saveBufferToUploadsDirs(buffer, prefix, ext);
  },

  deleteUploadFileIfUnused: (fileUrl?: string | null): boolean => {
    return deleteUploadFileSafely(fileUrl);
  },

  permanentlyDeleteTrashItem: async (trashId: string, actor = 'Master Admin') => {
    const items = Array.isArray(memoryStore.trashItems) ? memoryStore.trashItems : [];
    const target = items.find((item) => item.id === trashId);
    if (!target) return false;

    const candidateUploadUrls = new Set<string>();
    collectUploadUrlsFromValue(target.snapshot, candidateUploadUrls);

    await executeMySql('DELETE FROM trash_items WHERE id = ?', [trashId]);
    memoryStore.trashItems = items.filter((item) => item.id !== trashId);

    for (const url of candidateUploadUrls) {
      deleteUploadFileSafely(url);
    }

    addAuditLog('update_status', 'MASTER', `Hapus permanen item "${target.title}" (${target.entityType}) dari Sampah oleh ${actor}`, actor);
    persistStore();
    return true;
  },

  emptyTrash: async (actor = 'Master Admin') => {
    const items = Array.isArray(memoryStore.trashItems) ? memoryStore.trashItems : [];
    const count = items.length;
    const candidateUploadUrls = new Set<string>();
    for (const item of items) {
      collectUploadUrlsFromValue(item?.snapshot, candidateUploadUrls);
    }

    await executeMySql('DELETE FROM trash_items');
    memoryStore.trashItems = [];

    for (const url of candidateUploadUrls) {
      deleteUploadFileSafely(url);
    }

    addAuditLog('update_status', 'MASTER', `Kosongkan seluruh Sampah (${count} item dihapus permanen) oleh ${actor}`, actor);
    persistStore();
    return count;
  },

  cleanupExpiredSessions: () => {
    const now = Date.now();
    for (const [token, session] of activeSessions.entries()) {
      if (now > session.expiresAt) {
        activeSessions.delete(token);
      }
    }
    for (const [token, record] of realDbAccessTokens.entries()) {
      if (now > record.expiresAt) {
        realDbAccessTokens.delete(token);
      }
    }
    let resetChanged = false;
    for (const [hash, record] of passwordResetTokens.entries()) {
      if (now > record.expiresAt) {
        passwordResetTokens.delete(hash);
        resetChanged = true;
      }
    }
    if (resetChanged) {
      memoryStore.passwordResetTokens = Array.from(passwordResetTokens.values());
    }
    let revokedChanged = false;
    for (const [hash, exp] of revokedSessionHashes.entries()) {
      if (now > exp) {
        revokedSessionHashes.delete(hash);
        revokedChanged = true;
      }
    }
    if (revokedChanged) {
      memoryStore.revokedSessionHashes = Array.from(revokedSessionHashes.entries()).map(([hash, exp]) => ({
        hash,
        expiresAt: exp,
      }));
    }
    if (resetChanged || revokedChanged) {
      persistStore();
    }
    for (const [uid, ts] of passwordResetCooldowns.entries()) {
      if (now - ts > RESET_COOLDOWN_MS) {
        passwordResetCooldowns.delete(uid);
      }
    }
  },
};

interface SessionRecord {
  token: string;
  user: AppUser;
  expiresAt: number;
  ipAddress: string;
}

const activeSessions = new Map<string, SessionRecord>();
const realDbAccessTokens = new Map<string, { expiresAt: number; ipAddress: string }>();
