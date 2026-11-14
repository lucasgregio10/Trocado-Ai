import React, { useState } from 'react';
import { Receipt, User } from 'lucide-react';

export function TrocadoLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="36" height="36" rx="10" className="fill-emerald-500" />
      <path
        d="M11 12.5H25M18 12.5V24.5M13.5 18.5H22.5"
        stroke="#0B0F14"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="25.5" cy="10.5" r="2.5" className="fill-violet-400" />
    </svg>
  );
}

interface SafeImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackType?: 'avatar' | 'receipt';
}

export function SafeImage({
  src,
  alt,
  className = '',
  fallbackType = 'avatar',
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-200 dark:bg-[#1C2025] text-slate-500 dark:text-slate-400 ${className}`}
        role="img"
        aria-label={alt}
      >
        {fallbackType === 'avatar' ? (
          <User className="w-5 h-5" />
        ) : (
          <div className="flex flex-col items-center gap-1.5 p-4 text-center">
            <Receipt className="w-7 h-7 text-emerald-500" />
            <span className="text-xs font-medium">{alt}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
