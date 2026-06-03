import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { formatCurrencyFull, formatCurrency } from '../engine/calculator';

interface Props {
  sipAmountDisplay: number;
  requiredMonthlySIP: number;
  currency: string;
  fireTargetAge: number;
  failureAge: number;
  fireAchievedAge: number;
  isOnTrack: boolean;
  planStatus: { title: string; subtitle: string; color: string };
  netWorthAtRetirement: number;
  safetyMargin: number | null;
  onDepletionPress: () => void;
}

export function HeroCard({
  sipAmountDisplay,
  requiredMonthlySIP,
  currency,
  fireTargetAge,
  failureAge,
  fireAchievedAge,
  isOnTrack,
  planStatus,
  netWorthAtRetirement,
  safetyMargin,
  onDepletionPress,
}: Props) {
  const sipRatio = requiredMonthlySIP > 0 ? sipAmountDisplay / requiredMonthlySIP : 1;
  const heroColors: [string, string] = sipRatio >= 1.15
    ? ['#1B5E20', '#2E7D32']
    : sipRatio >= 1.0
    ? ['#2E7D32', '#388E3C']
    : sipRatio >= 0.7
    ? ['#E65100', '#BF360C']
    : ['#B71C1C', '#7F0000'];

  return (
    <LinearGradient colors={heroColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>

      {/* Primary: FIRE statement */}
      <Text style={styles.heroStatement}>{planStatus.title}</Text>
      <Text style={styles.heroSubtitle}>{planStatus.subtitle}</Text>

      {/* Big number: projected corpus */}
      {netWorthAtRetirement > 0 && (
        <View style={styles.corpusRow}>
          <View style={styles.corpusBlock}>
            <Text style={styles.corpusLabel}>PROJECTED CORPUS</Text>
            <Text style={styles.corpusAmount}>{formatCurrencyFull(netWorthAtRetirement, currency)}</Text>
          </View>
          {safetyMargin !== null && (
            <View style={[styles.safetyBadge, { backgroundColor: safetyMargin >= 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,80,80,0.3)' }]}>
              <Text style={styles.safetyBadgeText}>
                {safetyMargin >= 0 ? '+' : ''}{Math.round(safetyMargin)}%
              </Text>
              <Text style={styles.safetyBadgeLabel}>margin</Text>
            </View>
          )}
        </View>
      )}

      {/* Secondary: monthly SIP */}
      {requiredMonthlySIP > 0 && (
        <Text style={styles.sipLine}>
          Monthly SIP · {formatCurrency(sipAmountDisplay, currency)}
        </Text>
      )}

      {/* Status pills */}
      <View style={styles.heroPillRow}>
        <View style={[styles.heroPill, styles.heroPillStatus]}>
          <Text style={[styles.heroPillText, { color: isOnTrack ? '#1B5E20' : '#C62828' }]}>
            {isOnTrack ? '✓ On Track' : '✗ Off Track'}
          </Text>
        </View>
        {fireAchievedAge > 0 && (
          failureAge > 0 ? (
            <TouchableOpacity
              style={[styles.heroPill, { backgroundColor: 'rgba(255,167,38,0.9)' }]}
              onPress={onDepletionPress}
              accessibilityRole="button"
              accessibilityLabel="Corpus depletion detail"
            >
              <Text style={styles.heroPillText}>⚠ Runs out at {failureAge} ›</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>✓ Lasts till {fireTargetAge}</Text>
            </View>
          )
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  heroCard: { borderRadius: 16, padding: 20, marginBottom: 12, overflow: 'hidden' },

  heroStatement: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 2 },
  heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 16 },

  corpusRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  corpusBlock: { flex: 1 },
  corpusLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: 'rgba(255,255,255,0.65)', marginBottom: 3 },
  corpusAmount: { fontSize: 30, fontWeight: '800', color: '#fff' },

  safetyBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', marginLeft: 12 },
  safetyBadgeText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  safetyBadgeLabel: { fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: '600', letterSpacing: 0.5 },

  sipLine: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 14 },

  heroPillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  heroPill: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  heroPillStatus: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  heroPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
