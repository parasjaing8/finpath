import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, SegmentedButtons, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { createProfile } from '../../db/queries';
import { useProfile } from '../../hooks/useProfile';
import * as Crypto from 'expo-crypto';
import { DateInput } from '../../components/DateInput';

export default function CreateProfile() {
  const router = useRouter();
  const { setCurrentProfileId, refreshProfiles } = useProfile();

  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!dob.match(/^\d{4}-\d{2}-\d{2}$/)) newErrors.dob = 'Enter date as YYYY-MM-DD';
    else {
      const d = new Date(dob);
      if (isNaN(d.getTime()) || d > new Date()) newErrors.dob = 'Enter a valid past date';
    }
    if (!monthlyIncome || parseFloat(monthlyIncome) < 0) newErrors.income = 'Enter a valid income';
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) newErrors.pin = 'PIN must be 6 digits';
    if (pin !== confirmPin) newErrors.confirmPin = 'PINs do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const hashedPin = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        pin
      );
      const profileId = await createProfile(
        name.trim(),
        dob,
        parseFloat(monthlyIncome),
        currency,
        hashedPin
      );
      await setCurrentProfileId(profileId);
      await refreshProfiles();
      router.replace('/(tabs)/assets');
    } catch (e) {
      console.error('Failed to create profile:', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text variant="headlineMedium" style={styles.title}>Welcome to FinPath</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Your personal financial freedom planner. Let's set up your profile.
        </Text>

        <TextInput
          label="Full Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          style={styles.input}
          error={!!errors.name}
        />
        {errors.name && <HelperText type="error">{errors.name}</HelperText>}

        <DateInput
          label="Date of Birth"
          value={dob}
          onChangeText={setDob}
          style={styles.input}
          error={!!errors.dob}
          maximumDate={new Date()}
        />
        {errors.dob && <HelperText type="error">{errors.dob}</HelperText>}

        <TextInput
          label="Monthly Take-Home Income"
          value={monthlyIncome}
          onChangeText={setMonthlyIncome}
          mode="outlined"
          style={styles.input}
          keyboardType="numeric"
          left={<TextInput.Affix text={currency === 'INR' ? '₹' : '$'} />}
          error={!!errors.income}
        />
        {errors.income && <HelperText type="error">{errors.income}</HelperText>}

        <Text variant="labelLarge" style={styles.label}>Currency</Text>
        <SegmentedButtons
          value={currency}
          onValueChange={setCurrency}
          buttons={[
            { value: 'INR', label: '₹ INR' },
            { value: 'USD', label: '$ USD' },
          ]}
          style={styles.segment}
        />

        <TextInput
          label="Set PIN (6 digits)"
          value={pin}
          onChangeText={setPin}
          mode="outlined"
          style={styles.input}
          keyboardType="numeric"
          secureTextEntry
          maxLength={6}
          error={!!errors.pin}
        />
        {errors.pin && <HelperText type="error">{errors.pin}</HelperText>}

        <TextInput
          label="Confirm PIN"
          value={confirmPin}
          onChangeText={setConfirmPin}
          mode="outlined"
          style={styles.input}
          keyboardType="numeric"
          secureTextEntry
          maxLength={6}
          error={!!errors.confirmPin}
        />
        {errors.confirmPin && <HelperText type="error">{errors.confirmPin}</HelperText>}

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          Create Profile
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scroll: { padding: 24, paddingTop: 60 },
  title: { fontWeight: 'bold', color: '#1B5E20', marginBottom: 8 },
  subtitle: { color: '#666', marginBottom: 24 },
  input: { marginBottom: 4, backgroundColor: '#FFFFFF' },
  label: { marginTop: 12, marginBottom: 8 },
  segment: { marginBottom: 16 },
  button: { marginTop: 24, borderRadius: 8 },
  buttonContent: { paddingVertical: 8 },
});
