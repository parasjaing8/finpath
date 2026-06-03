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
      <View style={styles.heroBody}>

        {/* Left column — SIP + status */}
        <View style={styles.heroLeft}>
          <Text style={styles.heroLabel}>YOUR MONTHLY SIP</Text>
          {requiredMonthlySIP > 0 ? (
            <Text style={styles.heroAmount}>{formatCurrencyFull(sipAmountDisplay, currency)}</Text>
          ) : (
            <Text style={styles.heroAmount}>No SIP needed</Text>
          )}
          <Text style={styles.heroStatusTitle}>{planStatus.title}</Text>
          {!!planStatus.subtitle && (
            <Text style={styles.heroSubtitle}>{planStatus.subtitle}</Text>
          )}
        </View>

        {/* Right column — stacked pills */}
        <View style={styles.heroRight}>
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
                <Text style={styles.heroPillText}>⚠ Runs out{'\n'}at {failureAge} ›</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>✓ Lasts till{'\n'}{fireTargetAge}</Text>
              </View>
            )
          )}
        </View>

      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  heroCard: { borderRadius: 16, padding: 20, marginBottom: 12, overflow: 'hidden' },

  heroBody: { flexDirection: 'row', alignItems: 'flex-start' },

  heroLeft: { flex: 1, marginRight: 12 },
  heroLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  heroAmount: { fontSize: 32, fontWeight: '800', color: '#fff', marginBottom: 4 },
  heroStatusTitle: { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 2 },
  heroSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  heroRight: { gap: 8, alignItems: 'flex-end', justifyContent: 'center', paddingTop: 20 },
  heroPill: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, alignItems: 'center' },
  heroPillStatus: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  heroPillText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },
});
