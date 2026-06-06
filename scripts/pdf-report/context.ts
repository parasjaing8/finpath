// context.ts — builds all computed state used by every page
import type { Asset, Expense, Profile, Goals } from '../../engine/types';
import { ASSET_CATEGORIES } from '../../engine/types';
import {
  getCurrencySymbol, getAge, calculateProjections,
  type CalculationOutput,
} from '../../engine/calculator';
import type { FxRates } from '../../utils/fx';

export type { Asset, Expense, Profile, Goals, CalculationOutput };
export { ASSET_CATEGORIES };

export const INFL_S = [5, 6, 7] as const;
export const RET_S  = [10, 12, 14] as const;

export interface ReportContext {
  // inputs
  profile:    Profile;
  goals:      Goals;
  assets:     Asset[];
  expenses:   Expense[];
  sipAmount:  number;
  sipReturn:  number;
  postReturn: number;
  stepUp:     number;
  // formatting
  cur: string;
  age: number;
  fmt: (v: number) => string;
  // scenario results
  base:        CalculationOutput;
  pessimistic: CalculationOutput;
  optimistic:  CalculationOutput;
  earlyRetire: CalculationOutput;
  sensiGrid:   number[][];          // [infl_idx][ret_idx] = depletion age
  // health score
  score:      number;
  scoreLabel: string;
  scoreColor: string;
  corpusPts:  number;
  planPts:    number;
  sipPts:     number;
  covPts:     number;
  // derived metrics
  inflYears:       number;
  pensionInflated: number;
  incReplace:      number;
  corpusProgress:  number;
  burden:          number;
  cov:             number;
  equityPct:       number;
  targetEquityPct: number;
  fiRatio:         number;
  debtPct:         number;
  goldPct:         number;
  targetYear:      number;
  sipGap:          number;
}

