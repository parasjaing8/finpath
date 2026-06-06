// pageYoY.ts — page 4: full year-by-year projection table
import { formatCurrencyFull } from '../../engine/calculator';
import type { ReportContext } from './context';
import { pageFooter, LOGO_IMG } from './components';

export function buildPageYoY(ctx: ReportContext): string {
  const { profile, goals, base, cur, age } = ctx;
  const fireTargetAge = goals.fire_target_age ?? 100;
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const projRows = base.projections.map(p => {
    const isRetirement  = p.age === goals.retirement_age;
    const isDepletion   = p.age === base.failureAge && base.failureAge > 0;
    const isFire        = p.isFireAchieved;
    const rowBg = isDepletion  ? 'background:#FEF2F2'
                : isRetirement ? 'background:#EFF6FF'
                : isFire       ? 'background:#EAF7EF'
                : '';
    const nwColor = isDepletion ? '#D64545' : isFire ? '#0B6B3A' : '#1E293B';
    return `<tr${rowBg ? ` style="${rowBg}"` : ''}>
      <td style="color:#64748B;padding:5px 10px">${p.year}</td>
      <td style="font-weight:600;padding:5px 10px">${p.age}${isRetirement ? ' 🎯' : isDepletion ? ' ⚠️' : ''}</td>
      <td style="text-align:right;padding:5px 10px">${p.annualSIP > 0 ? formatCurrencyFull(p.annualSIP, cur) : '—'}</td>
      <td style="text-align:right;color:#64748B;padding:5px 10px">${p.totalNetExpenses > 0 ? formatCurrencyFull(p.totalNetExpenses, cur) : '—'}</td>
      <td style="text-align:right;font-weight:700;color:${nwColor};padding:5px 10px">${formatCurrencyFull(p.netWorthEOY, cur)}</td>
    </tr>`;
  }).join('');

  const legendItems = [
    { color: '#EFF6FF', label: '🎯 Retirement age' },
    ...(base.failureAge > 0 ? [{ color: '#FEF2F2', label: '⚠️ Corpus depletion' }] : []),
    { color: '#EAF7EF', label: 'FIRE corpus milestone' },
  ].map(item =>
    `<div style="display:flex;align-items:center;gap:6px">
      <div style="width:12px;height:12px;border-radius:3px;background:${item.color};border:1px solid #E6EAE8;flex-shrink:0"></div>
      <div style="font-size:8.5px;color:#64748B">${item.label}</div>
    </div>`
  ).join('');

  return `
<!-- ═══ PAGE 4 — YEAR-BY-YEAR PROJECTION ══════════════════════════════════ -->
<div style="padding:20px 22px 0;page-break-before:always;break-before:page">
  <!-- HEADER -->
  <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0 10px;border-bottom:1.5px solid #E6EAE8;margin-bottom:18px">
    <div style="display:flex;align-items:center;gap:10px">
      <img src="${LOGO_IMG}" style="width:36px;height:36px;border-radius:6px"/>
      <div>
        <div style="font-size:10px;font-weight:700;color:#0B6B3A;letter-spacing:0.5px;text-transform:uppercase">FinPath</div>
        <div style="font-size:8.5px;color:#94A3B8;margin-top:1px">Plan today. Live your freedom tomorrow.</div>
      </div>
    </div>
    <div style="font-size:11px;font-weight:700;color:#1E293B;text-align:center;letter-spacing:0.3px;text-transform:uppercase">Year-by-Year Projection</div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#1E293B;font-weight:600">${profile.name} · Age ${age}</div>
      <div style="font-size:9px;color:#94A3B8;margin-top:2px">${date}</div>
    </div>
  </div>

  <!-- TABLE INTRO -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px">
    <div>
      <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px">Complete Annual Projection</div>
      <div style="font-size:9px;color:#94A3B8;margin-top:2px">Age ${age} → ${fireTargetAge} · ${base.projections.length} years</div>
    </div>
    <div style="display:flex;gap:12px">${legendItems}</div>
  </div>

  <!-- TABLE -->
  <div style="background:white;border-radius:16px;overflow:hidden;border:1px solid #E6EAE8;box-shadow:0 1px 4px rgba(0,0,0,0.04)">
    <div style="background:#0B6B3A;padding:10px 14px">
      <div style="font-size:11px;font-weight:700;color:white;text-transform:uppercase;letter-spacing:0.5px">Year-by-Year Projection (Age ${age}→${fireTargetAge})</div>
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

  ${pageFooter(4, 5)}
</div>`;
}
