import React, { useState } from 'react';
import { 
  PiggyBank, 
  HelpCircle, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  DollarSign, 
  Briefcase, 
  CheckCircle2,
  Trash2,
  CreditCard
} from 'lucide-react';
import { CashflowItem, Wallet, MemberRole } from '../types';
import { addFamilyItem, updateFamilyItem, deleteFamilyItem } from '../services/firebase';

interface CashflowTabProps {
  familyId: string;
  cashflow: CashflowItem[];
  wallets: Wallet[];
  currentUserUid: string;
  currentUserRole: MemberRole;
}

export const CashflowTab: React.FC<CashflowTabProps> = ({
  familyId,
  cashflow,
  wallets,
  currentUserUid,
  currentUserRole
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'loans' | 'investments'>('loans');
  
  // Expanded card state for loan details
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);

  // Forms State
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Loan Form Fields
  const [loanType, setLoanType] = useState<'loan_to_pay' | 'loan_to_receive'>('loan_to_pay');
  const [name, setName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paymentType, setPaymentType] = useState<'one_time' | 'installment'>('one_time');
  const [totalTerms, setTotalTerms] = useState('12');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [notes, setNotes] = useState('');

  // Investment Form Fields
  const [initialCost, setInitialCost] = useState('');
  const [currentValue, setCurrentValue] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatVND = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  // Auto-calculate monthly payment on totalAmount or terms change
  const handleAmountOrTermsChange = (amountVal: string, termsVal: string) => {
    setTotalAmount(amountVal);
    if (paymentType === 'installment' && amountVal && termsVal && Number(termsVal) > 0) {
      const calc = Math.round(Number(amountVal) / Number(termsVal));
      setMonthlyPayment(calc.toString());
    }
  };

  const handlePaymentTypeChange = (typeVal: 'one_time' | 'installment') => {
    setPaymentType(typeVal);
    if (typeVal === 'installment' && totalAmount && totalTerms) {
      const calc = Math.round(Number(totalAmount) / Number(totalTerms));
      setMonthlyPayment(calc.toString());
    } else {
      setMonthlyPayment('');
    }
  };

  // Add Loan / Investment
  const handleAddCashflow = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !totalAmount || Number(totalAmount) <= 0) {
      setError('Vui lòng điền tên và số tiền hợp lệ.');
      return;
    }

    setLoading(true);
    try {
      if (activeSubTab === 'loans') {
        const payload: Partial<CashflowItem> = {
          type: loanType,
          name: name.trim(),
          totalAmount: Number(totalAmount),
          loanType: paymentType,
          notes: notes.trim(),
          createdBy: currentUserUid
        };

        if (paymentType === 'installment') {
          payload.totalTerms = Number(totalTerms);
          payload.paidTerms = 0;
          payload.monthlyPayment = Number(monthlyPayment) || Math.round(Number(totalAmount) / Number(totalTerms));
        }

        await addFamilyItem(familyId, 'cashflow', payload);
      } else {
        const initialCostNum = Number(totalAmount);
        const currentValueNum = Number(currentValue) || initialCostNum;
        const yieldPercent = initialCostNum > 0 ? ((currentValueNum - initialCostNum) / initialCostNum) * 100 : 0;

        const payload: Partial<CashflowItem> = {
          type: 'investment',
          name: name.trim(),
          totalAmount: initialCostNum,
          initialCost: initialCostNum,
          currentValue: currentValueNum,
          yieldPercent: Math.round(yieldPercent * 100) / 100,
          notes: notes.trim(),
          createdBy: currentUserUid
        };

        await addFamilyItem(familyId, 'cashflow', payload);
      }

      // Reset form
      setName('');
      setTotalAmount('');
      setMonthlyPayment('');
      setInitialCost('');
      setCurrentValue('');
      setNotes('');
      setShowAddForm(false);
    } catch (err: any) {
      setError('Lỗi khi thêm: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Pay 1 term for installment loan
  const handlePayTerm = async (item: CashflowItem) => {
    if (wallets.length === 0) {
      alert('Vui lòng thiết lập ví trước khi thanh toán.');
      return;
    }

    const defaultWallet = wallets[0];
    const pTerms = item.paidTerms || 0;
    const tTerms = item.totalTerms || 1;
    const payAmount = item.monthlyPayment || 0;

    if (pTerms >= tTerms) {
      alert('Khoản nợ này đã được tất toán đầy đủ!');
      return;
    }

    const isOwed = item.type === 'loan_to_pay';
    const confirm = window.confirm(
      isOwed
        ? `Xác nhận ghi nhận thanh toán Kỳ ${pTerms + 1}/${tTerms} số tiền ${formatVND(payAmount)} từ ví "${defaultWallet.name}"?`
        : `Xác nhận ghi nhận thu hồi nợ Kỳ ${pTerms + 1}/${tTerms} số tiền ${formatVND(payAmount)} vào ví "${defaultWallet.name}"?`
    );

    if (!confirm) return;

    try {
      // 1. Update loan terms
      await updateFamilyItem(familyId, 'cashflow', item.id, {
        paidTerms: pTerms + 1
      });

      // 2. Record transaction
      const txPayload = {
        date: new Date().toISOString().split('T')[0],
        amount: payAmount,
        type: isOwed ? 'expense' : 'income',
        category: isOwed ? 'Trả nợ' : 'Kinh doanh',
        walletId: defaultWallet.id,
        walletName: defaultWallet.name,
        member: currentUserRole,
        notes: isOwed 
          ? `Trả góp kỳ ${pTerms + 1}/${tTerms} - ${item.name}` 
          : `Thu nợ trả góp kỳ ${pTerms + 1}/${tTerms} - ${item.name}`,
        createdBy: currentUserUid
      };

      await addFamilyItem(familyId, 'transactions', txPayload);

      // 3. Update wallet balance
      const newBalance = isOwed
        ? defaultWallet.balance - payAmount
        : defaultWallet.balance + payAmount;
      await updateFamilyItem(familyId, 'wallets', defaultWallet.id, { balance: newBalance });

      alert('Đã cập nhật kỳ thanh toán và cập nhật số dư ví thành công!');
    } catch (err: any) {
      alert('Không thể cập nhật kỳ thanh toán: ' + err.message);
    }
  };

  // Mark single payment loan as completely settled
  const handleSettleOneTimeLoan = async (item: CashflowItem) => {
    if (wallets.length === 0) {
      alert('Vui lòng thiết lập ví trước.');
      return;
    }

    const defaultWallet = wallets[0];
    const isOwed = item.type === 'loan_to_pay';
    const payAmount = item.totalAmount;

    const confirm = window.confirm(
      isOwed
        ? `Tất toán khoản nợ "${item.name}" trị giá ${formatVND(payAmount)} từ ví "${defaultWallet.name}"?`
        : `Thu hồi tất toán khoản vay "${item.name}" trị giá ${formatVND(payAmount)} vào ví "${defaultWallet.name}"?`
    );

    if (!confirm) return;

    try {
      // Create transaction
      const txPayload = {
        date: new Date().toISOString().split('T')[0],
        amount: payAmount,
        type: isOwed ? 'expense' : 'income',
        category: isOwed ? 'Trả nợ' : 'Kinh doanh',
        walletId: defaultWallet.id,
        walletName: defaultWallet.name,
        member: currentUserRole,
        notes: isOwed ? `Tất toán toàn bộ nợ: ${item.name}` : `Thu hồi tất toán toàn bộ vay: ${item.name}`,
        createdBy: currentUserUid
      };

      await addFamilyItem(familyId, 'transactions', txPayload);

      // Update wallet balance
      const newBalance = isOwed
        ? defaultWallet.balance - payAmount
        : defaultWallet.balance + payAmount;
      await updateFamilyItem(familyId, 'wallets', defaultWallet.id, { balance: newBalance });

      // Delete cashflow item since it's fully paid
      await deleteFamilyItem(familyId, 'cashflow', item.id);

      alert('Đã tất toán khoản vay/nợ và ghi sổ thành công!');
    } catch (err: any) {
      alert('Tất toán thất bại: ' + err.message);
    }
  };

  // Update investment current valuation
  const handleUpdateInvestmentValue = async (item: CashflowItem, newValStr: string) => {
    const val = Number(newValStr);
    if (isNaN(val) || val < 0) return;

    try {
      const initCost = item.initialCost || item.totalAmount || 1;
      const yieldPercent = ((val - initCost) / initCost) * 100;
      await updateFamilyItem(familyId, 'cashflow', item.id, {
        currentValue: val,
        yieldPercent: Math.round(yieldPercent * 100) / 100
      });
    } catch (err: any) {
      alert('Lỗi cập nhật định giá đầu tư: ' + err.message);
    }
  };

  const handleDeleteCashflowItem = async (id: string) => {
    const confirm = window.confirm('Bạn có chắc chắn muốn xóa mục này?');
    if (confirm) {
      await deleteFamilyItem(familyId, 'cashflow', id);
    }
  };

  const loansList = cashflow.filter(item => item.type === 'loan_to_pay' || item.type === 'loan_to_receive');
  const investmentsList = cashflow.filter(item => item.type === 'investment');

  return (
    <div className="space-y-6">
      
      {/* Tab bar selection and Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Sub-tabs */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 w-full sm:w-auto">
          <button
            onClick={() => { setActiveSubTab('loans'); setShowAddForm(false); }}
            className={`flex-1 sm:flex-initial px-6 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeSubTab === 'loans'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500 hover:text-slate-950'
            }`}
          >
            <CreditCard className="w-4 h-4" /> Khoản Vay & Nợ
          </button>
          <button
            onClick={() => { setActiveSubTab('investments'); setShowAddForm(false); }}
            className={`flex-1 sm:flex-initial px-6 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeSubTab === 'investments'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500 hover:text-slate-950'
            }`}
          >
            <Briefcase className="w-4 h-4" /> Tài Sản Đầu Tư
          </button>
        </div>

        {/* Add trigger */}
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md ml-auto animate-fade-in"
        >
          <Plus className="w-4 h-4" /> 
          {showAddForm ? 'Ẩn form nhập' : activeSubTab === 'loans' ? 'Thêm khoản vay/nợ' : 'Thêm khoản đầu tư'}
        </button>

      </div>

      {/* Add New Cashflow Form Container */}
      {showAddForm && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm max-w-xl mx-auto space-y-4">
          <h4 className="text-sm font-bold text-slate-900 border-b border-slate-50 pb-2">
            Khởi tạo {activeSubTab === 'loans' ? 'Khoản vay / nợ mới' : 'Danh mục đầu tư mới'}
          </h4>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleAddCashflow} className="space-y-4">
            
            {activeSubTab === 'loans' ? (
              // Loans specifics
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Phân loại nợ</label>
                  <select
                    value={loanType}
                    onChange={(e) => setLoanType(e.target.value as 'loan_to_pay' | 'loan_to_receive')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="loan_to_pay">Nợ cần trả (Tôi đi vay)</option>
                    <option value="loan_to_receive">Khoản cho vay (Tôi cho mượn)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Hình thức thanh toán</label>
                  <select
                    value={paymentType}
                    onChange={(e) => handlePaymentTypeChange(e.target.value as 'one_time' | 'installment')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="one_time">Trả 1 lần (Đáo hạn một thể)</option>
                    <option value="installment">Trả góp hàng tháng</option>
                  </select>
                </div>
              </div>
            ) : null}

            {/* Common Name field */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Tên danh mục / Khoản giao dịch</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={activeSubTab === 'loans' ? 'Ví dụ: Vay ngân hàng mua nhà, cho anh Nam mượn' : 'Ví dụ: Cổ phiếu FPT, Chứng chỉ quỹ, Mua vàng SJC'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Amount / Valuation row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">
                  {activeSubTab === 'loans' ? 'Tổng số tiền (VND)' : 'Số vốn đầu tư gốc (VND)'}
                </label>
                <input
                  type="number"
                  required
                  value={totalAmount}
                  onChange={(e) => handleAmountOrTermsChange(e.target.value, totalTerms)}
                  placeholder="Nhập số tiền..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              {activeSubTab === 'loans' && paymentType === 'installment' ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tổng số kỳ (Tháng)</label>
                  <input
                    type="number"
                    value={totalTerms}
                    onChange={(e) => handleAmountOrTermsChange(totalAmount, e.target.value)}
                    placeholder="VD: 12"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ) : activeSubTab === 'investments' ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Định giá hiện tại (VND)</label>
                  <input
                    type="number"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    placeholder="Nhập định giá..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ) : null}
            </div>

            {/* Display monthly calculated payment for installments (Requirement 11) */}
            {activeSubTab === 'loans' && paymentType === 'installment' && (
              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex justify-between items-center text-xs">
                <span className="font-semibold text-indigo-800">Mức cần trả dự tính hàng tháng:</span>
                <span className="font-extrabold text-indigo-950">{formatVND(Number(monthlyPayment) || 0)}</span>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Ghi chú chi tiết</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Hạn trả, người làm chứng, thông tin thêm..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs transition shadow-sm"
            >
              Lưu thông tin
            </button>

          </form>
        </div>
      )}

      {/* Lists display */}
      {activeSubTab === 'loans' ? (
        // Loans display (Requirement 11)
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            Danh sách các khoản nợ & cho vay ({loansList.length})
          </h4>

          {loansList.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-100 text-center space-y-2">
              <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-400 font-medium">Không tìm thấy khoản vay/nợ nào.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {loansList.map(loan => {
                const isExpanded = expandedLoanId === loan.id;
                const isOwed = loan.type === 'loan_to_pay';
                const isInstallment = loan.loanType === 'installment';
                const pct = isInstallment && loan.totalTerms 
                  ? ((loan.paidTerms || 0) / loan.totalTerms) * 100 
                  : 0;

                return (
                  <div 
                    key={loan.id}
                    className="bg-white rounded-3xl border border-slate-100 shadow-xs hover:shadow-sm transition overflow-hidden"
                  >
                    {/* Header */}
                    <div 
                      className="p-5 cursor-pointer flex items-start justify-between gap-4"
                      onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                            isOwed 
                              ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                            {isOwed ? 'NỢ PHẢI TRẢ' : 'CHO VAY THU HỒI'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {isInstallment ? 'Trả góp' : 'Đóng 1 lần'}
                          </span>
                        </div>
                        <h5 className="font-bold text-slate-900 text-sm">{loan.name}</h5>
                        {isInstallment && (
                          <p className="text-[11px] text-indigo-600 font-bold">
                            Mức trả: {formatVND(loan.monthlyPayment || 0)} / tháng
                          </p>
                        )}
                      </div>

                      <div className="text-right space-y-1">
                        <span className="text-sm font-black text-slate-900 block">
                          {formatVND(loan.totalAmount)}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-slate-400 font-medium justify-end">
                          <span>{isExpanded ? 'Thu gọn' : 'Chi tiết'}</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Expand Detail (Requirement 11) */}
                    {isExpanded && (
                      <div className="bg-slate-50 p-5 border-t border-slate-100 space-y-3.5 text-xs">
                        
                        {isInstallment ? (
                          <div className="space-y-3">
                            <div className="flex justify-between font-bold text-slate-700">
                              <span>Tiến độ thanh toán kỳ:</span>
                              <span className="text-indigo-600 font-black">{loan.paidTerms}/{loan.totalTerms} Kỳ</span>
                            </div>
                            
                            {/* Progress bar */}
                            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-indigo-500 h-full transition-all"
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-[10px] text-slate-400 font-medium pt-1">
                              <div>
                                <p>Đã trả: {formatVND((loan.paidTerms || 0) * (loan.monthlyPayment || 0))}</p>
                              </div>
                              <div className="text-right">
                                <p>Cần trả tiếp: {formatVND(((loan.totalTerms || 0) - (loan.paidTerms || 0)) * (loan.monthlyPayment || 0))}</p>
                              </div>
                            </div>

                            {/* Payment trigger */}
                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={() => handlePayTerm(loan)}
                                disabled={(loan.paidTerms || 0) >= (loan.totalTerms || 1)}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-2 rounded-xl text-xs transition"
                              >
                                {(loan.paidTerms || 0) >= (loan.totalTerms || 1) ? 'Đã tất toán xong' : isOwed ? 'Thanh toán 1 kỳ' : 'Thu hồi nợ 1 kỳ'}
                              </button>
                              <button
                                onClick={() => handleDeleteCashflowItem(loan.id)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                                title="Xóa khoản"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          // Single Payment Details
                          <div className="space-y-3">
                            <p className="text-slate-600 font-medium">Khoản vay này thanh toán toàn bộ một lần vào ngày đáo hạn.</p>
                            {loan.notes && <p className="italic text-slate-400">Ghi chú: "{loan.notes}"</p>}
                            
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSettleOneTimeLoan(loan)}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl transition"
                              >
                                {isOwed ? 'Tất toán toàn bộ nợ' : 'Thu hồi toàn bộ nợ'}
                              </button>
                              <button
                                onClick={() => handleDeleteCashflowItem(loan.id)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}

                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        // Investments display
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            Danh mục tài sản đầu tư ({investmentsList.length})
          </h4>

          {investmentsList.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-100 text-center space-y-2">
              <Briefcase className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-400 font-medium">Chưa ghi sổ danh mục đầu tư nào.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {investmentsList.map(inv => {
                const yieldPct = inv.yieldPercent || 0;
                const isProfit = yieldPct >= 0;

                return (
                  <div key={inv.id} className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs space-y-4">
                    
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h5 className="font-bold text-slate-900 text-sm flex items-center gap-1">
                          <PiggyBank className="w-4 h-4 text-indigo-600" /> {inv.name}
                        </h5>
                        {inv.notes && <p className="text-[10px] text-slate-400 italic">"{inv.notes}"</p>}
                      </div>
                      <button
                        onClick={() => handleDeleteCashflowItem(inv.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Gốc đầu tư</p>
                        <p className="font-black text-slate-800">{formatVND(inv.initialCost || inv.totalAmount)}</p>
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Giá trị hiện tại</p>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            defaultValue={inv.currentValue || inv.totalAmount}
                            onBlur={(e) => handleUpdateInvestmentValue(inv, e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-800 focus:outline-none focus:border-indigo-500 text-xs"
                            title="Bấm vào để nhập định giá mới rồi click ra ngoài để lưu"
                          />
                        </div>
                      </div>

                      <div className="space-y-0.5 text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Hiệu suất lời/lỗ</p>
                        <p className={`font-black flex items-center justify-end gap-0.5 text-xs ${isProfit ? 'text-emerald-600' : 'text-red-500'}`}>
                          {isProfit ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                          {isProfit ? '+' : ''}{yieldPct.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <p className="text-[9px] text-slate-400 text-center italic">Tip: Click vào ô định giá và chỉnh sửa giá trị mới của tài sản rồi bấm chuột ra ngoài để cập nhật tự động.</p>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
