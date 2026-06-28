import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  Home as HomeIcon, 
  PieChart as ChartIcon, 
  ArrowUpRight, 
  Settings as SettingsIcon,
  Users,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Heart,
  Smile
} from 'lucide-react';
import { Header } from './components/Header';
import { SetupFamily } from './components/SetupFamily';
import { HomeTab } from './components/HomeTab';
import { AnalyticsTab } from './components/AnalyticsTab';
import { CashflowTab } from './components/CashflowTab';
import { SettingsTab } from './components/SettingsTab';
import { 
  auth, 
  loginWithGoogle, 
  logoutUser, 
  getUserDoc, 
  UserDoc,
  subscribeToFamilySubcollection,
  getCachedToken,
  setCachedToken
} from './services/firebase';
import { 
  Transaction, 
  Wallet, 
  BudgetLimit, 
  SavingGoal, 
  FixedBill, 
  CashflowItem 
} from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'analytics' | 'cashflow' | 'settings'>('home');
  const [googleToken, setGoogleToken] = useState<string>('');
  const [showFamilyModal, setShowFamilyModal] = useState(false);

  // Firestore Subscriptions States
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [budgets, setBudgets] = useState<BudgetLimit[]>([]);
  const [savings, setSavings] = useState<SavingGoal[]>([]);
  const [bills, setBills] = useState<FixedBill[]>([]);
  const [cashflow, setCashflow] = useState<CashflowItem[]>([]);

  // 1. Initial Authentication state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch user metadata/family settings
        await fetchUserDocAndData(currentUser);
      } else {
        setUserDoc(null);
        setGoogleToken('');
        setCachedToken(null);
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchUserDocAndData = async (currentUser: User) => {
    try {
      const docData = await getUserDoc(currentUser.uid, currentUser);
      setUserDoc(docData);
      
      const cached = getCachedToken();
      if (cached) {
        setGoogleToken(cached);
      }
    } catch (err) {
      console.error('Error fetching user document:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  // 2. Load Firestore subscriptions in real-time when familyId changes (Requirement 2)
  useEffect(() => {
    if (!userDoc?.familyId) {
      setTransactions([]);
      setWallets([]);
      setBudgets([]);
      setSavings([]);
      setBills([]);
      setCashflow([]);
      return;
    }

    const familyId = userDoc.familyId;

    // Set up real-time listener subscriptions
    const unsubTxs = subscribeToFamilySubcollection(familyId, 'transactions', (items) => {
      // Sort by date descending
      const sorted = (items as Transaction[]).sort((a, b) => b.date.localeCompare(a.date));
      setTransactions(sorted);
    });

    const unsubWallets = subscribeToFamilySubcollection(familyId, 'wallets', (items) => {
      setWallets(items as Wallet[]);
    });

    const unsubBudgets = subscribeToFamilySubcollection(familyId, 'budgets', (items) => {
      setBudgets(items as BudgetLimit[]);
    });

    const unsubSavings = subscribeToFamilySubcollection(familyId, 'savings', (items) => {
      setSavings(items as SavingGoal[]);
    });

    const unsubBills = subscribeToFamilySubcollection(familyId, 'bills', (items) => {
      setBills(items as FixedBill[]);
    });

    const unsubCashflow = subscribeToFamilySubcollection(familyId, 'cashflow', (items) => {
      setCashflow(items as CashflowItem[]);
    });

    // Cleanup listeners on unmount or family change
    return () => {
      unsubTxs();
      unsubWallets();
      unsubBudgets();
      unsubSavings();
      unsubBills();
      unsubCashflow();
    };
  }, [userDoc?.familyId]);

  // Auth actions
  const handleLogin = async () => {
    try {
      setAuthLoading(true);
      const res = await loginWithGoogle();
      if (res) {
        setUser(res.user);
        setGoogleToken(res.accessToken);
        setCachedToken(res.accessToken);
        await fetchUserDocAndData(res.user);
      }
    } catch (err) {
      console.error('Login error in app:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setUserDoc(null);
    setGoogleToken('');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="space-y-4 text-center">
          <div className="relative flex justify-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-800">Đang đồng bộ dòng tiền gia đình...</h4>
            <p className="text-xs text-gray-400 mt-1">Vui lòng chờ giây lát</p>
          </div>
        </div>
      </div>
    );
  }

  // Visual landing/login page
  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        
        {/* Soft background decor */}
        <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-100/40 rounded-full filter blur-3xl opacity-60"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-violet-100/40 rounded-full filter blur-3xl opacity-60"></div>

        <div className="max-w-md w-full text-center space-y-8 relative z-10">
          
          {/* Logo */}
          <div className="space-y-3">
            <div className="inline-flex p-4 bg-indigo-50 text-indigo-600 rounded-3xl shadow-sm border border-indigo-100/50 animate-bounce">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">FamilyPay 360°</h2>
              <p className="text-sm text-gray-500 font-semibold mt-1">Công cụ Quản lý Tài chính Đồng bộ Gia đình</p>
            </div>
          </div>

          {/* Intro Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl space-y-5">
            <p className="text-xs text-gray-500 leading-relaxed font-medium">
              Kết nối vợ chồng, con cái cùng theo dõi ví, thẻ, chi tiêu định mức hàng tháng, quản lý dòng tiền nợ/đầu tư và đồng bộ hóa trực quan lên file Google Sheets của gia đình bạn.
            </p>

            <div className="space-y-3.5 text-left pt-2">
              <div className="flex items-start gap-3 text-xs">
                <span className="p-1 bg-indigo-50 text-indigo-600 rounded-lg font-bold">1</span>
                <div>
                  <p className="font-bold text-gray-800">Đồng bộ Thời Gian Thực</p>
                  <p className="text-gray-400 text-[11px]">Vợ chi, chồng thấy ngay lập tức trên mọi thiết bị.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs">
                <span className="p-1 bg-indigo-50 text-indigo-600 rounded-lg font-bold">2</span>
                <div>
                  <p className="font-bold text-gray-800">Bảo mật & Liên kết Google Sheets</p>
                  <p className="text-gray-400 text-[11px]">Tự động tạo bảng & lưu trữ dữ liệu chính thức của riêng gia đình.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs">
                <span className="p-1 bg-indigo-50 text-indigo-600 rounded-lg font-bold">3</span>
                <div>
                  <p className="font-bold text-gray-800">Cảnh báo Vượt chi & Dự báo</p>
                  <p className="text-gray-400 text-[11px]">Cảnh báo hạn mức chung và dự báo dòng tiền tháng tới tránh bị âm.</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleLogin}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-2xl text-xs flex items-center justify-center gap-3.5 transition shadow-lg"
            >
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              Kết nối Gmail & Đăng nhập ngay
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 font-semibold">
            <Heart className="w-3.5 h-3.5 text-rose-400 animate-pulse" /> Đồng hành cùng tài chính gia đình vững bền
          </div>

        </div>
      </div>
    );
  }

  // Logged-in complete application
  return (
    <div className="min-h-screen bg-slate-50/50 pb-24 text-gray-800">
      
      {/* Universal header */}
      <Header 
        user={user} 
        userDoc={userDoc} 
        onLogin={handleLogin} 
        onLogout={handleLogout}
        onRefreshUserDoc={() => user && fetchUserDocAndData(user)}
        showFamilyModal={showFamilyModal}
        setShowFamilyModal={setShowFamilyModal}
      />

      {/* Main Content Area */}
      <main id="app-main" className="max-w-7xl mx-auto px-4 py-6">
        {userDoc?.familyId ? (
          <div className="transition-all duration-300">
            {activeTab === 'home' && (
              <HomeTab 
                familyId={userDoc.familyId}
                transactions={transactions}
                wallets={wallets}
                budgets={budgets}
                savings={savings}
                bills={bills}
                currentUserUid={user.uid}
                currentUserRole={userDoc.role}
              />
            )}
            
            {activeTab === 'analytics' && (
              <AnalyticsTab 
                transactions={transactions}
                budgets={budgets}
                bills={bills}
              />
            )}

            {activeTab === 'cashflow' && (
              <CashflowTab 
                familyId={userDoc.familyId}
                cashflow={cashflow}
                wallets={wallets}
                currentUserUid={user.uid}
                currentUserRole={userDoc.role}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsTab 
                familyId={userDoc.familyId}
                wallets={wallets}
                budgets={budgets}
                savings={savings}
                bills={bills}
                transactions={transactions}
                cashflow={cashflow}
                currentUserUid={user.uid}
                currentUserRole={userDoc.role}
                googleToken={googleToken}
                onLoginGoogle={handleLogin}
              />
            )}
          </div>
        ) : (
          <SetupFamily user={user!} onRefreshUserDoc={() => user && fetchUserDocAndData(user)} />
        )}
      </main>

      {/* BOTTOM NAVIGATION BAR (Requirement 9) */}
      <nav id="bottom-navigation" className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 shadow-lg z-40 py-2.5 px-4 backdrop-blur-md bg-opacity-95">
        <div className="max-w-lg mx-auto flex justify-between items-center text-center">
          
          {/* Home */}
          <button
            onClick={() => setActiveTab('home')}
            className={`flex-1 flex flex-col items-center gap-1 transition ${
              activeTab === 'home' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-700 font-semibold'
            }`}
          >
            <HomeIcon className="w-5 h-5 animate-pulse" />
            <span className="text-[10px]">Trang chính</span>
          </button>

          {/* Analytics */}
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 flex flex-col items-center gap-1 transition ${
              activeTab === 'analytics' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-700 font-semibold'
            }`}
          >
            <ChartIcon className="w-5 h-5" />
            <span className="text-[10px]">Phân tích</span>
          </button>

          {/* Cashflow (Loans & Investments) */}
          <button
            onClick={() => setActiveTab('cashflow')}
            className={`flex-1 flex flex-col items-center gap-1 transition ${
              activeTab === 'cashflow' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-700 font-semibold'
            }`}
          >
            <ArrowUpRight className="w-5 h-5" />
            <span className="text-[10px]">Dòng tiền</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 flex flex-col items-center gap-1 transition ${
              activeTab === 'settings' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-700 font-semibold'
            }`}
          >
            <SettingsIcon className="w-5 h-5" />
            <span className="text-[10px]">Cài đặt</span>
          </button>

        </div>
      </nav>

    </div>
  );
}
