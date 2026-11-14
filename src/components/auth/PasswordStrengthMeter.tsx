import React from 'react';
import { Check, Circle } from 'lucide-react';

export interface PasswordValidation {
  minLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  hasSymbolOrUpper: boolean;
  isValid: boolean;
  score: number; // 0..4
  label: string;
}

export function evaluatePassword(password: string): PasswordValidation {
  const minLength = password.length >= 8;
  const hasLetter = /[A-Za-zÀ-ÿ]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbolOrUpper = /[A-Z]/.test(password) && /[^A-Za-z0-9]/.test(password);

  let score = 0;
  if (minLength) score += 1;
  if (hasLetter && hasNumber) score += 1;
  if (password.length >= 10 && /[A-Z]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (password.length === 0) {
    return {
      minLength,
      hasLetter,
      hasNumber,
      hasSymbolOrUpper,
      isValid: false,
      score: 0,
      label: 'Digite uma senha',
    };
  }

  let label = 'Fraca';
  if (score >= 4) label = 'Muito forte';
  else if (score === 3) label = 'Forte';
  else if (score === 2 && minLength) label = 'Média';

  return {
    minLength,
    hasLetter,
    hasNumber,
    hasSymbolOrUpper,
    isValid: minLength && hasLetter && hasNumber,
    score: Math.max(1, score),
    label,
  };
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const { minLength, hasLetter, hasNumber, score, label } = evaluatePassword(password);

  const barColors = [
    'bg-red-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-[#4EDEA3]',
  ];
  const activeColor = barColors[Math.min(score - 1, barColors.length - 1)] || 'bg-red-500';

  const textColor =
    score >= 3
      ? 'text-emerald-600 dark:text-[#4EDEA3]'
      : score === 2
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-500';

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-500 dark:text-slate-400">Força da senha</span>
        <span className={`font-semibold ${textColor}`}>{label}</span>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1.5 rounded-full transition-colors ${
              score >= level ? activeColor : 'bg-slate-200 dark:bg-[#222C38]'
            }`}
          />
        ))}
      </div>

      <ul className="space-y-1 pt-0.5 text-[11px]">
        <li
          className={`flex items-center gap-1.5 ${
            minLength ? 'text-emerald-600 dark:text-[#4EDEA3]' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {minLength ? <Check className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
          <span>Mínimo de 8 caracteres</span>
        </li>
        <li
          className={`flex items-center gap-1.5 ${
            hasLetter ? 'text-emerald-600 dark:text-[#4EDEA3]' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {hasLetter ? <Check className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
          <span>Pelo menos uma letra</span>
        </li>
        <li
          className={`flex items-center gap-1.5 ${
            hasNumber ? 'text-emerald-600 dark:text-[#4EDEA3]' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {hasNumber ? <Check className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
          <span>Pelo menos um número</span>
        </li>
      </ul>
    </div>
  );
}
