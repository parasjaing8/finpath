// page3.ts — Health analysis, sensitivity matrix, year-by-year projection
import { formatCurrencyFull } from '../../engine/calculator';
import type { ReportContext } from './context';
import { INFL_S, RET_S } from './context';
import { svgHeroRing } from './svg';
import { healthMetric, PAGE_FOOTER, LOGO_IMG } from './components';

export function buildPage3(ctx: ReportContext): string {
  const {
    profile, goals, base, fmt, cur, age,
    sipAmount, sipReturn, postReturn, stepUp, burden,
    score, scoreLabel, scoreColor, corpusPts, planPts, sipPts, covPts,
    equityPct, targetEquityPct, fiRatio, debtPct, goldPct, inflYears, cov,
    sensiGrid,
  } = ctx;

  const fireTargetAge = goals.fire_target_age ?? 100;

  // sensitivity matrix
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

  // year-by-year table (every 3rd row + final row)
  const projRows = base.projections
    .filter((_, i) => i % 3 === 0 || i === base.projections.length - 1)
    .map(p => `<tr${p.isFireAchieved ? ' style="background:#EAF7EF"' : ''}>
      <td style="color:#64748B">${p.year}</td>
      <td style="font-weight:600">${p.age}</td>
      <td style="text-align:right">${formatCurrencyFull(p.annualSIP, cur)}</td>
      <td style="text-align:right;color:#64748B">${formatCurrencyFull(p.totalNetExpenses, cur)}</td>
      <td style="text-align:right;font-weight:700;color:${p.isFireAchieved ? '#0B6B3A' : '#1E293B'}">${formatCurrencyFull(p.netWorthEOY, cur)}</td>
    </tr>`)
    .join('');

  return `
<!-- ═══ PAGE 3 ═══════════════════════════════════════════════════════════ -->
<div style="padding:20px 22px 0;page-break-before:always;break-before:page">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0 10px;border-bottom:1.5px solid #E6EAE8;margin-bottom:18px">
    <div style="display:flex;align-items:center;gap:10px">
      <img src="${LOGO_IMG}" style="width:36px;height:36px;border-radius:6px"/>
      <div>
        <div style="font-size:10px;font-weight:700;color:#0B6B3A;letter-spacing:0.5px;text-transform:uppercase">FinPath</div>
        <div style="font-size:8.5px;color:#94A3B8;margin-top:1px">Plan today. Live your freedom tomorrow.</div>
      </div>
    </div>
    <div style="font-size:11px;font-weight:700;color:#1E293B;text-align:center;letter-spacing:0.3px;text-transform:uppercase">Plan Analysis & Projections</div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#1E293B;font-weight:600">${profile.name} · Age ${age}</div>
      <div style="font-size:9px;color:#94A3B8;margin-top:2px">${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <div style="display:inline-block;background:#EAF7EF;color:#0B6B3A;font-size:8.5px;font-weight:700;padding:2px 8px;border-radius:10px;margin-top:3px">Page 3 of 4</div>
    </div>
  </div>

  <!-- HEALTH METRICS + SCORE BREAKDOWN -->
  <div style="display:flex;gap:14px;margin-bottom:14px">
    <div style="flex:1">
      <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Plan Metrics</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        ${healthMetric('📊', 'Progress Ratio', `${fiRatio}%`,                       'investable / corpus',     fiRatio >= 50 ? 'good' : fiRatio >= 20 ? 'warn' : 'bad')}
        ${healthMetric('💰', 'Savings Rate',  `${Math.round(burden * 100)}%`,      'of monthly income',       burden < 0.3 ? 'good' : burden < 0.5 ? 'warn' : 'bad')}
        ${healthMetric('📈', 'Equity Alloc',  `${equityPct}%`,                     `Rule of 110: ${targetEquityPct}%`, equityPct >= targetEquityPct - 10 ? 'good' : 'warn')}
        ${healthMetric('🥇', 'Gold Alloc',    `${goldPct}%`,                       'typical range: 5–10%',    goldPct >= 5 && goldPct <= 15 ? 'good' : goldPct > 20 ? 'bad' : 'warn')}
        ${healthMetric('🛡️', 'Debt Alloc',   `${debtPct}%`,                       'EPF + PPF',               'neutral')}
        ${healthMetric('🏠', 'Income Cover',  `${Math.round(cov * 100)}%`,         'at retirement',           cov >= 0.9 ? 'good' : cov >= 0.7 ? 'warn' : 'bad')}
      </div>
    </div>

    <!-- SCORE BREAKDOWN -->
    <div style="width:230px">
      <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Score Breakdown</div>
      <div style="background:#F7FBF8;border-radius:14px;padding:16px;border:1px solid #E6EAE8;height:100%">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          <div style="width:60px;height:60px;flex-shrink:0">${
            svgHeroRing(score, scoreLabel, scoreColor)
              .replace('width="176" height="176"', 'width="60" height="60"')
          }</div>
          <div>
            <div style="font-size:28px;font-weight:800;color:${scoreColor};line-height:1">${score}</div>
            <div style="font-size:9.5px;color:#64748B">out of 100</div>
            <div style="font-size:9px;font-weight:700;color:${scoreColor}">${scoreLabel}</div>
          </div>
        </div>
        ${[
          ['Corpus Progress', '25', corpusPts],
          ['Plan Viability',  '40', planPts],
          ['SIP Affordability','20', sipPts],
          ['Income Coverage', '15', covPts],
        ].map(([l, max, pts]) => `
          <div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
              <div style="font-size:9px;color:#64748B">${l}</div>
              <div style="font-size:9px;font-weight:700;color:#0B6B3A">${pts}/${max}</div>
            </div>
            <div style="background:#E6EAE8;border-radius:4px;height:6px;overflow:hidden">
              <div style="width:${Math.round(Number(pts) / Number(max) * 100)}%;height:100%;background:linear-gradient(90deg,#0B6B3A,#4CAF50);border-radius:4px"></div>
            </div>
          </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- SENSITIVITY MATRIX -->
  <div style="background:white;border-radius:16px;padding:14px 16px;border:1px solid #E6EAE8;box-shadow:0 1px 4px rgba(0,0,0,0.04);margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Sensitivity Analysis — Corpus Depletion Age</div>
    <div style="font-size:8.5px;color:#94A3B8;margin-bottom:8px">Illustrative model outcomes under varying return and inflation assumptions.</div>
    <table style="width:100%;border-collapse:collapse;font-size:10px">
      <thead><tr>
        <th style="background:#F8FAFC;padding:8px 10px;text-align:left;color:#64748B;font-size:9.5px;border-bottom:2px solid #E6EAE8">Inflation / Return</th>
        ${RET_S.map(r => `<th style="background:#EFF6FF;padding:8px 10px;text-align:center;color:#2D6CDF;font-size:9.5px;border-bottom:2px solid #E6EAE8">Return ${r}%</th>`).join('')}
      </tr></thead>
      <tbody>${sensiRows}</tbody>
    </table>
    <div style="font-size:8.5px;color:#94A3B8;margin-top:6px">✓ = corpus sustains to target age ${fireTargetAge}. Highlighted row = current plan assumptions.</div>
  </div>

  <!-- 6 KPI CARDS -->
  <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:12px">
    ${[
      ['Monthly SIP',       fmt(sipAmount)],
      ['SIP %',             Math.round(burden * 100) + '%'],
      ['Yrs to FIRE',       inflYears + ''],
      ['Target Corpus',     fmt(base.fireCorpus)],
      ['Projected Corpus',  fmt(base.netWorthAtRetirement)],
      ['Retire Age',        goals.retirement_age + ''],
    ].map(([l, v]) => `
      <div style="background:#F7FBF8;border-radius:10px;padding:10px;text-align:center;border:1px solid #E6EAE8">
        <div style="font-size:8px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:3px">${l}</div>
        <div style="font-size:13px;font-weight:800;color:#1E293B">${v}</div>
      </div>`).join('')}
  </div>

  <!-- YEAR-BY-YEAR TABLE -->
  <div style="background:white;border-radius:16px;overflow:hidden;border:1px solid #E6EAE8;box-shadow:0 1px 4px rgba(0,0,0,0.04)">
    <div style="background:#0B6B3A;padding:10px 14px">
      <div style="font-size:11px;font-weight:700;color:white;text-transform:uppercase;letter-spacing:0.5px">Year-by-Year Projection (every 3 years)</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:10px">
      <thead><tr>
        ${['Year', 'Age', 'Annual SIP', 'Withdrawals', 'Net Worth'].map(h =>
          `<th style="padding:7px 10px;text-align:${['Annual SIP', 'Withdrawals', 'Net Worth'].includes(h) ? 'right' : 'left'};background:#F7FBF8;color:#64748B;font-size:9.5px;border-bottom:1px solid #E6EAE8">${h}</th>`
        ).join('')}
      </tr></thead>
      <tbody>${projRows}</tbody>
    </table>
  </div>

  ${PAGE_FOOTER}
</div>`;
}
