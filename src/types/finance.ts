export type ActiveView =
  | 'dashboard'
  | 'expenses'
  | 'assistant'
  | 'reports'
  | 'budgets'
  | 'settings';

export type PeriodFilter = 'month' | '30d' | 'year';

export type PaymentMethod = 'pix' | 'credito' | 'debito' | 'dinheiro' | 'outro';

export type ExpenseSource = 'foto' | 'texto' | 'voz' | 'manual';

export interface Profile {
  userId: string;
  email: string;
  displayName: string;
  theme: 'light' | 'dark';
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
  createdAt: string;
}

export interface Expense {
  id: string;
  amountCents: number;
  merchant: string;
  description: string | null;
  categoryId: string;
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
  subcategory: string | null;
  paymentMethod: PaymentMethod;
  expenseDate: string; // AAAA-MM-DD
  source: ExpenseSource;
  aiConfidence: number | null;
  receiptKey: string | null;
  receiptUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  monthlyLimitCents: number;
  spentCents: number;
}

export interface ChatMetric {
  label: string;
  value: string;
  hint?: string;
}

export interface ChatHighlight {
  id?: string;
  merchant: string;
  meta: string;
  amountCents: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  timestamp: string;
  text: string;
  metrics?: ChatMetric[];
  highlights?: ChatHighlight[];
  tip?: string;
}
