import {
  Transaction,
  Wallet,
  BudgetLimit,
  SavingGoal,
  FixedBill,
  CashflowItem,
  MemberRole
} from '../types';

export const getSpreadsheetId = (): string => {
  return localStorage.getItem('family_spreadsheet_id') || '1z8fcG1DADCp8XTGibOXviZJ4GhtInv2c_1Znq53PDcw';
};

export const setSpreadsheetId = (id: string) => {
  localStorage.setItem('family_spreadsheet_id', id);
};

const REQUIRED_SHEETS = ['Giao_Dich', 'Vi_The', 'Han_Muc', 'Muc_Tieu', 'Hoa_Don', 'Vay_Dau_Tu'];

interface SheetProperties {
  properties: {
    title: string;
  };
}

/**
 * Ensures that all necessary sheet tabs exist in the Google Sheet.
 * Creates any missing sheet tabs automatically.
 */
export const ensureSheetsExist = async (accessToken: string): Promise<string[]> => {
  if (!accessToken) throw new Error('Không tìm thấy token xác thực Google.');

  const spreadsheetId = getSpreadsheetId();

  // 1. Fetch current sheets
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Lỗi khi đọc thông tin Google Sheet:', errText);
    throw new Error('Không thể kết nối đến Google Sheet. Hãy chắc chắn bạn đã cấp quyền truy cập và Sheet ID chính xác.');
  }

  const data = await response.json();
  const existingSheets: string[] = (data.sheets || []).map(
    (sheet: SheetProperties) => sheet.properties.title
  );

  const missingSheets = REQUIRED_SHEETS.filter(name => !existingSheets.includes(name));

  if (missingSheets.length === 0) {
    return existingSheets;
  }

  // 2. Create missing sheets
  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const requests = missingSheets.map(title => ({
    addSheet: {
      properties: { title }
    }
  }));

  const updateResponse = await fetch(batchUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!updateResponse.ok) {
    const errText = await updateResponse.text();
    console.error('Lỗi khi tạo sheet mới:', errText);
    throw new Error('Lỗi tự động tạo các sheet name trong file Google Sheet.');
  }

  return [...existingSheets, ...missingSheets];
};

/**
 * Loads all 6 data types from Google Sheets.
 */
