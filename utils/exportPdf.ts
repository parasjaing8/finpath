import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { Asset, Expense, Profile, Goals, ASSET_CATEGORIES } from '../engine/types';
import {
  YearProjection,
  CalculationOutput,
  CalculationInput,
  formatCurrencyFull,
  getCurrencySymbol,
  getAge,
  calculateProjections,
} from '../engine/calculator';
import { FxRates } from './fx';

// ─── Formatting helpers ────────────────────────────────────────────────────

function fmt(v: number, cur: string): string {
  const sym = getCurrencySymbol(cur);
  if (cur === 'INR') {
    if (v >= 1e7) return `${sym}${(v / 1e7).toFixed(1)}Cr`;
    if (v >= 1e5) return `${sym}${(v / 1e5).toFixed(1)}L`;
  } else {
    if (v >= 1e9) return `${sym}${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${sym}${(v / 1e6).toFixed(1)}M`;
  }
  if (v >= 1e3) return `${sym}${(v / 1e3).toFixed(0)}K`;
  return `${sym}${v.toFixed(0)}`;
}

// ─── Financial Health Score ────────────────────────────────────────────────

function computeHealthScore(
  calc: CalculationOutput,
  profile: Profile,
  goals: Goals,
  sipAmount: number,
): { score: number; label: string; color: string } {
  let score = 0;

  // Corpus progress (0–25)
  const progress = calc.fireCorpus > 0 ? Math.min(1, calc.totalNetWorth / calc.fireCorpus) : 0;
  score += Math.round(progress * 25);

  // Plan viability (0–40)
  if (!calc.failureAge || calc.failureAge === 0) score += 40;
  else if (calc.failureAge > (goals.fire_target_age ?? 100) - 5) score += 20;

  // SIP affordability (0–20)
  const income = profile.monthly_income ?? 0;
  const burden = income > 0 ? sipAmount / income : 0;
  if (burden < 0.3) score += 20;
  else if (burden < 0.5) score += 12;
  else if (burden < 0.7) score += 6;

  // Time to FIRE buffer (0–15)
  const age = getAge(profile.dob);
  const yearsLeft = goals.retirement_age - age;
  if (yearsLeft <= 10) score += 15;
  else if (yearsLeft <= 20) score += 12;
  else if (yearsLeft <= 30) score += 8;
  else score += 4;

  const capped = Math.min(100, Math.max(0, score));
  let label: string;
  let color: string;
  if (capped >= 80) { label = 'Excellent'; color = '#1B5E20'; }
  else if (capped >= 60) { label = 'Good'; color = '#33691E'; }
  else if (capped >= 40) { label = 'Fair'; color = '#F57C00'; }
  else { label = 'Needs Work'; color = '#C62828'; }
  return { score: capped, label, color };
}

// ─── Executive Summary bullets ────────────────────────────────────────────

