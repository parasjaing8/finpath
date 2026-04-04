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
  let csv = `FinPath Export - ${profile.name} - ${date}\n\n`;

  // Assets section
  csv += 'ASSETS\n';
  csv += 'Category,Name,Current Value,Currency,ROI%,Recurring,Vesting Amount,Frequency\n';
  for (const a of assets) {
    csv += `${a.category},${a.name},${a.current_value},${a.currency},${a.expected_roi},${a.is_recurring ? 'Yes' : 'No'},${a.recurring_amount ?? ''},${a.recurring_frequency ?? ''}\n`;
  }

  csv += '\nEXPENSES\n';
  csv += 'Name,Category,Amount Today,Type,Frequency,Start Date,End Date,Inflation Rate%\n';
  for (const e of expenses) {
    csv += `${e.name},${e.category},${e.amount},${e.expense_type},${e.frequency ?? ''},${e.start_date ?? ''},${e.end_date ?? ''},${e.inflation_rate}\n`;
  }

  csv += '\nYEAR BY YEAR PROJECTION\n';
  csv += 'Year,Age,Annual SIP,Planned Expenses,Pension/Income,Total Net Expenses,Net Worth EOY\n';
  for (const p of projections) {
    csv += `${p.year},${p.age},${Math.round(p.annualSIP)},${Math.round(p.plannedExpenses)},${Math.round(p.pensionIncome)},${Math.round(p.totalNetExpenses)},${Math.round(p.netWorthEOY)}\n`;
  }

  const fileName = `FinPath_${profile.name.replace(/\s+/g, '_')}_${date}.csv`;
  const filePath = `${LegacyFileSystem.cacheDirectory}${fileName}`;
  await LegacyFileSystem.writeAsStringAsync(filePath, csv, { encoding: LegacyFileSystem.EncodingType.UTF8 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(filePath, { mimeType: 'text/csv', dialogTitle: 'Export FinPath Data' });
  }
}
