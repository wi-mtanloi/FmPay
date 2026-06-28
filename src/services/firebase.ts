import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { MemberRole } from '../types';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-qunltichnhgianh-55fe14a9-cc54-4e61-9887-516d9ce88ae1');

// Google Auth Provider with Google Sheets and User info scopes
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');

let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Authenticate and get Google Sheets accessToken
export const loginWithGoogle = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) return null;
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      console.warn('Did not get access token directly, user may need to re-approve.');
    }
    cachedAccessToken = credential?.accessToken || null;
    
    // Setup local user doc
    if (result.user) {
      await getUserDoc(result.user.uid, result.user);
    }
    
    return { user: result.user, accessToken: cachedAccessToken || '' };
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logoutUser = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export const getCachedToken = (): string | null => {
  return cachedAccessToken;
};

export const setCachedToken = (token: string | null) => {
  cachedAccessToken = token;
};

// User Profile & Family Management
export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  familyId: string;
  role: MemberRole;
}

export const getUserDoc = async (uid: string, currentUser?: User): Promise<UserDoc | null> => {
  const key = `user_doc_${uid}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {}
  }

  // Create default if not exists
  const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const defaultFamilyId = `FAM-${randomId}`;
  const newUserDoc: UserDoc = {
    uid,
    email: currentUser?.email || '',
    displayName: currentUser?.displayName || 'Thành viên gia đình',
    photoURL: currentUser?.photoURL || '',
    familyId: defaultFamilyId,
    role: 'Khác'
  };
  localStorage.setItem(key, JSON.stringify(newUserDoc));
  return newUserDoc;
};

export const updateUserRole = async (uid: string, role: MemberRole) => {
  const key = `user_doc_${uid}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    const doc = JSON.parse(stored);
    doc.role = role;
    localStorage.setItem(key, JSON.stringify(doc));
  }
};

export const joinFamilyGroup = async (uid: string, familyId: string, role: MemberRole) => {
  const key = `user_doc_${uid}`;
  const stored = localStorage.getItem(key);
  const doc = stored ? JSON.parse(stored) : { uid, email: '', displayName: '', photoURL: '' };
  doc.familyId = familyId.trim().toUpperCase();
  doc.role = role;
  localStorage.setItem(key, JSON.stringify(doc));
};

export const createNewFamilyGroup = async (uid: string, familyName: string, role: MemberRole): Promise<string> => {
  const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const newFamilyId = `FAM-${randomId}`;

  localStorage.setItem(`family_details_${newFamilyId}`, JSON.stringify({
    id: newFamilyId,
    name: familyName,
    createdBy: uid,
    createdAt: new Date().toISOString()
  }));

  const key = `user_doc_${uid}`;
  const stored = localStorage.getItem(key);
  const doc = stored ? JSON.parse(stored) : { uid, email: '', displayName: '', photoURL: '' };
  doc.familyId = newFamilyId;
  doc.role = role;
  localStorage.setItem(key, JSON.stringify(doc));

  return newFamilyId;
};

// Subscriptions list to trigger reactively when local storage changes
const listeners: { [key: string]: Array<(data: any[]) => void> } = {};

export const getLocalFamilyItems = (familyId: string, subcollectionName: string): any[] => {
  const storageKey = `family_${familyId}_${subcollectionName}`;
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Error parsing local storage:', e);
    }
  }

  // Seed default wallets if subcollection is 'wallets' and it's empty
  if (subcollectionName === 'wallets') {
    const defaultWallets = [
      {
        id: 'cash',
        name: 'Tiền mặt',
        member: 'Khác' as MemberRole,
        balance: 5000000,
        type: 'cash' as const,
        createdBy: 'system',
        createdAt: new Date().toISOString()
      },
      {
        id: 'bank',
        name: 'Thẻ ngân hàng',
        member: 'Khác' as MemberRole,
        balance: 15000000,
        type: 'bank' as const,
        createdBy: 'system',
        createdAt: new Date().toISOString()
      }
    ];
    localStorage.setItem(storageKey, JSON.stringify(defaultWallets));
    return defaultWallets;
  }

  return [];
};

