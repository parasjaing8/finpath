export function inflationAdjusted(amount: number, inflationRate: number, years: number): number {
  return amount * Math.pow(1 + inflationRate / 100, years);
}

export function presentValue(futureAmount: number, discountRate: number, years: number): number {
  return futureAmount / Math.pow(1 + discountRate / 100, years);
}
