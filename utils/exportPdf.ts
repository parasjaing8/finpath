import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { Asset, Expense, Profile, ASSET_CATEGORIES } from '../engine/types';
import { YearProjection, CalculationOutput, formatCurrencyFull, getCurrencySymbol, getAge } from '../engine/calculator';

function svgBarChart(projections: YearProjection[], currency: string): string {
  const W = 560;
  const H = 196;
  const PAD = { top: 10, right: 10, bottom: 46, left: 60 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Sample every ~5 years for readability
  const sample = projections.filter((_, i) => i % 5 === 0 || i === projections.length - 1);
  const maxNW = Math.max(...sample.map(p => p.netWorthEOY), 1);

  const bars = sample.map((p, i) => {
    const x = PAD.left + (i / (sample.length - 1 || 1)) * chartW;
    const barH = Math.max(1, (Math.max(0, p.netWorthEOY) / maxNW) * chartH);
    const y = PAD.top + chartH - barH;
    const fill = p.isFireAchieved ? '#1B5E20' : '#81C784';
    return `<rect x="${x - 7}" y="${y}" width="14" height="${barH}" fill="${fill}" rx="2"/>`;
  });

  const xLabels = sample.map((p, i) => {
    const x = PAD.left + (i / (sample.length - 1 || 1)) * chartW;
    return `<text x="${x}" y="${PAD.top + chartH + 14}" font-size="9" text-anchor="middle" fill="#666">${p.age}</text>`;
  });

  // Y-axis: 0 and max
  const sym = getCurrencySymbol(currency);
  function fmt(v: number): string {
    if (currency === 'INR') {
      if (v >= 1e7) return `${sym}${(v / 1e7).toFixed(1)}Cr`;
      if (v >= 1e5) return `${sym}${(v / 1e5).toFixed(1)}L`;
    } else {
      if (v >= 1e9) return `${sym}${(v / 1e9).toFixed(1)}B`;
      if (v >= 1e6) return `${sym}${(v / 1e6).toFixed(1)}M`;
    }
    if (v >= 1e3) return `${sym}${(v / 1e3).toFixed(0)}K`;
    return `${sym}${v.toFixed(0)}`;
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <text x="${PAD.left - 4}" y="${PAD.top + 4}" font-size="9" text-anchor="end" fill="#666">${fmt(maxNW)}</text>
  <text x="${PAD.left - 4}" y="${PAD.top + chartH}" font-size="9" text-anchor="end" fill="#666">0</text>
  <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + chartH}" stroke="#ddd" stroke-width="1"/>
  <line x1="${PAD.left}" y1="${PAD.top + chartH}" x2="${W - PAD.right}" y2="${PAD.top + chartH}" stroke="#ddd" stroke-width="1"/>
  ${bars.join('\n  ')}
  ${xLabels.join('\n  ')}
  <text x="${W / 2}" y="${H - 4}" font-size="8" text-anchor="middle" fill="#999">Age →   Dark green = FIRE achieved</text>
</svg>`;
}

function buildHtml(
  profile: Profile,
  assets: Asset[],
  expenses: Expense[],
  projections: YearProjection[],
  calc: CalculationOutput,
): string {
  const cur = profile.currency;
  const age = getAge(profile.dob);
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const chart = svgBarChart(projections, cur);

  const f = (v: number) => formatCurrencyFull(v, cur);

  // Show currency column only when assets are in more than one currency
  const getCatLabel = (key: string) => ASSET_CATEGORIES.find(c => c.key === key)?.label ?? key;
  const getAssetCurrency = (a: Asset) => (a as any).value_currency ?? (a as any).currency ?? cur;
  const multiCurrency = assets.some(a => getAssetCurrency(a) !== cur);

  const assetRows = assets.map(a =>
    `<tr>
      <td>${getCatLabel(a.category)}</td>
      <td>${a.name}</td>
      <td style="text-align:right">${f(a.current_value)}</td>
      ${multiCurrency ? `<td>${getAssetCurrency(a)}</td>` : ''}
      <td>${a.expected_roi ?? '—'}%</td>
    </tr>`
  ).join('');

  const projRows = projections.filter((_, i) => i % 5 === 0 || i === projections.length - 1).map(p =>
    `<tr${p.isFireAchieved ? ' style="background:#E8F5E9"' : ''}><td>${p.year}</td><td>${p.age}</td><td style="text-align:right">${f(p.annualSIP)}</td><td style="text-align:right">${f(p.totalNetExpenses)}</td><td style="text-align:right;font-weight:600">${f(p.netWorthEOY)}</td></tr>`
  ).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 32px; }
  h1 { color: #1B5E20; font-size: 20px; margin-bottom: 4px; }
  .subtitle { color: #666; font-size: 11px; margin-bottom: 24px; }
  h2 { color: #1B5E20; font-size: 14px; border-bottom: 1px solid #C8E6C9; padding-bottom: 4px; margin-top: 24px; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .stat-card { background: #F1F8E9; border-radius: 8px; padding: 12px; }
  .stat-label { color: #666; font-size: 10px; margin-bottom: 4px; }
  .stat-value { color: #1B5E20; font-size: 16px; font-weight: 700; }
  .stat-sub { color: #888; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #E8F5E9; color: #1B5E20; padding: 6px 8px; text-align: left; }
  td { padding: 5px 8px; border-bottom: 1px solid #F5F5F5; }
  .warn { background: #FFF3E0; border-radius: 6px; padding: 8px 12px; font-size: 11px; color: #E65100; margin-top: 12px; }
  .footer { margin-top: 32px; color: #aaa; font-size: 10px; text-align: center; }
</style>
</head>
<body>
<h1>FinPath — FIRE Projection Report</h1>
<div class="subtitle">${profile.name} · Age ${age} · Generated ${date}</div>

<h2>FIRE Summary</h2>
<div class="summary-grid">
  <div class="stat-card">
    <div class="stat-label">Required Monthly SIP</div>
    <div class="stat-value">${f(calc.requiredMonthlySIP)}</div>
    <div class="stat-sub">per month</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">FIRE Corpus Target</div>
    <div class="stat-value">${f(calc.fireCorpus)}</div>
    <div class="stat-sub">needed at retirement</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Net Worth at Retirement</div>
    <div class="stat-value">${f(calc.netWorthAtRetirement)}</div>
    <div class="stat-sub">projected</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Current Net Worth</div>
    <div class="stat-value">${f(calc.totalNetWorth)}</div>
    <div class="stat-sub">today</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Net Worth at Age 100</div>
    <div class="stat-value">${f(calc.netWorthAtAge100)}</div>
    <div class="stat-sub">projected</div>
  </div>
  ${calc.fireAchievedAge > 0 ? `<div class="stat-card">
    <div class="stat-label">FIRE Achieved Age</div>
    <div class="stat-value">${calc.fireAchievedAge}</div>
    <div class="stat-sub">years old</div>
  </div>` : ''}
</div>

${calc.sipBurdenWarning ? `<div class="warn">${calc.sipBurdenWarning}</div>` : ''}

<h2>Net Worth Projection (Age)</h2>
${chart}

<h2>Assets (${assets.length})</h2>
<table>
  <tr><th>Category</th><th>Name</th><th>Value</th>${multiCurrency ? '<th>Currency</th>' : ''}<th>ROI</th></tr>
  ${assetRows}
</table>

<h2>Year-by-Year Snapshot (every 5 years)</h2>
<table>
  <tr><th>Year</th><th>Age</th><th>Annual SIP</th><th>Total Withdrawal</th><th>Net Worth</th></tr>
  ${projRows}
</table>

<div class="footer">Generated by FinPath · ${date} · For personal planning purposes only. Not financial advice.</div>
</body>
</html>`;
}

export async function exportToPDF(
  profile: Profile,
  assets: Asset[],
  expenses: Expense[],
  projections: YearProjection[],
  calc: CalculationOutput,
): Promise<void> {
  try {
    const html = buildHtml(profile, assets, expenses, projections, calc);
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    if (await Sharing.isAvailableAsync()) {
      const date = new Date().toISOString().split('T')[0];
      const name = profile.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Export FinPath PDF Report',
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('Export', 'Sharing is not available on this device.');
    }
  } catch (e: any) {
    Alert.alert('PDF Export Failed', e?.message ?? 'Could not generate PDF. Please try again.');
  }
}
