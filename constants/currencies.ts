export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  flag: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'INR', symbol: '₹',    name: 'Indian Rupee',         flag: '🇮🇳' },
  { code: 'USD', symbol: '$',    name: 'US Dollar',            flag: '🇺🇸' },
  { code: 'EUR', symbol: '€',    name: 'Euro',                 flag: '🇪🇺' },
  { code: 'GBP', symbol: '£',    name: 'British Pound',        flag: '🇬🇧' },
  { code: 'AUD', symbol: 'A$',   name: 'Australian Dollar',    flag: '🇦🇺' },
  { code: 'CAD', symbol: 'C$',   name: 'Canadian Dollar',      flag: '🇨🇦' },
  { code: 'SGD', symbol: 'S$',   name: 'Singapore Dollar',     flag: '🇸🇬' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham',           flag: '🇦🇪' },
  { code: 'CHF', symbol: 'Fr',   name: 'Swiss Franc',          flag: '🇨🇭' },
  { code: 'JPY', symbol: '¥',    name: 'Japanese Yen',         flag: '🇯🇵' },
  { code: 'NZD', symbol: 'NZ$',  name: 'New Zealand Dollar',   flag: '🇳🇿' },
  { code: 'SEK', symbol: 'kr',   name: 'Swedish Krona',        flag: '🇸🇪' },
  { code: 'NOK', symbol: 'kr',   name: 'Norwegian Krone',      flag: '🇳🇴' },
  { code: 'DKK', symbol: 'kr',   name: 'Danish Krone',         flag: '🇩🇰' },
  { code: 'HKD', symbol: 'HK$',  name: 'Hong Kong Dollar',     flag: '🇭🇰' },
  { code: 'MYR', symbol: 'RM',   name: 'Malaysian Ringgit',    flag: '🇲🇾' },
  { code: 'THB', symbol: '฿',    name: 'Thai Baht',            flag: '🇹🇭' },
  { code: 'IDR', symbol: 'Rp',   name: 'Indonesian Rupiah',    flag: '🇮🇩' },
  { code: 'PHP', symbol: '₱',    name: 'Philippine Peso',      flag: '🇵🇭' },
  { code: 'ZAR', symbol: 'R',    name: 'South African Rand',   flag: '🇿🇦' },
  { code: 'BRL', symbol: 'R$',   name: 'Brazilian Real',       flag: '🇧🇷' },
  { code: 'MXN', symbol: '$',    name: 'Mexican Peso',         flag: '🇲🇽' },
  { code: 'SAR', symbol: '﷼',   name: 'Saudi Riyal',          flag: '🇸🇦' },
  { code: 'QAR', symbol: '﷼',   name: 'Qatari Riyal',         flag: '🇶🇦' },
  { code: 'KWD', symbol: 'KD',   name: 'Kuwaiti Dinar',        flag: '🇰🇼' },
  { code: 'BHD', symbol: 'BD',   name: 'Bahraini Dinar',       flag: '🇧🇭' },
  { code: 'OMR', symbol: '﷼',   name: 'Omani Rial',           flag: '🇴🇲' },
  { code: 'KRW', symbol: '₩',    name: 'South Korean Won',     flag: '🇰🇷' },
  { code: 'TWD', symbol: 'NT$',  name: 'Taiwan Dollar',        flag: '🇹🇼' },
];

export const COMMON_CURRENCY_CODES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'SGD'];

export function getCurrencyByCode(code: string): CurrencyInfo | undefined {
  return CURRENCIES.find(c => c.code === code);
}

export function filterCurrencies(query: string): CurrencyInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return CURRENCIES;
  return CURRENCIES.filter(
    c =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q),
  );
}
