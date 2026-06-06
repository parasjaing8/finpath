// index.ts — entry point for sample PDF generation
// Run: npx tsx scripts/pdf-report/index.ts
import * as fs from 'fs';
import * as path from 'path';
import type { Asset, Expense, Profile, Goals } from '../../engine/types';
import type { FxRates } from '../../utils/fx';
import { buildContext } from './context';
import { buildPage1 } from './page1';
import { buildPage2 } from './page2';
import { buildPage3 } from './page3';
import { buildPage4 } from './page4';

// ── Sample data ────────────────────────────────────────────────────────────
const profile: Profile = {
  id: '1', name: 'Rahul Sharma', dob: '1994-06-05',
  currency: 'INR', monthly_income: 150000,
};
const goals: Goals = {
  retirement_age: 55, sip_stop_age: 55, pension_income: 75000,
  inflation_rate: 6, fire_type: 'moderate', fire_target_age: 90,
};
const assets: Asset[] = [
  { id: 1, name: 'Nifty Index Fund',     category: 'MUTUAL_FUND',  current_value: 800000,  expected_roi: 12  },
  { id: 2, name: 'EPF',                  category: 'EPF',           current_value: 450000,  expected_roi: 8.5 },
  { id: 3, name: 'PPF',                  category: 'PPF',           current_value: 150000,  expected_roi: 7.1 },
  { id: 4, name: 'Direct Stocks',        category: 'EQUITY',        current_value: 200000,  expected_roi: 15  },
  { id: 5, name: 'Sovereign Gold Bonds', category: 'GOLD',          current_value: 300000,  expected_roi: 8   },
  { id: 6, name: 'Home (Self-Use)',       category: 'REAL_ESTATE',   current_value: 5000000, expected_roi: 8, is_self_use: true },
];
const expenses: Expense[] = [
  { id: 1, name: 'Monthly Rent', category: 'housing', expense_type: 'CURRENT_RECURRING', amount: 25000, frequency: 'MONTHLY', inflation_rate: 6, start_date: '2026-01-01', end_date: '2049-12-31' },
  { id: 2, name: "Child's Higher Education", category: 'education', expense_type: 'FUTURE_ONE_TIME', amount: 1500000, inflation_rate: 8, start_date: '2048-01-01', end_date: '2048-12-31' },
];
const SIP_AMOUNT  = 35000;
const SIP_RETURN  = 12;
const POST_RETURN = 8;
const STEP_UP     = 5;
const fxRates: FxRates = { USD: 1, INR: 84 };

// ── Build ──────────────────────────────────────────────────────────────────
const ctx = buildContext(profile, goals, assets, expenses, SIP_AMOUNT, SIP_RETURN, POST_RETURN, STEP_UP, fxRates);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>FinPath Premium Report — ${profile.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 11.5px; color: #1E293B; background: #FAFBFA; line-height: 1.45; }
  @page { margin: 0; size: A4 portrait; }
  @media print { body { background: white; } }
</style>
</head>
<body>
${buildPage1(ctx)}
${buildPage2(ctx)}
${buildPage3(ctx)}
${buildPage4(ctx)}
</body>
</html>`;

const outHtml = '/tmp/finpath_report_v4.html';
fs.writeFileSync(outHtml, html, 'utf8');
console.log(`HTML → ${outHtml}`);
console.log(`Score: ${ctx.score}/100 (${ctx.scoreLabel})`);
console.log(`Scenarios — Base: ${ctx.base.failureAge} · Pessimistic: ${ctx.pessimistic.failureAge} · Optimistic: ${ctx.optimistic.failureAge} · Early: ${ctx.earlyRetire.failureAge}`);
