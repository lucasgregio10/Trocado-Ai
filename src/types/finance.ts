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

export type ThemePreference = 'light' | 'dark' | 'system';

export interface Profile {
  userId: string;
  email: string;
  displayName: string;
  theme: ThemePreference;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
  createdAt: string;
  expenseCount?: number;
}

export interface MeResponse {
  profile: Profile;
  categories: Category[];
  receiptsEnabled?: boolean;
}

export interface AiConfidenceScores {
  merchant: number;
  amount: number;
  date: number;
  category: number;
}

export interface AiExtractSuggestion {
  merchant: string | null;
  amountCents: number | null;
  expenseDate: string | null;
  categoryId: string;
  categoryName: string;
  subcategory: string | null;
  paymentMethod: PaymentMethod | null;
  description: string | null;
  confidence: AiConfidenceScores;
}

export interface AiExtractResponse {
  suggestion: AiExtractSuggestion;
  transcript: string | null;
}

export interface UpdateMePayload {
  displayName?: string;
  theme?: ThemePreference;
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

export interface ExpenseDraftInput {
  amountCents: number;
  merchant: string;
  description: string | null;
  categoryId: string;
  subcategory: string | null;
  paymentMethod: PaymentMethod;
  expenseDate: string;
  source: ExpenseSource;
  aiConfidence: number | null;
  receiptKey: string | null;
}

export interface ExpensesPageResponse {
  items: Expense[];
  nextCursor: string | null;
  summary: {
    totalCount: number;
    totalCents: number;
    aiCount: number;
  };
}

export interface Budget {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  monthlyLimitCents: number;
  spentCents: number;
}

export interface DashboardCategoryTotal {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  totalCents: number;
  expenseCount: number;
}

export interface DashboardDailyTotal {
  expenseDate: string; // AAAA-MM-DD
  totalCents: number;
  expenseCount: number;
}

export interface DashboardResponse {
  month: string; // AAAA-MM
  previousMonth: string; // AAAA-MM
  totalCents: number;
  previousTotalCents: number;
  variationPct: number | null;
  expenseCount: number;
  activeDays: number;
  hasAnyExpense: boolean;
  byCategory: DashboardCategoryTotal[];
  byDay: DashboardDailyTotal[];
  recentExpenses: Expense[];
  budgets: Budget[];
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

export interface ReportMonthlyCategory {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  totalCents: number;
}

export interface ReportMonthlyBucket {
  month: string; // AAAA-MM
  totalCents: number;
  categories: ReportMonthlyCategory[];
}

export interface ReportTopMerchant {
  merchant: string;
  totalCents: number;
  expenseCount: number;
  categoryName: string;
}

export interface ReportRecurringExpense {
  merchant: string;
  categoryName: string;
  avgCents: number;
  monthsCount: number;
  occurrences: number;
  lastDate: string;
}

export interface ReportsResponse {
  from: string;
  to: string;
  totalCents: number;
  expenseCount: number;
  monthlyByCategory: ReportMonthlyBucket[];
  topMerchants: ReportTopMerchant[];
  recurring: ReportRecurringExpense[];
}

export interface BudgetsResponse {
  month: string;
  budgets: Budget[];
}

export interface InsightResponse {
  month: string;
  insight: string;
  fromAi: boolean;
  cached: boolean;
  expenseCount: number;
}
