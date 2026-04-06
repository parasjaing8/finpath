/**
 * Multi-Scenario Test Runner
 * ===========================
 * Runs all 5 user scenarios through the FIRE calculation engine
 * and outputs detailed analysis for each.
 */

const { runScenario, fmt } = require('./engine');

const scenarios = [
  require('./scenario-1-priya'),
  require('./scenario-2-amit'),
  require('./scenario-3-sneha'),
  require('./scenario-4-vikram'),
  require('./scenario-5-meera'),
];

const LINE = '═'.repeat(80);
const DASH = '─'.repeat(80);

console.log(`\n${LINE}`);
console.log('FINPATH — MULTI-SCENARIO TEST RESULTS');
console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
console.log(LINE);

const allResults = [];

for (const scenario of scenarios) {
  const result = runScenario(scenario);
  allResults.push(result);

  console.log(`\n${LINE}`);
  console.log(`SCENARIO: ${result.name}`);
  console.log(`${scenario.description}`);
  console.log(DASH);

  // Profile summary
  console.log(`\nPROFILE:`);
  console.log(`  Age: ${result.profile.currentAge} | Salary: ${fmt(result.profile.monthly_income)}/month`);
  console.log(`  Expenses: ${result.expenseCount} items | Assets: ${result.assetCount} items`);
  console.log(`  Investable NW: ${fmt(result.investableNetWorth)} | Total NW: ${fmt(result.totalNetWorth)}`);
  console.log(`  SIP: ${fmt(result.sipAmount)}/month | Step-up: ${result.stepUpRate}%/yr`);
  console.log(`  Returns: Pre-ret ${result.sipReturnRate}%, Post-ret ${result.postSipReturnRate}%`);
  console.log(`  Retire at: ${result.retirementAge} | Pension: ${result.pensionIncome > 0 ? fmt(result.pensionIncome) + '/month' : 'None'}`);

  // Key results
  console.log(`\nRESULTS:`);
  console.log(`  FIRE Corpus needed:   ${fmt(result.fireCorpus)}`);
  console.log(`  Required SIP:         ${fmt(result.requiredSIP)}/month`);
  console.log(`  Current SIP:          ${fmt(result.sipAmount)}/month`);
  console.log(`  On Track:             ${result.isOnTrack ? '✅ YES' : '❌ NO'}`);
  console.log(`  FIRE achieved at:     ${result.fireAchievedAge > 0 ? `Age ${result.fireAchievedAge}` : 'Never'}`);
  console.log(`  PV of all expenses:   ${fmt(result.totalPV)}`);

  // Net worth milestones
  console.log(`\nNET WORTH TRAJECTORY:`);
  const ages = [result.profile.currentAge, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100];
  const relevantAges = ages.filter(a => a >= result.profile.currentAge);
  for (const age of relevantAges) {
    const m = result.milestoneData.find(d => d.age === age);
    if (!m) continue;
    const marker = (result.fireAchievedAge === age) ? ' ★ FIRE' : '';
    const retMarker = (age === result.retirementAge) ? ' ◆ RETIRE' : '';
    const sipStr = m.annualSIP > 0 ? `SIP:${fmt(m.annualSIP/12)}/mo` : 'No SIP';
    const expStr = `Exp:${fmt(m.plannedExpenses)}/yr`;
    const penStr = m.pensionIncome > 0 ? ` Pen:${fmt(m.pensionIncome)}/yr` : '';
    console.log(`  Age ${String(age).padEnd(3)} NW: ${fmt(m.netWorth).padEnd(16)} ${sipStr.padEnd(22)} ${expStr}${penStr}${marker}${retMarker}`);
  }

  // Issues
  if (result.issues.length > 0) {
    console.log(`\nISSUES DETECTED (${result.issues.length}):`);
    // Deduplicate by type+age
    const seen = new Set();
    for (const issue of result.issues) {
      const key = `${issue.type}:${issue.age || 'x'}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`  ⚠ [${issue.type}] ${issue.message}`);
    }
  } else {
    console.log(`\nISSUES: None detected ✅`);
  }
}

// ─── CROSS-SCENARIO COMPARISON ───
console.log(`\n${LINE}`);
console.log('CROSS-SCENARIO COMPARISON');
console.log(LINE);

console.log(`\n${'Name'.padEnd(45)} ${'Age'.padEnd(5)} ${'Salary'.padEnd(12)} ${'FIRE Corpus'.padEnd(14)} ${'Req SIP'.padEnd(12)} ${'On Track'.padEnd(10)} ${'FIRE Age'.padEnd(10)} Issues`);
console.log('─'.repeat(120));
for (const r of allResults) {
  const name = r.name.substring(0, 44).padEnd(45);
  const age = String(r.profile.currentAge).padEnd(5);
  const salary = fmt(r.profile.monthly_income).padEnd(12);
  const corpus = fmt(r.fireCorpus).padEnd(14);
  const reqSip = fmt(r.requiredSIP).padEnd(12);
  const onTrack = (r.isOnTrack ? '✅' : '❌').padEnd(10);
  const fireAge = (r.fireAchievedAge > 0 ? String(r.fireAchievedAge) : 'Never').padEnd(10);
  const issues = r.issues.length;
  console.log(`${name} ${age} ${salary} ${corpus} ${reqSip} ${onTrack} ${fireAge} ${issues}`);
}

// ─── ISSUE SUMMARY ───
console.log(`\n${LINE}`);
console.log('CONSOLIDATED ISSUE SUMMARY');
console.log(LINE);

const issuesByType = {};
for (const r of allResults) {
  for (const issue of r.issues) {
    if (!issuesByType[issue.type]) issuesByType[issue.type] = [];
    issuesByType[issue.type].push({ scenario: r.name.split('—')[0].trim(), ...issue });
  }
}

if (Object.keys(issuesByType).length === 0) {
  console.log('\nNo issues detected across all scenarios ✅');
} else {
  for (const [type, instances] of Object.entries(issuesByType)) {
    // Count unique scenarios affected
    const affectedScenarios = [...new Set(instances.map(i => i.scenario))];
    console.log(`\n[${type}] — affects ${affectedScenarios.length}/5 scenarios: ${affectedScenarios.join(', ')}`);
    // Show first 3 examples
    const examples = instances.slice(0, 3);
    for (const ex of examples) {
      console.log(`  ${ex.scenario}: ${ex.message}`);
    }
    if (instances.length > 3) {
      console.log(`  ... and ${instances.length - 3} more`);
    }
  }
}

// ─── EDGE CASE CHECKS ───
console.log(`\n${LINE}`);
console.log('EDGE CASE ANALYSIS');
console.log(LINE);

for (const r of allResults) {
  const name = r.name.split('—')[0].trim();
  const checks = [];

  // 1. Does corpus go to 0 or negative?
  if (r.fireCorpus <= 0) checks.push('FIRE corpus is ₹0 — pension covers everything?');

  // 2. Does NW ever go negative post-retirement?
  const postRetNeg = r.milestoneData.filter(d => d.age >= r.retirementAge && d.netWorth < 0);
  if (postRetNeg.length > 0) checks.push(`NW goes negative at age ${postRetNeg[0].age}`);

  // 3. FIRE achieved before retirement?
  if (r.fireAchievedAge > 0 && r.fireAchievedAge < r.retirementAge) {
    checks.push(`FIRE achieved ${r.retirementAge - r.fireAchievedAge} years before planned retirement`);
  }

  // 4. FIRE never achieved?
  if (r.fireAchievedAge < 0) checks.push('FIRE never achieved — needs higher SIP or later retirement');

  // 5. SIP at retirement > 5x current salary?
  const yrsToRet = r.retirementAge - r.profile.currentAge;
  const sipAtRet = r.sipAmount * Math.pow(1 + r.stepUpRate / 100, yrsToRet);
  if (sipAtRet > r.profile.monthly_income * 5) {
    checks.push(`SIP at retirement (${fmt(sipAtRet)}/mo) exceeds 5x current salary — step-up unrealistic`);
  }

  // 6. Expenses at 80 > 50x current
  const exp80 = r.milestoneData.find(d => d.age === 80);
  const expNow = r.milestoneData.find(d => d.age === r.profile.currentAge);
  if (exp80 && expNow && expNow.plannedExpenses > 0) {
    const ratio = exp80.plannedExpenses / expNow.plannedExpenses;
    if (ratio > 30) checks.push(`Expenses at 80 are ${ratio.toFixed(0)}x current — inflation compounding concern`);
  }

  // 7. NW at 100
  const nw100 = r.milestoneData.find(d => d.age === 100);
  if (nw100) {
    if (nw100.netWorth > 1e11) checks.push(`NW at 100 = ${fmt(nw100.netWorth)} — seems unrealistically high (compounding artifact?)`);
  }

  // 8. Required SIP > current salary
  if (r.requiredSIP > r.profile.monthly_income) {
    checks.push(`Required SIP (${fmt(r.requiredSIP)}) > salary (${fmt(r.profile.monthly_income)}) — unachievable`);
  }

  console.log(`\n${name}:`);
  if (checks.length === 0) {
    console.log('  All checks passed ✅');
  } else {
    for (const c of checks) console.log(`  ⚠ ${c}`);
  }
}

console.log(`\n${LINE}`);
console.log('END OF TEST RESULTS');
console.log(LINE);
console.log('');
