import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  ShieldCheck,
  Database,
  Lock,
  Clock,
  Activity,
  FileCheck2,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { usePPDB } from '../../../context/PPDBContext';
import { isSuperAdmin } from '../../../utils/rbac';
import { apiFetch } from '../../../utils/auth';

interface LiveSecurityStatus {
  database: {
    connected: boolean;
    driver: string;
    host: string;
    port: string;
    database: string;
    statusMessage: string;
  };
  tableCount: number;
  security: {
    appMode?: 'development' | 'production';
    authMechanism: string;
    sessionDuration: string;
    corsAllowlistActive: boolean;
    corsWildcard?: boolean;
    rateLimits: {
      generalUnauth: string;
      generalAuth: string;
      authSensitive: string;
      otp: string;
      publicLookup: string;
      upload: string;
    };
    cloudflareEnabled: boolean;
    cloudflareManagedByEnv?: boolean;
    smtpEnabled: boolean;
    smtpVerified: boolean;
    auditIntegrity: {
      valid: boolean;
      totalLogs: number;
      chainedCount: number;
      legacyCount: number;
      brokenCount: number;
    };
    securityHeaders: string[];
  };
}

export const StatusSistemView: React.FC = () => {
  const { dbStatus, refreshAllData, downloadMySqlDump, showToast, currentUser } = usePPDB();
  const [liveStatus, setLiveStatus] = useState<LiveSecurityStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const canDownloadSql = isSuperAdmin(currentUser);

  const fetchLiveSecurityStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/system-security-status', {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setLiveStatus(data);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchLiveSecurityStatus();
  }, [fetchLiveSecurityStatus]);

  const handleTestPing = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshAllData(), fetchLiveSecurityStatus()]);
      showToast('Ping server, database, & status keamanan tersinkronisasi.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const effectiveDb = liveStatus?.database || dbStatus;
  const auditValid = liveStatus ? liveStatus.security.auditIntegrity.valid : true;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-600" />
            <span>Status Sistem & Backend Database MySQL</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoring koneksi database, parameter keamanan OWASP ASVS aktual, dan proteksi server Express.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canDownloadSql && (
            <button
              onClick={downloadMySqlDump}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download SQL Dump MySQL (.sql)</span>
            </button>
          )}

          <button
            onClick={handleTestPing}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>
        </div>
      </div>

      {/* MySQL Connection Detail Banner */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">
                Driver Database: {effectiveDb?.driver || 'MySQL / Persistent JSON Store'}
              </h4>
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                effectiveDb?.connected
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                {effectiveDb?.connected ? 'MySQL Live Connected' : 'Local Persistent Store'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Host: {effectiveDb?.host || 'localhost'} · Port: {effectiveDb?.port || '3306'} · Database: {effectiveDb?.database || 'ppdb_arrisalah'}
            </p>
            <p className="text-[11px] text-emerald-700 mt-1 font-medium">
              {effectiveDb?.statusMessage || 'Koneksi database persisten siap digunakan secara otomatis.'}
            </p>
          </div>
        </div>

        <div className="text-right text-xs text-slate-500 space-y-1">
          <p>
            Tabel Terdeteksi:{' '}
            <strong className="text-slate-700">
              {liveStatus ? `${liveStatus.tableCount} Tabel Relasional` : 'Memuat...'}
            </strong>
          </p>
          <p>Charset: <strong className="text-slate-700">utf8mb4_unicode_ci</strong></p>
        </div>
      </div>

      {/* 6 Grid Status Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Database Terhubung */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Koneksi Database MySQL
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${effectiveDb?.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="font-bold text-slate-900 text-sm">
              {effectiveDb?.connected ? 'MySQL Live Terhubung' : 'Mode Persistent JSON Store'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Dukungan sinkronisasi MySQL dan fallback persistent store lokal secara atomik.
          </p>
        </div>

        {/* Auth & Origin Protection */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Autentikasi & CORS Allowlist
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="font-bold text-slate-900 text-sm">
              {liveStatus
                ? liveStatus.security.corsWildcard
                  ? `Mode ${liveStatus.security.appMode || 'production'} · CORS Publik (*)`
                  : `Mode ${liveStatus.security.appMode || 'production'} · CORS Allowlist Aktif`
                : 'Memeriksa...'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {liveStatus?.security.authMechanism || 'HttpOnly Cookie + HMAC-SHA256 Session + CSRF'} · Cloudflare Turnstile (.env):{' '}
            <strong>{liveStatus?.security.cloudflareEnabled ? 'Aktif' : 'Non-aktif'}</strong>
          </p>
        </div>

        {/* Session Expiry */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Masa Berlaku Sesi
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="font-bold text-slate-900 text-sm">
              {liveStatus?.security.sessionDuration || '7 Hari (Auto-revoke)'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Pencabutan sesi otomatis saat logout, reset kata sandi, perubahan hak akses, atau penonaktifan akun.
          </p>
        </div>

        {/* Rate Limiting */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Rate Limiting Backend
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="font-bold text-slate-900 text-sm">
              Auth: {liveStatus?.security.rateLimits.authSensitive || '30 Req / 1 Menit'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            API Umum: {liveStatus?.security.rateLimits.generalAuth || '450 Req / 5 Menit'} · OTP:{' '}
            {liveStatus?.security.rateLimits.otp || '10 Req / 10 Menit'} · Publik:{' '}
            {liveStatus?.security.rateLimits.publicLookup || '30 Req / 5 Menit'}
          </p>
        </div>

        {/* Audit Log Active */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Security Audit Log
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              {auditValid ? (
                <FileCheck2 className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${auditValid ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="font-bold text-slate-900 text-sm">
              {auditValid ? 'HMAC Chain Valid' : 'Terdeteksi Anomali Chain'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {liveStatus
              ? `${liveStatus.security.auditIntegrity.chainedCount} entri berantai HMAC-SHA256 (${liveStatus.security.auditIntegrity.totalLogs} total log).`
              : 'Mencatat setiap mutasi autentikasi, pendaftaran, verifikasi, dan pembayaran.'}
          </p>
        </div>

        {/* Security Headers */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Security Headers Express
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="font-bold text-slate-900 text-sm">
              CSP, X-Frame, Nosniff, Permissions
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {liveStatus?.security.securityHeaders.join(' · ') || 'Header keamanan Express aktif pada seluruh endpoint.'}
          </p>
        </div>
      </div>

      {/* MySQL Import Instructions */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 space-y-3">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Petunjuk Impor ke Database MySQL (phpMyAdmin / cPanel / VPS)</span>
        </h4>
        <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1.5 pl-1 leading-relaxed">
          <li>Klik tombol <strong>"Download SQL Dump MySQL (.sql)"</strong> di atas untuk mendapatkan file <code>ppdb_arrisalah_mysql.sql</code>.</li>
          <li>Buka phpMyAdmin atau MySQL Client Anda, lalu buat database baru bernama <code>ppdb_arrisalah</code> (atau sesuaikan dengan file <code>.env</code>).</li>
          <li>Pilih tab <strong>Import</strong> dan upload file <code>ppdb_arrisalah_mysql.sql</code>.</li>
          <li>Atur variabel environment di file <code>.env</code> (misal: <code>MYSQL_HOST=localhost</code>, <code>MYSQL_USER=root</code>, <code>MYSQL_PASSWORD=...</code>).</li>
          <li>Aplikasi akan secara otomatis menghubungkan dan menyinkronkan data langsung dengan server MySQL Anda!</li>
        </ol>
      </div>
    </div>
  );
};
