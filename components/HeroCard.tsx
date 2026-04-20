import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { formatCurrencyFull } from '../engine/calculator';

interface Props {
  sipAmountDisplay: number;
  requiredMonthlySIP: number;
  currency: string;
  fireTargetAge: number;
  failureAge: number;
  fireAchievedAge: number;
  isOnTrack: boolean;
  planStatus: { title: string; subtitle: string; color: string };
  onDepletionPress: () => void;
  fireCorpus: number;
  investableNetWorth: number;
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
  onDepletionPress,
  fireCorpus,
  investableNetWorth,
}: Props) {
  const sipRatio = requiredMonthlySIP > 0 ? sipAmountDisplay / requiredMonthlySIP : 1;
  const progressPct = fireCorpus > 0 ? Math.min(100, Math.round(investableNetWorth / fireCorpus * 100)) : 0;
  const heroColors: [string, string] = sipRatio >= 1.15
    ? ['#1B5E20', '#2E7D32']
    : sipRatio >= 1.0
    ? ['#2E7D32', '#388E3C']
    : sipRatio >= 0.7
    ? ['#E65100', '#BF360C']
    : ['#B71C1C', '#7F0000'];

  return (
    <LinearGradient colors={heroColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
      <Text style={styles.heroLabel}>YOUR MONTHLY SIP</Text>
      {requiredMonthlySIP > 0 ? (
        <Text style={styles.heroAmount}>{formatCurrencyFull(sipAmountDisplay, currency)}</Text>
      ) : (
        <Text style={styles.heroAmount}>No SIP needed</Text>
      )}
      <Text style={styles.heroStatusTitle}>{planStatus.title}</Text>
      <Text style={styles.heroSubtitle}>{planStatus.subtitle}</Text>
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
      {fireCorpus > 0 && (
        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>CORPUS TARGET</Text>
            <Text style={styles.progressLabel}>{formatCurrencyFull(fireCorpus, currency)} · {progressPct}% built</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(2, progressPct)}%` as any }]} />
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  heroCard: { borderRadius: 16, padding: 20, marginBottom: 12, overflow: 'hidden' },
  heroLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  heroAmount: { fontSize: 36, fontWeight: '800', color: '#fff', marginBottom: 4 },
  heroStatusTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 2 },
  heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 14 },
  heroPillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  heroPill: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  heroPillStatus: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  heroPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  progressSection: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 },
  progressTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 3 },
});
