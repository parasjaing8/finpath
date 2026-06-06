// page2.ts — Wealth projection overview, insights, scenario analysis
import type { ReportContext } from './context';
import { INFL_S, RET_S } from './context';
import { svgAreaChart, svgDrawdownChart } from './svg';
import { insightCard, scenarioCard, PAGE_FOOTER, LOGO_IMG } from './components';

export function buildPage2(ctx: ReportContext): string {
  const {
    profile, goals, base, pessimistic, optimistic, earlyRetire,
    fmt, age, sipAmount, sipReturn, postReturn, stepUp,
    burden, equityPct, targetEquityPct, pensionInflated, incReplace,
    inflYears,
  } = ctx;

  const fireTargetAge = goals.fire_target_age ?? 100;

  // sensitivity matrix rows
  const { sensiGrid } = ctx;
  const sensiRows = INFL_S.map((infl, ri) => {
    const cells = sensiGrid[ri].map(fa => {
      const ok   = fa > fireTargetAge;
      const diff = fireTargetAge - fa;
      const color = ok ? '#0B6B3A' : diff <= 5 ? '#F39C12' : '#D64545';
      const bg    = ok ? '#EAF7EF' : diff <= 5 ? '#FFF8E1' : '#FEF2F2';
      return `<td style="text-align:center;padding:8px 6px;background:${bg};color:${color};font-weight:700;font-size:11px">${ok ? `${fireTargetAge}+ ✓` : `Age ${fa}`}</td>`;
    }).join('');
    const isBase = infl === 6;
    return `<tr${isBase ? ' style="outline:2px solid #2D6CDF;outline-offset:-1px"' : ''}>
      <td style="padding:8px 10px;background:${isBase ? '#EFF6FF' : '#F8FAFC'};font-size:10px;font-weight:600;color:${isBase ? '#2D6CDF' : '#64748B'}">${infl}% infl${isBase ? ' (base)' : ''}</td>
      ${cells}
    </tr>`;
  }).join('');

  return `
<!-- ═══ PAGE 2 ═══════════════════════════════════════════════════════════ -->
<div style="padding:20px 22px 0;page-break-before:always;break-before:page">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0 10px;border-bottom:1.5px solid #E6EAE8;margin-bottom:18px">
    <div style="display:flex;align-items:center;gap:10px">
      <img src="${LOGO_IMG}" style="width:36px;height:36px;border-radius:6px"/>
      <div>
        <div style="font-size:10px;font-weight:700;color:#0B6B3A;letter-spacing:0.5px;text-transform:uppercase">FinPath</div>
        <div style="font-size:8.5px;color:#94A3B8;margin-top:1px">Plan today. Live your freedom tomorrow.</div>
      </div>
    </div>
    <div style="font-size:11px;font-weight:700;color:#1E293B;text-align:center;letter-spacing:0.3px;text-transform:uppercase">Wealth Projection Overview</div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#1E293B;font-weight:600">${profile.name} · Age ${age}</div>
      <div style="font-size:9px;color:#94A3B8;margin-top:2px">${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <div style="display:inline-block;background:#EAF7EF;color:#0B6B3A;font-size:8.5px;font-weight:700;padding:2px 8px;border-radius:10px;margin-top:3px">Page 2 of 4</div>
    </div>
  </div>

  <!-- TWO CHART CARDS -->
  <div style="display:flex;gap:14px;margin-bottom:14px">
    <div style="flex:1;background:white;border-radius:16px;padding:16px;border:1px solid #E6EAE8;box-shadow:0 1px 4px rgba(0,0,0,0.04)">
      <div style="font-size:9px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Pre-Retirement Growth (Age ${age}→${goals.retirement_age})</div>
      <div style="font-size:26px;font-weight:800;color:#0B6B3A;margin-bottom:10px">${fmt(base.netWorthAtRetirement)}</div>
      ${svgAreaChart(base.projections, goals.retirement_age, base.fireCorpus, fmt, 296, 120)}
      <div style="font-size:8.5px;color:#94A3B8;margin-top:4px">Blue dashed line = FIRE corpus target (${fmt(base.fireCorpus)})</div>
    </div>
    <div style="flex:1;background:white;border-radius:16px;padding:16px;border:1px solid #E6EAE8;box-shadow:0 1px 4px rgba(0,0,0,0.04)">
      <div style="font-size:9px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Post-Retirement Drawdown (Age ${goals.retirement_age}→${fireTargetAge})</div>
      <div style="font-size:26px;font-weight:800;color:${base.failureAge > 0 ? '#D64545' : '#0B6B3A'};margin-bottom:10px">${base.failureAge > 0 ? `Depletes age ${base.failureAge}` : `Sustains to ${fireTargetAge}+`}</div>
      ${svgDrawdownChart(base.projections, base.failureAge, goals.retirement_age, fireTargetAge, fmt, 296, 120)}
      <div style="font-size:8.5px;color:${base.failureAge > 0 ? '#D64545' : '#94A3B8'};margin-top:4px">${base.failureAge > 0 ? `⚠ Red zone = ${fireTargetAge - base.failureAge} year shortfall after age ${base.failureAge}` : 'Corpus sustains all planned withdrawals.'}</div>
    </div>
  </div>

  <!-- PLAN ASSUMPTIONS STRIP -->
  <div style="background:#EAF7EF;border-radius:12px;padding:10px 16px;margin-bottom:12px;display:flex;gap:20px;flex-wrap:wrap;border:1px solid #C8E6C9">
    <div style="font-size:9px;font-weight:700;color:#0B6B3A;text-transform:uppercase;letter-spacing:0.4px;align-self:center">Plan Assumptions</div>
    ${[
      ['SIP',       fmt(sipAmount) + '/mo'],
      ['Return',    sipReturn + '%'],
      ['Post-Ret',  postReturn + '%'],
      ['Step-Up',   stepUp + '%/yr'],
      ['Inflation', goals.inflation_rate + '%'],
      ['Retire',    'Age ' + goals.retirement_age],
      ['Target',    'Age ' + fireTargetAge],
      ['Pension',   fmt(goals.pension_income) + '/mo today'],
    ].map(([l, v]) => `<div style="font-size:9.5px"><span style="color:#64748B">${l}: </span><span style="font-weight:700;color:#1E293B">${v}</span></div>`).join('')}
  </div>

  <!-- KEY INSIGHTS + SCENARIO ANALYSIS -->
  <div style="display:flex;gap:14px;margin-bottom:14px">
    <div style="flex:1">
      <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Projection Insights</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${insightCard('💪', 'Contribution Sustainability',
          `Contribution is ${Math.round(burden * 100)}% of income — within the <30% threshold in this plan's model. Step-up of ${stepUp}%/yr is active and compounds to a larger projected corpus vs flat contributions.`,
          '#EAF7EF', '#0B6B3A')}
        ${insightCard('⚠️', 'Projection Gap',
          base.failureAge > 0
            ? `Under current assumptions, the model estimates corpus depletion around age ${base.failureAge} — ${fireTargetAge - base.failureAge} years before your stated target.`
            : `Under pessimistic conditions (10% return, 7% inflation), the model estimates depletion around age ${pessimistic.failureAge} — ${fireTargetAge - pessimistic.failureAge} years before your stated target.`,
          '#FFF8E1', '#F39C12')}
        ${insightCard('📐', 'Allocation Comparison',
          `Equity allocation is ${equityPct}%. A commonly referenced allocation heuristic (110 − age) indicates approximately ${targetEquityPct}% equity exposure for age ${age}. This heuristic may not be suitable for every investor.`,
          '#EFF6FF', '#2D6CDF')}
        ${insightCard('🧪', 'Sensitivity Observation',
          `Under pessimistic assumptions (10% return, 7% inflation), the model estimates corpus depletion around age ${pessimistic.failureAge} — ${fireTargetAge - pessimistic.failureAge} years before stated target.`,
          '#FEF2F2', '#D64545')}
      </div>
    </div>

    <div style="width:240px">
      <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Scenario Analysis</div>
      <div style="font-size:8.5px;color:#94A3B8;margin-bottom:8px;line-height:1.4">Illustrative outcomes using different return and inflation assumptions. Actual inflation and spending patterns may differ.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${scenarioCard('😊', 'Optimistic',   optimistic.failureAge,  '#0B6B3A', '#EAF7EF', fireTargetAge)}
        ${scenarioCard('🙂', 'Expected',     base.failureAge,        '#F39C12', '#FFF8E1', fireTargetAge)}
        ${scenarioCard('😟', 'Conservative', pessimistic.failureAge, '#D64545', '#FEF2F2', fireTargetAge)}
        ${scenarioCard('⏰', 'Early Retire', earlyRetire.failureAge, '#7E57C2', '#F3E8FF', fireTargetAge)}
      </div>
    </div>
  </div>

  <!-- INFLATION + INCOME REPLACEMENT -->
  <div style="display:flex;gap:12px">
    <div style="flex:1;background:#EFF6FF;border-radius:12px;padding:12px 16px;border-left:4px solid #2D6CDF">
      <div style="font-size:10px;font-weight:700;color:#2D6CDF;margin-bottom:4px">Inflation Impact</div>
      <div style="font-size:10.5px;color:#1E293B;line-height:1.6">
        ${fmt(goals.pension_income)}/mo today → <strong>${fmt(pensionInflated)}/month</strong> at age ${goals.retirement_age} (${goals.inflation_rate}% × ${inflYears} yrs). FIRE corpus is sized for this inflated need.
      </div>
    </div>
    <div style="flex:1;background:${incReplace >= 65 ? '#EAF7EF' : '#FFF8E1'};border-radius:12px;padding:12px 16px;border-left:4px solid ${incReplace >= 65 ? '#4CAF50' : '#F39C12'}">
      <div style="font-size:10px;font-weight:700;color:${incReplace >= 65 ? '#0B6B3A' : '#F39C12'};margin-bottom:4px">Income Replacement: ${incReplace}%</div>
      <div style="font-size:10.5px;color:#1E293B;line-height:1.6">
        ${incReplace >= 65
          ? `${fmt(goals.pension_income)}/mo = ${incReplace}% of current income — within the 65–80% reference range cited in financial planning literature.`
          : `${fmt(goals.pension_income)}/mo = ${incReplace}% of current income. Common financial planning benchmarks reference 65–80%.`}
      </div>
    </div>
  </div>

  ${PAGE_FOOTER}
</div>`;
}
