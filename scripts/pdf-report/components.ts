// components.ts — reusable HTML block builders (pure, no global state)

export const LOGO_IMG = 'data:image/png;base64,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';
export function pageHeader(page: number, total: number, title: string, name: string, age: number): string {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0 10px;border-bottom:1.5px solid #E6EAE8;margin-bottom:18px">
  <div style="display:flex;align-items:center;gap:10px">
    <img src="${LOGO_IMG}" style="width:36px;height:36px;border-radius:6px"/>
    <div>
      <div style="font-size:10px;font-weight:700;color:#0B6B3A;letter-spacing:0.5px;text-transform:uppercase">FinPath</div>
      <div style="font-size:8.5px;color:#94A3B8;margin-top:1px">Plan today. Live your freedom tomorrow.</div>
    </div>
  </div>
  <div style="font-size:11px;font-weight:700;color:#1E293B;text-align:center;letter-spacing:0.3px;text-transform:uppercase">${title}</div>
  <div style="text-align:right">
    <div style="font-size:11px;color:#1E293B;font-weight:600">${name} · Age ${age}</div>
    <div style="font-size:9px;color:#94A3B8;margin-top:2px">${date}</div>
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

export function pageFooter(page: number, total: number): string {
  const pillars = ['Plan', 'Track', 'Explore', 'Achieve']
    .map(p => `<div style="font-size:9px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px">${p}</div>`)
    .join('');
  return `
  <div style="margin-top:14px;padding-top:8px;border-top:1px solid #E6EAE8">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div style="display:flex;gap:24px">${pillars}</div>
      <div style="background:#EAF7EF;color:#0B6B3A;font-size:8.5px;font-weight:700;padding:2px 10px;border-radius:10px">Page ${page} of ${total}</div>
    </div>
    <div style="font-size:7.5px;color:#C4C9D0;text-align:center">This report contains mathematical projections generated from user-provided information and selected assumptions. It is intended for educational and planning purposes only and should not be interpreted as personalized investment advice.</div>
  </div>`;
}
