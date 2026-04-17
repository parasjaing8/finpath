import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Text, Card, TextInput, Button, HelperText, Dialog, Portal, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useProfile } from '../../hooks/useProfile';
import { getGoals, saveGoals, FireType } from '../../db/queries';
import { Slider } from '@miblanchard/react-native-slider';
import { formatCurrency, PENSION_INFLATION_RATE, FIRE_TARGET_AGES } from '../../engine/calculator';
import { FREQUENCIES } from '../../constants/categories';
import { CorpusPrimer } from '../../components/CorpusPrimer';

export default function GoalsScreen() {
  const { currentProfile } = useProfile();
  const router = useRouter();
  const [retirementAge, setRetirementAge] = useState(60);
  const [sipStopAge, setSipStopAge] = useState(55);
  const [pensionIncome, setPensionIncome] = useState('');
  const [fireType, setFireType] = useState<FireType>('moderate');
  const [fireTargetAge, setFireTargetAge] = useState(100);
  const [inflationRate, setInflationRate] = useState(6);
  const [showSWRDialog, setShowSWRDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      if (!currentProfile) return;
      const goals = await getGoals(currentProfile.id);
      if (goals) {
        setRetirementAge(goals.retirement_age);
        setSipStopAge(goals.sip_stop_age);
        if (goals.pension_income) setPensionIncome(String(goals.pension_income));
        // Map legacy fire_type values to new naming
        const typeMap: Record<string, FireType> = {
          conservative: 'fat', comfortable: 'moderate', aggressive: 'slim',
          slim: 'slim', moderate: 'moderate', fat: 'fat', custom: 'custom',
        };
        const mappedType = typeMap[goals.fire_type] ?? 'moderate';
        setFireType(mappedType);
        if (mappedType === 'custom') {
          setFireTargetAge(goals.fire_target_age ?? 100);
        } else {
          setFireTargetAge(FIRE_TARGET_AGES[mappedType] ?? 100);
        }
        setInflationRate(goals.inflation_rate ?? 6);
      }
    }
    load();
  }, [currentProfile]);

  async function handleSave() {
    if (!currentProfile) return;
    const correctedSipStopAge = Math.min(sipStopAge, retirementAge);
    if (correctedSipStopAge !== sipStopAge) setSipStopAge(correctedSipStopAge);

    setLoading(true);
    try {
      await saveGoals(
        currentProfile.id,
        retirementAge,
        correctedSipStopAge,
        parseFloat(pensionIncome) > 0 ? parseFloat(pensionIncome) : 0,
        fireType,
        fireTargetAge,
        0,
        inflationRate,
      );
      setSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => { router.push('/(tabs)/dashboard'); }, 500);
    } catch (e) {
      Alert.alert('Error', 'Could not save goals. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!currentProfile) {
    return <View style={styles.center}><Text>No profile selected</Text></View>;
  }

  const yearsToRetirement = Math.max(0, retirementAge - (() => {
    const b = new Date(currentProfile.dob), n = new Date();
    let a = n.getFullYear() - b.getFullYear();
    if (n.getMonth() - b.getMonth() < 0 || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
    return a;
  })());

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <CorpusPrimer profileId={currentProfile.id} />
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>Set Your Goals</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Define when you want to retire and stop SIP contributions.
          </Text>

          <Text variant="labelLarge" style={styles.sliderLabel}>
            Retirement Age: {retirementAge}
          </Text>
          <Slider
            value={retirementAge}
            onValueChange={(v: number[]) => {
              const val = Math.round(v[0]);
              setRetirementAge(val);
              if (sipStopAge > val) setSipStopAge(val);
            }}
            minimumValue={35} maximumValue={80} step={1}
            minimumTrackTintColor="#1B5E20" thumbTintColor="#1B5E20"
            accessibilityLabel={`Retirement age: ${retirementAge} years`}
          />

          <Text variant="labelLarge" style={styles.sliderLabel}>
            SIP Stop Age: {sipStopAge}
          </Text>
          <Slider
            value={sipStopAge}
            onValueChange={(v: number[]) => setSipStopAge(Math.round(v[0]))}
            minimumValue={30} maximumValue={retirementAge} step={1}
            minimumTrackTintColor="#1B5E20" thumbTintColor="#1B5E20"
            accessibilityLabel={`SIP stop age: ${sipStopAge} years`}
          />
          <HelperText type="info">
            Age at which you stop making SIP contributions. Can be before retirement.
          </HelperText>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24 }}>
            <Text variant="labelLarge" style={[styles.sectionLabel, { marginTop: 0, flex: 1 }]}>
              Retirement Safety Level
            </Text>
            <IconButton icon="information-outline" size={20} onPress={() => setShowSWRDialog(true)} accessibilityLabel="Learn about retirement safety levels" />
          </View>
          <Text variant="bodySmall" style={styles.sectionHint}>
            How safely do you want your corpus to last? Lean = 85 yrs, Comfortable = 100 yrs, Rich = 120 yrs.
          </Text>
          <View style={styles.fireTypeRow}>
            {([
              { type: 'slim' as FireType, label: 'Lean' },
              { type: 'moderate' as FireType, label: 'Comfortable' },
              { type: 'fat' as FireType, label: 'Rich' },
              { type: 'custom' as FireType, label: 'Custom' },
            ]).map(({ type, label }) => {
              const selected = fireType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.fireTypeChip, selected && styles.fireTypeChipSelected]}
                  onPress={() => {
                    setFireType(type);
                    if (type !== 'custom') setFireTargetAge(FIRE_TARGET_AGES[type]);
                  }}
                  accessibilityLabel={`FIRE type: ${label}`}
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.fireTypeChipText, selected && styles.fireTypeChipTextSelected]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {fireType === 'custom' && (
            <>
              <Text variant="labelLarge" style={styles.sliderLabel}>
                Corpus Survival Target: Age {fireTargetAge}
              </Text>
              <Slider
                value={fireTargetAge}
                onValueChange={(v: number[]) => setFireTargetAge(Math.round(v[0]))}
                minimumValue={75}
                maximumValue={120}
                step={1}
                minimumTrackTintColor="#1B5E20"
                thumbTintColor="#1B5E20"
                accessibilityLabel={`Corpus survival target age: ${fireTargetAge}`}
              />
              <HelperText type="info">
                How long should your corpus last? Earlier = smaller corpus needed. Later = larger, safer.
              </HelperText>
            </>
          )}

          <Text variant="labelLarge" style={styles.sliderLabel}>
            Inflation Rate: {inflationRate}%/year
          </Text>
          <Slider
            value={inflationRate}
            onValueChange={(v: number[]) => setInflationRate(Math.round(v[0]))}
            minimumValue={3} maximumValue={12} step={1}
            minimumTrackTintColor="#1B5E20" thumbTintColor="#1B5E20"
            accessibilityLabel={`Inflation rate: ${inflationRate} percent`}
          />
          <HelperText type="info">
            Rate at which prices rise each year. Affects how much your monthly withdrawal must grow by retirement.
          </HelperText>

          <Text variant="labelLarge" style={styles.sectionLabel}>Monthly Retirement Withdrawal</Text>
          <Text variant="bodySmall" style={styles.sectionHint}>
            How much you want to withdraw from your corpus each month after retiring (in today's value).
            This sizes your corpus target via the withdrawal rate above.
          </Text>
          <TextInput
            label={`Monthly withdrawal target (${currentProfile.currency === 'INR' ? '₹' : '$'} today's value)`}
            value={pensionIncome}
            onChangeText={text => setPensionIncome(text.replace(/[^0-9.]/g, ''))}
            mode="outlined"
            keyboardType="numeric"
            style={styles.input}
            left={<TextInput.Affix text={currentProfile.currency === 'INR' ? '₹' : '$'} />}
          />
          {parseFloat(pensionIncome) > 0 && yearsToRetirement > 0 && (() => {
            const monthly = parseFloat(pensionIncome);
            const inflatedMonthly = Math.round(monthly * Math.pow(1 + inflationRate / 100, yearsToRetirement));
            return (
              <View style={styles.fvCard}>
                <Text style={styles.fvText}>
                  {formatCurrency(monthly, currentProfile.currency)}/month today
                  {' = '}
                  <Text style={styles.fvHighlight}>{formatCurrency(inflatedMonthly, currentProfile.currency)}/month</Text>
                  {' at age '}{retirementAge}{' ('}{inflationRate}{'% inflation, '}{yearsToRetirement}{' yrs)'}
                </Text>
              </View>
            );
          })()}


          <Button mode="contained" onPress={handleSave} loading={loading} disabled={loading}
            style={styles.button} contentStyle={styles.buttonContent}>
            {saved ? '✓ Saved!' : 'Save Plan'}
          </Button>
        </Card.Content>
      </Card>


      {/* SWR Info Dialog */}
      <Portal>
        <Dialog visible={showSWRDialog} onDismiss={() => setShowSWRDialog(false)} style={{ backgroundColor: '#FFF' }}>
          <Dialog.Title>Retirement Safety Level</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ lineHeight: 22, marginBottom: 10 }}>
              SWR is the percentage of your corpus you withdraw each year in retirement. It originated from the
              Trinity Study (the "4% rule") which found that a 4% annual withdrawal from a diversified
              portfolio historically lasted 30+ years.
            </Text>
            <Text variant="bodyMedium" style={{ lineHeight: 22, marginBottom: 10 }}>
              In the Indian context, money managers typically recommend:{'\n'}
              • <Text style={{ fontWeight: '700' }}>3% — Rich</Text> · Very conservative · FDs, debt funds · corpus horizon 120 yrs{'\n'}
              • <Text style={{ fontWeight: '700' }}>5% — Comfortable</Text> · Balanced equity-debt mix · Recommended · 100 yrs{'\n'}
              • <Text style={{ fontWeight: '700' }}>7% — Lean</Text> · Equity-heavy SWP · Aggressive · 85 yrs
            </Text>
            <Text variant="bodySmall" style={{ color: '#E65100', lineHeight: 18, marginBottom: 8 }}>
              ⚠ Despite the name, Lean is the most aggressive option — a 7% withdrawal rate leaves the least margin for bad market years. Choose it only if you are comfortable with equity-heavy post-retirement investing.
            </Text>
            <Text variant="bodySmall" style={{ color: '#B71C1C', lineHeight: 18 }}>
              ⚠ Post-tax, in-hand passive returns from SWP / dividends / interest may be lower than the
              headline SWR due to capital gains tax, TDS, and exit loads. Plan conservatively.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowSWRDialog(false)}>Got it</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 16, paddingBottom: 40, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { borderRadius: 16, padding: 8 },

  title: { fontWeight: 'bold', color: '#1B5E20', marginBottom: 8 },
  subtitle: { color: '#666', marginBottom: 24 },
  sliderLabel: { marginTop: 16, marginBottom: 4, fontWeight: '600' },
  sectionLabel: { marginTop: 24, marginBottom: 4, fontWeight: '700', color: '#1B5E20' },
  sectionHint: { color: '#888', marginBottom: 12, lineHeight: 18 },
  input: { marginBottom: 4, backgroundColor: '#FFFFFF' },
  button: { marginTop: 32, borderRadius: 8 },
  buttonContent: { paddingVertical: 8 },
  fireTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  fireTypeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#1B5E20', backgroundColor: '#FFF',
  },
  fireTypeChipSelected: { backgroundColor: '#1B5E20' },
  fireTypeChipText: { fontSize: 13, fontWeight: '600', color: '#1B5E20' },
  fireTypeChipTextSelected: { color: '#FFF' },
  fvCard: { backgroundColor: '#FFFDE7', borderLeftWidth: 2, borderLeftColor: '#F9A825', borderRadius: 6, padding: 10, marginTop: 8, marginBottom: 4 },
  fvText: { fontSize: 12, color: '#4E342E', lineHeight: 18 },
  fvHighlight: { fontWeight: '800', color: '#BF360C' },
});
