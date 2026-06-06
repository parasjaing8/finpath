// page1.ts — Hero, executive summary, FIRE journey, portfolio allocation
import { ASSET_CATEGORIES } from '../../engine/types';
import type { ReportContext } from './context';
import { svgHeroRing, svgDonut, svgMountain } from './svg';
import { pageHeader, metricCard, pageFooter } from './components';

const CAT_COLORS: Record<string, string> = {
  EQUITY: '#0B6B3A', MUTUAL_FUND: '#4CAF50', DEBT: '#2D6CDF',
  FIXED_DEPOSIT: '#5C6BC0', PPF: '#00897B', EPF: '#00BCD4',
  GOLD: '#F4C542', REAL_ESTATE: '#8D6E63', CRYPTO: '#7E57C2',
  CASH: '#78909C', ESOP_RSU: '#F39C12', OTHERS: '#9E9E9E',
};

export function buildPage1(ctx: ReportContext): string {
  const {
    profile, goals, assets, base, fmt, cur, age,
    sipAmount, sipReturn, stepUp, burden, corpusProgress,
    sipGap, score, scoreLabel, scoreColor, inflYears, targetYear,
  } = ctx;

  // donut chart segments
  const byCat: Record<string, number> = {};
  for (const a of assets) byCat[a.category] = (byCat[a.category] ?? 0) + a.current_value;
  const totalNW = Object.values(byCat).reduce((s, v) => s + v, 0);
  const getCatLabel = (k: string) => ASSET_CATEGORIES.find(c => c.key === k)?.label ?? k;
  const donutSegs = Object.entries(byCat).sort(([, a], [, b]) => b - a)
    .map(([cat, val]) => ({ label: getCatLabel(cat), value: val, color: CAT_COLORS[cat] ?? '#9E9E9E' }));
  const legendItems = donutSegs.slice(0, 6).map(s =>
    `<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">
      <div style="width:8px;height:8px;border-radius:2px;background:${s.color};flex-shrink:0"></div>
      <div style="font-size:9px;color:#64748B">${s.label}</div>
      <div style="font-size:9px;font-weight:700;color:#1E293B;margin-left:auto">${Math.round((s.value / totalNW) * 100)}%</div>
    </div>`
  ).join('');

  const bullets = [
    `Current portfolio of <strong>${fmt(base.totalNetWorth)}</strong> plus <strong>${fmt(sipAmount)}/month SIP</strong> over ${inflYears} years is projected to reach <strong>${fmt(base.netWorthAtRetirement)}</strong> by age ${goals.retirement_age}.`,
    base.failureAge > 0
      ? `Corpus depletes at age <strong>${base.failureAge}</strong>. The model calculates <strong>${fmt(base.requiredMonthlySIP)}/month</strong> as the SIP needed to reach your stated target age of ${goals.fire_target_age}.`
      : `FIRE corpus of <strong>${fmt(base.fireCorpus)}</strong> fully covered. Projected withdrawals sustained to age ${goals.fire_target_age}.`,
    burden < 0.30
      ? `SIP is <strong>${Math.round(burden * 100)}% of income</strong> — within the plan's model thresholds. Step-up of ${stepUp}% p.a. is active.`
      : `SIP is <strong>${Math.round(burden * 100)}% of income</strong> — above the 30% of income threshold in this plan's model.`,
  ];

  return `
<!-- ═══ PAGE 1 ═══════════════════════════════════════════════════════════ -->
<div style="padding:20px 22px 0">
  ${pageHeader(1, 4, 'Fire Projection Report', profile.name, age)}

  <!-- HERO ROW -->
  <div style="display:flex;gap:16px;align-items:stretch;margin-bottom:16px">

    <!-- LEFT: dark hero card -->
    <div style="width:36%;background:linear-gradient(150deg,#084E2A 0%,#0B6B3A 55%,#147A45 100%);border-radius:18px;padding:22px 18px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;min-height:310px">
      <div style="text-align:center;width:100%">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:rgba(255,255,255,0.55);margin-bottom:12px">Projection Score</div>
        ${svgHeroRing(score, scoreLabel, scoreColor)}
      </div>
      <div style="background:rgba(255,255,255,0.1);border-radius:12px;padding:12px 14px;width:100%;margin-top:12px">
        <div style="font-size:10px;color:rgba(255,255,255,0.7);line-height:1.6">
          ${base.failureAge > 0
            ? `Corpus projected to <span style="color:#F4C542;font-weight:700">deplete at age ${base.failureAge}</span>. Model shows ${fmt(sipGap)}/month additional SIP needed to meet your stated target age of ${goals.fire_target_age}.`
            : `Your plan projects retirement at age <span style="color:#4CAF50;font-weight:700">${goals.retirement_age}</span> based on your stated inputs.`
          }
        </div>
      </div>
    </div>

    <!-- RIGHT: executive summary + metrics grid -->
    <div style="flex:1;display:flex;flex-direction:column;gap:12px">
      <div>
        <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Executive Summary</div>
        ${bullets.map(b => `<div style="display:flex;gap:8px;margin-bottom:7px;align-items:flex-start"><div style="width:5px;height:5px;border-radius:50%;background:#4CAF50;flex-shrink:0;margin-top:5px"></div><div style="font-size:11px;color:#1E293B;line-height:1.55">${b}</div></div>`).join('')}
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Report Highlights</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          ${metricCard('Current Portfolio',  fmt(base.totalNetWorth),          `${corpusProgress}% of target`)}
          ${metricCard('FIRE Corpus',         fmt(base.fireCorpus),             'needed at retirement')}
          ${metricCard('Projected Corpus',    fmt(base.netWorthAtRetirement),   `at age ${goals.retirement_age}`)}
          ${metricCard('Investable NW',       fmt(base.investableNetWorth),     'excl. self-use home')}
          ${metricCard('Monthly SIP',         fmt(sipAmount),                   `${Math.round(burden * 100)}% of income`)}
          ${metricCard(
            base.failureAge > 0 ? 'Corpus Depletes' : 'FIRE Age',
            base.failureAge > 0 ? `Age ${base.failureAge}` : `Age ${base.fireAchievedAge || goals.retirement_age}`,
            base.failureAge > 0 ? `${(goals.fire_target_age ?? 100) - base.failureAge} yrs before target` : 'corpus crosses target',
            base.failureAge > 0 ? '#D64545' : '#0B6B3A',
            base.failureAge > 0 ? '#FEF2F2' : '#F7FBF8',
          )}
        </div>
      </div>
      ${base.requiredMonthlySIP > sipAmount
        ? `<div style="background:#FFF8E1;border-radius:10px;padding:10px 14px;border-left:4px solid #F39C12;font-size:10.5px;color:#92400E">Model estimate: an investment of approximately <strong>${fmt(base.requiredMonthlySIP)}/month</strong> (${fmt(sipGap)} above current) would align with the selected assumptions.</div>`
        : ''}
    </div>
  </div>

  <!-- FIRE JOURNEY -->
  <div style="background:#F7FBF8;border-radius:16px;padding:16px 20px;margin-bottom:14px;border:1px solid #E6EAE8">
    <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Your FIRE Journey</div>
    <div style="display:flex;gap:20px;align-items:center">
      <div style="flex:1">
        <div style="font-size:10px;color:#64748B;margin-bottom:6px">You are <strong style="color:#0B6B3A">${corpusProgress}% closer</strong> to Financial Freedom</div>
        <div style="background:#E6EAE8;border-radius:100px;height:10px;overflow:hidden;margin-bottom:8px">
          <div style="width:${Math.min(100, corpusProgress)}%;height:100%;background:linear-gradient(90deg,#0B6B3A,#4CAF50);border-radius:100px"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:8.5px;color:#94A3B8">
          <span>0%</span><span style="font-weight:700;color:#0B6B3A">${corpusProgress}% today</span><span>100% FIRE</span>
        </div>
        <div style="display:flex;gap:16px;margin-top:12px">
          <div><div style="font-size:9px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.3px">Corpus Today</div><div style="font-size:14px;font-weight:800;color:#0B6B3A">${fmt(base.investableNetWorth)}</div></div>
          <div><div style="font-size:9px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.3px">Target Corpus</div><div style="font-size:14px;font-weight:800;color:#1E293B">${fmt(base.fireCorpus)}</div></div>
          <div><div style="font-size:9px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.3px">Freedom Year</div><div style="font-size:14px;font-weight:800;color:#1E293B">${targetYear}</div></div>
        </div>
      </div>
      ${svgMountain(corpusProgress, targetYear, goals.retirement_age)}
    </div>
  </div>

  <!-- PORTFOLIO ALLOCATION + NET WORTH -->
  <div style="display:flex;gap:14px">
    <div style="background:white;border-radius:16px;padding:16px;border:1px solid #E6EAE8;box-shadow:0 1px 4px rgba(0,0,0,0.04);flex:0 0 auto">
      <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Portfolio Allocation</div>
      <div style="display:flex;align-items:center;gap:16px">
        ${svgDonut(donutSegs, fmt(totalNW), 160, 160)}
        <div style="min-width:140px">${legendItems}</div>
      </div>
    </div>
    <div style="flex:1;background:white;border-radius:16px;padding:16px;border:1px solid #E6EAE8;box-shadow:0 1px 4px rgba(0,0,0,0.04)">
      <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Net Worth at a Glance</div>
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #F1F5F9"><span style="font-size:10.5px;color:#64748B">Total Net Worth</span><span style="font-size:14px;font-weight:800;color:#0B6B3A">${fmt(base.totalNetWorth)}</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #F1F5F9"><span style="font-size:10.5px;color:#64748B">Investable Corpus</span><span style="font-size:14px;font-weight:800;color:#1E293B">${fmt(base.investableNetWorth)}</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #F1F5F9"><span style="font-size:10.5px;color:#64748B">Self-Use Assets</span><span style="font-size:13px;font-weight:700;color:#64748B">${fmt(assets.filter(a => (a as any).is_self_use).reduce((s, a) => s + a.current_value, 0))}</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0"><span style="font-size:10.5px;color:#64748B">Liabilities</span><span style="font-size:13px;font-weight:700;color:#94A3B8">₹0</span></div>
      </div>
      <div style="background:#EAF7EF;border-radius:10px;padding:8px 12px">
        <div style="font-size:9px;color:#0B6B3A;font-weight:600">Compounding illustration</div>
        <div style="font-size:10px;color:#1E293B;margin-top:2px">At ${sipReturn}% CAGR assumed in this plan, ₹1L invested today would compound to ${fmt(100000 * Math.pow(1 + sipReturn / 100, inflYears))} by age ${goals.retirement_age}.</div>
      </div>
    </div>
  </div>

  ${pageFooter(1, 5)}
</div>`;
}
