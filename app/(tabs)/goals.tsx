import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, TextInput, Button, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useProfile } from '../../hooks/useProfile';
import { getGoals, saveGoals } from '../../db/queries';
import { Slider } from '@miblanchard/react-native-slider';
import { formatCurrency, PENSION_INFLATION_RATE } from '../../engine/calculator';

export default function GoalsScreen() {
  const { currentProfile } = useProfile();
  const router = useRouter();
  const [retirementAge, setRetirementAge] = useState(60);
  const [sipStopAge, setSipStopAge] = useState(55);
  const [pensionIncome, setPensionIncome] = useState('');
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
          parseFloat(pensionIncome) > 0 ? parseFloat(pensionIncome) : 0
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

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
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
                parseFloat(pensionIncome) * 12 * Math.pow(1 + PENSION_INFLATION_RATE, retirementAge - (new Date().getFullYear() - new Date(currentProfile.dob).getFullYear())),
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, padding: 16, backgroundColor: '#F5F5F5', justifyContent: 'center' },
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
});
