import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, TextInput, Button, HelperText, Dialog, Portal, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useProfile } from '../../hooks/useProfile';
import { getGoals, saveGoals, getExpenses, FireType, Expense } from '../../db/queries';
import { Slider } from '@miblanchard/react-native-slider';
import { formatCurrency, PENSION_INFLATION_RATE, FIRE_WITHDRAWAL_RATES } from '../../engine/calculator';
import { FREQUENCIES } from '../../constants/categories';

export default function GoalsScreen() {
  const { currentProfile } = useProfile();
  const router = useRouter();
  const [retirementAge, setRetirementAge] = useState(60);
  const [sipStopAge, setSipStopAge] = useState(55);
  const [pensionIncome, setPensionIncome] = useState('');
  const [fireType, setFireType] = useState<FireType>('moderate');
  const [withdrawalRate, setWithdrawalRate] = useState(5);
  const [inflationRate, setInflationRate] = useState(6);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showSWRDialog, setShowSWRDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      if (!currentProfile) return;
      const [goals, exps] = await Promise.all([
        getGoals(currentProfile.id),
        getExpenses(currentProfile.id),
      ]);
      setExpenses(exps);
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
        const rate = goals.withdrawal_rate ?? (FIRE_WITHDRAWAL_RATES[mappedType] ?? 5);
        setWithdrawalRate(rate);
      }
    }
    load();
  }, [currentProfile]);

  async function handleSave() {
    if (!currentProfile) return;
    if (sipStopAge > retirementAge) setSipStopAge(retirementAge);

    const doSave = async () => {
      setLoading(true);
      try {
        await saveGoals(
          currentProfile.id,
          retirementAge,
          Math.min(sipStopAge, retirementAge),
          parseFloat(pensionIncome) > 0 ? parseFloat(pensionIncome) : 0,
          fireType,
          100,
          withdrawalRate,
        );
        setSaved(true);
        setTimeout(() => { router.push('/(tabs)/dashboard'); }, 500);
      } finally {
        setLoading(false);
      }
    };

    Alert.alert(
      'Save Goals',
      'This will overwrite your current goals and recalculate your FIRE projection. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: doSave },
      ]
    );
  }

  if (!currentProfile) {
    return <View style={styles.center}><Text>No profile selected</Text></View>;
  }

  // Dynamic FIRE number preview
  const currentAge = (() => {
    const birth = new Date(currentProfile.dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  })();

  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const firePreview = (() => {
    // Sum current annual expenses from DB
    let currentAnnualExpenses = 0;
    for (const e of expenses) {
      if (e.expense_type !== 'CURRENT_RECURRING') continue;
      const freq = FREQUENCIES.find(f => f.key === e.frequency);
      const multiplier = freq ? freq.multiplier : 12;
      currentAnnualExpenses += e.amount * multiplier;
    }
    // Inflate expenses to retirement year using user-selected inflation
    const expensesAtRetirement = currentAnnualExpenses * Math.pow(1 + inflationRate / 100, yearsToRetirement);
    // Pension at retirement (uses standard pension inflation)
    const pensionVal = parseFloat(pensionIncome) || 0;
    const pensionAtRetirement = pensionVal * 12 * Math.pow(1 + PENSION_INFLATION_RATE, yearsToRetirement);
    const firstYearWithdrawal = expensesAtRetirement + pensionAtRetirement;
    if (withdrawalRate <= 0) return 0;
    return Math.ceil(firstYearWithdrawal / (withdrawalRate / 100));
  })();

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* FIRE Number Preview Tile */}
      <Card style={[styles.card, { backgroundColor: '#E8F5E9', marginBottom: 12 }]}>
        <Card.Content style={styles.previewRow}>
          <View style={{ flex: 1 }}>
            <Text variant="labelSmall" style={{ color: '#666', fontSize: 11 }}>
              Estimated FIRE Corpus (based on current recurring expenses)
            </Text>
            <Text variant="headlineMedium" style={{ fontWeight: 'bold', color: '#1B5E20' }}>
              {formatCurrency(firePreview, currentProfile.currency)}
            </Text>
            <Text variant="bodySmall" style={{ color: '#888', marginTop: 2 }}>
              SWR {withdrawalRate}% · Retire at {retirementAge} · Inflation {inflationRate}%
            </Text>
          </View>
        </Card.Content>
      </Card>

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
          />

          <Text variant="labelLarge" style={styles.sliderLabel}>
            SIP Stop Age: {sipStopAge}
          </Text>
          <Slider
            value={sipStopAge}
            onValueChange={(v: number[]) => setSipStopAge(Math.round(v[0]))}
            minimumValue={30} maximumValue={retirementAge} step={1}
            minimumTrackTintColor="#1B5E20" thumbTintColor="#1B5E20"
          />
          <HelperText type="info">
            Age at which you stop making SIP contributions. Can be before retirement.
          </HelperText>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24 }}>
            <Text variant="labelLarge" style={[styles.sectionLabel, { marginTop: 0, flex: 1 }]}>
              FIRE Type — Withdrawal Rate (SWR)
            </Text>
            <IconButton icon="information-outline" size={20} onPress={() => setShowSWRDialog(true)} />
          </View>
          <Text variant="bodySmall" style={styles.sectionHint}>
            Annual withdrawal % from your corpus post-retirement. Lower rate = larger corpus, safer.
          </Text>
          <View style={styles.fireTypeRow}>
            {([
              { type: 'slim' as FireType, label: 'Slim (7%)' },
              { type: 'moderate' as FireType, label: 'Moderate (5%)' },
              { type: 'fat' as FireType, label: 'Fat (3%)' },
              { type: 'custom' as FireType, label: 'Custom' },
            ]).map(({ type, label }) => {
              const selected = fireType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.fireTypeChip, selected && styles.fireTypeChipSelected]}
                  onPress={() => {
                    setFireType(type);
                    if (type !== 'custom') setWithdrawalRate(FIRE_WITHDRAWAL_RATES[type]);
                  }}
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
                Withdrawal Rate: {withdrawalRate}%
              </Text>
              <Slider
                value={withdrawalRate}
                onValueChange={(v: number[]) => setWithdrawalRate(Math.round(v[0]))}
                minimumValue={3}
                maximumValue={10}
                step={1}
                minimumTrackTintColor="#1B5E20"
                thumbTintColor="#1B5E20"
              />
              <HelperText type="info">
                Lower rate = larger corpus, safer. Higher rate = smaller corpus, riskier.
              </HelperText>
            </>
          )}

          <Text variant="labelLarge" style={styles.sectionLabel}>Post-Retirement Inflation</Text>
          <Text variant="bodySmall" style={styles.sectionHint}>
            Expected inflation rate for your post-retirement lifestyle expenses.
          </Text>
          <Text variant="labelLarge" style={styles.sliderLabel}>
            Inflation: {inflationRate}%
          </Text>
          <Slider
            value={inflationRate}
            onValueChange={(v: number[]) => setInflationRate(Math.round(v[0]))}
            minimumValue={0}
            maximumValue={9}
            step={1}
            minimumTrackTintColor="#1B5E20"
            thumbTintColor="#1B5E20"
          />

          <Text variant="labelLarge" style={styles.sectionLabel}>Retirement Income</Text>
          <Text variant="bodySmall" style={styles.sectionHint}>
            Expected monthly pension or passive income in today's value (e.g. rental income, govt
            pension). It will be inflation-adjusted at {(PENSION_INFLATION_RATE * 100).toFixed(0)}% and credited from retirement age onwards.
          </Text>
          <TextInput
            label={`Monthly pension / passive income (${currentProfile.currency === 'INR' ? '₹' : '$'} today's value)`}
            value={pensionIncome}
            onChangeText={text => setPensionIncome(text.replace(/[^0-9.]/g, ''))}
            mode="outlined"
            keyboardType="numeric"
            style={styles.input}
            left={<TextInput.Affix text={currentProfile.currency === 'INR' ? '₹' : '$'} />}
          />
          {parseFloat(pensionIncome) > 0 && (
            <HelperText type="info">
              At retirement (age {retirementAge}) this will be{' '}
              {formatCurrency(
                parseFloat(pensionIncome) * 12 * Math.pow(1 + PENSION_INFLATION_RATE, yearsToRetirement),
                currentProfile.currency
              )}/yr in nominal terms.
            </HelperText>
          )}

          <Button mode="contained" onPress={handleSave} loading={loading} disabled={loading}
            style={styles.button} contentStyle={styles.buttonContent}>
            {saved ? '✓ Saved! Going to Dashboard...' : 'Calculate & View Dashboard'}
          </Button>
        </Card.Content>
      </Card>

      {/* SWR Info Dialog */}
      <Portal>
        <Dialog visible={showSWRDialog} onDismiss={() => setShowSWRDialog(false)} style={{ backgroundColor: '#FFF' }}>
          <Dialog.Title>Safe Withdrawal Rate (SWR)</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ lineHeight: 22, marginBottom: 10 }}>
              SWR is the percentage of your corpus you withdraw each year in retirement. It originated from the
              Trinity Study (the "4% rule") which found that a 4% annual withdrawal from a diversified
              portfolio historically lasted 30+ years.
            </Text>
            <Text variant="bodyMedium" style={{ lineHeight: 22, marginBottom: 10 }}>
              In the Indian context, money managers typically recommend:{'\n'}
              • <Text style={{ fontWeight: '700' }}>3% (Fat FIRE)</Text> — mostly FDs, debt funds, very conservative{'\n'}
              • <Text style={{ fontWeight: '700' }}>5% (Moderate FIRE)</Text> — balanced equity-debt mix, recommended{'\n'}
              • <Text style={{ fontWeight: '700' }}>7% (Slim FIRE)</Text> — equity-heavy SWP, aggressive
            </Text>
            <Text variant="bodySmall" style={{ color: '#B71C1C', lineHeight: 18, marginTop: 4 }}>
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
  previewRow: { flexDirection: 'row', alignItems: 'center' },
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
});
