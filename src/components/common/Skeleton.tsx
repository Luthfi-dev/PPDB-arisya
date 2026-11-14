import React from 'react';

export const SkeletonBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`} aria-hidden="true" />
);

export const WaliDashboardSkeleton: React.FC = () => (
  <div className="space-y-6" aria-busy="true" aria-label="Memuat data pendaftaran ananda">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="space-y-2">
        <SkeletonBlock className="h-6 w-60" />
        <SkeletonBlock className="h-3.5 w-80 max-w-full" />
      </div>
      <SkeletonBlock className="h-10 w-40 rounded-xl" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {[0, 1].map((idx) => (
        <div
          key={idx}
          className="bg-white rounded-3xl p-5 border border-emerald-100/80 shadow-2xs space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="w-12 h-12 rounded-2xl shrink-0" />
              <div className="space-y-2">
                <SkeletonBlock className="h-4 w-40" />
                <SkeletonBlock className="h-3.5 w-28" />
              </div>
            </div>
            <SkeletonBlock className="h-6 w-16 rounded-full" />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <SkeletonBlock className="h-14 rounded-2xl" />
            <SkeletonBlock className="h-14 rounded-2xl" />
          </div>

          <SkeletonBlock className="h-16 rounded-2xl" />

          <div className="flex items-center gap-2 pt-1">
            <SkeletonBlock className="h-9 flex-1 rounded-xl" />
            <SkeletonBlock className="h-9 flex-1 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const TableRowsSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 6,
}) => (
  <>
    {Array.from({ length: rows }).map((_, rowIdx) => (
      <tr key={rowIdx} className="animate-pulse">
        {Array.from({ length: cols }).map((__, colIdx) => (
          <td key={colIdx} className="py-3.5 px-4">
            <div className="h-4 bg-slate-200/80 rounded-lg w-full max-w-[140px]" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Memuat statistik dashboard">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl p-5 border border-emerald-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-24 bg-slate-200 rounded" />
            <div className="w-9 h-9 bg-emerald-100/80 rounded-xl" />
          </div>
          <div className="h-7 w-20 bg-slate-200 rounded-lg" />
          <div className="h-3 w-32 bg-slate-100 rounded" />
        </div>
      ))}
    </div>
    <div className="bg-white rounded-2xl p-6 border border-emerald-100 space-y-4">
      <div className="h-5 w-48 bg-slate-200 rounded" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((r) => (
          <div key={r} className="h-10 bg-slate-100 rounded-xl w-full" />
        ))}
      </div>
    </div>
  </div>
);
