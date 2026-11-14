export type ActiveView =
  | 'dashboard'
  | 'expenses'
  | 'assistant'
  | 'reports'
  | 'budgets'
  | 'settings';

export type PeriodFilter = 'month' | '30d' | 'year';

export type ExpenseOrigin = 'ai_scanner' | 'ai_audio' | 'ai_text' | 'manual' | 'open_finance';

export type CategoryName =
  | 'Alimentação'
  | 'Moradia'
  | 'Transporte'
  | 'Lazer'
  | 'Saúde'
  | 'Educação'
  | 'Outros'
  | string;

export interface ExpenseItem {
  name: string;
  quantity: string;
  price: number;
}

export interface Expense {
  id: string;
  merchant: string;
  cnpj?: string;
  amount: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  category: CategoryName;
  subcategory: string;
  paymentMethod: string;
  origin: ExpenseOrigin;
  confidence?: number;
  receiptImage?: string;
  items?: ExpenseItem[];
  notes?: string;
  status: 'Conciliado' | 'Liquidado' | 'Pendente';
}

export interface CategoryBudget {
  id: string;
  category: CategoryName;
  description: string;
  limit: number;
  color: string;
  iconKey: string;
  isFixed?: boolean;
}

export interface SavingsGoal {
  id: string;
  title: string;
  target: number;
  current: number;
  deadline: string;
  monthlyContribution: number;
  color: string;
}

export interface BankConnection {
  id: string;
  bankName: string;
  legalName: string;
  shortCode: string;
  accentColor: string;
  status: 'connected' | 'reauth_required';
  lastSyncLabel: string;
  autoSync: boolean;
  consentUntil: string;
  accounts: Array<{
    title: string;
    subtitle: string;
    balanceOrStatus: string;
    type: 'card' | 'checking' | 'investment';
  }>;
  scopes: string[];
}

export interface ChatMetric {
  label: string;
  value: string;
  hint?: string;
}

export interface ChatHighlight {
  merchant: string;
  meta: string;
  amount: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  timestamp: string;
  text: string;
  metrics?: ChatMetric[];
  highlights?: ChatHighlight[];
  tip?: string;
  showMiniChart?: boolean;
}

export interface CustomCategory {
  id: string;
  name: string;
  color: string;
  iconKey: string;
}
