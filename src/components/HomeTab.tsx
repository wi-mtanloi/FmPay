import React, { useState, useMemo } from 'react';
import { 
  PlusCircle, 
  MinusCircle, 
  TrendingUp, 
  TrendingDown, 
  Wallet as WalletIcon, 
  Calendar, 
  Tag, 
  User, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2,
  DollarSign,
  Heart,
  Briefcase,
  AlertCircle,
  ArrowLeftRight,
  X
} from 'lucide-react';
import { 
  Transaction, 
  Wallet, 
  BudgetLimit, 
  SavingGoal, 
  FixedBill, 
  MemberRole 
} from '../types';
import { 
  addFamilyItem, 
  deleteFamilyItem, 
  updateFamilyItem 
} from '../services/firebase';
import { getAllCategoriesWithSavings } from '../services/categories';

interface HomeTabProps {
  familyId: string;
  transactions: Transaction[];
  wallets: Wallet[];
  budgets: BudgetLimit[];
  savings: SavingGoal[];
  bills: FixedBill[];
  currentUserUid: string;
  currentUserRole: MemberRole;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  familyId,
  transactions,
  wallets,
  budgets,
  savings,
  bills,
  currentUserUid,
  currentUserRole
}) => {
  // Load dynamic categories
  const categories = useMemo(() => {
    return getAllCategoriesWithSavings(familyId, savings);
  }, [familyId, savings]);

  // Form State
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [category, setCategory] = useState(() => {
    const cats = getAllCategoriesWithSavings(familyId, savings);
    return cats.expense[0] || 'Ăn uống';
  });
  const [walletId, setWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [assignedMember, setAssignedMember] = useState<MemberRole>(currentUserRole || 'Khác');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // State for paying bill modal
  const [payingBill, setPayingBill] = useState<FixedBill | null>(null);
  const [payWalletId, setPayWalletId] = useState<string>('');

  // 1. Calculate General Dashboard Metrics
  const totalBalance = wallets.reduce((acc, w) => acc + w.balance, 0);

  // Filter transactions for CURRENT month
  const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
  const currentMonthTransactions = transactions.filter(t => t.date.startsWith(currentMonthStr));

  const monthlyIncome = currentMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const monthlyExpense = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  // 2. Format Money (VND helper)
  const formatVND = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  // 3. Handle Add Transaction
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!amount || Number(amount) <= 0) {
      setFormError('Vui lòng nhập số tiền hợp lệ.');
      return;
    }
    if (!walletId) {
      setFormError('Vui lòng chọn ví/thẻ nguồn.');
      return;
    }
    if (type === 'transfer' && !toWalletId) {
      setFormError('Vui lòng chọn ví đích.');
      return;
    }
    if (type === 'transfer' && walletId === toWalletId) {
      setFormError('Ví nguồn và ví đích không được trùng nhau.');
      return;
    }

    setFormLoading(true);
    try {
      const selectedWallet = wallets.find(w => w.id === walletId);
      const transactionAmount = Number(amount);

      if (type === 'transfer') {
        const destWallet = wallets.find(w => w.id === toWalletId);
        if (!selectedWallet || !destWallet) {
          throw new Error('Không tìm thấy thông tin ví nguồn hoặc ví đích.');
        }

        const transferId = 'TRF-' + Math.random().toString(36).substring(2, 9).toUpperCase();

        // 1. Outgoing transaction (from source wallet, recorded as expense)
        const outTx = {
          date,
          amount: transactionAmount,
          type: 'expense' as const,
          category: 'Chuyển ví',
          walletId,
          walletName: selectedWallet.name,
          member: assignedMember,
          notes: `Chuyển đến ví "${destWallet.name}". [Mã chuyển: ${transferId}] ${notes.trim()}`.trim(),
          createdBy: currentUserUid
        };

        // 2. Incoming transaction (to dest wallet, recorded as income)
        const inTx = {
          date,
          amount: transactionAmount,
          type: 'income' as const,
          category: 'Chuyển ví',
          walletId: toWalletId,
          walletName: destWallet.name,
          member: assignedMember,
          notes: `Nhận từ ví "${selectedWallet.name}". [Mã chuyển: ${transferId}] ${notes.trim()}`.trim(),
          createdBy: currentUserUid
        };

        await addFamilyItem(familyId, 'transactions', outTx);
        await addFamilyItem(familyId, 'transactions', inTx);

        // Adjust wallet balances
        await updateFamilyItem(familyId, 'wallets', walletId, { balance: selectedWallet.balance - transactionAmount });
        await updateFamilyItem(familyId, 'wallets', toWalletId, { balance: destWallet.balance + transactionAmount });

      } else {
        // Create new standard transaction
        const newTx = {
          date,
          amount: transactionAmount,
          type,
          category,
          walletId,
          walletName: selectedWallet?.name || 'Ví ẩn',
          member: assignedMember,
          notes: notes.trim(),
          createdBy: currentUserUid
        };

        await addFamilyItem(familyId, 'transactions', newTx);

        // Adjust Wallet Balance
        if (selectedWallet) {
          const newBalance = type === 'expense' 
            ? selectedWallet.balance - transactionAmount 
            : selectedWallet.balance + transactionAmount;
          await updateFamilyItem(familyId, 'wallets', walletId, { balance: newBalance });
        }

        // Tự động chuyển tiền vào mục tiêu tiết kiệm tương ứng khi chọn chi mục tiêu tiết kiệm
        if (type === 'expense' && category.startsWith('🎯 Tiết kiệm: ')) {
          const goalName = category.replace('🎯 Tiết kiệm: ', '');
          const goal = savings.find(g => g.name === goalName);
          if (goal) {
            const newCurrentAmount = (goal.currentAmount || 0) + transactionAmount;
            await updateFamilyItem(familyId, 'savings', goal.id, { currentAmount: newCurrentAmount });
          }
        }
      }

      // Reset form
      setAmount('');
      setNotes('');
      setFormError('');
    } catch (err: any) {
      setFormError('Lỗi khi thêm giao dịch: ' + err.message);
    } finally {
      setFormLoading(false);
    }
  };

  // 4. Handle Delete Transaction
  const handleDeleteTransaction = async (tx: Transaction) => {
    // Check if it's a transfer transaction
    const transferMatch = tx.notes ? tx.notes.match(/\[Mã chuyển:\s*(TRF-[A-Z0-9]+)\]/) : null;
    if (transferMatch) {
      const transferId = transferMatch[1];
      const confirm = window.confirm(
        `Giao dịch này là một phần của giao dịch Chuyển ví [${transferId}].\n` +
        `Xóa giao dịch này sẽ tự động hoàn tác số dư và xóa cả giao dịch chuyển đối ứng ở ví kia.\n\n` +
        `Bạn có chắc chắn muốn tiếp tục?`
      );
      if (!confirm) return;

      try {
        // Find counterpart transaction
        const counterpart = transactions.find(t => t.id !== tx.id && t.notes && t.notes.includes(transferId));

        // Delete current transaction and reverse its wallet balance
        const targetWallet = wallets.find(w => w.id === tx.walletId);
        if (targetWallet) {
          const reversedBalance = tx.type === 'expense'
            ? targetWallet.balance + tx.amount
            : targetWallet.balance - tx.amount;
          await updateFamilyItem(familyId, 'wallets', tx.walletId, { balance: reversedBalance });
        }
        await deleteFamilyItem(familyId, 'transactions', tx.id);

        // Delete counterpart transaction and reverse its wallet balance
        if (counterpart) {
          const counterpartWallet = wallets.find(w => w.id === counterpart.walletId);
          if (counterpartWallet) {
            const reversedCounterpartBalance = counterpart.type === 'expense'
              ? counterpartWallet.balance + counterpart.amount
              : counterpartWallet.balance - counterpart.amount;
            await updateFamilyItem(familyId, 'wallets', counterpart.walletId, { balance: reversedCounterpartBalance });
          }
          await deleteFamilyItem(familyId, 'transactions', counterpart.id);
        }
      } catch (err: any) {
        alert('Không thể xóa giao dịch chuyển ví: ' + err.message);
      }
      return;
    }

    const confirm = window.confirm('Bạn có chắc chắn muốn xóa giao dịch này?');
    if (!confirm) return;

    try {
      // Find wallet to reverse the amount
      const targetWallet = wallets.find(w => w.id === tx.walletId);
      if (targetWallet) {
        const reversedBalance = tx.type === 'expense'
          ? targetWallet.balance + tx.amount
          : targetWallet.balance - tx.amount;
        await updateFamilyItem(familyId, 'wallets', tx.walletId, { balance: reversedBalance });
      }

      // Revert savings goal amount if it was a savings goal expense transaction
      if (tx.type === 'expense' && tx.category && tx.category.startsWith('🎯 Tiết kiệm: ')) {
        const goalName = tx.category.replace('🎯 Tiết kiệm: ', '');
        const goal = savings.find(g => g.name === goalName);
        if (goal) {
          const newCurrentAmount = Math.max(0, (goal.currentAmount || 0) - tx.amount);
          await updateFamilyItem(familyId, 'savings', goal.id, { currentAmount: newCurrentAmount });
        }
      }

      await deleteFamilyItem(familyId, 'transactions', tx.id);
    } catch (err: any) {
      alert('Không thể xóa giao dịch: ' + err.message);
    }
  };

  // 5. Handle Pay Bill Directly
  const startPayBill = (bill: FixedBill) => {
    if (wallets.length === 0) {
      alert('Vui lòng tạo ví/thẻ trong phần Thiết lập trước khi thanh toán hóa đơn.');
      return;
    }
    setPayingBill(bill);
    // Find first non-credit card wallet as preferred pay source, otherwise wallets[0]
    const preferredWallet = wallets.find(w => w.type !== 'credit') || wallets[0];
    setPayWalletId(preferredWallet.id);
  };

  const handleConfirmPayBill = async () => {
    if (!payingBill) return;
    const selectedWallet = wallets.find(w => w.id === payWalletId);
    if (!selectedWallet) {
      alert('Vui lòng chọn ví/thẻ để thanh toán.');
      return;
    }

    try {
      // Create transaction
      const newTx = {
        date: new Date().toISOString().split('T')[0],
        amount: payingBill.amount,
        type: 'expense' as const,
        category: payingBill.category || 'Nhà cửa & Tiền ích',
        walletId: selectedWallet.id,
        walletName: selectedWallet.name,
        member: currentUserRole,
        notes: `Thanh toán hóa đơn cố định: ${payingBill.name}`,
        createdBy: currentUserUid
      };

      await addFamilyItem(familyId, 'transactions', newTx);

      // Adjust balances
      // If paying a credit card bill, we also need to pay off/reduce the credit card's debt balance
      if (payingBill.id && payingBill.id.startsWith('credit-bill-')) {
        const creditWalletId = payingBill.id.replace('credit-bill-', '');
        const creditWallet = wallets.find(w => w.id === creditWalletId);
        if (creditWallet) {
          const newCreditBalance = creditWallet.balance + payingBill.amount;
          await updateFamilyItem(familyId, 'wallets', creditWallet.id, { balance: newCreditBalance });
        }
      }

      // Decrease the paying wallet's balance
      const newBalance = selectedWallet.balance - payingBill.amount;
      await updateFamilyItem(familyId, 'wallets', selectedWallet.id, { balance: newBalance });

      // Update last paid date on the bill
      await updateFamilyItem(familyId, 'bills', payingBill.id, {
        lastPaidDate: new Date().toISOString().split('T')[0]
      });

      alert(`Thanh toán thành công hóa đơn ${payingBill.name}!`);
      setPayingBill(null);
    } catch (err: any) {
      alert('Thanh toán hóa đơn thất bại: ' + err.message);
    }
  };

  // 6. Find upcoming bills (due in next 7 days, or unpaid this month)
  const currentDay = new Date().getDate();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const upcomingBills = bills.filter(bill => {
    // If already paid in current month/year, no warning needed
    if (bill.lastPaidDate) {
      const lastPaidParts = bill.lastPaidDate.split('-');
      if (Number(lastPaidParts[0]) === currentYear && Number(lastPaidParts[1]) === currentMonth) {
        return false;
      }
    }
    // Is it due soon or overdue?
    return true;
  });

  // 7. Find budget categories exceeding limit
  const budgetAlerts = budgets.map(b => {
    let spent = 0;
    if (b.category === 'Tất cả') {
      spent = monthlyExpense;
    } else {
      spent = currentMonthTransactions
        .filter(t => t.type === 'expense' && t.category === b.category)
        .reduce((sum, t) => sum + t.amount, 0);
    }

    const ratio = b.limitAmount > 0 ? (spent / b.limitAmount) * 100 : 0;
    return {
      category: b.category,
      spent,
      limit: b.limitAmount,
      ratio,
      exceeded: spent > b.limitAmount,
      warning: spent >= (b.limitAmount * (b.alertThreshold / 100))
    };
  }).filter(b => b.warning || b.exceeded);

  // Helper to sync category choice on type change
  const handleTypeChange = (newType: 'income' | 'expense' | 'transfer') => {
    setType(newType);
    if (newType === 'transfer') {
      setCategory('Chuyển ví');
    } else {
      setCategory(categories[newType][0] || '');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. General Metrics Rows */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Total Balance Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng tài sản ví</span>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">{formatVND(totalBalance)}</h3>
            <p className="text-[10px] text-slate-400 font-medium">Tổng giá trị của tất cả các ví/thẻ trong nhà</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100 flex items-center justify-center">
            <WalletIcon className="w-6 h-6" />
          </div>
        </div>

        {/* Monthly Income */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Thu nhập tháng này</span>
            <h3 className="text-3xl font-black text-emerald-600 tracking-tight">+{formatVND(monthlyIncome)}</h3>
            <p className="text-[10px] text-slate-400 font-medium">Toàn bộ các khoản thu nhập của gia đình</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl text-emerald-600 border border-emerald-100 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Monthly Expense */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chi tiêu tháng này</span>
            <h3 className="text-3xl font-black text-rose-500 tracking-tight">-{formatVND(monthlyExpense)}</h3>
            {totalBalance < 0 ? (
              <p className="text-[10px] text-rose-500 font-medium flex items-center gap-0.5">
                <AlertCircle className="w-3 h-3" /> Số dư ví tổng đang bị âm!
              </p>
            ) : (
              <p className="text-[10px] text-slate-400 font-medium">Hạch toán tổng các ví chi tiêu</p>
            )}
          </div>
          <div className="w-12 h-12 bg-rose-50 rounded-2xl text-rose-600 border border-rose-100 flex items-center justify-center">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* 2. Critical Alerts Area (Limits & Bills) */}
      {(upcomingBills.length > 0 || budgetAlerts.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Unpaid fixed bills notification (Requirement 7) */}
          {upcomingBills.length > 0 && (
            <div className="bg-rose-50/70 border border-rose-100 rounded-3xl p-6 space-y-4 shadow-sm">
              <h3 className="text-lg font-bold text-rose-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" /> Hóa đơn sắp tới ({upcomingBills.length})
              </h3>
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {upcomingBills.map(bill => (
                  <div key={bill.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between text-xs shadow-sm">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{bill.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">Hạn thanh toán: ngày {bill.dueDay} hàng tháng</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-slate-900 text-sm">{formatVND(bill.amount)}</span>
                      <button
                        onClick={() => startPayBill(bill)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-xl text-[10px] transition shadow-xs"
                      >
                        Thanh toán
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Budget Limit Warnings (Requirement 5) */}
          {budgetAlerts.length > 0 && (
            <div className="bg-rose-50/70 border border-rose-100 rounded-3xl p-6 space-y-4 shadow-sm">
              <h3 className="text-lg font-bold text-rose-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" /> Cảnh báo hạn mức chi tiêu
              </h3>
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {budgetAlerts.map(alert => (
                  <div key={alert.category} className="bg-white p-4 rounded-2xl border border-slate-100 text-xs shadow-sm space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900 text-sm">{alert.category === 'Tất cả' ? 'Tổng chi tiêu chung' : `Danh mục: ${alert.category}`}</span>
                      <span className={`font-bold text-[10px] px-2 py-0.5 rounded-full ${alert.exceeded ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {alert.exceeded ? 'ĐÃ VƯỢT QUÁ' : 'SẮP CHẠM HẠN MỨC'} ({alert.ratio.toFixed(0)}%)
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${alert.exceeded ? 'bg-rose-500' : 'bg-amber-500'}`}
                        style={{ width: `${Math.min(alert.ratio, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span>Đã tiêu: {formatVND(alert.spent)}</span>
                      <span>Hạn mức: {formatVND(alert.limit)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Main Dashboard Section: Left Form & Wallets, Right History & Savings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form & Wallets (5 spans) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Quick Transaction Input */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4 w-[800px] max-w-full">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-50 pb-3">
              Ghi nhanh giao dịch mới
            </h3>
            
            {formError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddTransaction} className="space-y-4">
              
              {/* Type Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleTypeChange('expense')}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-1 ${
                    type === 'expense' 
                      ? 'bg-rose-500 text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <MinusCircle className="w-3.5 h-3.5" /> Chi tiêu
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('income')}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-1 ${
                    type === 'income' 
                      ? 'bg-emerald-500 text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Thu nhập
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('transfer')}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-1 ${
                    type === 'transfer' 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" /> Chuyển ví
                </button>
              </div>

              {/* Amount input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số tiền (VND)</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Nhập số tiền..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-12 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 font-bold"
                  />
                  <span className="absolute right-3 top-3 text-xs text-slate-400 font-bold">đ</span>
                </div>
              </div>

              {/* Category & Wallet row */}
              <div className="grid grid-cols-2 gap-3">
                {type !== 'transfer' ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-0.5">
                        <Tag className="w-3 h-3 text-slate-400" /> Danh mục
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                      >
                        {categories[type === 'income' ? 'income' : 'expense'].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-0.5">
                        <WalletIcon className="w-3 h-3 text-slate-400" /> Ví/Thẻ sử dụng
                      </label>
                      <select
                        value={walletId}
                        required
                        onChange={(e) => setWalletId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                      >
                        <option value="">-- Chọn ví --</option>
                        {wallets.map(w => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({formatVND(w.balance)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-0.5">
                        <WalletIcon className="w-3 h-3 text-slate-400" /> Ví nguồn (Từ)
                      </label>
                      <select
                        value={walletId}
                        required
                        onChange={(e) => setWalletId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                      >
                        <option value="">-- Chọn ví nguồn --</option>
                        {wallets.map(w => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({formatVND(w.balance)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-0.5">
                        <WalletIcon className="w-3 h-3 text-indigo-600" /> Ví đích (Đến)
                      </label>
                      <select
                        value={toWalletId}
                        required
                        onChange={(e) => setToWalletId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold border-indigo-200"
                      >
                        <option value="">-- Chọn ví đích --</option>
                        {wallets.map(w => (
                          <option key={w.id} value={w.id} disabled={w.id === walletId}>
                            {w.name} ({formatVND(w.balance)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Member & Date row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-0.5">
                    <User className="w-3 h-3 text-slate-400" /> Người chi/thu
                  </label>
                  <select
                    value={assignedMember}
                    onChange={(e) => setAssignedMember(e.target.value as MemberRole)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                  >
                    <option value="Chồng">Chồng</option>
                    <option value="Vợ">Vợ</option>
                    <option value="Khác">Khác (Con/Người thân)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-0.5">
                    <Calendar className="w-3 h-3 text-slate-400" /> Ngày tháng
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ghi chú giao dịch</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ghi rõ chi tiết mua gì, ở đâu..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-md"
              >
                Ghi sổ giao dịch
              </button>

            </form>
          </div>

          {/* Wallets & Cards Management Widget (Requirement 8) */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-50 pb-3">
              Ví & Thẻ liên kết ({wallets.length})
            </h3>
            
            {wallets.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 font-medium">Chưa có ví nào được tạo. Hãy thêm ví trong mục Thiết lập.</p>
            ) : (
              <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                {wallets.map(w => {
                  let cardBg = "bg-indigo-50 border-indigo-100";
                  if (w.type === "cash") cardBg = "bg-emerald-50 border-emerald-100";
                  if (w.type === "credit") cardBg = "bg-rose-50 border-rose-100";
                  if (w.type === "e-wallet") cardBg = "bg-amber-50 border-amber-100";
                  return (
                    <div key={w.id} className={`p-4 rounded-2xl border flex items-center justify-between text-xs ${cardBg}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-6 bg-slate-800 rounded shadow-sm"></div>
                        <div>
                          <p className="font-bold text-slate-950">{w.name}</p>
                          <p className="text-[10px] text-slate-500">
                            Sở hữu: {w.member} • {w.type === 'credit' ? 'Thẻ Tín Dụng' : 'Ví'}
                          </p>
                        </div>
                      </div>
                      <span className={`font-black text-sm text-slate-900`}>
                        {formatVND(w.balance)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: History & Saving Goals (7 spans) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Saving Goals Progress Widget (Requirement 6) */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-50 pb-3">
              Mục tiêu tiết kiệm ({savings.length})
            </h3>

            {savings.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 font-medium">Chưa có mục tiêu tiết kiệm nào. Hãy thiết lập ở mục Thiết lập.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savings.map(goal => {
                  const percent = goal.targetAmount > 0 
                    ? (goal.currentAmount / goal.targetAmount) * 100 
                    : 0;
                  return (
                    <div key={goal.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900">🏠 {goal.name}</span>
                        <span className="text-xs font-bold text-indigo-600">{percent.toFixed(0)}%</span>
                      </div>
                      
                      <div className="space-y-1.5">
                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-indigo-500 h-full transition-all"
                            style={{ width: `${Math.min(percent, 100)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-medium pt-0.5">
                          <span>Đã tích lũy: {formatVND(goal.currentAmount)}</span>
                          <span>Hạn đạt: {goal.targetDate}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 text-right">Mục tiêu: {formatVND(goal.targetAmount)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent transactions (Last 10) */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-50 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                Lịch sử giao dịch gần đây
              </h3>
              <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">Tất cả thành viên</span>
            </div>

            {transactions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8 font-medium">Chưa có giao dịch nào được ghi chép.</p>
            ) : (
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto pr-1">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="py-2.5 font-bold">Ngày</th>
                      <th className="py-2.5 font-bold">Thành viên</th>
                      <th className="py-2.5 font-bold">Danh mục/Ví</th>
                      <th className="py-2.5 font-bold text-right">Số tiền</th>
                      <th className="py-2.5 font-bold text-center">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.slice(0, 10).map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 text-[11px] text-slate-400 font-medium">{tx.date}</td>
                        <td className="py-3 font-semibold">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            tx.member === 'Chồng' 
                              ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                              : tx.member === 'Vợ' 
                              ? 'bg-pink-50 text-pink-700 border border-pink-100' 
                              : 'bg-purple-50 text-purple-700 border border-purple-100'
                          }`}>
                            {tx.member}
                          </span>
                        </td>
                        <td className="py-3">
                          <p className="font-bold text-slate-900">{tx.category}</p>
                          <p className="text-[9px] text-slate-400 font-medium">{tx.walletName || 'Ví'}</p>
                          {tx.notes && <p className="text-[10px] text-slate-400 italic mt-0.5">"{tx.notes}"</p>}
                        </td>
                        <td className={`py-3 text-right font-black ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatVND(tx.amount)}
                        </td>
                        <td className="py-3 text-center">
                          <button
                            onClick={() => handleDeleteTransaction(tx)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Custom Pay Bill Modal Overlay */}
      {payingBill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl border border-slate-100 space-y-4 relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setPayingBill(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <AlertTriangle className="w-5 h-5 text-indigo-600" /> Xác nhận thanh toán hóa đơn
              </h3>
              <p className="text-xs text-slate-400">Vui lòng chọn nguồn tiền để thực hiện giao dịch này.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Tên hóa đơn:</span>
                <span className="font-bold text-slate-800">{payingBill.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Số tiền:</span>
                <span className="font-black text-slate-900 text-sm">{formatVND(payingBill.amount)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Danh mục:</span>
                <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md text-[10px]">{payingBill.category}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Chọn Ví/Thẻ nguồn thanh toán</label>
              <select
                value={payWalletId}
                onChange={(e) => setPayWalletId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
              >
                {wallets.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} (Số dư: {formatVND(w.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPayingBill(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-xs transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmPayBill}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md shadow-indigo-100"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
