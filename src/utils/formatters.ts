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

export function getTodaySaoPauloISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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

  const [ty, tm, td] = today.split('-').map(Number);
  const yesterdayUtc = new Date(Date.UTC(ty, tm - 1, td - 1));
  const yesterdayISO = yesterdayUtc.toISOString().slice(0, 10);
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
