// page4.ts — Appendix: asset details, top holdings, liquidity summary, brand strip
import { ASSET_CATEGORIES } from '../../engine/types';
import { formatCurrencyFull } from '../../engine/calculator';
import type { ReportContext } from './context';
import { LOGO_IMG, pageFooter } from './components';

const CAT_COLORS: Record<string, string> = {
  EQUITY: '#0B6B3A', MUTUAL_FUND: '#4CAF50', DEBT: '#2D6CDF',
  FIXED_DEPOSIT: '#5C6BC0', PPF: '#00897B', EPF: '#00BCD4',
  GOLD: '#F4C542', REAL_ESTATE: '#8D6E63', CRYPTO: '#7E57C2',
  CASH: '#78909C', ESOP_RSU: '#F39C12', OTHERS: '#9E9E9E',
};

export function buildPage4(ctx: ReportContext): string {
  const { profile, goals, assets, base, fmt, cur, age, debtPct } = ctx;
  const getCatLabel = (k: string) => ASSET_CATEGORIES.find(c => c.key === k)?.label ?? k;
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const sortedAssets = [...assets].sort((a, b) => b.current_value - a.current_value);
  const assetRows = sortedAssets.map((a, i) => `
    <tr style="background:${i % 2 === 0 ? '#F8FAFC' : 'white'}">
      <td style="padding:7px 10px">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:6px;height:6px;border-radius:2px;background:${CAT_COLORS[a.category] ?? '#9E9E9E'}"></div>
          ${getCatLabel(a.category)}
        </div>
      </td>
      <td style="padding:7px 10px;color:#1E293B;font-weight:500">${a.name}${(a as any).is_self_use ? ' <span style="font-size:8px;background:#FEF2F2;color:#D64545;padding:1px 5px;border-radius:4px">Self-use</span>' : ''}</td>
      <td style="padding:7px 10px;text-align:right;font-weight:700">${formatCurrencyFull(a.current_value, cur)}</td>
      <td style="padding:7px 10px;text-align:right;color:#64748B">${a.expected_roi}%</td>
    </tr>`).join('');

  const top5 = [...assets]
    .filter(a => !(a as any).is_self_use)
    .sort((a, b) => b.current_value - a.current_value)
    .slice(0, 5);
  const top5Rows = top5.map((a, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #F1F5F9">
      <div style="width:24px;height:24px;border-radius:6px;background:${CAT_COLORS[a.category] ?? '#9E9E9E'};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:white">${i + 1}</div>
      <div style="flex:1">
        <div style="font-size:11px;font-weight:600;color:#1E293B">${a.name}</div>
        <div style="font-size:9px;color:#94A3B8">${getCatLabel(a.category)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;font-weight:700;color:#1E293B">${fmt(a.current_value)}</div>
        <div style="font-size:9px;color:#94A3B8">${a.expected_roi}% ROI</div>
      </div>
    </div>`).join('');

  return `
<!-- ═══ PAGE 4 ═══════════════════════════════════════════════════════════ -->
<div style="padding:20px 22px 0;page-break-before:always;break-before:page">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0 10px;border-bottom:1.5px solid #E6EAE8;margin-bottom:18px">
    <div style="display:flex;align-items:center;gap:10px">
      <img src="${LOGO_IMG}" style="width:36px;height:36px;border-radius:6px"/>
      <div>
        <div style="font-size:10px;font-weight:700;color:#0B6B3A;letter-spacing:0.5px;text-transform:uppercase">FinPath</div>
        <div style="font-size:8.5px;color:#94A3B8;margin-top:1px">Plan today. Live your freedom tomorrow.</div>
      </div>
    </div>
    <div style="font-size:11px;font-weight:700;color:#1E293B;text-align:center;letter-spacing:0.3px;text-transform:uppercase">Appendix</div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#1E293B;font-weight:600">${profile.name} · Age ${age}</div>
      <div style="font-size:9px;color:#94A3B8;margin-top:2px">${date}</div>
    </div>
  </div>

  <!-- ASSET TABLE + TOP 5 -->
  <div style="display:flex;gap:14px;margin-bottom:14px">
    <div style="flex:1;background:white;border-radius:16px;overflow:hidden;border:1px solid #E6EAE8;box-shadow:0 1px 4px rgba(0,0,0,0.04)">
      <div style="background:#0B6B3A;padding:10px 14px">
        <div style="font-size:11px;font-weight:700;color:white;text-transform:uppercase;letter-spacing:0.5px">Asset Details (${assets.length})</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:10px">
        <thead><tr>
          ${['Category', 'Asset Name', 'Value', 'ROI'].map(h =>
            `<th style="padding:7px 10px;text-align:${['Value', 'ROI'].includes(h) ? 'right' : 'left'};background:#F7FBF8;color:#64748B;font-size:9.5px;border-bottom:1px solid #E6EAE8">${h}</th>`
          ).join('')}
        </tr></thead>
        <tbody>${assetRows}</tbody>
        <tfoot>
          <tr style="background:#EAF7EF">
            <td colspan="2" style="padding:8px 10px;font-weight:700;color:#0B6B3A;font-size:10.5px">Total Investable Assets</td>
            <td style="padding:8px 10px;text-align:right;font-weight:800;color:#0B6B3A;font-size:11px">${formatCurrencyFull(base.investableNetWorth, cur)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div style="width:220px">
      <div style="background:white;border-radius:16px;padding:14px 16px;border:1px solid #E6EAE8;box-shadow:0 1px 4px rgba(0,0,0,0.04);margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Top 5 Holdings</div>
        ${top5Rows}
      </div>
    </div>
  </div>

  <!-- LIQUIDITY & SAFETY + INDIA NOTES -->
  <div style="display:flex;gap:14px;margin-bottom:14px">
    <div style="flex:1">
      <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Liquidity & Safety Summary</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:#FFF8E1;border-radius:12px;padding:12px 14px"><div style="font-size:9px;color:#F39C12;font-weight:700;text-transform:uppercase;margin-bottom:4px">Emergency Fund</div><div style="font-size:16px;font-weight:800;color:#1E293B">0 months</div><div style="font-size:9px;color:#94A3B8;margin-top:2px">Not tracked · common benchmark: 6 months</div></div>
        <div style="background:#EAF7EF;border-radius:12px;padding:12px 14px"><div style="font-size:9px;color:#0B6B3A;font-weight:700;text-transform:uppercase;margin-bottom:4px">Debt Ratio</div><div style="font-size:16px;font-weight:800;color:#0B6B3A">${debtPct}%</div><div style="font-size:9px;color:#94A3B8;margin-top:2px">EPF + PPF of investable corpus</div></div>
        <div style="background:#F1F5F9;border-radius:12px;padding:12px 14px"><div style="font-size:9px;color:#64748B;font-weight:700;text-transform:uppercase;margin-bottom:4px">Term Insurance</div><div style="font-size:14px;font-weight:800;color:#94A3B8">Not currently tracked by FinPath.</div><div style="font-size:9px;color:#94A3B8;margin-top:2px">Benchmark: 10–15× annual income</div></div>
        <div style="background:#F1F5F9;border-radius:12px;padding:12px 14px"><div style="font-size:9px;color:#64748B;font-weight:700;text-transform:uppercase;margin-bottom:4px">Dependents</div><div style="font-size:14px;font-weight:800;color:#94A3B8">Not currently tracked by FinPath.</div><div style="font-size:9px;color:#94A3B8;margin-top:2px">Factor dependents into corpus need</div></div>
      </div>
    </div>
    <div style="width:220px">
      <div style="background:#EAF7EF;border-radius:14px;padding:14px 16px;border:1px solid #C8E6C9;margin-bottom:10px">
        <div style="font-size:10px;font-weight:700;color:#0B6B3A;margin-bottom:6px">General Educational Information</div>
        ${[
          'EPS gives ₹7,500/month lifelong pension — an income floor not modelled here.',
          'NPS: 40% corpus must buy an annuity at age 60. 60% lump sum is tax-free.',
          'EPF (5+ yr) withdrawals are EEE-exempt. PPF fully tax-free.',
          'India SWR: 3.0–3.5% (vs US 4%) due to higher inflation.',
        ].map(t => `<div style="display:flex;gap:6px;margin-bottom:5px"><div style="width:4px;height:4px;border-radius:50%;background:#4CAF50;flex-shrink:0;margin-top:5px"></div><div style="font-size:9.5px;color:#64748B;line-height:1.5">${t}</div></div>`).join('')}
      </div>
    </div>
  </div>

  <!-- ABOUT THIS REPORT -->
  <div style="background:linear-gradient(135deg,#084E2A 0%,#0B6B3A 100%);border-radius:16px;padding:20px 24px;margin-bottom:14px;display:flex;gap:20px;align-items:center">
    <div style="flex:1">
      <div style="font-size:14px;font-weight:700;color:white;margin-bottom:8px">About This Report</div>
      ${[
        'Calculated using user-entered values and selected assumptions.',
        'Uses constant mathematical assumptions — does not model real market volatility.',
        'All projections are estimates only. Actual outcomes will vary.',
        'Educational planning tool only. Not financial advice.',
      ].map(t => `<div style="display:flex;gap:8px;margin-bottom:5px"><div style="color:#4CAF50;font-size:12px">✓</div><div style="font-size:10px;color:rgba(255,255,255,0.8);line-height:1.5">${t}</div></div>`).join('')}
    </div>
    <div style="text-align:center;flex-shrink:0">
      <div style="font-size:36px;margin-bottom:6px">⛰</div>
      <div style="font-size:11px;font-weight:700;color:white">Track your path to</div>
      <div style="font-size:11px;font-weight:700;color:#4CAF50">your financial goals.</div>
    </div>
  </div>

  <!-- DISCLAIMER -->
  <div style="background:#F8FAFC;border-radius:12px;padding:12px 16px;border:1px solid #E6EAE8;margin-bottom:14px">
    <div style="display:flex;gap:8px;align-items:flex-start">
      <div style="font-size:16px">🛡️</div>
      <div>
        <div style="font-size:10px;font-weight:700;color:#64748B;margin-bottom:4px">DISCLAIMER</div>
        <div style="font-size:9px;color:#94A3B8;line-height:1.6">Projections are estimates based on user-provided inputs and assumed growth rates. Past performance is not indicative of future results. Market returns, inflation, and personal circumstances are variable. FinPath is not a SEBI-registered investment advisor. This report is for informational and educational purposes only. Consult a licensed SEBI RIA before making major investment decisions. Generated ${date}.</div>
      </div>
    </div>
  </div>

  ${pageFooter(5, 5)}

  <!-- BRAND STRIP -->
  <div style="border:1px solid #E6EAE8;border-radius:14px;padding:14px 20px;display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:10px">
      <img src="${LOGO_IMG}" style="width:44px;height:44px;border-radius:8px"/>
      <div>
        <div style="font-size:14px;font-weight:800;color:#0B6B3A">FinPath</div>
        <div style="font-size:9px;color:#94A3B8">Plan today. Live your freedom tomorrow.</div>
      </div>
    </div>
    <div style="display:flex;gap:20px">
      ${[
        ['Plan',     '🗓'],
        ['Track',    '📊'],
        ['Optimize', '⚡'],
        ['Achieve',  '🎯'],
      ].map(([label, icon]) => `<div style="text-align:center"><div style="font-size:16px;margin-bottom:3px">${icon}</div><div style="font-size:9px;font-weight:700;color:#0B6B3A">${label}</div></div>`).join('')}
    </div>
    <div style="text-align:center;color:#94A3B8;font-size:9px;max-width:100px">Thank you for trusting FinPath in your financial journey.</div>
  </div>
</div>`;
}
