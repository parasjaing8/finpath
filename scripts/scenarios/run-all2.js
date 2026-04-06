/**
 * Multi-Scenario Test Runner #2 — 10 New Users
 * =============================================
 * Runs scenarios 6-15 through the FIRE calculation engine
 * with exhaustive analysis, edge case reporting, and cross-scenario comparison.
 */

const { runScenario, fmt } = require('./engine');

const scenarios = [
  require('./scenario-6-rohan'),
  require('./scenario-7-divya'),
  require('./scenario-8-arjun'),
  require('./scenario-9-kavita'),
  require('./scenario-10-rahul'),
  require('./scenario-11-neha'),
  require('./scenario-12-sanjay'),
  require('./scenario-13-tanvi'),
  require('./scenario-14-kiran'),
  require('./scenario-15-preethi'),
];

const LINE = '═'.repeat(80);
const DASH = '─'.repeat(80);

console.log(`\n${LINE}`);
console.log('FINPATH — SCENARIO TEST BATCH 2 (Scenarios 6-15)');
console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
console.log(`Engine: simulation-based corpus + pension-as-withdrawal`);
console.log(LINE);

const allResults = [];

for (const scenario of scenarios) {
  const result = runScenario(scenario);
  allResults.push(result);

  console.log(`\n${LINE}`);
  console.log(`SCENARIO: ${result.name}`);
  console.log(scenario.description);
  console.log(DASH);

  console.log(`\nPROFILE:`);
  console.log(`  Age: ${result.profile.currentAge} | Salary: ${fmt(result.profile.monthly_income)}/month`);
  console.log(`  Expenses: ${result.expenseCount} items | Assets: ${result.assetCount} items`);
  console.log(`  Investable NW: ${fmt(result.investableNetWorth)} | Total NW: ${fmt(result.totalNetWorth)}`);
  console.log(`  SIP: ${fmt(result.sipAmount)}/month | Step-up: ${result.stepUpRate}%/yr`);
  console.log(`  Returns: Pre-ret ${result.sipReturnRate}%, Post-ret ${result.postSipReturnRate}%`);
  console.log(`  Retire at: ${result.retirementAge} | SIP stops: ${scenario.goals.sip_stop_age}`);
  console.log(`  Pension target: ${result.pensionIncome > 0 ? fmt(result.pensionIncome) + '/month (today\'s value)' : 'None'}`);
  console.log(`  FIRE type: ${scenario.goals.fire_type || 'moderate'} (SWR ${scenario.goals.withdrawal_rate || 5}%)`);

  console.log(`\nRESULTS:`);
  console.log(`  FIRE Corpus needed:   ${fmt(result.fireCorpus)}`);
  console.log(`  Required SIP:         ${fmt(result.requiredSIP)}/month`);
  console.log(`  Current SIP:          ${fmt(result.sipAmount)}/month`);
  console.log(`  On Track:             ${result.isOnTrack ? '✅ YES' : '❌ NO'}`);
  console.log(`  FIRE achieved at:     ${result.fireAchievedAge > 0 ? `Age ${result.fireAchievedAge}` : 'Never'}`);
  console.log(`  PV of all expenses:   ${fmt(result.totalPV)}`);
  const gap = result.isOnTrack ? 0 : result.fireCorpus - result.milestoneData.find(d => d.age === result.retirementAge)?.netWorth || 0;
  if (!result.isOnTrack) {
    const nwAtRetire = result.milestoneData.find(d => d.age === result.retirementAge);
    if (nwAtRetire) {
      console.log(`  NW at retirement:     ${fmt(nwAtRetire.netWorth)} (${fmt(result.fireCorpus - nwAtRetire.netWorth)} SHORT)`);
    }
  } else {
    const nwAtRetire = result.milestoneData.find(d => d.age === result.retirementAge);
    if (nwAtRetire) {
      console.log(`  NW at retirement:     ${fmt(nwAtRetire.netWorth)} (${fmt(nwAtRetire.netWorth - result.fireCorpus)} SURPLUS)`);
    }
  }

  // NW trajectory
  console.log(`\nNET WORTH TRAJECTORY:`);
  const ages = [result.profile.currentAge, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100];
  const relevantAges = [...new Set(ages)].filter(a => a >= result.profile.currentAge);
  for (const age of relevantAges) {
    const m = result.milestoneData.find(d => d.age === age);
    if (!m) continue;
    const fireMarker = (result.fireAchievedAge === age) ? ' ★ FIRE' : '';
    const retMarker = (age === result.retirementAge) ? ' ◆ RETIRE' : '';
    const negMarker = m.netWorth < 0 ? ' ⚠ NEGATIVE' : '';
    const sipStr = m.annualSIP > 0 ? `SIP:${fmt(m.annualSIP/12)}/mo` : 'No SIP';
    const expStr = `Exp:${fmt(m.plannedExpenses)}/yr`;
    const penStr = m.pensionIncome > 0 ? ` | Pen:${fmt(m.pensionIncome)}/yr` : '';
    console.log(`  Age ${String(age).padEnd(3)} NW: ${fmt(m.netWorth).padEnd(18)} ${sipStr.padEnd(22)} ${expStr}${penStr}${fireMarker}${retMarker}${negMarker}`);
  }

  // Issues
  if (result.issues.length > 0) {
    console.log(`\nISSUES DETECTED (${result.issues.length}):`);
    const seen = new Set();
    for (const issue of result.issues) {
      const key = `${issue.type}:${issue.age || 'x'}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sev = ['CORPUS_DEPLETED', 'NEGATIVE_NW', 'ZERO_CORPUS'].includes(issue.type) ? '🔴' :
                  ['SIP_TOO_HIGH', 'INFLATION_EXPLOSION', 'TIGHT_AT_100'].includes(issue.type) ? '🟡' : '🟠';
      console.log(`  ${sev} [${issue.type}] ${issue.message}`);
    }
  } else {
    console.log(`\nISSUES DETECTED: None ✅`);
  }
}

// ============================================================
// CROSS-SCENARIO SUMMARY TABLE
// ============================================================
console.log(`\n\n${LINE}`);
console.log('CROSS-SCENARIO COMPARISON TABLE');
console.log(LINE);
console.log(`${'Scenario'.padEnd(38)} ${'Corpus'.padEnd(14)} ${'Req SIP'.padEnd(12)} ${'Cur SIP'.padEnd(12)} ${'Track'.padEnd(8)} ${'FIRE Age'}`);
console.log(DASH);
for (const r of allResults) {
  const short = r.name.length > 37 ? r.name.substring(0, 34) + '...' : r.name;
  console.log(`${short.padEnd(38)} ${fmt(r.fireCorpus).padEnd(14)} ${fmt(r.requiredSIP).padEnd(12)} ${fmt(r.sipAmount).padEnd(12)} ${(r.isOnTrack ? '✅' : '❌').padEnd(8)} ${r.fireAchievedAge > 0 ? r.fireAchievedAge : 'Never'}`);
}

// ============================================================
// CONSOLIDATED ISSUES + PATTERNS
// ============================================================
console.log(`\n${LINE}`);
console.log('CONSOLIDATED ISSUE ANALYSIS');
console.log(LINE);

const issueTypes = {};
for (const r of allResults) {
  const seen = new Set();
  for (const issue of r.issues) {
    const key = `${issue.type}:${issue.age || 'x'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!issueTypes[issue.type]) issueTypes[issue.type] = [];
    issueTypes[issue.type].push({ scenario: r.name.split('—')[0].trim(), ...issue });
  }
}
for (const [type, items] of Object.entries(issueTypes).sort((a, b) => b[1].length - a[1].length)) {
  const sev = ['CORPUS_DEPLETED', 'NEGATIVE_NW', 'ZERO_CORPUS'].includes(type) ? '🔴' :
              ['SIP_TOO_HIGH', 'INFLATION_EXPLOSION'].includes(type) ? '🟡' : '🟠';
  console.log(`\n${sev} ${type} (${items.length} scenarios):`);
  for (const item of items) {
    console.log(`   → ${item.scenario}: ${item.message}`);
  }
}

// ============================================================
// STATS
// ============================================================
console.log(`\n${LINE}`);
console.log('STATISTICS');
console.log(LINE);
const onTrack = allResults.filter(r => r.isOnTrack).length;
const avgCorpus = allResults.reduce((s, r) => s + r.fireCorpus, 0) / allResults.length;
const maxCorpus = allResults.reduce((a, b) => a.fireCorpus > b.fireCorpus ? a : b);
const minCorpus = allResults.filter(r => r.fireCorpus > 0).reduce((a, b) => a.fireCorpus < b.fireCorpus ? a : b);
console.log(`On Track: ${onTrack}/${allResults.length}`);
console.log(`Off Track: ${allResults.length - onTrack}/${allResults.length}`);
console.log(`Average FIRE Corpus: ${fmt(avgCorpus)}`);
console.log(`Largest Corpus: ${maxCorpus.name.split('—')[0].trim()} — ${fmt(maxCorpus.fireCorpus)}`);
console.log(`Smallest Corpus: ${minCorpus.name.split('—')[0].trim()} — ${fmt(minCorpus.fireCorpus)}`);
const totalIssues = allResults.reduce((s, r) => s + new Set(r.issues.map(i => `${i.type}:${i.age||'x'}`)).size, 0);
console.log(`Total unique issues: ${totalIssues}`);

// ============================================================
// EDGE CASE REGISTER
// ============================================================
console.log(`\n${LINE}`);
console.log('EDGE CASE REGISTER');
console.log(LINE);
const edgeCases = [
  { scenario: 'Rohan (S6)', case: 'Retire at 40 (only 20yr accumulation)', result: allResults[0] },
  { scenario: 'Divya (S7)', case: 'Zero step-up + SIP stops 5yr before retire', result: allResults[1] },
  { scenario: 'Arjun (S8)', case: 'RSU vesting + ₹1L pension (medium FIRE 95)', result: allResults[2] },
  { scenario: 'Kavita (S9)', case: 'Single parent + slim FIRE (85) + gold asset', result: allResults[3] },
  { scenario: 'Rahul (S10)', case: 'Govt pension ₹35K + zero step-up + PF-heavy', result: allResults[4] },
  { scenario: 'Neha (S11)', case: 'Low income ₹45K + kid college post-retirement', result: allResults[5] },
  { scenario: 'Sanjay (S12)', case: 'RE-dominant NW + ₹1.5L pension + 8yr runway', result: allResults[6] },
  { scenario: 'Tanvi (S13)', case: 'Perpetual rent + DINK + SIP stops 3yr early', result: allResults[7] },
  { scenario: 'Kiran (S14)', case: 'Inherited home + NPS/PPF heavy + modest pension', result: allResults[8] },
  { scenario: 'Preethi (S15)', case: 'Oldest (45) + UGC pension ₹55K + large EPF/NPS', result: allResults[9] },
];
for (const ec of edgeCases) {
  const r = ec.result;
  const nwAtRetire = r.milestoneData.find(d => d.age === r.retirementAge);
  console.log(`\n  ${ec.scenario}: ${ec.case}`);
  console.log(`    Corpus: ${fmt(r.fireCorpus)} | Req SIP: ${fmt(r.requiredSIP)}/mo | Status: ${r.isOnTrack ? '✅ On Track' : '❌ Off Track'}`);
  if (nwAtRetire) console.log(`    NW at retire: ${fmt(nwAtRetire.netWorth)}`);
  const negAge = r.milestoneData.find(d => d.age >= r.retirementAge && d.netWorth < 0);
  if (negAge) console.log(`    ⚠ Money runs out at age: ${negAge.age}`);
}
