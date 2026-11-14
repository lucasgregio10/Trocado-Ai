import { Expense } from '../types/finance';

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDateHeader(isoDate: string): string {
  if (isoDate === '2024-10-24') return 'Hoje · 24 de Outubro, 2024';
  if (isoDate === '2024-10-23') return 'Ontem · 23 de Outubro, 2024';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  return `${String(d).padStart(2, '0')} de ${months[m - 1] || 'Outubro'}, ${y}`;
}

export function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function exportExpensesToCSV(expenses: Expense[], filename = 'trocado-despesas-outubro-2024.csv') {
  const headers = [
    'Data',
    'Hora',
    'Estabelecimento',
    'Categoria',
    'Subcategoria',
    'Valor (R$)',
    'Forma de Pagamento',
    'Origem',
    'Status',
  ];
  const originLabels: Record<string, string> = {
    ai_scanner: 'Registrado por IA (OCR)',
    ai_audio: 'Registrado por IA (Áudio)',
    ai_text: 'Registrado por IA (Texto)',
    open_finance: 'Open Finance',
    manual: 'Manual',
  };

  const rows = expenses.map((e) => [
    formatShortDate(e.date),
    e.time,
    `"${e.merchant.replace(/"/g, '""')}"`,
    e.category,
    `"${e.subcategory.replace(/"/g, '""')}"`,
    e.amount.toFixed(2).replace('.', ','),
    `"${e.paymentMethod}"`,
    originLabels[e.origin] || e.origin,
    e.status,
  ]);

  const csvContent =
    '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
