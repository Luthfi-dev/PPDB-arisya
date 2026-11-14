import React from 'react';
import { Heart } from 'lucide-react';

interface DeveloperFooterProps {
  variant?: 'light' | 'green' | 'sidebar';
  className?: string;
}

export const DeveloperFooter: React.FC<DeveloperFooterProps> = ({
  variant = 'light',
  className = '',
}) => {
  const isGreenBg = variant === 'green' || variant === 'sidebar';

  const textClass = isGreenBg
    ? 'text-emerald-200/80'
    : 'text-slate-400';

  const linkClass = isGreenBg
    ? 'text-white hover:text-emerald-200 underline decoration-emerald-400/70 underline-offset-2 font-semibold transition-colors'
    : 'text-slate-600 hover:text-emerald-700 underline decoration-slate-300 hover:decoration-emerald-500 underline-offset-2 font-semibold transition-colors';

  const heartClass = isGreenBg
    ? 'w-3 h-3 inline-block mx-0.5 -mt-0.5 text-rose-400 fill-rose-400'
    : 'w-3 h-3 inline-block mx-0.5 -mt-0.5 text-slate-400 fill-slate-400';

  const sizeClass =
    variant === 'sidebar'
      ? 'text-[10px] pt-2 mt-1 border-t border-emerald-800/40'
      : 'text-[11px]';

  return (
    <div className={`text-center select-none ${sizeClass} ${textClass} ${className}`}>
      <span>Dev by </span>
      <a
        href="https://maudigi.com"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        Luthfi
      </a>
      <span> · Created with </span>
      <Heart className={heartClass} aria-label="hati" />
    </div>
  );
};
