// svg.ts — inline SVG renderers used by all pages
import type { YearProjection } from '../../engine/calculator';

export function svgHeroRing(score: number, label: string, scoreColor: string): string {
  const W = 176, H = 176, cx = 88, cy = 88, r = 66;
  const circ  = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const gap    = circ - filled;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="13"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${scoreColor}" stroke-width="13"
    stroke-dasharray="${filled.toFixed(1)} ${gap.toFixed(1)}" stroke-linecap="round"
    transform="rotate(-90 ${cx} ${cy})"/>
  <circle cx="${cx}" cy="${cy}" r="${r - 20}" fill="rgba(255,255,255,0.06)"/>
  <text x="${cx}" y="${cy - 10}" font-size="46" font-weight="800" text-anchor="middle" fill="white" dominant-baseline="auto">${score}</text>
  <text x="${cx}" y="${cy + 10}" font-size="12" text-anchor="middle" fill="rgba(255,255,255,0.65)">/100</text>
  <text x="${cx}" y="${cy + 28}" font-size="11" font-weight="700" text-anchor="middle" fill="${scoreColor}">${label}</text>
</svg>`;
}

export function svgDonut(
  segments: { label: string; value: number; color: string }[],
  totalLabel: string,
  W = 200, H = 200,
): string {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total <= 0) return '';
  const cx = W / 2, cy = H / 2, outerR = 72, innerR = 44;
  let angle = -Math.PI / 2;
  const paths: string[] = [];
  for (const seg of segments) {
    const sweep = (seg.value / total) * 2 * Math.PI;
    const x1 = cx + outerR * Math.cos(angle),   y1 = cy + outerR * Math.sin(angle);
    const x2 = cx + outerR * Math.cos(angle + sweep), y2 = cy + outerR * Math.sin(angle + sweep);
    const ix1 = cx + innerR * Math.cos(angle + sweep), iy1 = cy + innerR * Math.sin(angle + sweep);
    const ix2 = cx + innerR * Math.cos(angle),         iy2 = cy + innerR * Math.sin(angle);
    const la = sweep > Math.PI ? 1 : 0;
    paths.push(`<path d="M ${x1.toFixed(1)},${y1.toFixed(1)} A ${outerR},${outerR} 0 ${la} 1 ${x2.toFixed(1)},${y2.toFixed(1)} L ${ix1.toFixed(1)},${iy1.toFixed(1)} A ${innerR},${innerR} 0 ${la} 0 ${ix2.toFixed(1)},${iy2.toFixed(1)} Z" fill="${seg.color}" stroke="white" stroke-width="1.5"/>`);
    angle += sweep;
  }
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${paths.join('\n  ')}
  <text x="${cx}" y="${cy - 6}" font-size="9" text-anchor="middle" fill="#64748B">Total</text>
  <text x="${cx}" y="${cy + 10}" font-size="13" font-weight="800" text-anchor="middle" fill="#1E293B">${totalLabel}</text>
</svg>`;
}

export function svgMountain(progressPct: number, year: number, retireAge: number): string {
  const W = 240, H = 160;
  const t  = Math.max(0.02, Math.min(1, progressPct / 100));
  // cubic bezier: base (40,145) → summit (120,18)
  const px = (1-t)*(1-t)*(1-t)*40 + 3*(1-t)*(1-t)*t*60 + 3*(1-t)*t*t*100 + t*t*t*120;
  const py = (1-t)*(1-t)*(1-t)*145 + 3*(1-t)*(1-t)*t*140 + 3*(1-t)*t*t*60 + t*t*t*18;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E8F5E9"/><stop offset="100%" stop-color="#F9FBF9"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#skyG)" rx="10"/>
  <polygon points="10,155 85,60 160,155"  fill="#A5D6A7" opacity="0.35"/>
  <polygon points="80,155 155,75 230,155" fill="#81C784" opacity="0.25"/>
  <polygon points="120,18 220,148 20,148" fill="#0B6B3A" opacity="0.18"/>
  <polygon points="120,18 200,138 40,138" fill="#0B6B3A" opacity="0.22"/>
  <polygon points="120,18 138,52 102,52"  fill="white"   opacity="0.85"/>
  <path d="M 40,145 C 60,140 100,60 120,18" fill="none" stroke="#0B6B3A" stroke-width="2" stroke-dasharray="4,3.5" opacity="0.55"/>
  <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="7.5" fill="#4CAF50" stroke="white" stroke-width="2.5"/>
  <line x1="120" y1="18" x2="120" y2="4" stroke="#1E293B" stroke-width="1.8"/>
  <polygon points="120,4 136,11 120,18" fill="#F4C542"/>
  <text x="162" y="42" font-size="8.5" fill="#64748B" font-weight="500">Financial Freedom</text>
  <text x="162" y="57" font-size="18"  fill="#0B6B3A" font-weight="800">${year}</text>
  <text x="162" y="71" font-size="8.5" fill="#64748B">At age ${retireAge}</text>
</svg>`;
}

export function svgAreaChart(
  projections: YearProjection[],
  retireAge:   number,
  fireCorpus:  number,
  fmt:         (v: number) => string,
  W = 300, H = 130,
): string {
  const data = projections.filter(p => p.age <= retireAge);
  if (data.length < 2) return '';
  const PAD = { top: 12, right: 8, bottom: 28, left: 52 };
  const cW = W - PAD.left - PAD.right, cH = H - PAD.top - PAD.bottom;
  const maxV    = Math.max(...data.map(d => d.netWorthEOY), fireCorpus, 1);
  const minAge  = data[0].age, maxAge = data[data.length - 1].age, aR = maxAge - minAge || 1;
  const px = (a: number) => PAD.left + ((a - minAge) / aR) * cW;
  const py = (v: number) => PAD.top  + cH - Math.max(0, v / maxV) * cH;
  const pts      = data.map(d => `${px(d.age).toFixed(1)},${py(d.netWorthEOY).toFixed(1)}`);
  const linePts  = pts.join(' L ');
  const areaPath = `M ${px(minAge).toFixed(1)},${(PAD.top + cH).toFixed(1)} L ${linePts} L ${px(maxAge).toFixed(1)},${(PAD.top + cH).toFixed(1)} Z`;
  const fireY    = Math.min(PAD.top + cH, py(fireCorpus));
  const xLabels  = [minAge, Math.round((minAge + maxAge) / 2), maxAge].map(a => {
    const d = data.reduce((c, dd) => Math.abs(dd.age - a) < Math.abs(c.age - a) ? dd : c, data[0]);
    return `<text x="${px(d.age).toFixed(1)}" y="${(PAD.top + cH + 14).toFixed(1)}" font-size="8" text-anchor="middle" fill="#94A3B8">Age ${d.age}</text>`;
  });
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ag${W}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0B6B3A" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#0B6B3A" stop-opacity="0.02"/>
    </linearGradient>
  </defs>
  <line x1="${PAD.left}" y1="${fireY.toFixed(1)}" x2="${(W - PAD.right).toFixed(1)}" y2="${fireY.toFixed(1)}" stroke="#2D6CDF" stroke-width="1" stroke-dasharray="4,3" opacity="0.5"/>
  <path d="${areaPath}" fill="url(#ag${W})"/>
  <path d="M ${linePts}" fill="none" stroke="#0B6B3A" stroke-width="2.5" stroke-linejoin="round"/>
  ${xLabels.join('')}
  <text x="${PAD.left - 4}" y="${(PAD.top + 6).toFixed(1)}"       font-size="7.5" text-anchor="end" fill="#94A3B8">${fmt(maxV)}</text>
  <text x="${PAD.left - 4}" y="${(PAD.top + cH / 2 + 3).toFixed(1)}" font-size="7.5" text-anchor="end" fill="#94A3B8">${fmt(maxV / 2)}</text>
</svg>`;
}

