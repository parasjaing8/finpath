/**
 * inflation.test.ts
 *
 * Tests for utils/inflation.ts — pure compound-interest utilities.
 */

import { inflationAdjusted, presentValue } from '../utils/inflation';

describe('inflationAdjusted', () => {
  test('Rs 1L at 6% inflation grows to correct future value in 10 years', () => {
    // 100000 * 1.06^10 = 179,084.77
    expect(inflationAdjusted(100_000, 6, 10)).toBeCloseTo(179_084.77, 0);
  });

  test('Rs 50K monthly expense at 8% (medical) after 20 years', () => {
    // 50000 * 1.08^20 = 233,047.857... → nearest integer is 233,048
    expect(inflationAdjusted(50_000, 8, 20)).toBeCloseTo(233_048, 0);
  });

  test('zero inflation leaves amount unchanged', () => {
    expect(inflationAdjusted(200_000, 0, 15)).toBe(200_000);
  });

  test('0 years returns original amount regardless of inflation rate', () => {
    expect(inflationAdjusted(75_000, 6, 0)).toBe(75_000);
  });

  test('education expense at 10% inflation nearly triples in 12 years', () => {
    // 1.10^12 = 3.138
    const result = inflationAdjusted(30_000, 10, 12);
    expect(result).toBeGreaterThan(90_000);
    expect(result).toBeLessThan(100_000);
  });
});

describe('presentValue', () => {
  test('PV of Rs 1.79L discounted at 6% over 10 years is ~Rs 1L', () => {
    // 179084.77 / 1.06^10 ≈ 100,000
    expect(presentValue(179_084.77, 6, 10)).toBeCloseTo(100_000, 0);
  });

  test('zero discount rate returns the future amount unchanged', () => {
    expect(presentValue(500_000, 0, 10)).toBe(500_000);
  });

  test('inflationAdjusted and presentValue are inverse operations', () => {
    const amount = 250_000;
    const rate = 7;
    const years = 15;
    const fv = inflationAdjusted(amount, rate, years);
    const pv = presentValue(fv, rate, years);
    expect(pv).toBeCloseTo(amount, 0);
  });

  test('higher discount rate gives lower PV for the same future amount', () => {
    const pv6 = presentValue(1_000_000, 6, 20);
    const pv8 = presentValue(1_000_000, 8, 20);
    expect(pv6).toBeGreaterThan(pv8);
  });
});
