import React from 'react';
import { RegistrationStatus, PaymentStatus } from '../../types/ppdb';

export const StatusBadge: React.FC<{ status: RegistrationStatus | string }> = ({ status }) => {
  switch (status) {
    case 'verifikasi':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Verifikasi
        </span>
      );
    case 'tes':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          Tahap Tes
        </span>
      );
    case 'lulus':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Lulus
        </span>
      );
    case 'tidak_lulus':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          Tidak Lulus
        </span>
      );
    case 'terdaftar':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          Terdaftar
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700">
          {status}
        </span>
      );
  }
};

export const PaymentBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          Menunggu Bukti
        </span>
      );
    case 'verifikasi':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Sedang Dicek
        </span>
      );
    case 'lunas':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Lunas
        </span>
      );
    case 'ditolak':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          Ditolak
        </span>
      );
  }
};

export const UnitBadge: React.FC<{ unit: string }> = ({ unit }) => {
  const fixedStyles: Record<string, string> = {
    TK01: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    SD01: 'bg-teal-100 text-teal-800 border-teal-200',
    SMP01: 'bg-sky-100 text-sky-800 border-sky-200',
    SMA01: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    MASTER: 'bg-purple-100 text-purple-800 border-purple-200',
  };

  const palette = [
    'bg-cyan-100 text-cyan-800 border-cyan-200',
    'bg-violet-100 text-violet-800 border-violet-200',
    'bg-amber-100 text-amber-800 border-amber-200',
    'bg-rose-100 text-rose-800 border-rose-200',
    'bg-lime-100 text-lime-800 border-lime-200',
  ];

  const hash = unit.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const badgeClass = fixedStyles[unit] || palette[hash % palette.length];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border ${badgeClass}`}
    >
      {unit}
    </span>
  );
};
