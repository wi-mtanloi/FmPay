import React, { useState } from 'react';
import { 
  Wallet as WalletIcon, 
  Trash2, 
  Plus, 
  AlertTriangle, 
  RefreshCw, 
  FileText, 
  PiggyBank, 
  Calendar,
  ExternalLink,
  ShieldAlert,
  Info,
  Download,
  Tag
} from 'lucide-react';
import { 
  Wallet, 
  BudgetLimit, 
  SavingGoal, 
  FixedBill, 
  MemberRole,
  SyncLog
} from '../types';
import { 
  addFamilyItem, 
  deleteFamilyItem, 
  updateFamilyItem,
  overwriteLocalFamilyData
} from '../services/firebase';
import { 
  syncAllToGoogleSheets,
  getSpreadsheetId,
  setSpreadsheetId,
  loadAllFromGoogleSheets
} from '../services/googleSheets';
import { getCustomCategories, saveCustomCategories, DEFAULT_CATEGORIES } from '../services/categories';

interface SettingsTabProps {
  familyId: string;
  wallets: Wallet[];
  budgets: BudgetLimit[];
  savings: SavingGoal[];
  bills: FixedBill[];
  transactions: any[];
  cashflow: any[];
  currentUserUid: string;
  currentUserRole: MemberRole;
  googleToken: string;
  onLoginGoogle: () => void;
}

const BILL_CATEGORIES = ['Điện', 'Nước', 'Internet', 'Truyền hình', 'Thuê nhà', 'Phí chung cư', 'Trả nợ', 'Khác'];