export function buildContext(
  profile:    Profile,
  goals:      Goals,
  assets:     Asset[],
  expenses:   Expense[],
  sipAmount:  number,
  sipReturn:  number,
  postReturn: number,
  stepUp:     number,
  fxRates:    FxRates,
): ReportContext {
  const cur = profile.currency;
  const age = getAge(profile.dob);
  const SYM = getCurrencySymbol(cur);

  function fmt(v: number): string {
    if (cur === 'INR') {
      if (v >= 1e7) return `${SYM}${(v / 1e7).toFixed(1)}Cr`;
      if (v >= 1e5) return `${SYM}${(v / 1e5).toFixed(1)}L`;
    } else {
      if (v >= 1e9) return `${SYM}${(v / 1e9).toFixed(1)}B`;
      if (v >= 1e6) return `${SYM}${(v / 1e6).toFixed(1)}M`;
    }
    if (v >= 1e3) return `${SYM}${(v / 1e3).toFixed(0)}K`;
    return `${SYM}${v.toFixed(0)}`;
  }

  // base scenario
  const base = calculateProjections({ profile, assets, expenses, goals, sipAmount, sipReturnRate: sipReturn, postSipReturnRate: postReturn, stepUpRate: stepUp, fxRates });

  function runScenario(sr: number, pr: number, infl: number, retAge?: number): CalculationOutput {
    try {
      const g = { ...goals, inflation_rate: infl, ...(retAge ? { retirement_age: retAge, sip_stop_age: retAge } : {}) };
      return calculateProjections({ profile, assets, expenses, goals: g, sipAmount, sipReturnRate: sr, postSipReturnRate: pr, stepUpRate: stepUp, fxRates });
    } catch { return base; }
  }

  const pessimistic = runScenario(10, 6, 7);
  const optimistic  = runScenario(14, 10, 5);
  const earlyRetire = runScenario(sipReturn, postReturn, goals.inflation_rate, 52);

  const sensiGrid = INFL_S.map(infl => RET_S.map(ret => {
    try {
      const out = calculateProjections({
        profile, assets, expenses,
        goals: { ...goals, inflation_rate: infl },
        sipAmount, sipReturnRate: ret,
        postSipReturnRate: Math.max(4, postReturn + (ret - sipReturn)),
        stepUpRate: stepUp, fxRates,
      });
      return out.failureAge > 0 ? out.failureAge : (goals.fire_target_age! + 1);
    } catch { return 0; }
  }));

  // score components
  const START = 22, REAL_R = 0.07;
  const worked   = Math.max(0, age - START);
  const totalYrs = Math.max(1, goals.retirement_age - START);
  const expFrac  = (Math.pow(1 + REAL_R, totalYrs) - 1) > 0
    ? (Math.pow(1 + REAL_R, worked) - 1) / (Math.pow(1 + REAL_R, totalYrs) - 1)
    : 0;
  const actFrac     = base.fireCorpus > 0 ? base.totalNetWorth / base.fireCorpus : 0;
  const onTrack     = expFrac > 0 ? Math.min(1, actFrac / expFrac) : (actFrac > 0 ? 1 : 0);
  const corpusPts   = Math.round(onTrack * 25);
  const retYrs      = Math.max(1, (goals.fire_target_age ?? 100) - goals.retirement_age);
  const planPts     = (!base.failureAge || base.failureAge === 0) ? 40
    : Math.round((Math.max(0, base.failureAge - goals.retirement_age) / retYrs) * 40);
  const burden      = (profile.monthly_income ?? 0) > 0 ? sipAmount / profile.monthly_income! : 0;
  const sipPts      = burden < 0.3 ? 20 : burden < 0.5 ? 12 : burden < 0.7 ? 6 : 0;
  const cov         = base.fireCorpus > 0
    ? Math.min(1, base.netWorthAtRetirement / base.fireCorpus)
    : (base.netWorthAtRetirement > 0 ? 1 : 0);
  const covPts      = Math.round(cov * 15);
  const score       = Math.min(100, corpusPts + planPts + sipPts + covPts);
  const scoreLabel  = score >= 80 ? 'Excellent' : score >= 60 ? 'Good Progress' : score >= 40 ? 'Fair' : 'Needs Work';
  const scoreColor  = score >= 80 ? '#4CAF50' : score >= 60 ? '#8BC34A' : score >= 40 ? '#F39C12' : '#D64545';

  // derived metrics
  const inflYears       = goals.retirement_age - age;
  const pensionInflated = Math.round(goals.pension_income * Math.pow(1 + goals.inflation_rate / 100, inflYears));
  const incReplace      = profile.monthly_income ? Math.round((goals.pension_income / profile.monthly_income) * 100) : 0;
  const corpusProgress  = Math.round(actFrac * 100);
  const investable      = assets.filter(a => !(a as any).is_self_use);
  const totalInv        = investable.reduce((s, a) => s + a.current_value, 0);
  const equityVal       = investable.filter(a => ['EQUITY', 'MUTUAL_FUND', 'ESOP_RSU'].includes(a.category)).reduce((s, a) => s + a.current_value, 0);
  const equityPct       = totalInv > 0 ? Math.round((equityVal / totalInv) * 100) : 0;
  const targetEquityPct = Math.max(40, 110 - age);
  const fiRatio         = base.fireCorpus > 0 ? Math.round((totalInv / base.fireCorpus) * 100) : 0;
  const debtVal         = investable.filter(a => ['EPF', 'PPF', 'DEBT', 'FIXED_DEPOSIT'].includes(a.category)).reduce((s, a) => s + a.current_value, 0);
  const debtPct         = totalInv > 0 ? Math.round((debtVal / totalInv) * 100) : 0;
  const goldVal         = investable.filter(a => a.category === 'GOLD').reduce((s, a) => s + a.current_value, 0);
  const goldPct         = totalInv > 0 ? Math.round((goldVal / totalInv) * 100) : 0;
  const targetYear      = new Date().getFullYear() + inflYears;
  const sipGap          = Math.max(0, base.requiredMonthlySIP - sipAmount);

  return {
    profile, goals, assets, expenses, sipAmount, sipReturn, postReturn, stepUp,
    cur, age, fmt,
    base, pessimistic, optimistic, earlyRetire, sensiGrid,
    score, scoreLabel, scoreColor, corpusPts, planPts, sipPts, covPts,
    inflYears, pensionInflated, incReplace, corpusProgress,
    burden, cov, equityPct, targetEquityPct, fiRatio, debtPct, goldPct,
    targetYear, sipGap,
  };
}