export function svgDrawdownChart(
  projections: YearProjection[],
  failAge:     number,
  retireAge:   number,
  targetAge:   number,
  fmt:         (v: number) => string,
  W = 300, H = 130,
): string {
  const data = projections.filter(p => p.age >= retireAge);
  if (data.length < 2) return '';
  const PAD = { top: 12, right: 8, bottom: 28, left: 52 };
  const cW = W - PAD.left - PAD.right, cH = H - PAD.top - PAD.bottom;
  const maxV   = Math.max(...data.map(d => d.netWorthEOY), 1);
  const minAge = data[0].age, maxAge = data[data.length - 1].age, aR = maxAge - minAge || 1;
  const px = (a: number) => PAD.left + ((a - minAge) / aR) * cW;
  const py = (v: number) => PAD.top  + cH - Math.max(0, v / maxV) * cH;
  const pts  = data.map(d => `${px(d.age).toFixed(1)},${py(Math.max(0, d.netWorthEOY)).toFixed(1)}`);
  const hPts = failAge > 0
    ? data.filter(d => d.age <= failAge).map(d => `${px(d.age).toFixed(1)},${py(Math.max(0, d.netWorthEOY)).toFixed(1)}`)
    : [...pts];
  const areaPath = `M ${px(minAge).toFixed(1)},${(PAD.top + cH).toFixed(1)} L ${hPts.join(' L ')} L ${px(failAge > 0 ? Math.min(failAge, maxAge) : maxAge).toFixed(1)},${(PAD.top + cH).toFixed(1)} Z`;
  const xLabels  = [minAge, failAge > 0 ? failAge : Math.round((minAge + maxAge) / 2), maxAge]
    .filter((v, i, a) => a.indexOf(v) === i)
    .map(a => {
      const d = data.reduce((c, dd) => Math.abs(dd.age - a) < Math.abs(c.age - a) ? dd : c, data[0]);
      return `<text x="${px(d.age).toFixed(1)}" y="${(PAD.top + cH + 14).toFixed(1)}" font-size="8" text-anchor="middle" fill="${a === failAge ? '#D64545' : '#94A3B8'}">${a === failAge ? `⚠${d.age}` : `Age ${d.age}`}</text>`;
    });
  let failZone = '';
  if (failAge > 0 && failAge < maxAge) {
    const fx = px(failAge);
    failZone = `<rect x="${fx.toFixed(1)}" y="${PAD.top}" width="${(px(maxAge) - fx).toFixed(1)}" height="${cH}" fill="#FEE2E2" opacity="0.6"/>
  <line x1="${fx.toFixed(1)}" y1="${PAD.top}" x2="${fx.toFixed(1)}" y2="${(PAD.top + cH).toFixed(1)}" stroke="#D64545" stroke-width="1.5" stroke-dasharray="4,3"/>`;
  }
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="dg${W}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4CAF50" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#4CAF50" stop-opacity="0.02"/>
    </linearGradient>
  </defs>
  ${failZone}
  <path d="${areaPath}" fill="url(#dg${W})"/>
  <path d="M ${pts.join(' L ')}" fill="none" stroke="#43A047" stroke-width="2.5" stroke-linejoin="round"/>
  ${xLabels.join('')}
  <text x="${PAD.left - 4}" y="${(PAD.top + 6).toFixed(1)}"          font-size="7.5" text-anchor="end" fill="#94A3B8">${fmt(maxV)}</text>
  <text x="${PAD.left - 4}" y="${(PAD.top + cH / 2 + 3).toFixed(1)}" font-size="7.5" text-anchor="end" fill="#94A3B8">${fmt(maxV / 2)}</text>
</svg>`;
}