export const SettingsTab: React.FC<SettingsTabProps> = ({
  familyId,
  wallets,
  budgets,
  savings,
  bills,
  transactions,
  cashflow,
  currentUserUid,
  currentUserRole,
  googleToken,
  onLoginGoogle
}) => {
  // Sync state
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [spreadsheetId, setSpreadsheetIdState] = useState(() => getSpreadsheetId());

  // 1. Wallets Form State (Requirement 8)
  const [walletName, setWalletName] = useState('');
  const [walletOwner, setWalletOwner] = useState<MemberRole>(currentUserRole || 'Khác');
  const [walletBalance, setWalletBalance] = useState('');
  const [walletType, setWalletType] = useState<'cash' | 'credit' | 'bank' | 'e-wallet'>('cash');

  // 2. Budget Limits Form State (Requirement 5)
  const [budgetCategory, setBudgetCategory] = useState('Tất cả');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetThreshold, setBudgetThreshold] = useState('80');

  // 3. Saving Goals Form State (Requirement 6)
  const [savingName, setSavingName] = useState('');
  const [savingTarget, setSavingTarget] = useState('');
  const [savingCurrent, setSavingCurrent] = useState('0');
  const [savingDate, setSavingDate] = useState('');

  // 4. Fixed Bills Form State (Requirement 7)
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDueDay, setBillDueDay] = useState('5');
  const [billCategory, setBillCategory] = useState('Điện');

  // 5. Dynamic Categories State
  const [categories, setCategories] = useState(() => getCustomCategories(familyId));
  const [categoryTab, setCategoryTab] = useState<'expense' | 'income'>('expense');
  const [newCatName, setNewCatName] = useState('');

  const formatVND = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  // Dynamic categories helpers
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;

    if (categories[categoryTab].includes(name)) {
      alert('Danh mục này đã tồn tại!');
      return;
    }

    const updated = {
      ...categories,
      [categoryTab]: [...categories[categoryTab], name]
    };

    setCategories(updated);
    saveCustomCategories(familyId, updated);
    setNewCatName('');
  };

  const handleDeleteCategory = (nameToDel: string) => {
    const confirm = window.confirm(`Bạn có chắc chắn muốn xóa danh mục "${nameToDel}" không?`);
    if (!confirm) return;

    const updated = {
      ...categories,
      [categoryTab]: categories[categoryTab].filter(name => name !== nameToDel)
    };

    setCategories(updated);
    saveCustomCategories(familyId, updated);
  };

  const handleResetCategories = () => {
    const confirm = window.confirm('Bạn có chắc chắn muốn khôi phục danh mục mặc định của hệ thống?');
    if (!confirm) return;

    setCategories(DEFAULT_CATEGORIES);
    saveCustomCategories(familyId, DEFAULT_CATEGORIES);
  };

  // 1. Submit Wallet
  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletName.trim() || !walletBalance) return;
    try {
      await addFamilyItem(familyId, 'wallets', {
        name: walletName.trim(),
        member: walletOwner,
        balance: Number(walletBalance),
        type: walletType,
        createdBy: currentUserUid
      });
      setWalletName('');
      setWalletBalance('');
    } catch (err: any) {
      alert('Lỗi khi thêm ví: ' + err.message);
    }
  };

  // 2. Submit Budget Limit
  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetAmount) return;
    try {
      // Check if limit for category already exists
      const exists = budgets.find(b => b.category === budgetCategory);
      if (exists) {
        alert(`Hạn mức cho "${budgetCategory}" đã tồn tại. Hãy xóa hạn mức cũ trước khi cập nhật.`);
        return;
      }

      await addFamilyItem(familyId, 'budgets', {
        category: budgetCategory,
        limitAmount: Number(budgetAmount),
        alertThreshold: Number(budgetThreshold),
        createdBy: currentUserUid
      });
      setBudgetAmount('');
    } catch (err: any) {
      alert('Lỗi thêm hạn mức: ' + err.message);
    }
  };

  // 3. Submit Saving Goal
  const handleAddSaving = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savingName.trim() || !savingTarget) return;
    try {
      await addFamilyItem(familyId, 'savings', {
        name: savingName.trim(),
        targetAmount: Number(savingTarget),
        currentAmount: Number(savingCurrent) || 0,
        targetDate: savingDate,
        createdBy: currentUserUid
      });
      setSavingName('');
      setSavingTarget('');
      setSavingCurrent('0');
      setSavingDate('');
    } catch (err: any) {
      alert('Lỗi thêm mục tiêu tiết kiệm: ' + err.message);
    }
  };

  // Update current savings amount directly
  const handleAdjustSavingAmount = async (goal: SavingGoal, newValStr: string) => {
    const val = Number(newValStr);
    if (isNaN(val) || val < 0) return;
    try {
      await updateFamilyItem(familyId, 'savings', goal.id, { currentAmount: val });
    } catch (err: any) {
      alert('Lỗi cập nhật số dư tiết kiệm: ' + err.message);
    }
  };

  // 4. Submit Fixed Bill
  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billName.trim() || !billAmount || !billDueDay) return;
    try {
      await addFamilyItem(familyId, 'bills', {
        name: billName.trim(),
        amount: Number(billAmount),
        dueDay: Number(billDueDay),
        category: billCategory,
        createdBy: currentUserUid
      });
      setBillName('');
      setBillAmount('');
    } catch (err: any) {
      alert('Lỗi thêm hóa đơn: ' + err.message);
    }
  };

  // Delete helpers
  const handleDeleteItem = async (subcollection: string, itemId: string) => {
    const confirm = window.confirm('Bạn chắc chắn muốn xóa mục thiết lập này?');
    if (confirm) {
      await deleteFamilyItem(familyId, subcollection, itemId);
    }
  };

  // 5. Google Sheets Manual sync trigger
  const triggerGoogleSheetsSync = async () => {
    if (!googleToken) {
      onLoginGoogle();
      return;
    }

    const confirm = window.confirm('Bạn có muốn đẩy toàn bộ dữ liệu hiện tại lên các bảng tính Google Sheets của bạn? Hành động này sẽ thay thế các hàng cũ tương ứng.');
    if (!confirm) return;

    setSyncLoading(true);
    try {
      await syncAllToGoogleSheets(googleToken, {
        transactions,
        wallets,
        budgets,
        savings,
        bills,
        cashflow
      });

      const newLog: SyncLog = {
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        status: 'success',
        message: 'Ghi dữ liệu lên Google Sheets thành công!',
        sheetsUpdated: ['Giao_Dich', 'Vi_The', 'Han_Muc', 'Muc_Tieu', 'Hoa_Don', 'Vay_Dau_Tu']
      };
      setSyncLogs(prev => [newLog, ...prev]);
      alert('Chúc mừng! Đã ghi toàn bộ 6 bảng dữ liệu lên Google Sheets thành công!');
    } catch (err: any) {
      const errorLog: SyncLog = {
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        status: 'error',
        message: err.message || 'Lỗi bất ngờ xảy ra.'
      };
      setSyncLogs(prev => [errorLog, ...prev]);
      alert('Ghi dữ liệu thất bại: ' + err.message);
    } finally {
      setSyncLoading(false);
    }
  };

  // LOAD from Google Sheets helper
  const handleLoadFromGoogleSheets = async () => {
    if (!googleToken) {
      onLoginGoogle();
      return;
    }

    const confirm = window.confirm('Bạn có chắc muốn nạp dữ liệu từ Google Sheets? Thao tác này sẽ ghi đè toàn bộ dữ liệu chi tiêu hiện tại trong bộ nhớ ứng dụng của bạn bằng dữ liệu từ Google Sheets.');
    if (!confirm) return;

    setSyncLoading(true);
    try {
      const sheetsData = await loadAllFromGoogleSheets(googleToken);
      if (sheetsData) {
        overwriteLocalFamilyData(familyId, sheetsData);

        const newLog: SyncLog = {
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          status: 'success',
          message: 'Tải và nạp dữ liệu từ Google Sheets thành công!',
          sheetsUpdated: ['Giao_Dich', 'Vi_The', 'Han_Muc', 'Muc_Tieu', 'Hoa_Don', 'Vay_Dau_Tu']
        };
        setSyncLogs(prev => [newLog, ...prev]);
        alert('Chúc mừng! Đã tải và cập nhật toàn bộ 6 bảng dữ liệu từ Google Sheets xuống máy thành công!');
        window.location.reload();
      }
    } catch (err: any) {
      const errorLog: SyncLog = {
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        status: 'error',
        message: err.message || 'Lỗi bất ngờ xảy ra.'
      };
      setSyncLogs(prev => [errorLog, ...prev]);
      alert('Tải dữ liệu từ Sheets thất bại: ' + err.message);
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 5. Google Sheets Synchronization Dashboard Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-600" /> Đồng bộ & Lưu trữ Google Sheets (Không cần database)
            </h4>
            <p className="text-[11px] text-slate-500 font-medium">
              Ứng dụng lưu trữ dữ liệu hoàn toàn đáng tin cậy trên thiết bị của bạn và đồng bộ trực tiếp với trang Google Sheets cá nhân.
            </p>
          </div>
          <a
            href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1 self-start md:self-center bg-indigo-50 px-3 py-1.5 rounded-xl transition"
          >
            Mở file Google Sheets <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          <div className="md:col-span-5 space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
            {/* Input Google Spreadsheet ID */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                ⚙️ Thay đổi ID Bảng tính của bạn
              </span>
              <input
                type="text"
                value={spreadsheetId}
                onChange={(e) => {
                  setSpreadsheetIdState(e.target.value);
                  setSpreadsheetId(e.target.value);
                }}
                placeholder="Nhập Google Sheets ID"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 focus:outline-none focus:border-indigo-500 shadow-sm"
              />
              <p className="text-[10px] text-slate-400">
                Hãy tạo hoặc dùng file Google Sheet của bạn rồi dán ID từ URL của trình duyệt vào đây để lưu trữ dòng tiền riêng tư của bạn.
              </p>
            </div>

            {googleToken ? (
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  onClick={handleLoadFromGoogleSheets}
                  disabled={syncLoading}
                  className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm animate-pulse-slow"
                >
                  <Download className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
                  Tải từ Sheets xuống
                </button>
                <button
                  onClick={triggerGoogleSheetsSync}
                  disabled={syncLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
                  Đẩy lên Sheets
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-[10px] text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-100 font-semibold flex items-start gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  Bạn cần kết nối Google Auth trước để lấy Token xác thực đọc/ghi Google Sheets.
                </p>
                <button
                  onClick={onLoginGoogle}
                  className="w-full bg-slate-950 hover:bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-sm"
                >
                  Kết nối Google Auth ngay
                </button>
              </div>
            )}
          </div>

          <div className="md:col-span-7 bg-slate-50 p-4 rounded-2xl border border-slate-100 min-h-[170px] flex flex-col justify-between">
            <div>
              <h5 className="text-xs font-bold text-slate-700 mb-2.5 flex items-center gap-1">
                📋 Nhật ký đồng bộ hóa:
              </h5>
              {syncLogs.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">Chưa có hoạt động đồng bộ nào được thực hiện trong phiên làm việc này. Bạn có thể kéo dữ liệu cũ từ Sheets về hoặc đẩy dữ liệu mới lên bất cứ lúc nào!</p>
              ) : (
                <div className="space-y-2 max-h-[130px] overflow-y-auto">
                  {syncLogs.map((log, index) => (
                    <div key={index} className="text-[11px] flex justify-between items-start bg-white p-2 rounded-lg border border-slate-100 shadow-sm animate-fadeIn">
                      <div className="space-y-0.5">
                        <p className={`font-bold ${log.status === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {log.message}
                        </p>
                        {log.sheetsUpdated && (
                          <p className="text-[9px] text-slate-400">Tabs cập nhật: {log.sheetsUpdated.join(', ')}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono font-semibold">{log.timestamp}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-4 leading-relaxed bg-white/60 p-2 rounded-xl border border-slate-200/50">
              💡 <strong>Mẹo nhỏ:</strong> Chia sẻ ID Bảng tính này với các thành viên khác trong gia đình để mọi người có thể cùng tải/đẩy dữ liệu chung lên một tệp Google Sheets duy nhất!
            </div>
          </div>

        </div>
      </div>

      {/* Grid of settings sub-forms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Manage Categories */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-50 pb-3">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-indigo-600" /> Quản lý Danh mục Thu / Chi
            </h4>
            <button
              onClick={handleResetCategories}
              type="button"
              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-2 py-1 rounded-lg transition"
            >
              Mặc định
            </button>
          </div>

          {/* Toggle Tab */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setCategoryTab('expense')}
              className={`flex-1 py-1.5 rounded-lg transition ${
                categoryTab === 'expense'
                  ? 'bg-white text-rose-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Chi tiêu
            </button>
            <button
              type="button"
              onClick={() => setCategoryTab('income')}
              className={`flex-1 py-1.5 rounded-lg transition ${
                categoryTab === 'income'
                  ? 'bg-white text-emerald-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Thu nhập
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleAddCategory} className="flex gap-2 text-xs">
            <input
              type="text"
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder={`Thêm danh mục ${categoryTab === 'expense' ? 'chi tiêu' : 'thu nhập'} mới...`}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 font-semibold"
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded-xl transition flex items-center gap-0.5"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm
            </button>
          </form>

          {/* List of categories */}
          <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
            {categories[categoryTab].map(cat => (
              <div
                key={cat}
                className="flex justify-between items-center text-xs bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-100/50 hover:bg-slate-100/50 transition font-medium"
              >
                <span className="text-slate-800">{cat}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat)}
                  className="p-1 text-slate-400 hover:text-red-500 rounded-lg transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
        
        {/* 1. Manage Wallets & Cards (Requirement 8) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-slate-900 border-b border-slate-50 pb-3 flex items-center gap-1.5">
            <WalletIcon className="w-4 h-4 text-indigo-600" /> Thiết lập Ví / Thẻ gia đình
          </h4>

          {/* Form */}
          <form onSubmit={handleAddWallet} className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="col-span-2">
              <input
                type="text"
                required
                value={walletName}
                onChange={(e) => setWalletName(e.target.value)}
                placeholder="Tên ví (Ví dụ: Thẻ tín dụng của chồng)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <input
                type="number"
                required
                value={walletBalance}
                onChange={(e) => setWalletBalance(e.target.value)}
                placeholder="Số dư ban đầu"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 font-semibold"
              />
            </div>
            <div>
              <select
                value={walletType}
                onChange={(e) => setWalletType(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-700 font-semibold focus:outline-none focus:border-indigo-500"
              >
                <option value="cash">Tiền mặt</option>
                <option value="bank">Tài khoản ngân hàng</option>
                <option value="credit">Thẻ tín dụng</option>
                <option value="e-wallet">Ví điện tử</option>
              </select>
            </div>
            <div className="col-span-2 flex gap-2">
              <select
                value={walletOwner}
                onChange={(e) => setWalletOwner(e.target.value as MemberRole)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="Chồng">Chồng sở hữu</option>
                <option value="Vợ">Vợ sở hữu</option>
                <option value="Khác">Sở hữu chung / Khác</option>
              </select>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-0.5"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm
              </button>
            </div>
          </form>

          {/* List */}
          <div className="space-y-2 max-h-[180px] overflow-y-auto">
            {wallets.map(w => (
              <div key={w.id} className="flex justify-between items-center text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <p className="font-bold text-slate-850">{w.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold">({w.member}) • {formatVND(w.balance)}</p>
                </div>
                <button
                  onClick={() => handleDeleteItem('wallets', w.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Spending limits (Requirement 5) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-slate-900 border-b border-slate-50 pb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-indigo-600" /> Quản lý Hạn mức chi tiêu chung
          </h4>

          {/* Form */}
          <form onSubmit={handleAddBudget} className="grid grid-cols-2 gap-2.5 text-xs">
            <div>
              <select
                value={budgetCategory}
                onChange={(e) => setBudgetCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="Tất cả">Tổng chi tiêu chung</option>
                {categories.expense.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <input
                type="number"
                required
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder="Hạn mức (VND)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <select
                value={budgetThreshold}
                onChange={(e) => setBudgetThreshold(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-600 font-semibold focus:outline-none focus:border-indigo-500"
              >
                <option value="70">Cảnh báo khi tiêu đạt 70%</option>
                <option value="80">Cảnh báo khi tiêu đạt 80%</option>
                <option value="90">Cảnh báo khi tiêu đạt 90%</option>
                <option value="100">Cảnh báo khi vượt 100%</option>
              </select>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-0.5"
              >
                <Plus className="w-3.5 h-3.5" /> Thiết lập
              </button>
            </div>
          </form>

          {/* List */}
          <div className="space-y-2 max-h-[180px] overflow-y-auto">
            {budgets.map(b => (
              <div key={b.id} className="flex justify-between items-center text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <p className="font-bold text-slate-850">{b.category === 'Tất cả' ? 'Tổng chi tiêu chung' : `Danh mục: ${b.category}`}</p>
                  <p className="text-[10px] text-slate-400 font-bold">Mức: {formatVND(b.limitAmount)} (Báo động: {b.alertThreshold}%)</p>
                </div>
                <button
                  onClick={() => handleDeleteItem('budgets', b.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Saving Goals (Requirement 6) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-slate-900 border-b border-slate-50 pb-3 flex items-center gap-1.5">
            <PiggyBank className="w-4 h-4 text-indigo-600" /> Mục tiêu tiết kiệm gia đình
          </h4>

          {/* Form */}
          <form onSubmit={handleAddSaving} className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="col-span-2">
              <input
                type="text"
                required
                value={savingName}
                onChange={(e) => setSavingName(e.target.value)}
                placeholder="Tên mục tiêu (Ví dụ: Mua tivi mới, xây nhà)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <input
                type="number"
                required
                value={savingTarget}
                onChange={(e) => setSavingTarget(e.target.value)}
                placeholder="Số tiền cần đạt"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 font-bold"
              />
            </div>
            <div>
              <input
                type="number"
                value={savingCurrent}
                onChange={(e) => setSavingCurrent(e.target.value)}
                placeholder="Đã tích lũy sẵn"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 font-bold"
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <input
                type="date"
                required
                value={savingDate}
                onChange={(e) => setSavingDate(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 font-semibold focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-0.5"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm
              </button>
            </div>
          </form>

          {/* List */}
          <div className="space-y-2.5 max-h-[180px] overflow-y-auto">
            {savings.map(s => (
              <div key={s.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-850">{s.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold">Mục tiêu: {formatVND(s.targetAmount)} (Hạn: {s.targetDate})</p>
                  </div>
                  <button
                    onClick={() => handleDeleteItem('savings', s.id)}
                    className="p-1 text-slate-400 hover:text-red-500 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {/* Micro input to quickly add savings balance */}
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-100">
                  <span className="text-[9px] text-slate-400 font-bold uppercase pl-1.5 flex-shrink-0">Tiết kiệm hiện tại:</span>
                  <input
                    type="number"
                    defaultValue={s.currentAmount}
                    onBlur={(e) => handleAdjustSavingAmount(s, e.target.value)}
                    className="w-full text-right font-bold text-slate-850 focus:outline-none focus:border-indigo-500 text-xs bg-slate-50/50 rounded-lg px-1.5 py-0.5"
                    title="Chỉnh sửa số đã tiết kiệm và click ra ngoài để tự lưu"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Fixed Bills (Requirement 7) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-slate-900 border-b border-slate-50 pb-3 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-600" /> Thiết lập hóa đơn cố định hàng tháng
          </h4>

          {/* Form */}
          <form onSubmit={handleAddBill} className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="col-span-2">
              <input
                type="text"
                required
                value={billName}
                onChange={(e) => setBillName(e.target.value)}
                placeholder="Tên hóa đơn (Ví dụ: Tiền điện gia đình, Internet FPT)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <input
                type="number"
                required
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
                placeholder="Số tiền cần trả"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 font-bold"
              />
            </div>
            <div>
              <input
                type="number"
                min="1"
                max="31"
                required
                value={billDueDay}
                onChange={(e) => setBillDueDay(e.target.value)}
                placeholder="Hạn trả hàng tháng (Ngày 1-31)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <select
                value={billCategory}
                onChange={(e) => setBillCategory(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-700 font-semibold focus:outline-none focus:border-indigo-500"
              >
                {BILL_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-0.5"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm
              </button>
            </div>
          </form>

          {/* List */}
          <div className="space-y-2 max-h-[180px] overflow-y-auto">
            {bills.map(b => (
              <div key={b.id} className="flex justify-between items-center text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <p className="font-bold text-slate-850">{b.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold">
                    Tiền: {formatVND(b.amount)} • Ngày đến hạn: {b.dueDay} hàng tháng
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteItem('bills', b.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
