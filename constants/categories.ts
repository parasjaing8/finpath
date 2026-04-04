export const ASSET_CATEGORIES = [
  { key: 'ESOP_RSU', label: 'ESOP/RSU', icon: 'briefcase-outline' },
  { key: 'STOCKS', label: 'Stocks', icon: 'chart-line' },
  { key: 'MUTUAL_FUND', label: 'Mutual Fund', icon: 'chart-areaspline' },
  { key: 'SAVINGS', label: 'Savings', icon: 'piggy-bank-outline' },
  { key: 'GOLD_SILVER', label: 'Gold/Silver', icon: 'gold' },
  { key: 'PF', label: 'PF', icon: 'shield-check-outline' },
  { key: 'NPS', label: 'NPS', icon: 'account-clock-outline' },
  { key: 'REAL_ESTATE', label: 'Real Estate', icon: 'home-outline' },
  { key: 'OTHERS', label: 'Others', icon: 'dots-horizontal-circle-outline' },
] as const;

export type AssetCategory = typeof ASSET_CATEGORIES[number]['key'];

export const EXPENSE_CATEGORIES = [
  { key: 'RENT', label: 'Housing', icon: 'home-city-outline', defaultInflation: 6 },
  { key: 'EMI', label: 'EMI', icon: 'credit-card-outline', defaultInflation: 0 },
  { key: 'GROCERIES', label: 'Food & Daily', icon: 'food-apple-outline', defaultInflation: 6 },
  { key: 'TRANSPORT', label: 'Transport', icon: 'car-outline', defaultInflation: 6 },
  { key: 'EDUCATION', label: 'Education', icon: 'school-outline', defaultInflation: 10 },
  { key: 'MEDICAL', label: 'Medical', icon: 'medical-bag', defaultInflation: 8 },
  { key: 'EVENTS', label: 'Events', icon: 'party-popper', defaultInflation: 6 },
  { key: 'INSURANCE', label: 'Insurance', icon: 'shield-outline', defaultInflation: 5 },
  { key: 'PENSION_INCOME', label: 'Pension/Income', icon: 'cash-plus', defaultInflation: 6 },
  { key: 'OTHERS', label: 'Others', icon: 'dots-horizontal-circle-outline', defaultInflation: 6 },
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]['key'];

export const EXPENSE_TYPES = [
  { key: 'CURRENT_RECURRING', label: 'Current Recurring' },
  { key: 'FUTURE_ONE_TIME', label: 'Future One-Time' },
  { key: 'FUTURE_RECURRING', label: 'Future Recurring' },
] as const;

export type ExpenseType = typeof EXPENSE_TYPES[number]['key'];

export const FREQUENCIES = [
  { key: 'MONTHLY', label: 'Monthly', multiplier: 12 },
  { key: 'QUARTERLY', label: 'Quarterly', multiplier: 4 },
  { key: 'HALF_YEARLY', label: 'Half Yearly', multiplier: 2 },
  { key: 'YEARLY', label: 'Yearly', multiplier: 1 },
] as const;

export type Frequency = typeof FREQUENCIES[number]['key'];

export const DEFAULT_INFLATION_RATES: Record<string, number> = {
  GENERAL: 6.0,
  EDUCATION: 10.0,
  MEDICAL: 8.0,
  FOOD: 6.0,
  REAL_ESTATE: 7.0,
  RENT: 6.0,
  EMI: 0.0,
  GROCERIES: 6.0,
  TRANSPORT: 6.0,
  EVENTS: 6.0,
  INSURANCE: 5.0,
  PENSION_INCOME: 6.0,
  OTHERS: 6.0,
};
