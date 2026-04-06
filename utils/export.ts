import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Asset, Expense, Profile } from '../db/queries';
import { YearProjection } from '../engine/calculator';

export async function exportToCSV(
  profile: Profile,
  assets: Asset[],
  expenses: Expense[],
  projections: YearProjection[],
): Promise<void> {
  const date = new Date().toISOString().split('T')[0];

  // Wrap a value in double-quotes and escape any internal double-quotes
  function q(value: string | number | null | undefined): string {
    const s = value == null ? '' : String(value);
    return `"${s.replace(/"/g, '""')}"`;
  }

  let csv = `${q('FinPath Export - ' + profile.name + ' - ' + date)}\n\n`;

  // Assets section
  csv += 'ASSETS\n';
  csv += [q('Category'), q('Name'), q('Current Value'), q('Currency'), q('ROI%'), q('Recurring'), q('Vesting Amount'), q('Frequency')].join(',') + '\n';
  for (const a of assets) {
    csv += [q(a.category), q(a.name), q(a.current_value), q(a.currency), q(a.expected_roi), q(a.is_recurring ? 'Yes' : 'No'), q(a.recurring_amount), q(a.recurring_frequency)].join(',') + '\n';
  }

  csv += '\nEXPENSES\n';
  csv += [q('Name'), q('Category'), q('Amount Today'), q('Type'), q('Frequency'), q('Start Date'), q('End Date'), q('Inflation Rate%')].join(',') + '\n';
  for (const e of expenses) {
    csv += [q(e.name), q(e.category), q(e.amount), q(e.expense_type), q(e.frequency), q(e.start_date), q(e.end_date), q(e.inflation_rate)].join(',') + '\n';
  }

  csv += '\nYEAR BY YEAR PROJECTION\n';
  csv += [q('Year'), q('Age'), q('Annual SIP'), q('Vesting Income'), q('Planned Expenses'), q('Pension/Income'), q('Total Net Expenses'), q('Net Worth EOY')].join(',') + '\n';
  for (const p of projections) {
    csv += [q(p.year), q(p.age), q(Math.round(p.annualSIP)), q(Math.round(p.vestingIncome)), q(Math.round(p.plannedExpenses)), q(Math.round(p.pensionIncome)), q(Math.round(p.totalNetExpenses)), q(Math.round(p.netWorthEOY))].join(',') + '\n';
  }

  const fileName = `FinPath_${profile.name.replace(/\s+/g, '_')}_${date}.csv`;
  const filePath = `${LegacyFileSystem.cacheDirectory}${fileName}`;
  await LegacyFileSystem.writeAsStringAsync(filePath, csv, { encoding: LegacyFileSystem.EncodingType.UTF8 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(filePath, { mimeType: 'text/csv', dialogTitle: 'Export FinPath Data' });
  }
}