function buildSummaryBullets(
  calc: CalculationOutput,
  profile: Profile,
  goals: Goals,
  sipAmount: number,
  cur: string,
): string[] {
  const age = getAge(profile.dob);
  const bullets: string[] = [];

  // Bullet 1: current wealth → retirement wealth
  bullets.push(
    `Portfolio of ${fmt(calc.totalNetWorth, cur)} today projected to reach ` +
    `${fmt(calc.netWorthAtRetirement, cur)} by age ${goals.retirement_age} ` +
    `(${goals.retirement_age - age} years away).`
  );

  // Bullet 2: FIRE status
  if (calc.fireAchievedAge > 0 && calc.fireAchievedAge < goals.retirement_age) {
    bullets.push(
      `At ${fmt(sipAmount, cur)}/month SIP, FIRE is achievable at age ${calc.fireAchievedAge} — ` +
      `${goals.retirement_age - calc.fireAchievedAge} year${goals.retirement_age - calc.fireAchievedAge !== 1 ? 's' : ''} ahead of target.`
    );
  } else if (calc.failureAge > 0) {
    bullets.push(
      `Corpus runs out at age ${calc.failureAge}. Increasing SIP to ` +
      `${fmt(calc.requiredMonthlySIP, cur)}/month would sustain withdrawals to age ${goals.fire_target_age ?? 100}.`
    );
  } else {
    bullets.push(
      `Corpus of ${fmt(calc.fireCorpus, cur)} required; projected corpus covers planned withdrawals through age ${goals.fire_target_age ?? 100}.`
    );
  }

  // Bullet 3: key risk or opportunity
  const income = profile.monthly_income ?? 0;
  if (income > 0 && sipAmount / income > 0.5) {
    bullets.push(
      `SIP of ${fmt(sipAmount, cur)}/month is ${Math.round((sipAmount / income) * 100)}% of monthly income — ` +
      `review expenses to reduce pressure on cash flow.`
    );
  } else if (calc.investableNetWorth > calc.fireCorpus * 0.7) {
    bullets.push(
      `Investable net worth (${fmt(calc.investableNetWorth, cur)}) is already ${Math.round((calc.investableNetWorth / calc.fireCorpus) * 100)}% ` +
      `of your FIRE corpus target — you are in a strong position.`
    );
  } else {
    bullets.push(
      `Annual step-up contributions and staying invested through market cycles are the highest-leverage actions at this stage.`
    );
  }

  return bullets;
}

// ─── Action Items ─────────────────────────────────────────────────────────

function buildActionItems(
  calc: CalculationOutput,
  profile: Profile,
  goals: Goals,
  sipAmount: number,
  cur: string,
): string[] {
  const items: string[] = [];
  const age = getAge(profile.dob);
  const progress = calc.fireCorpus > 0 ? calc.totalNetWorth / calc.fireCorpus : 0;
  const income = profile.monthly_income ?? 0;

  if (calc.failureAge > 0) {
    const gap = calc.requiredMonthlySIP - sipAmount;
    items.push(
      `Increase monthly SIP by ${fmt(Math.max(0, gap), cur)} to prevent corpus depletion at age ${calc.failureAge}.`
    );
  }

  if (income > 0 && sipAmount / income > 0.5) {
    items.push('Audit recurring expenses — reducing discretionary spend creates more investable surplus.');
  }

  if (progress < 0.1) {
    items.push(
      `You are at ${Math.round(progress * 100)}% of your corpus target. Starting a SIP today is the single highest-impact action.`
    );
  } else if (calc.fireAchievedAge > 0 && calc.fireAchievedAge < goals.retirement_age - 5) {
    items.push(
      `Sustaining your current SIP could let you retire at ${calc.fireAchievedAge} — ${goals.retirement_age - calc.fireAchievedAge} years early.`
    );
  }

  if (goals.retirement_age - age > 20 && progress < 0.5) {
    items.push('Enable 10% annual SIP step-up — it more than doubles corpus without changing today\'s cash flow.');
  }

  items.push('Review asset allocation and goals annually, especially after income changes or major life events.');

  return items.slice(0, 5);
}

// ─── SVG Charts ───────────────────────────────────────────────────────────

