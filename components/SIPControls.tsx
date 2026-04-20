import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Card, Switch } from 'react-native-paper';
import { Slider } from '@miblanchard/react-native-slider';
import { formatCurrency } from '../engine/calculator';

interface Props {
  sipAmountDisplay: number;
  sipReturnRateDisplay: number;
  postSipReturnRateDisplay: number;
  stepUpEnabled: boolean;
  stepUpRateDisplay: number;
  sipStopAge: number;
  currency: string;
  onSipChange: (v: number) => void;
  onSipCommit: (v: number) => void;
  onReturnChange: (v: number) => void;
  onReturnCommit: (v: number) => void;
  onPostReturnChange: (v: number) => void;
  onPostReturnCommit: (v: number) => void;
  onStepUpToggle: (v: boolean) => void;
  onStepUpChange: (v: number) => void;
  onStepUpCommit: (v: number) => void;
  inflationRate?: number;
}

export function SIPControls({
  sipAmountDisplay,
  sipReturnRateDisplay,
  postSipReturnRateDisplay,
  stepUpEnabled,
  stepUpRateDisplay,
  sipStopAge,
  currency,
  onSipChange,
  onSipCommit,
  onReturnChange,
  onReturnCommit,
  onPostReturnChange,
  onPostReturnCommit,
  onStepUpToggle,
  onStepUpChange,
  onStepUpCommit,
  inflationRate = 6,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <Card style={styles.strategyCard}>
      <Card.Content>
        <View style={styles.strategyHeader}>
          <Text variant="titleMedium" style={styles.strategyTitle}>Adjust Your Plan</Text>
          <Text style={styles.strategyLiveValue}>{formatCurrency(sipAmountDisplay, currency)}/mo</Text>
        </View>

        {/* Primary control — always visible */}
        <Slider
          value={sipAmountDisplay}
          onValueChange={(v: number[]) => onSipChange(Math.round(v[0] / 1000) * 1000)}
          onSlidingComplete={(v: number[]) => onSipCommit(Math.round(v[0] / 1000) * 1000)}
          minimumValue={1000} maximumValue={1000000} step={1000}
          minimumTrackTintColor="#1B5E20" thumbTintColor="#1B5E20"
        />

        {/* Advanced toggle */}
        <TouchableOpacity
          style={styles.advancedToggle}
          onPress={() => setShowAdvanced(v => !v)}
          accessibilityRole="button"
          accessibilityLabel={showAdvanced ? 'Hide advanced settings' : 'Show advanced settings'}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="labelMedium" style={styles.advancedToggleText}>
              Advanced {showAdvanced ? '▲' : '▼'}
            </Text>
            <Text variant="bodySmall" style={{ color: '#999', fontStyle: 'italic', fontSize: 11 }}>
              Stops {sipStopAge} · Step-up {stepUpEnabled ? `${stepUpRateDisplay}%` : 'off'}
            </Text>
          </View>
        </TouchableOpacity>

        {showAdvanced && (
          <>
            <View style={styles.returnRow}>
              <Text variant="labelMedium" style={styles.sliderLabel}>
                Return While Investing (until age {sipStopAge}): {sipReturnRateDisplay}%
              </Text>
              <View style={[styles.realReturnPill, { backgroundColor: sipReturnRateDisplay - inflationRate >= 4 ? '#E8F5E9' : '#FFF3E0' }]}>
                <Text style={[styles.realReturnText, { color: sipReturnRateDisplay - inflationRate >= 4 ? '#1B5E20' : '#E65100' }]}>
                  Real: +{(sipReturnRateDisplay - inflationRate).toFixed(1)}%
                </Text>
              </View>
            </View>
            <Slider
              value={sipReturnRateDisplay}
              onValueChange={(v: number[]) => onReturnChange(Math.round(v[0]))}
              onSlidingComplete={(v: number[]) => onReturnCommit(Math.round(v[0]))}
              minimumValue={5} maximumValue={20} step={1}
              minimumTrackTintColor="#1B5E20" thumbTintColor="#1B5E20"
            />
            <Text variant="labelMedium" style={styles.sliderLabel}>
              Return After SIP Stops (from age {sipStopAge}): {postSipReturnRateDisplay}%
            </Text>
            <Slider
              value={postSipReturnRateDisplay}
              onValueChange={(v: number[]) => onPostReturnChange(Math.round(v[0]))}
              onSlidingComplete={(v: number[]) => onPostReturnCommit(Math.round(v[0]))}
              minimumValue={3} maximumValue={15} step={1}
              minimumTrackTintColor="#1B5E20" thumbTintColor="#1B5E20"
            />
            <Text variant="bodySmall" style={styles.infoText}>
              Equity LTCG above ₹1L/year is taxed at 10%. Lower your return rate by ~1–1.5% to model post-tax growth.
            </Text>

            <View style={styles.switchRow}>
              <Text variant="bodyMedium">Step-Up SIP</Text>
              <Switch value={stepUpEnabled} onValueChange={onStepUpToggle} color="#1B5E20" />
            </View>
            {stepUpEnabled && (
              <>
                <Text variant="labelMedium" style={styles.sliderLabel}>
                  Step-Up Rate: {stepUpRateDisplay}%/year
                </Text>
                <Slider
                  value={stepUpRateDisplay}
                  onValueChange={(v: number[]) => onStepUpChange(Math.round(v[0]))}
                  onSlidingComplete={(v: number[]) => onStepUpCommit(Math.round(v[0]))}
                  minimumValue={5} maximumValue={20} step={1}
                  minimumTrackTintColor="#1B5E20" thumbTintColor="#1B5E20"
                />
              </>
            )}
          </>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  strategyCard: { marginTop: 8, marginBottom: 16, borderRadius: 12 },
  strategyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  strategyTitle: { fontWeight: 'bold', color: '#1B5E20' },
  strategyLiveValue: { fontSize: 14, fontWeight: '700', color: '#1B5E20' },
  sliderLabel: { marginTop: 12, marginBottom: 4, fontWeight: '600' },
  infoText: { color: '#666', marginTop: 8, fontStyle: 'italic' },
  advancedToggle: { marginTop: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  advancedToggleText: { color: '#1B5E20', fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  returnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 4 },
  realReturnPill: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  realReturnText: { fontSize: 11, fontWeight: '700' },
});
