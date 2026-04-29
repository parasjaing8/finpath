import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@finpath_fx_rates';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FX_URL = 'https://open.er-api.com/v6/latest/USD';

export type FxRates = Record<string, number>;

interface CachedRates {
  rates: FxRates;
  fetchedAt: number;
}

// Static fallback rates (USD base) — used when offline and no cache exists.
const FALLBACK_RATES: FxRates = {
  USD: 1, EUR: 0.92, GBP: 0.79, AUD: 1.53, CAD: 1.36, SGD: 1.34, AED: 3.67,
  INR: 83.5, CHF: 0.90, JPY: 149.0, NZD: 1.63, SEK: 10.4, NOK: 10.6,
  DKK: 6.88, HKD: 7.82, MYR: 4.70, THB: 35.0, IDR: 15700, PHP: 56.0,
  ZAR: 18.5, BRL: 5.0, MXN: 17.5, SAR: 3.75, QAR: 3.64, KWD: 0.307,
  BHD: 0.376, OMR: 0.385, KRW: 1330, TWD: 31.5,
};

let memCache: CachedRates | null = null;

export async function getFxRates(): Promise<FxRates> {
  // In-memory cache
  if (memCache && Date.now() - memCache.fetchedAt < CACHE_TTL_MS) {
    return memCache.rates;
  }

  // AsyncStorage cache
  try {
    const stored = await AsyncStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed: CachedRates = JSON.parse(stored);
      if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
        memCache = parsed;
        return parsed.rates;
      }
    }
  } catch (_) {}

  // Network fetch
  try {
    const res = await fetch(FX_URL, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.result === 'success' && data.rates) {
      const cached: CachedRates = { rates: data.rates as FxRates, fetchedAt: Date.now() };
      memCache = cached;
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cached));
      return cached.rates;
    }
  } catch (_) {}

  // Offline fallback: use stale cache or static rates
  try {
    const stored = await AsyncStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed: CachedRates = JSON.parse(stored);
      memCache = parsed;
      return parsed.rates;
    }
  } catch (_) {}

  return FALLBACK_RATES;
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
