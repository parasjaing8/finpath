// components.ts — reusable HTML block builders (pure, no global state)

export function pageHeader(page: number, total: number, title: string, name: string, age: number): string {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0 10px;border-bottom:1.5px solid #E6EAE8;margin-bottom:18px">
  <div style="display:flex;align-items:center;gap:10px">
    <div style="background:#0B6B3A;color:white;font-size:14px;font-weight:800;padding:5px 11px;border-radius:7px;letter-spacing:-0.3px">FP</div>
    <div>
      <div style="font-size:10px;font-weight:700;color:#0B6B3A;letter-spacing:0.5px;text-transform:uppercase">FinPath</div>
      <div style="font-size:8.5px;color:#94A3B8;margin-top:1px">Plan today. Live your freedom tomorrow.</div>
    </div>
  </div>
  <div style="font-size:11px;font-weight:700;color:#1E293B;text-align:center;letter-spacing:0.3px;text-transform:uppercase">${title}</div>
  <div style="text-align:right">
    <div style="font-size:11px;color:#1E293B;font-weight:600">${name} · Age ${age}</div>
    <div style="font-size:9px;color:#94A3B8;margin-top:2px">${date}</div>
    <div style="display:inline-block;background:#EAF7EF;color:#0B6B3A;font-size:8.5px;font-weight:700;padding:2px 8px;border-radius:10px;margin-top:3px">Page ${page} of ${total}</div>
  </div>
</div>`;
}

export function metricCard(label: string, value: string, sub: string, accent = '#0B6B3A', bg = '#F7FBF8'): string {
  return `<div style="background:${bg};border:1px solid #E6EAE8;border-radius:14px;padding:14px 16px;box-shadow:0 1px 4px rgba(0,0,0,0.04)">
  <div style="font-size:9px;color:#64748B;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:5px;font-weight:600">${label}</div>
  <div style="font-size:20px;font-weight:800;color:${accent};line-height:1;margin-bottom:3px">${value}</div>
  <div style="font-size:9.5px;color:#94A3B8">${sub}</div>
</div>`;
}

export function insightCard(icon: string, title: string, body: string, accentBg: string, accentColor: string): string {
  return `<div style="background:${accentBg};border-radius:14px;padding:14px 16px;height:100%">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
    <div style="width:30px;height:30px;border-radius:50%;background:${accentColor};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">${icon}</div>
    <div style="font-size:11px;font-weight:700;color:#1E293B">${title}</div>
  </div>
  <div style="font-size:10px;color:#64748B;line-height:1.55">${body}</div>
</div>`;
}

export function scenarioCard(
  emoji: string,
  label: string,
  depleteAge:    number,
  accent:        string,
  bg:            string,
  fireTargetAge: number,
): string {
  const ok      = depleteAge <= 0 || depleteAge > fireTargetAge;
  const display = ok ? `${fireTargetAge}+` : `${depleteAge}`;
  const sub     = ok ? 'Sustains to target' : `${fireTargetAge - depleteAge} yr shortfall`;
  return `<div style="background:${bg};border-radius:12px;padding:10px 12px;border:1px solid ${accent}22">
  <div style="font-size:14px;margin-bottom:4px">${emoji}</div>
  <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:${accent};margin-bottom:3px">${label}</div>
  <div style="font-size:20px;font-weight:800;color:${accent};line-height:1">Age ${display}</div>
  <div style="font-size:8.5px;color:#94A3B8;margin-top:3px">${sub}</div>
</div>`;
}

export function healthMetric(
  icon:   string,
  label:  string,
  value:  string,
  sub:    string,
  status: 'good' | 'warn' | 'bad' | 'neutral',
): string {
  const colors = {
    good:    { bg: '#EAF7EF', text: '#0B6B3A' },
    warn:    { bg: '#FFF8E1', text: '#F39C12' },
    bad:     { bg: '#FEE2E2', text: '#D64545' },
    neutral: { bg: '#F1F5F9', text: '#64748B' },
  };
  const c = colors[status];
  return `<div style="background:${c.bg};border-radius:14px;padding:12px 14px;text-align:center">
  <div style="font-size:18px;margin-bottom:4px">${icon}</div>
  <div style="font-size:9px;color:#64748B;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:3px">${label}</div>
  <div style="font-size:20px;font-weight:800;color:${c.text};line-height:1">${value}</div>
  <div style="font-size:8.5px;color:#94A3B8;margin-top:3px">${sub}</div>
</div>`;
}

export const PAGE_FOOTER = `
  <div style="margin-top:14px;padding-top:8px;border-top:1px solid #E6EAE8;display:flex;flex-direction:column;align-items:center;gap:5px">
    <div style="display:flex;gap:24px">${['Plan', 'Track', 'Explore', 'Achieve'].map(p => `<div style="font-size:9px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px">${p}</div>`).join('')}</div>
    <div style="font-size:7.5px;color:#C4C9D0;text-align:center;max-width:520px">This report contains mathematical projections generated from user-provided information and selected assumptions. It is intended for educational and planning purposes only and should not be interpreted as personalized investment advice.</div>
  </div>`;