function svgLineChart(
  data: { age: number; value: number; fire: boolean }[],
  cur: string,
  title: string,
  milestoneAges: number[],
  W = 520,
  H = 180,
): string {
  if (data.length < 2) return '';
  const PAD = { top: 16, right: 12, bottom: 36, left: 58 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const maxV = Math.max(...data.map(d => d.value), 1);
  const minAge = data[0].age;
  const maxAge = data[data.length - 1].age;
  const ageRange = maxAge - minAge || 1;

  const px = (age: number) => PAD.left + ((age - minAge) / ageRange) * cW;
  const py = (v: number) => PAD.top + cH - Math.max(0, (v / maxV)) * cH;

  // Build path — split into green (fire achieved) and grey segments
  let firePath = '';
  let prePath = '';
  let inFire = false;
  let fireStart = '';

  const pts = data.map(d => `${px(d.age).toFixed(1)},${py(d.value).toFixed(1)}`);
  const fullPath = `M ${pts.join(' L ')}`;

  // Color by segment
  const segments: { pts: string[]; fire: boolean }[] = [];
  let seg: typeof segments[0] = { pts: [pts[0]], fire: data[0].fire };
  for (let i = 1; i < data.length; i++) {
    if (data[i].fire === seg.fire) {
      seg.pts.push(pts[i]);
    } else {
      segments.push(seg);
      seg = { pts: [pts[i - 1], pts[i]], fire: data[i].fire };
    }
  }
  segments.push(seg);

  const paths = segments.map(s =>
    `<path d="M ${s.pts.join(' L ')}" fill="none" stroke="${s.fire ? '#1B5E20' : '#81C784'}" stroke-width="2"/>`
  ).join('\n  ');

  // X-axis labels — every 5 years
  const xLabels: string[] = [];
  for (let age = Math.ceil(minAge / 5) * 5; age <= maxAge; age += 5) {
    const d = data.find(d => d.age === age);
    if (d) xLabels.push(`<text x="${px(age).toFixed(1)}" y="${PAD.top + cH + 14}" font-size="8" text-anchor="middle" fill="#666">${age}</text>`);
  }

  // Milestone diamonds
  const diamonds = milestoneAges.map(age => {
    const d = data.find(d => d.age === age);
    if (!d) return '';
    const cx = px(age);
    const cy = py(d.value);
    return `<polygon points="${cx},${cy - 6} ${cx + 5},${cy} ${cx},${cy + 6} ${cx - 5},${cy}" fill="#F57C00" opacity="0.9"/>`;
  }).filter(Boolean).join('\n  ');

  // Y-axis labels
  const yMax = `<text x="${PAD.left - 4}" y="${PAD.top + 6}" font-size="8" text-anchor="end" fill="#666">${fmt(maxV, cur)}</text>`;
  const yMid = `<text x="${PAD.left - 4}" y="${PAD.top + cH / 2}" font-size="8" text-anchor="end" fill="#666">${fmt(maxV / 2, cur)}</text>`;
  const yZero = `<text x="${PAD.left - 4}" y="${PAD.top + cH + 2}" font-size="8" text-anchor="end" fill="#666">0</text>`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + cH}" stroke="#e0e0e0" stroke-width="1"/>
  <line x1="${PAD.left}" y1="${PAD.top + cH}" x2="${W - PAD.right}" y2="${PAD.top + cH}" stroke="#e0e0e0" stroke-width="1"/>
  <line x1="${PAD.left}" y1="${PAD.top + cH / 2}" x2="${W - PAD.right}" y2="${PAD.top + cH / 2}" stroke="#f5f5f5" stroke-width="1" stroke-dasharray="3,3"/>
  ${yMax}${yMid}${yZero}
  ${paths}
  ${diamonds}
  ${xLabels.join('\n  ')}
  <text x="${(PAD.left + W - PAD.right) / 2}" y="${H - 2}" font-size="8" text-anchor="middle" fill="#aaa">${title}</text>
</svg>`;
}

function svgAllocationBar(assets: Asset[], cur: string): string {
  if (assets.length === 0) return '';
  const W = 520;
  const H = 60;
  const BAR_H = 22;
  const BAR_Y = 10;
  const PAD_L = 0;
  const PAD_R = 80;

  const byCat: Record<string, number> = {};
  for (const a of assets) {
    byCat[a.category] = (byCat[a.category] ?? 0) + a.current_value;
  }
  const total = Object.values(byCat).reduce((s, v) => s + v, 0);
  if (total <= 0) return '';

  const CAT_COLORS: Record<string, string> = {
    EQUITY: '#1B5E20', MUTUAL_FUND: '#2E7D32', DEBT: '#5C6BC0',
    FIXED_DEPOSIT: '#3949AB', PPF: '#00897B', EPF: '#00838F',
    GOLD: '#F9A825', REAL_ESTATE: '#6D4C41', CRYPTO: '#8E24AA',
    CASH: '#78909C', ESOP_RSU: '#D84315', OTHERS: '#9E9E9E',
  };

  const getCatLabel = (key: string) => ASSET_CATEGORIES.find(c => c.key === key)?.label ?? key;

  const sorted = Object.entries(byCat).sort(([, a], [, b]) => b - a);
  const barW = W - PAD_L - PAD_R;
  let offsetX = PAD_L;

  const rects = sorted.map(([cat, val]) => {
    const w = Math.max(1, (val / total) * barW);
    const r = `<rect x="${offsetX}" y="${BAR_Y}" width="${w.toFixed(1)}" height="${BAR_H}" fill="${CAT_COLORS[cat] ?? '#9E9E9E'}" rx="2"/>`;
    offsetX += w;
    return r;
  });

  // Legend below (compact, 3 per row)
  const legendItems = sorted.slice(0, 6).map(([cat, val], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const lx = col * (barW / 3);
    const ly = BAR_Y + BAR_H + 8 + row * 14;
    return `<rect x="${lx}" y="${ly}" width="8" height="8" fill="${CAT_COLORS[cat] ?? '#9E9E9E'}" rx="1"/>
<text x="${lx + 11}" y="${ly + 7}" font-size="8" fill="#555">${getCatLabel(cat)} ${Math.round((val / total) * 100)}%</text>`;
  });

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${rects.join('\n  ')}
  ${legendItems.join('\n  ')}
</svg>`;
}