export const syncCreditCardDebt = (familyId: string, wallets: any[]) => {
  if (!familyId) return;
  const bills = getLocalFamilyItems(familyId, 'bills');
  const cashflow = getLocalFamilyItems(familyId, 'cashflow');

  let billsChanged = false;
  let cashflowChanged = false;

  const creditWallets = wallets.filter(w => w.type === 'credit');
  const negativeCreditWalletIds = creditWallets.filter(w => w.balance < 0).map(w => w.id);

  // 1. Process bills (remove if no longer negative)
  let updatedBills = bills.filter(b => {
    if (b.id && b.id.startsWith('credit-bill-')) {
      const walletId = b.id.replace('credit-bill-', '');
      if (!negativeCreditWalletIds.includes(walletId)) {
        billsChanged = true;
        return false;
      }
    }
    return true;
  });

  // 2. Process cashflow (remove if no longer negative)
  let updatedCashflow = cashflow.filter(cf => {
    if (cf.id && cf.id.startsWith('credit-loan-')) {
      const walletId = cf.id.replace('credit-loan-', '');
      if (!negativeCreditWalletIds.includes(walletId)) {
        cashflowChanged = true;
        return false;
      }
    }
    return true;
  });

  // 3. Add or update negative credit card balances
  creditWallets.forEach(wallet => {
    if (wallet.balance < 0) {
      const debtAmount = Math.abs(wallet.balance);
      const billId = `credit-bill-${wallet.id}`;
      const loanId = `credit-loan-${wallet.id}`;

      // Update or insert FixedBill
      const existingBillIdx = updatedBills.findIndex(b => b.id === billId);
      if (existingBillIdx !== -1) {
        if (updatedBills[existingBillIdx].amount !== debtAmount) {
          updatedBills[existingBillIdx].amount = debtAmount;
          billsChanged = true;
        }
      } else {
        updatedBills.push({
          id: billId,
          name: `Thanh toán nợ thẻ ${wallet.name}`,
          amount: debtAmount,
          dueDay: 30,
          category: 'Trả nợ',
          createdBy: 'system',
          createdAt: new Date().toISOString()
        });
        billsChanged = true;
      }

      // Update or insert CashflowItem (loan_to_pay)
      const existingLoanIdx = updatedCashflow.findIndex(cf => cf.id === loanId);
      const today = new Date();
      let year = today.getFullYear();
      let month = today.getMonth() + 1; // getMonth is 0-indexed
      month += 1; // next month
      if (month > 12) {
        month = 1;
        year += 1;
      }
      const monthStr = month < 10 ? `0${month}` : `${month}`;
      const dueStr = `30/${monthStr}/${year}`;

      if (existingLoanIdx !== -1) {
        if (updatedCashflow[existingLoanIdx].totalAmount !== debtAmount) {
          updatedCashflow[existingLoanIdx].totalAmount = debtAmount;
          cashflowChanged = true;
        }
      } else {
        updatedCashflow.push({
          id: loanId,
          type: 'loan_to_pay',
          name: `Nợ thẻ tín dụng ${wallet.name}`,
          totalAmount: debtAmount,
          loanType: 'one_time',
          notes: `Hạn thanh toán: ngày 30 tháng kế tiếp (${dueStr})`,
          createdBy: 'system',
          createdAt: new Date().toISOString()
        });
        cashflowChanged = true;
      }
    }
  });

  // Save changes if any
  if (billsChanged) {
    const storageKey = `family_${familyId}_bills`;
    localStorage.setItem(storageKey, JSON.stringify(updatedBills));
    const key = `${familyId}_bills`;
    if (listeners[key]) {
      listeners[key].forEach(cb => cb(updatedBills));
    }
  }

  if (cashflowChanged) {
    const storageKey = `family_${familyId}_cashflow`;
    localStorage.setItem(storageKey, JSON.stringify(updatedCashflow));
    const key = `${familyId}_cashflow`;
    if (listeners[key]) {
      listeners[key].forEach(cb => cb(updatedCashflow));
    }
  }
};

export const setLocalFamilyItems = (familyId: string, subcollectionName: string, items: any[]) => {
  const storageKey = `family_${familyId}_${subcollectionName}`;
  localStorage.setItem(storageKey, JSON.stringify(items));
  notifyListeners(familyId, subcollectionName);

  if (subcollectionName === 'wallets' && familyId) {
    syncCreditCardDebt(familyId, items);
  }
};

// Helper to notify listeners of changes
const notifyListeners = (familyId: string, subcollectionName: string) => {
  const key = `${familyId}_${subcollectionName}`;
  if (listeners[key]) {
    const data = getLocalFamilyItems(familyId, subcollectionName);
    listeners[key].forEach(cb => cb(data));
  }
};

export const subscribeToFamilySubcollection = (
  familyId: string,
  subcollectionName: string,
  callback: (data: any[]) => void
) => {
  const key = `${familyId}_${subcollectionName}`;
  if (!listeners[key]) {
    listeners[key] = [];
  }
  listeners[key].push(callback);

  // Trigger initial load
  const data = getLocalFamilyItems(familyId, subcollectionName);

  if (subcollectionName === 'wallets' && familyId) {
    syncCreditCardDebt(familyId, data);
  }

  callback(data);

  // Return unsubscribe
  return () => {
    listeners[key] = listeners[key].filter(cb => cb !== callback);
  };
};

export const addFamilyItem = async (familyId: string, subcollectionName: string, item: any) => {
  const items = getLocalFamilyItems(familyId, subcollectionName);
  const newItem = {
    ...item,
    id: item.id || `${subcollectionName}-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: item.createdAt || new Date().toISOString()
  };
  items.push(newItem);
  setLocalFamilyItems(familyId, subcollectionName, items);
  return { id: newItem.id };
};

export const updateFamilyItem = async (familyId: string, subcollectionName: string, itemId: string, item: any) => {
  const items = getLocalFamilyItems(familyId, subcollectionName);
  const idx = items.findIndex(i => i.id === itemId);
  if (idx !== -1) {
    items[idx] = { ...items[idx], ...item };
    setLocalFamilyItems(familyId, subcollectionName, items);
  }
};

export const deleteFamilyItem = async (familyId: string, subcollectionName: string, itemId: string) => {
  let items = getLocalFamilyItems(familyId, subcollectionName);
  items = items.filter(i => i.id !== itemId);
  setLocalFamilyItems(familyId, subcollectionName, items);
};

export const overwriteLocalFamilyData = (
  familyId: string,
  data: {
    transactions: any[];
    wallets: any[];
    budgets: any[];
    savings: any[];
    bills: any[];
    cashflow: any[];
  }
) => {
  setLocalFamilyItems(familyId, 'transactions', data.transactions);
  setLocalFamilyItems(familyId, 'wallets', data.wallets);
  setLocalFamilyItems(familyId, 'budgets', data.budgets);
  setLocalFamilyItems(familyId, 'savings', data.savings);
  setLocalFamilyItems(familyId, 'bills', data.bills);
  setLocalFamilyItems(familyId, 'cashflow', data.cashflow);
};
