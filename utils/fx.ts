// Bundled FX rates (USD base). Source: open.er-api.com — 29 April 2026.
// App is offline-first; no network fetch. Update rates before each release.

export type FxRates = Record<string, number>;

const BUNDLED_RATES: FxRates = {
  USD: 1,
  INR: 94.62,
  EUR: 0.8541,
  GBP: 0.7403,
  AUD: 1.3931,
  CAD: 1.3673,
  SGD: 1.2764,
  AED: 3.6725,  // hard peg
  CHF: 0.7895,
  JPY: 159.54,
  NZD: 1.6991,
  SEK: 9.267,
  NOK: 9.318,
  DKK: 6.378,
  HKD: 7.837,
  MYR: 3.952,
  THB: 32.51,
  IDR: 17266,
  PHP: 61.18,
  ZAR: 16.55,
  BRL: 4.985,
  MXN: 17.40,
  SAR: 3.75,    // peg
  QAR: 3.64,    // peg
  KWD: 0.3077,
  BHD: 0.376,   // peg
  OMR: 0.3845,  // peg
  KRW: 1473.3,
  TWD: 31.57,
};

/** Returns bundled FX rates. Async signature kept for call-site compatibility. */
export async function getFxRates(): Promise<FxRates> {
  return BUNDLED_RATES;
}

/** Convert amount from one currency to another via USD pivot. */
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: FxRates,
): number {
  if (from === to) return amount;
  const fromRate = rates[from] ?? 1;
  const toRate = rates[to] ?? 1;
  return amount * (toRate / fromRate);
}