// ─── Sensitivity table ─────────────────────────────────────────────────────

function buildSensitivityTable(
  profile: Profile,
  assets: Asset[],
  expenses: Expense[],
  goals: Goals,
  baseSip: number,
  baseSipReturn: number,
  basePostReturn: number,
  stepUpRate: number,
  fxRates: FxRates | undefined,
  cur: string,
): string {
  const baseInflation = goals.inflation_rate ?? 6;
  const inflScenarios = [baseInflation - 1, baseInflation, baseInflation + 1];
  const returnScenarios = [baseSipReturn - 2, baseSipReturn, baseSipReturn + 2];

  const cells: string[][] = [];
  for (const infl of inflScenarios) {
    const row: string[] = [];
    for (const ret of returnScenarios) {
      try {
        const g: Goals = { ...goals, inflation_rate: Math.max(1, infl) };
        const out = calculateProjections({
          profile, assets, expenses, goals: g,
          sipAmount: baseSip,
          sipReturnRate: Math.max(1, ret),
          postSipReturnRate: Math.max(1, basePostReturn + (ret - baseSipReturn)),
          stepUpRate,
          fxRates,
        });
        const val = out.requiredMonthlySIP;
        const color = val <= baseSip
          ? '#1B5E20'
          : val <= baseSip * 1.25
          ? '#F57C00'
          : '#C62828';
        row.push(`<td style="text-align:center;color:${color};font-weight:600">${fmt(val, cur)}</td>`);
      } catch {
        row.push('<td style="text-align:center;color:#999">—</td>');
      }
    }
    cells.push(row);
  }

  const colHeaders = returnScenarios.map(r =>
    `<th style="text-align:center;background:#E3F2FD;color:#1565C0">Return ${r > 0 ? '+' : ''}${r - baseSipReturn === 0 ? '' : (r - baseSipReturn > 0 ? '+' : '')}${r - baseSipReturn === 0 ? 'Base' : `${r - baseSipReturn}%`}<br/><span style="font-weight:400;font-size:9px">${r}%</span></th>`
  );

  const rows = cells.map((row, i) => {
    const infl = inflScenarios[i];
    const label = infl === baseInflation ? 'Base' : infl < baseInflation ? '−1%' : '+1%';
    return `<tr><td style="background:#FFF3E0;color:#E65100;font-weight:600">${label}<br/><span style="font-weight:400;font-size:9px">${infl}%</span></td>${row.join('')}</tr>`;
  });

  return `
<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:8px">
  <tr>
    <th style="background:#F5F5F5;color:#666;text-align:center">Inflation ↓ / Return →</th>
    ${colHeaders.join('')}
  </tr>
  ${rows.join('')}
</table>
<p style="font-size:9px;color:#aaa;margin-top:4px">Required monthly SIP under each scenario at your current plan settings. Green = at or below current SIP.</p>`;
}

