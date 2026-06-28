import React, { useState } from 'react';
import { 
  PieChart as PieIcon, 
  BarChart as BarIcon, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle,
  HelpCircle,
  PiggyBank,
  ChevronRight,
  Filter
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';
import { Transaction, BudgetLimit, FixedBill, MemberRole } from '../types';

interface AnalyticsTabProps {
  transactions: Transaction[];
  budgets: BudgetLimit[];
  bills: FixedBill[];
}

const COLORS = [
  '#10B981', '#3B82F6', '#EC4899', '#F59E0B', 
  '#8B5CF6', '#EF4444', '#14B8A6', '#6366F1', '#6B7280'
];

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  transactions,
  budgets,
  bills
}) => {
  const [memberFilter, setMemberFilter] = useState<'Tất cả' | MemberRole>('Tất cả');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM

  const formatVND = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  // 1. Filter Transactions by month & member
  const filteredTxs = transactions.filter(t => {
    const isMonthMatch = t.date.startsWith(selectedMonth);
    const isMemberMatch = memberFilter === 'Tất cả' || t.member === memberFilter;
    return isMonthMatch && isMemberMatch;
  });

  const incomeTxs = filteredTxs.filter(t => t.type === 'income');
  const expenseTxs = filteredTxs.filter(t => t.type === 'expense');

  const totalIncome = incomeTxs.reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = expenseTxs.reduce((sum, t) => sum + t.amount, 0);
  const netSavings = totalIncome - totalExpense;

  // 2. Prepare Category Breakdown Data (Pie Chart)
  const categoryMap: { [key: string]: number } = {};
  expenseTxs.forEach(t => {
    categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
  });

  const pieData = Object.keys(categoryMap).map(cat => ({
    name: cat,
    value: categoryMap[cat]
  })).sort((a, b) => b.value - a.value);

  // 3. Monthly Income vs Expense Comparison Data (Bar Chart)
  const barData = [
    {
      name: 'Tháng này',
      'Thu nhập': totalIncome,
      'Chi tiêu': totalExpense
    }
  ];

  // 4. Spending limit status
  const limitStatus = budgets.map(b => {
    let spent = 0;
    if (b.category === 'Tất cả') {
      spent = totalExpense;
    } else {
      spent = expenseTxs
        .filter(t => t.category === b.category)
        .reduce((sum, t) => sum + t.amount, 0);
    }
    const ratio = b.limitAmount > 0 ? (spent / b.limitAmount) * 100 : 0;
    return {
      category: b.category,
      limit: b.limitAmount,
      spent,
      ratio,
      exceeded: spent > b.limitAmount
    };
  });

  // 5. REQUIREMENT 12: Next Month Spend Forecasting System
  // Fixed expenses from due bills
  const totalFixedBills = bills.reduce((sum, b) => sum + b.amount, 0);
  
  // Variable expenses calculated from current month's variable spend
  // Excluding categories that might overlap with fixed bills
  const variableExpenses = expenseTxs
    .filter(t => t.category !== 'Nhà cửa & Tiền ích' && t.category !== 'Trả nợ')
    .reduce((sum, t) => sum + t.amount, 0);

  // Forecasted next month spend
  const forecastedExpense = totalFixedBills + variableExpenses;

  // Expected income is the current month's regular income
  // (Salary, dividends, gifts, etc.)
  const forecastedIncome = totalIncome;

  const forecastedNet = forecastedIncome - forecastedExpense;
  const isNegativeRisk = forecastedNet < 0;

  // Suggestions on what to cut down
  const topSpentCategories = [...pieData].slice(0, 2);

  return (
    <div className="space-y-6">
      
      {/* Filters Bar (Requirement 3) */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-slate-700">Bộ lọc chi tiêu:</span>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {/* Member Filters */}
          <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200 flex-1 sm:flex-initial">
            {(['Tất cả', 'Chồng', 'Vợ', 'Khác'] as const).map(option => (
              <button
                key={option}
                onClick={() => setMemberFilter(option)}
                className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl transition ${
                  memberFilter === option
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          {/* Month selector */}
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-indigo-500"
          />
        </div>

      </div>

      {/* Main Charts area */}
      {filteredTxs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm text-center space-y-2">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700">Không tìm thấy dữ liệu chi tiêu</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">Chưa có giao dịch nào được ghi nhận cho bộ lọc đã chọn trong tháng này.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Pie Chart: spending by category (7 spans) */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h4 className="text-sm font-bold text-slate-900 border-b border-slate-50 pb-3 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-indigo-600" /> Cơ cấu chi tiêu theo danh mục
            </h4>
            
            {pieData.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-12">Không có khoản chi tiêu nào trong thời gian này.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                
                {/* Visual Chart */}
                <div className="md:col-span-7 h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatVND(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend & Details */}
                <div className="md:col-span-5 space-y-2 max-h-[220px] overflow-y-auto">
                  {pieData.map((item, idx) => {
                    const pct = totalExpense > 0 ? (item.value / totalExpense) * 100 : 0;
                    return (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 truncate">
                          <span 
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                          />
                          <span className="font-semibold text-slate-700 truncate">{item.name}</span>
                        </div>
                        <span className="font-bold text-slate-900">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>

              </div>
            )}
          </div>

          {/* Bar Chart: income vs expense comparison (5 spans) */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h4 className="text-sm font-bold text-slate-900 border-b border-slate-50 pb-3 flex items-center gap-2">
              <BarIcon className="w-4 h-4 text-indigo-600" /> So sánh Thu nhập & Chi tiêu
            </h4>

            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => formatVND(Number(value))} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Thu nhập" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Chi tiêu" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Quick balance overview */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-600">Thặng dư tích lũy:</span>
              <span className={`font-black ${netSavings >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {netSavings >= 0 ? '+' : ''}{formatVND(netSavings)}
              </span>
            </div>

          </div>

        </div>
      )}

      {/* Spending Limits comparison list */}
      {limitStatus.length > 0 && filteredTxs.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-slate-900 border-b border-slate-50 pb-3">
            Báo cáo tiến độ Hạn mức chi tiêu ({selectedMonth})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {limitStatus.map(status => (
              <div key={status.category} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">
                    {status.category === 'Tất cả' ? 'Hạn mức Tổng chung' : `Danh mục: ${status.category}`}
                  </span>
                  <span className={`font-bold ${status.exceeded ? 'text-red-600' : 'text-indigo-600'}`}>
                    {status.ratio.toFixed(0)}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${status.exceeded ? 'bg-rose-500' : 'bg-indigo-500'}`}
                    style={{ width: `${Math.min(status.ratio, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                  <span>Đã tiêu: {formatVND(status.spent)}</span>
                  <span>Giới hạn: {formatVND(status.limit)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REQUIREMENT 12: Next Month Forecast Card */}
      <div className="bg-gradient-to-r from-gray-900 via-slate-800 to-gray-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        
        {/* Background shapes */}
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-y-12 translate-x-12">
          <PiggyBank className="w-64 h-64" />
        </div>

        <div className="space-y-4 relative">
          
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <PiggyBank className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold tracking-wider text-emerald-400 uppercase">Dự báo tài chính tháng tới ({new Date(new Date().getFullYear(), new Date().getMonth() + 1).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            
            <div className="space-y-1">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Dự kiến Thu nhập</p>
              <h5 className="text-xl font-extrabold text-teal-400">{formatVND(forecastedIncome)}</h5>
              <p className="text-[9px] text-slate-400 font-medium">Bằng thu nhập ổn định tháng hiện tại</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Dự kiến Chi tiêu</p>
              <h5 className="text-xl font-extrabold text-rose-400">{formatVND(forecastedExpense)}</h5>
              <p className="text-[9px] text-slate-400 font-medium">
                Gồm hóa đơn cố định ({formatVND(totalFixedBills)}) + phí sinh hoạt khác
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Kết dư dự kiến</p>
              <h5 className={`text-xl font-extrabold ${isNegativeRisk ? 'text-red-400' : 'text-emerald-400'}`}>
                {isNegativeRisk ? '' : '+'}{formatVND(forecastedNet)}
              </h5>
              <p className="text-[9px] text-slate-400 font-medium">Dòng tiền khả dụng còn lại</p>
            </div>

          </div>

          {/* Verdict and warning message */}
          <div className="border-t border-slate-700/60 pt-4 mt-2">
            {isNegativeRisk ? (
              <div className="flex items-start gap-2.5 text-xs text-red-200 bg-red-500/10 p-3 rounded-2xl border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-red-300">CẢNH BÁO CHI VƯỢT THU: Dòng tiền dự kiến tháng tới có nguy cơ bị âm!</p>
                  <p className="text-[11px] text-slate-300">
                    Hãy tối ưu hóa ngân sách của bạn ngay hôm nay. 
                    {topSpentCategories.length > 0 && (
                      <span> Đặc biệt cân nhắc cắt giảm các danh mục đang tiêu nhiều nhất như: <strong>{topSpentCategories.map(c => c.name).join(', ')}</strong>.</span>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 text-xs text-emerald-200 bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-emerald-300">CÂN ĐỐI TỐT: Kế hoạch thu chi tháng sau rất an toàn!</p>
                  <p className="text-[11px] text-slate-300">
                    Bạn dự kiến sẽ dư dả khoảng <strong>{formatVND(forecastedNet)}</strong>. 
                    Hãy trích tối thiểu 50% số tiền này để gửi thêm vào các <strong>Mục tiêu tiết kiệm</strong> của gia đình để tối đa hóa tài sản!
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
