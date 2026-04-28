import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { Asset, Expense, Profile } from '../engine/types';
import { YearProjection, CalculationOutput, formatCurrencyFull, getAge } from '../engine/calculator';

export async function exportToCSV(
  profile: Profile,
  assets: Asset[],
  expenses: Expense[],
  projections: YearProjection[],
  calc?: CalculationOutput,
): Promise<void> {
  const date = new Date().toISOString().split('T')[0];

  function q(value: string | number | null | undefined): string {
    const s = value == null ? '' : String(value);
    return `"${s.replace(/"/g, '""')}"`;
  }

  let csv = `${q('FinPath Export - ' + profile.name + ' - ' + date)}\n\n`;

  // --- SUMMARY section (requires calc output) ---
  if (calc) {
    const cur = profile.currency;
    const age = getAge(profile.dob);
    csv += 'SUMMARY\n';
    csv += [q('Field'), q('Value')].join(',') + '\n';
    csv += [q('Name'), q(profile.name)].join(',') + '\n';
    csv += [q('Age'), q(age)].join(',') + '\n';
    csv += [q('Currency'), q(cur)].join(',') + '\n';
    csv += [q('Monthly Income'), q(formatCurrencyFull(profile.monthly_income, cur))].join(',') + '\n';
    csv += [q('Required Monthly SIP'), q(formatCurrencyFull(calc.requiredMonthlySIP, cur))].join(',') + '\n';
    csv += [q('FIRE Corpus Target'), q(formatCurrencyFull(calc.fireCorpus, cur))].join(',') + '\n';
    csv += [q('Current Net Worth'), q(formatCurrencyFull(calc.totalNetWorth, cur))].join(',') + '\n';
    csv += [q('Net Worth at Retirement'), q(formatCurrencyFull(calc.netWorthAtRetirement, cur))].join(',') + '\n';
    csv += [q('Net Worth at Age 100'), q(formatCurrencyFull(calc.netWorthAtAge100, cur))].join(',') + '\n';
    if (calc.fireAchievedAge > 0) csv += [q('FIRE Achieved Age'), q(calc.fireAchievedAge)].join(',') + '\n';
    if (calc.failureAge > 0) csv += [q('Corpus Depletion Age'), q(calc.failureAge)].join(',') + '\n';
    csv += '\n';
  }

  // --- ASSETS section ---
  csv += 'ASSETS\n';
  csv += [q('Category'), q('Name'), q('Current Value'), q('Currency'), q('ROI%'), q('Recurring'), q('Vesting Amount'), q('Frequency')].join(',') + '\n';
  for (const a of assets) {
    csv += [q(a.category), q(a.name), q(a.current_value), q(a.currency), q(a.expected_roi), q(a.is_recurring ? 'Yes' : 'No'), q(a.recurring_amount), q(a.recurring_frequency)].join(',') + '\n';
  }

  // --- EXPENSES section ---
  csv += '\nEXPENSES\n';
  csv += [q('Name'), q('Category'), q('Amount Today'), q('Type'), q('Frequency'), q('Start Date'), q('End Date'), q('Inflation Rate%')].join(',') + '\n';
  for (const e of expenses) {
    csv += [q(e.name), q(e.category), q(e.amount), q(e.expense_type), q(e.frequency), q(e.start_date), q(e.end_date), q(e.inflation_rate)].join(',') + '\n';
  }

  // --- YEAR BY YEAR PROJECTION section ---
  csv += '\nYEAR BY YEAR PROJECTION\n';
  csv += [q('Year'), q('Age'), q('Annual SIP'), q('Vesting Income'), q('Planned Expenses'), q('Annual Withdrawal'), q('Corpus Withdrawal'), q('Net Worth EOY')].join(',') + '\n';
  for (const p of projections) {
    csv += [q(p.year), q(p.age), q(Math.round(p.annualSIP)), q(Math.round(p.vestingIncome)), q(Math.round(p.plannedExpenses)), q(Math.round(p.pensionIncome)), q(Math.round(p.totalNetExpenses)), q(Math.round(p.netWorthEOY))].join(',') + '\n';
  }

  const fileName = `FinPath_${profile.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${date}.csv`;
  const filePath = `${LegacyFileSystem.cacheDirectory}${fileName}`;
  try {
    await LegacyFileSystem.writeAsStringAsync(filePath, csv, { encoding: LegacyFileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, { mimeType: 'text/csv', dialogTitle: 'Export FinPath Data' });
    } else {
      Alert.alert('Export', 'Sharing is not available on this device.');
    }
  } catch (e) {
    Alert.alert('Export Failed', 'Could not export data. Please try again.');
  }
}