// ─── HTML builder ─────────────────────────────────────────────────────────

function buildHtml(
  profile: Profile,
  assets: Asset[],
  expenses: Expense[],
  projections: YearProjection[],
  calc: CalculationOutput,
  goals: Goals,
  sipAmount: number,
  sipReturnRate: number,
  postSipReturnRate: number,
  stepUpRate: number,
  fxRates: FxRates | undefined,
): string {
  const cur = profile.currency;
  const age = getAge(profile.dob);
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const health = computeHealthScore(calc, profile, goals, sipAmount);
  const bullets = buildSummaryBullets(calc, profile, goals, sipAmount, cur);
  const actions = buildActionItems(calc, profile, goals, sipAmount, cur);

  // Pre-retirement projections (current age → retirement)
  const preRetirement = projections.filter(p => p.age <= goals.retirement_age);
  const postRetirement = projections.filter(p => p.age >= goals.retirement_age);

  const preData = preRetirement.map(p => ({ age: p.age, value: p.netWorthEOY, fire: p.isFireAchieved }));
  const postData = postRetirement.map(p => ({ age: p.age, value: Math.max(0, p.netWorthEOY), fire: p.isFireAchieved }));

  // Key milestone ages for diamonds
  const fireAge = calc.fireAchievedAge > 0 ? [calc.fireAchievedAge] : [];
  const preChart = svgLineChart(preData, cur, 'Age → Pre-retirement accumulation   ◆ = FIRE achieved', fireAge, 520, 180);
  const postChart = svgLineChart(postData, cur, 'Age → Post-retirement drawdown', [], 520, 160);
  const allocBar = svgAllocationBar(assets, cur);
  const sensitivityTable = buildSensitivityTable(
    profile, assets, expenses, goals,
    sipAmount, sipReturnRate, postSipReturnRate, stepUpRate, fxRates, cur
  );

  // Asset table
  const getCatLabel = (key: string) => ASSET_CATEGORIES.find(c => c.key === key)?.label ?? key;
  const getAssetCurrency = (a: Asset) => (a as any).value_currency ?? (a as any).currency ?? cur;
  const multiCurrency = assets.some(a => getAssetCurrency(a) !== cur);
  const assetRows = assets.map(a =>
    `<tr>
      <td>${getCatLabel(a.category)}</td>
      <td>${a.name}</td>
      <td style="text-align:right">${formatCurrencyFull(a.current_value, cur)}</td>
      ${multiCurrency ? `<td>${getAssetCurrency(a)}</td>` : ''}
      <td style="text-align:right">${a.expected_roi ?? '—'}%</td>
    </tr>`
  ).join('');

  // Snapshot table (every 5 years)
  const projRows = projections
    .filter((_, i) => i % 5 === 0 || i === projections.length - 1)
    .map(p =>
      `<tr${p.isFireAchieved ? ' style="background:#E8F5E9"' : ''}>
        <td>${p.year}</td><td>${p.age}</td>
        <td style="text-align:right">${formatCurrencyFull(p.annualSIP, cur)}</td>
        <td style="text-align:right">${formatCurrencyFull(p.totalNetExpenses, cur)}</td>
        <td style="text-align:right;font-weight:600">${formatCurrencyFull(p.netWorthEOY, cur)}</td>
      </tr>`
    ).join('');

  // Score gauge arc (simple SVG semi-circle)
  const scoreAngle = (health.score / 100) * 180;
  const r = 44;
  const cx = 60;
  const cy = 52;
  const startX = cx - r;
  const startY = cy;
  const rad = (scoreAngle * Math.PI) / 180;
  const endX = cx + r * Math.cos(Math.PI - rad);
  const endY = cy - r * Math.sin(rad);
  const largeArc = scoreAngle > 90 ? 1 : 0;
  const gaugeSvg = `<svg width="120" height="62" viewBox="0 0 120 62">
    <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="#e0e0e0" stroke-width="8" stroke-linecap="round"/>
    <path d="M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${endX.toFixed(1)} ${endY.toFixed(1)}" fill="none" stroke="${health.color}" stroke-width="8" stroke-linecap="round"/>
    <text x="${cx}" y="${cy - 6}" font-size="18" font-weight="700" text-anchor="middle" fill="${health.color}">${health.score}</text>
    <text x="${cx}" y="${cy + 10}" font-size="9" text-anchor="middle" fill="${health.color}">${health.label}</text>
  </svg>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 28px 36px; }
  h1 { color: #1B5E20; font-size: 20px; margin-bottom: 2px; }
  .subtitle { color: #666; font-size: 11px; margin-bottom: 20px; }
  h2 { color: #1B5E20; font-size: 13px; border-bottom: 2px solid #C8E6C9; padding-bottom: 3px; margin: 20px 0 10px; }
  .row { display: flex; gap: 16px; align-items: flex-start; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .stat-card { background: #F1F8E9; border-radius: 8px; padding: 10px 12px; }
  .stat-label { color: #666; font-size: 9px; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.3px; }
  .stat-value { color: #1B5E20; font-size: 15px; font-weight: 700; }
  .stat-sub { color: #888; font-size: 9px; margin-top: 1px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #E8F5E9; color: #1B5E20; padding: 6px 8px; text-align: left; font-size: 10px; }
  td { padding: 4px 8px; border-bottom: 1px solid #F5F5F5; vertical-align: middle; }
  .warn { background: #FFF3E0; border-radius: 6px; padding: 8px 12px; font-size: 11px; color: #E65100; margin: 10px 0; }
  .bullets { margin: 0; padding-left: 18px; }
  .bullets li { margin-bottom: 7px; line-height: 1.55; color: #333; font-size: 11px; }
  .actions li { margin-bottom: 6px; color: #1B5E20; font-size: 11px; line-height: 1.5; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; color: #fff; }
  .health-row { display: flex; align-items: center; gap: 20px; margin-bottom: 8px; }
  .footer { margin-top: 28px; color: #bbb; font-size: 9px; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
  .section-note { font-size: 9px; color: #aaa; margin-top: 4px; }
  .fire-strip { display: flex; align-items: center; gap: 0; margin: 8px 0 14px; }
  .fire-seg { height: 12px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #fff; }
</style>
</head>
<body>

<div class="row" style="justify-content:space-between;align-items:flex-start">
  <div>
    <h1>FinPath — FIRE Projection Report</h1>
    <div class="subtitle">${profile.name} · Age ${age} · Generated ${date}</div>
  </div>
  <div style="text-align:center">
    ${gaugeSvg}
    <div style="font-size:9px;color:#888;text-align:center">Financial Health Score</div>
  </div>
</div>

<h2>Executive Summary</h2>
<ul class="bullets">
  ${bullets.map(b => `<li>${b}</li>`).join('')}
</ul>

<h2>FIRE Snapshot</h2>
<div class="summary-grid">
  <div class="stat-card">
    <div class="stat-label">Required Monthly SIP</div>
    <div class="stat-value">${formatCurrencyFull(calc.requiredMonthlySIP, cur)}</div>
    <div class="stat-sub">per month</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">FIRE Corpus Target</div>
    <div class="stat-value">${fmt(calc.fireCorpus, cur)}</div>
    <div class="stat-sub">needed at retirement</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Net Worth at Retirement</div>
    <div class="stat-value">${fmt(calc.netWorthAtRetirement, cur)}</div>
    <div class="stat-sub">projected at age ${goals.retirement_age}</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Current Portfolio</div>
    <div class="stat-value">${fmt(calc.totalNetWorth, cur)}</div>
    <div class="stat-sub">today · ${Math.round((calc.totalNetWorth / (calc.fireCorpus || 1)) * 100)}% of target</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Investable Net Worth</div>
    <div class="stat-value">${fmt(calc.investableNetWorth, cur)}</div>
    <div class="stat-sub">excludes self-use assets</div>
  </div>
  ${calc.fireAchievedAge > 0 ? `<div class="stat-card" style="background:#E8F5E9">
    <div class="stat-label">FIRE Achieved Age</div>
    <div class="stat-value" style="color:#1B5E20">${calc.fireAchievedAge}</div>
    <div class="stat-sub">${calc.fireAchievedAge < goals.retirement_age ? `${goals.retirement_age - calc.fireAchievedAge} yr ahead of target` : 'at retirement age'}</div>
  </div>` : `<div class="stat-card" style="background:${calc.failureAge ? '#FFF3E0' : '#F5F5F5'}">
    <div class="stat-label">${calc.failureAge ? 'Corpus Depletion Age' : 'Net Worth at Age 100'}</div>
    <div class="stat-value" style="color:${calc.failureAge ? '#E65100' : '#555'}">${calc.failureAge ? calc.failureAge : fmt(calc.netWorthAtAge100, cur)}</div>
    <div class="stat-sub">${calc.failureAge ? 'increase SIP to prevent' : 'projected'}</div>
  </div>`}
</div>

${calc.sipBurdenWarning ? `<div class="warn">${calc.sipBurdenWarning}</div>` : ''}

<h2>Asset Allocation</h2>
${allocBar}

<h2>Pre-Retirement Accumulation (Age ${age} → ${goals.retirement_age})</h2>
${preChart}
<p class="section-note">Dark green = FIRE milestone achieved · Orange diamond = FIRE achieved age</p>

<h2>Post-Retirement Drawdown (Age ${goals.retirement_age} → ${goals.fire_target_age ?? 100})</h2>
${postChart}
<p class="section-note">${calc.failureAge ? `⚠ Corpus depleted at age ${calc.failureAge}` : 'Corpus sustains planned withdrawals through target age.'}</p>

<h2>Sensitivity Analysis — Required Monthly SIP</h2>
${sensitivityTable}

<h2>Action Items</h2>
<ol class="actions">
  ${actions.map(a => `<li>${a}</li>`).join('')}
</ol>

<h2>Assets (${assets.length})</h2>
<table>
  <tr><th>Category</th><th>Name</th><th style="text-align:right">Value</th>${multiCurrency ? '<th>Currency</th>' : ''}<th style="text-align:right">ROI</th></tr>
  ${assetRows}
</table>

<h2>Year-by-Year Projection (every 5 years)</h2>
<table>
  <tr><th>Year</th><th>Age</th><th style="text-align:right">Annual SIP</th><th style="text-align:right">Withdrawals</th><th style="text-align:right">Net Worth</th></tr>
  ${projRows}
</table>

<div class="footer">
  Generated by FinPath · ${date}<br/>
  Projections are estimates based on user inputs and assumed growth rates. Returns are not guaranteed.<br/>
  FinPath is not a SEBI-registered investment advisor. Consult a licensed financial advisor before making major investment decisions.
</div>

</body>
</html>`;
}

// ─── Public export ─────────────────────────────────────────────────────────

export async function exportToPDF(
  profile: Profile,
  assets: Asset[],
  expenses: Expense[],
  projections: YearProjection[],
  calc: CalculationOutput,
  goals?: Goals,
  sipAmount?: number,
  sipReturnRate?: number,
  postSipReturnRate?: number,
  stepUpRate?: number,
  fxRates?: FxRates,
): Promise<void> {
  try {
    const resolvedGoals: Goals = goals ?? {
      retirement_age: 60,
      sip_stop_age: 60,
      pension_income: 0,
      inflation_rate: 6,
      fire_type: 'moderate',
      fire_target_age: 100,
    };
    const html = buildHtml(
      profile, assets, expenses, projections, calc,
      resolvedGoals,
      sipAmount ?? calc.requiredMonthlySIP,
      sipReturnRate ?? 12,
      postSipReturnRate ?? 7,
      stepUpRate ?? 0,
      fxRates,
    );
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    if (await Sharing.isAvailableAsync()) {
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
