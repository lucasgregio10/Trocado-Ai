import { Expense, PaymentMethod, ExpenseSource } from '../types/finance';

const SAO_PAULO_TZ = 'America/Sao_Paulo';

export function formatCentsBRL(amountCents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

export function formatCentsInputMask(cents: number): string {
  if (!cents || cents <= 0) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function parseDigitsToCents(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  const parsed = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(parsed, 100_000_000);
}

export function getTodaySaoPauloISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function addDaysToISO(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

export function getMaxExpenseDateISO(): string {
  return addDaysToISO(getTodaySaoPauloISO(), 1);
}

export function getCurrentMonthISO(): string {
  return getTodaySaoPauloISO().slice(0, 7);
}

export function shiftMonthISO(monthIso: string, deltaMonths: number): string {
  const [y, m] = monthIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatMonthLabel(monthIso: string): string {
  const [y, m] = monthIso.split('-').map(Number);
  if (!y || !m) return monthIso;
  const dt = new Date(Date.UTC(y, m - 1, 15));
  const label = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(dt);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function getCurrentMonthSaoPaulo(): { year: number; month: number; label: string } {
  const iso = getTodaySaoPauloISO();
  const [yStr, mStr] = iso.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const monthLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SAO_PAULO_TZ,
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  return {
    year,
    month,
    label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
  };
}

export function getSaoPauloGreeting(): string {
  const hourStr = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SAO_PAULO_TZ,
    hour: '2-digit',
    hour12: false,
  }).format(new Date());
  const hour = Number(hourStr);

  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function formatDateBR(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

export function formatDateHeader(isoDate: string): string {
  const today = getTodaySaoPauloISO();
  if (isoDate === today) {
    return `Hoje · ${formatDateBR(isoDate)}`;
  }

  const yesterdayISO = addDaysToISO(today, -1);
  if (isoDate === yesterdayISO) {
    return `Ontem · ${formatDateBR(isoDate)}`;
  }

  return formatDateBR(isoDate);
}

export function parseCurrencyInputToCents(raw: string): number {
  const normalized = raw.trim().replace(/\./g, '').replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100);
}

export function centsToDecimalInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'PIX',
  credito: 'Cartão de Crédito',
  debito: 'Cartão de Débito',
  dinheiro: 'Dinheiro',
  outro: 'Outro',
};

export const EXPENSE_SOURCE_LABELS: Record<ExpenseSource, string> = {
  foto: 'Foto (IA)',
  texto: 'Texto (IA)',
  voz: 'Voz (IA)',
  manual: 'Manual',
};

export function exportExpensesToCSV(expenses: Expense[], filename?: string) {
  const today = getTodaySaoPauloISO();
  const targetFilename = filename || `trocado-despesas-${today}.csv`;

  const headers = [
    'Data',
    'Estabelecimento',
    'Descrição',
    'Categoria',
    'Subcategoria',
    'Valor (R$)',
    'Forma de Pagamento',
    'Origem',
  ];

  const rows = expenses.map((e) => [
    formatDateBR(e.expenseDate),
    `"${e.merchant.replace(/"/g, '""')}"`,
    `"${(e.description || '').replace(/"/g, '""')}"`,
    `"${(e.categoryName || 'Outros').replace(/"/g, '""')}"`,
    `"${(e.subcategory || '').replace(/"/g, '""')}"`,
    (e.amountCents / 100).toFixed(2).replace('.', ','),
    PAYMENT_METHOD_LABELS[e.paymentMethod] || e.paymentMethod,
    EXPENSE_SOURCE_LABELS[e.source] || e.source,
  ]);

  const csvContent =
    '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = targetFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
