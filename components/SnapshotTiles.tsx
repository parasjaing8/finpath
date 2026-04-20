import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { formatCurrency } from '../engine/calculator';
import colors from '../constants/colors';

const c = colors.light;

interface Props {
  investableNetWorth: number;
  netWorthAtRetirement: number;
  retirementAge: number;
  currency: string;
  onCorpusInfoPress: () => void;
  savingsRate: number;
  realReturnRate: number;
  sipCorpusAtRetirement: number;
  existingCorpusAtRetirement: number;
}

export function SnapshotTiles({
  investableNetWorth,
  netWorthAtRetirement,
  retirementAge,
  currency,
  onCorpusInfoPress,
  savingsRate,
  realReturnRate,
  sipCorpusAtRetirement,
  existingCorpusAtRetirement,
}: Props) {
  const totalAtRetirement = sipCorpusAtRetirement + existingCorpusAtRetirement;
  const sipPct = totalAtRetirement > 0
    ? Math.round(sipCorpusAtRetirement / totalAtRetirement * 100)
    : 0;
  const realReturnColor = realReturnRate >= 4 ? c.success : realReturnRate >= 2 ? c.warning : c.destructive;
  const savingsColor = savingsRate <= 20 ? c.success : savingsRate <= 40 ? c.warning : c.destructive;

  return (
    <View style={styles.wrapper}>
      <View style={styles.tilesRow}>
        <View style={[styles.snapTile, { backgroundColor: c.successLight }]}>
          <Text style={[styles.snapLabel, { color: c.success }]}>TODAY</Text>
          <Text style={[styles.snapNumber, { color: c.success }]}>
            {formatCurrency(investableNetWorth, currency)}
          </Text>
          <Text style={styles.snapSub}>Investable Net Worth</Text>
        </View>
        <View style={[styles.snapTile, { backgroundColor: c.purpleLight }]}>
          <IconButton
            icon="information-outline"
            size={16}
            iconColor={c.purple}
            style={{ position: 'absolute', top: 0, right: 0, margin: 0 }}
            onPress={onCorpusInfoPress}
            accessibilityLabel="Why is the corpus this large?"
          />
          <Text style={[styles.snapLabel, { color: c.purple }]}>AT AGE {retirementAge}</Text>
          <Text style={[styles.snapNumber, { color: c.purple }]}>
            {formatCurrency(netWorthAtRetirement, currency)}
          </Text>
          <Text style={styles.snapSub}>Projected Corpus</Text>
        </View>
      </View>

      <View style={[styles.metricsStrip, { backgroundColor: c.muted }]}>
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: savingsColor }]}>{savingsRate}%</Text>
          <Text style={styles.metricLabel}>SAVINGS RATE</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: realReturnColor }]}>
            {realReturnRate > 0 ? '+' : ''}{realReturnRate.toFixed(1)}%
          </Text>
          <Text style={styles.metricLabel}>REAL RETURN</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: c.accent }]}>{sipPct}%</Text>
          <Text style={styles.metricLabel}>SIP BUILDS</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  tilesRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  snapTile: { flex: 1, borderRadius: 12, padding: 14, minHeight: 90 },
  snapLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  snapNumber: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  snapSub: { fontSize: 11, color: '#777' },
  metricsStrip: {
    borderRadius: 12, flexDirection: 'row',
    paddingVertical: 12, paddingHorizontal: 8,
  },
  metricItem: { flex: 1, alignItems: 'center' },
  metricValue: { fontSize: 16, fontWeight: '800' },
  metricLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: '#888', marginTop: 3 },
  metricDivider: { width: 1, backgroundColor: '#D8DED8', marginVertical: 4 },
});