export const loadAllFromGoogleSheets = async (
  accessToken: string
): Promise<{
  transactions: Transaction[];
  wallets: Wallet[];
  budgets: BudgetLimit[];
  savings: SavingGoal[];
  bills: FixedBill[];
  cashflow: CashflowItem[];
} | null> => {
  if (!accessToken) throw new Error('Không tìm thấy token xác thực Google.');

  const spreadsheetId = getSpreadsheetId();
  // Ensure the sheets exist first
  await ensureSheetsExist(accessToken);

  const ranges = REQUIRED_SHEETS.map(sheet => `${sheet}!A1:Z2000`);
  const queryParams = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${queryParams}&valueRenderOption=UNFORMATTED_VALUE`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Lỗi khi tải dữ liệu từ Google Sheets:', errText);
    throw new Error('Không thể tải dữ liệu từ Google Sheet. Vui lòng kiểm tra lại quyền truy cập hoặc ID bảng tính.');
  }

  const data = await response.json();
  const valueRanges = data.valueRanges || [];

  const getRowsForSheet = (sheetName: string): any[][] => {
    const vr = valueRanges.find((item: any) => item.range.startsWith(`'${sheetName}'`) || item.range.startsWith(sheetName));
    return vr?.values || [];
  };

  const transactionRows = getRowsForSheet('Giao_Dich');
  const walletRows = getRowsForSheet('Vi_The');
  const budgetRows = getRowsForSheet('Han_Muc');
  const savingRows = getRowsForSheet('Muc_Tieu');
  const billRows = getRowsForSheet('Hoa_Don');
  const cashflowRows = getRowsForSheet('Vay_Dau_Tu');

  // Parse Transactions
  const transactions: Transaction[] = [];
  if (transactionRows.length > 1) {
    for (let i = 1; i < transactionRows.length; i++) {
      const row = transactionRows[i];
      if (!row || row.length < 3) continue;
      transactions.push({
        id: String(row[0] || `tx-${Math.random().toString(36).substring(2, 9)}`),
        date: String(row[1] || new Date().toISOString().split('T')[0]),
        amount: Number(row[2]) || 0,
        type: row[3] === 'Thu nhập' ? 'income' : 'expense',
        category: String(row[4] || 'Khác'),
        walletId: String(row[5] || 'cash'),
        walletName: String(row[5] || 'Tiền mặt'),
        member: (row[6] as MemberRole) || 'Khác',
        notes: String(row[7] || ''),
        createdBy: '',
        createdAt: new Date()
      });
    }
  }

  // Parse Wallets
  const wallets: Wallet[] = [];
  if (walletRows.length > 1) {
    for (let i = 1; i < walletRows.length; i++) {
      const row = walletRows[i];
      if (!row || row.length < 2) continue;
      const typeStr = row[4];
      const type: 'cash' | 'credit' | 'bank' | 'e-wallet' = 
        typeStr === 'Tiền mặt' ? 'cash' : 
        typeStr === 'Thẻ tín dụng' ? 'credit' : 
        typeStr === 'Thẻ ngân hàng' ? 'bank' : 'e-wallet';
      wallets.push({
        id: String(row[0] || `wallet-${Math.random().toString(36).substring(2, 9)}`),
        name: String(row[1] || 'Ví mới'),
        member: (row[2] as MemberRole) || 'Khác',
        balance: Number(row[3]) || 0,
        type,
        createdBy: '',
        createdAt: new Date()
      });
    }
  }

  // Parse Budgets
  const budgets: BudgetLimit[] = [];
  if (budgetRows.length > 1) {
    for (let i = 1; i < budgetRows.length; i++) {
      const row = budgetRows[i];
      if (!row || row.length < 2) continue;
      budgets.push({
        id: `budget-${Math.random().toString(36).substring(2, 9)}`,
        category: String(row[0] || 'Tất cả'),
        limitAmount: Number(row[1]) || 0,
        alertThreshold: Number(row[2]) || 80,
        createdBy: ''
      });
    }
  }

  // Parse Savings
  const savings: SavingGoal[] = [];
  if (savingRows.length > 1) {
    for (let i = 1; i < savingRows.length; i++) {
      const row = savingRows[i];
      if (!row || row.length < 2) continue;
      savings.push({
        id: `saving-${Math.random().toString(36).substring(2, 9)}`,
        name: String(row[0] || ''),
        targetAmount: Number(row[1]) || 0,
        currentAmount: Number(row[2]) || 0,
        targetDate: String(row[3] || new Date().toISOString().split('T')[0]),
        notes: String(row[4] || ''),
        createdBy: '',
        createdAt: new Date()
      });
    }
  }

  // Parse Bills
  const bills: FixedBill[] = [];
  if (billRows.length > 1) {
    for (let i = 1; i < billRows.length; i++) {
      const row = billRows[i];
      if (!row || row.length < 2) continue;
      bills.push({
        id: `bill-${Math.random().toString(36).substring(2, 9)}`,
        name: String(row[0] || ''),
        amount: Number(row[1]) || 0,
        dueDay: Number(row[2]) || 1,
        category: String(row[3] || 'Khác'),
        lastPaidDate: String(row[4] || ''),
        createdBy: ''
      });
    }
  }

  // Parse Cashflow
  const cashflow: CashflowItem[] = [];
  if (cashflowRows.length > 1) {
    for (let i = 1; i < cashflowRows.length; i++) {
      const row = cashflowRows[i];
      if (!row || row.length < 3) continue;
      const typeStr = row[1];
      const type: 'loan_to_pay' | 'loan_to_receive' | 'investment' = 
        typeStr === 'Khoản nợ' ? 'loan_to_pay' : 
        typeStr === 'Cho vay' ? 'loan_to_receive' : 'investment';
      cashflow.push({
        id: String(row[0] || `cf-${Math.random().toString(36).substring(2, 9)}`),
        type,
        name: String(row[2] || ''),
        totalAmount: Number(row[3]) || 0,
        loanType: row[4] === 'Trả một lần' ? 'one_time' : 'installment',
        monthlyPayment: Number(row[5]) || 0,
        totalTerms: Number(row[6]) || 0,
        paidTerms: Number(row[7]) || 0,
        currentValue: Number(row[8]) || 0,
        yieldPercent: Number(row[9]) || 0,
        notes: String(row[10] || ''),
        createdBy: '',
        createdAt: new Date()
      });
    }
  }

  return {
    transactions,
    wallets,
    budgets,
    savings,
    bills,
    cashflow
  };
};

/**
 * Truncates and updates all 6 sheet tabs with latest data.
 */
export const syncAllToGoogleSheets = async (
  accessToken: string,
  data: {
    transactions: Transaction[];
    wallets: Wallet[];
    budgets: BudgetLimit[];
    savings: SavingGoal[];
    bills: FixedBill[];
    cashflow: CashflowItem[];
  }
): Promise<void> => {
  if (!accessToken) throw new Error('Cần đăng nhập Google để đồng bộ.');

  const spreadsheetId = getSpreadsheetId();

  // 1. Ensure sheet tabs exist
  await ensureSheetsExist(accessToken);

  // 2. Clear old ranges to avoid ghost rows
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`;
  const clearRes = await fetch(clearUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ranges: REQUIRED_SHEETS.map(sheet => `${sheet}!A1:Z2000`)
    }),
  });

  if (!clearRes.ok) {
    console.warn('Lỗi khi dọn dẹp dữ liệu cũ trên Google Sheets:', await clearRes.text());
  }

  // 3. Format new data to grid values
  const transactionRows = [
    ['Mã GD', 'Ngày', 'Số tiền', 'Loại', 'Danh mục', 'Ví/Thẻ', 'Thành viên', 'Ghi chú'],
    ...data.transactions.map(t => [
      t.id,
      t.date,
      t.amount,
      t.type === 'income' ? 'Thu nhập' : 'Chi tiêu',
      t.category,
      t.walletName || t.walletId,
      t.member,
      t.notes
    ])
  ];

  const walletRows = [
    ['Mã Ví', 'Tên Ví', 'Thành viên sở hữu', 'Số dư', 'Loại ví'],
    ...data.wallets.map(w => [
      w.id,
      w.name,
      w.member,
      w.balance,
      w.type === 'cash' ? 'Tiền mặt' : w.type === 'credit' ? 'Thẻ tín dụng' : w.type === 'bank' ? 'Thẻ ngân hàng' : 'Ví điện tử'
    ])
  ];

  const budgetRows = [
    ['Danh mục', 'Hạn mức chi tiêu', 'Ngưỡng cảnh báo (%)'],
    ...data.budgets.map(b => [
      b.category,
      b.limitAmount,
      b.alertThreshold
    ])
  ];

  const savingRows = [
    ['Tên mục tiêu', 'Số tiền cần đạt', 'Đã tiết kiệm', 'Ngày đến hạn', 'Ghi chú'],
    ...data.savings.map(s => [
      s.name,
      s.targetAmount,
      s.currentAmount,
      s.targetDate,
      s.notes || ''
    ])
  ];

  const billRows = [
    ['Tên hóa đơn', 'Số tiền', 'Ngày thanh toán hàng tháng', 'Danh mục', 'Lần thanh toán cuối'],
    ...data.bills.map(b => [
      b.name,
      b.amount,
      b.dueDay,
      b.category,
      b.lastPaidDate || ''
    ])
  ];

  const cashflowRows = [
    ['Mã', 'Phân loại', 'Tên khoản', 'Tổng số tiền', 'Hình thức trả', 'Trả hàng tháng', 'Tổng số kỳ', 'Kỳ đã trả', 'Giá trị hiện tại', 'Lợi tức (%)', 'Ghi chú'],
    ...data.cashflow.map(c => [
      c.id,
      c.type === 'loan_to_pay' ? 'Khoản nợ' : c.type === 'loan_to_receive' ? 'Cho vay' : 'Đầu tư',
      c.name,
      c.totalAmount,
      c.type !== 'investment' ? (c.loanType === 'one_time' ? 'Trả một lần' : 'Trả góp') : '',
      c.monthlyPayment || 0,
      c.totalTerms || 0,
      c.paidTerms || 0,
      c.currentValue || 0,
      c.yieldPercent || 0,
      c.notes || ''
    ])
  ];

  // 4. Send batchUpdate to write all data
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  const body = {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: 'Giao_Dich!A1', values: transactionRows },
      { range: 'Vi_The!A1', values: walletRows },
      { range: 'Han_Muc!A1', values: budgetRows },
      { range: 'Muc_Tieu!A1', values: savingRows },
      { range: 'Hoa_Don!A1', values: billRows },
      { range: 'Vay_Dau_Tu!A1', values: cashflowRows }
    ]
  };

  const writeRes = await fetch(updateUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!writeRes.ok) {
    const errText = await writeRes.text();
    console.error('Lỗi khi ghi dữ liệu xuống Google Sheets:', errText);
    throw new Error('Đồng bộ thất bại. Không thể ghi đè dữ liệu lên các bảng tính Google Sheets.');
  }
};
