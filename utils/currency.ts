const GOLD_API_KEY = ''; // Set your goldapi.io key here

export async function fetchGoldPrice(metal: 'XAU' | 'XAG', currency: 'INR' | 'USD'): Promise<number> {
  if (!GOLD_API_KEY) {
    // Fallback approximate prices per gram in INR
    if (currency === 'INR') return metal === 'XAU' ? 6500 : 80;
    return metal === 'XAU' ? 78 : 0.95;
  }
  const response = await fetch(`https://www.goldapi.io/api/${metal}/${currency}`, {
    headers: { 'x-access-token': GOLD_API_KEY },
  });
  const data = await response.json();
  return data.price_gram_24k;
}

const EXCHANGE_RATE_CACHE: { rate: number; timestamp: number } = { rate: 83, timestamp: 0 };
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function getUSDToINR(): Promise<number> {
  const now = Date.now();
  if (now - EXCHANGE_RATE_CACHE.timestamp < CACHE_DURATION) {
    return EXCHANGE_RATE_CACHE.rate;
  }
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await response.json();
    const rate = data.rates?.INR ?? 83;
    EXCHANGE_RATE_CACHE.rate = rate;
    EXCHANGE_RATE_CACHE.timestamp = now;
    return rate;
  } catch {
    return EXCHANGE_RATE_CACHE.rate;
  }
}

export function convertToINR(amount: number, currency: string, usdToInrRate: number): number {
  if (currency === 'USD') return amount * usdToInrRate;
  return amount;
}
