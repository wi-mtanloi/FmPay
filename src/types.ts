export type MemberRole = 'Chồng' | 'Vợ' | 'Khác';

export interface FamilyMember {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: MemberRole;
}

export interface Family {
  id: string;
  name: string;
  createdBy: string;
  createdAt: any;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  type: 'income' | 'expense';
  category: string;
  walletId: string;
  walletName?: string;
  member: MemberRole;
  notes: string;
  createdBy: string;
  createdAt: any;
}

export interface Wallet {
  id: string;
  name: string;
  member: MemberRole;
  balance: number;
  type: 'cash' | 'credit' | 'bank' | 'e-wallet';
  createdBy: string;
  createdAt: any;
}

export interface BudgetLimit {
  id: string;
  category: string; // 'Tất cả' or specific category
  limitAmount: number;
  alertThreshold: number; // e.g. 80 for 80%
  createdBy: string;
}

export interface SavingGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // YYYY-MM-DD
  notes?: string;
  createdBy: string;
  createdAt: any;
}

export interface FixedBill {
  id: string;
  name: string;
  amount: number;
  dueDay: number; // day of month (1-31)
  category: string;
  lastPaidDate?: string; // YYYY-MM-DD
  createdBy: string;
}

export interface CashflowItem {
  id: string;
  type: 'loan_to_pay' | 'loan_to_receive' | 'investment';
  name: string;
  totalAmount: number;
  // For loans:
  loanType?: 'one_time' | 'installment';
  monthlyPayment?: number;
  totalTerms?: number;
  paidTerms?: number;
  // For investments:
  currentValue?: number;
  initialCost?: number;
  yieldPercent?: number; // performance yield
  // Common:
  notes?: string;
  createdBy: string;
  createdAt: any;
}

export interface SyncLog {
  timestamp: string;
  status: 'success' | 'error';
  message: string;
  sheetsUpdated?: string[];
}
