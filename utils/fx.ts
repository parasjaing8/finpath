// Bundled FX rates (USD base). Updated with each app release — April 2026.
// App is offline-first; no network fetch. Refresh rates monthly before release.

export type FxRates = Record<string, number>;

const BUNDLED_RATES: FxRates = {
  USD: 1,
  INR: 84.0,
  EUR: 0.91,
  GBP: 0.78,
  AUD: 1.58,
  CAD: 1.39,
  SGD: 1.35,
  AED: 3.67,   // hard peg
  CHF: 0.89,
  JPY: 152.0,
  NZD: 1.73,
  SEK: 10.5,
  NOK: 10.8,
  DKK: 6.90,
  HKD: 7.78,
  MYR: 4.45,
  THB: 35.5,
  IDR: 16200,
  PHP: 57.5,
  ZAR: 18.8,
  BRL: 5.20,
  MXN: 17.2,
  SAR: 3.75,   // peg
  QAR: 3.64,   // peg
  KWD: 0.307,
  BHD: 0.376,  // peg
  OMR: 0.385,  // peg
  KRW: 1380,
  TWD: 32.0,
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
