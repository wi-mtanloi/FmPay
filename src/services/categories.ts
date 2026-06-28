import { SavingGoal } from '../types';

export const DEFAULT_CATEGORIES = {
  expense: ['Ăn uống', 'Di chuyển', 'Mua sắm', 'Nhà cửa & Tiền ích', 'Sức khỏe', 'Giải trí', 'Giáo dục', 'Trả nợ', 'Khác'],
  income: ['Lương & Thưởng', 'Kinh doanh', 'Đầu tư', 'Quà tặng', 'Khác']
};

export const getCustomCategories = (familyId: string): { expense: string[]; income: string[] } => {
  const stored = localStorage.getItem(`family_${familyId}_categories`);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        expense: Array.isArray(parsed?.expense) ? parsed.expense : [...DEFAULT_CATEGORIES.expense],
        income: Array.isArray(parsed?.income) ? parsed.income : [...DEFAULT_CATEGORIES.income]
      };
    } catch (e) {
      console.error('Lỗi khi đọc danh mục tùy chỉnh:', e);
    }
  }
  return {
    expense: [...DEFAULT_CATEGORIES.expense],
    income: [...DEFAULT_CATEGORIES.income]
  };
};

export const saveCustomCategories = (familyId: string, categories: { expense: string[]; income: string[] }) => {
  localStorage.setItem(`family_${familyId}_categories`, JSON.stringify(categories));
};

export const getAllCategoriesWithSavings = (
  familyId: string,
  savings: SavingGoal[]
): { expense: string[]; income: string[] } => {
  const custom = getCustomCategories(familyId || 'default');
  
  // Tự động thêm các mục tiêu tiết kiệm vào mục chi
  savings.forEach(saving => {
    if (saving.name) {
      const savingCatName = `🎯 Tiết kiệm: ${saving.name}`;
      if (!custom.expense.includes(savingCatName)) {
        custom.expense.push(savingCatName);
      }
    }
  });
  
  return custom;
};
