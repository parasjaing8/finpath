import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '../hooks/useColors';
import { YearProjection, formatCurrency } from '../engine/calculator';

const ROWS_PER_PAGE = 10;

interface Props {
  projections: YearProjection[];
  currency: string;
  firstFireYear: number;
}

export function ProjectionTable({ projections, currency, firstFireYear }: Props) {
  const colors = useColors();
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(projections.length / ROWS_PER_PAGE);
  const rows = projections.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
  const hasVesting = projections.some(p => p.vestingIncome > 0);

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}> 
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header */}
          <View style={[styles.row, styles.headerRow, { backgroundColor: colors.secondary }]}> 
            <Text style={[styles.cell, styles.narrow, styles.headerText, { color: colors.primary }]}>Year</Text>
            <Text style={[styles.cell, styles.narrow, styles.headerText, { color: colors.primary }]}>Age</Text>
            <Text style={[styles.cell, styles.wide, styles.headerText, styles.right, { color: colors.primary }]}>SIP</Text>
            {hasVesting && <Text style={[styles.cell, styles.wide, styles.headerText, styles.right, { color: colors.primary }]}>Vesting</Text>}
            <Text style={[styles.cell, styles.wide, styles.headerText, styles.right, { color: colors.primary }]}>Expenses</Text>
            <Text style={[styles.cell, styles.wide, styles.headerText, styles.right, { color: colors.primary }]}>Pension</Text>
            <Text style={[styles.cell, styles.wide, styles.headerText, styles.right, { color: colors.primary }]}>Net Worth</Text>
          </View>

          {/* Rows: FlatList for virtualization */}
          <FlatList
            data={rows}
            keyExtractor={row => String(row.year)}
            renderItem={({ item: row, index: idx }) => {
              const isFire = row.year === firstFireYear;
              return (
                <View
                  style={[
                    styles.row,
                    idx % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.card },
                    isFire && styles.fireRow,
                  ]}
                >
                  <Text style={[styles.cell, styles.narrow, styles.bodyText]}>{row.year}</Text>
                  <Text style={[styles.cell, styles.narrow, styles.bodyText]}>{row.age}</Text>
                  <Text style={[styles.cell, styles.wide, styles.bodyText, styles.right]}>
                    {formatCurrency(row.annualSIP, currency)}
                  </Text>
                  {hasVesting && (
                    <Text style={[styles.cell, styles.wide, styles.bodyText, styles.right]}>
                      {row.vestingIncome > 0 ? formatCurrency(row.vestingIncome, currency) : '—'}
                    </Text>
                  )}
                  <Text style={[styles.cell, styles.wide, styles.bodyText, styles.right]}>
                    {formatCurrency(row.plannedExpenses, currency)}
                  </Text>
                  <Text style={[styles.cell, styles.wide, styles.bodyText, styles.right]}>
                    {row.pensionIncome > 0 ? formatCurrency(row.pensionIncome, currency) : '—'}
                  </Text>
                  <Text
                    style={[
                      styles.cell,
                      styles.wide,
                      styles.bodyText,
                      styles.right,
                      { color: row.netWorthEOY < 0 ? '#C62828' : '#1B5E20', fontWeight: '600' },
                    ]}
                  >
                    {formatCurrency(row.netWorthEOY, currency)}
                  </Text>
                </View>
              );
            }}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>

      {/* Pagination */}
      <View style={styles.pagination}>
        <TouchableOpacity
          disabled={page === 0}
          onPress={() => setPage(p => p - 1)}
          style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
        >
          <Feather name="chevron-left" size={18} color={page === 0 ? '#ccc' : '#333'} />
        </TouchableOpacity>
        <Text style={styles.pageText}>
          {page * ROWS_PER_PAGE + 1}–{Math.min((page + 1) * ROWS_PER_PAGE, projections.length)} of {projections.length}
        </Text>
        <TouchableOpacity
          disabled={page >= totalPages - 1}
          onPress={() => setPage(p => p + 1)}
          style={[styles.pageBtn, page >= totalPages - 1 && styles.pageBtnDisabled]}
        >
          <Feather name="chevron-right" size={18} color={page >= totalPages - 1 ? '#ccc' : '#333'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRow: {
    borderRadius: 8,
    marginBottom: 2,
  },
  fireRow: {
    backgroundColor: '#C8E6C9',
  },
  cell: {
    padding: 8,
    fontSize: 12,
  },
  narrow: {
    width: 52,
  },
  wide: {
    width: 96,
  },
  right: {
    textAlign: 'right',
  },
  headerText: {
    fontWeight: '700',
    fontSize: 11,
  },
  bodyText: {
    color: '#333',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
  },
  pageBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  pageBtnDisabled: {
    backgroundColor: '#F8F8F8',
  },
  pageText: {
    fontSize: 12,
    color: '#666',
  },
});
