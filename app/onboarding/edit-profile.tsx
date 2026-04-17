import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, SegmentedButtons, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { updateProfile, saveProfilePin } from '../../db/queries';
import { useProfile } from '../../hooks/useProfile';
import { useApp } from '../../context/AppContext';
import type { Profile as EngineProfile } from '../../engine/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DateInput } from '../../components/DateInput';
import * as Crypto from 'expo-crypto';

export default function EditProfile() {
  const router = useRouter();
  const { currentProfile, refreshProfiles } = useProfile();
  const { setProfile: setAppProfile } = useApp();

  const [name, setName] = useState(currentProfile?.name ?? '');
  const [monthlyIncome, setMonthlyIncome] = useState(
    currentProfile?.monthly_income != null ? String(currentProfile.monthly_income) : ''
  );
  const [dob, setDob] = useState(currentProfile?.dob ?? '');
  const [currency, setCurrency] = useState(currentProfile?.currency ?? 'INR');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  if (!currentProfile) {
    return <View style={styles.center}><Text>No profile selected</Text></View>;
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name cannot be empty';
    if (!monthlyIncome || parseFloat(monthlyIncome) < 0) e.income = 'Enter a valid income';
    if (!dob.match(/^\d{4}-\d{2}-\d{2}$/)) e.dob = 'Enter date as YYYY-MM-DD';
    else { const d = new Date(dob); if (isNaN(d.getTime()) || d > new Date()) e.dob = 'Enter a valid past date'; }
    if (newPin.length > 0) {
      if (!/^\d{6}$/.test(newPin)) e.newPin = 'PIN must be 6 digits';
      if (newPin !== confirmPin) e.confirmPin = 'PINs do not match';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!currentProfile || !validate()) return;
    setLoading(true);
    try {
      await updateProfile(currentProfile.id, parseFloat(monthlyIncome), currency, dob, name.trim());
      if (newPin.length === 6) {
        const saltBytes = Crypto.getRandomValues(new Uint8Array(16));
        const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + newPin);
        await saveProfilePin(currentProfile.id, `${salt}$${hash}`);
      }
      await refreshProfiles();
      try {
        await setAppProfile({ id: String(currentProfile.id), name: name.trim(), dob, currency, monthly_income: parseFloat(monthlyIncome) || 0 });
      } catch { /* non-critical */ }
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
            <MaterialCommunityIcons name="arrow-left" size={24} color="#1B5E20" />
          </TouchableOpacity>
          <Text variant="headlineSmall" style={styles.title}>Edit Profile</Text>
        </View>

        {/* Name (editable) */}
        <Text variant="labelSmall" style={styles.sectionLabel}>PROFILE</Text>
        <TextInput
          label="Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          style={styles.input}
          autoCapitalize="words"
          error={!!errors.name}
        />
        {errors.name && <HelperText type="error">{errors.name}</HelperText>}
        <DateInput
          label="Date of Birth (YYYY-MM-DD)"
          value={dob}
          onChangeText={setDob}
          style={styles.input}
          error={!!errors.dob}
        />
        {errors.dob && <HelperText type="error">{errors.dob}</HelperText>}

        {/* Income */}
        <Text variant="labelSmall" style={styles.sectionLabel}>FINANCIALS</Text>
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

        {/* PIN change (optional) */}
        <Text variant="labelSmall" style={[styles.sectionLabel, { marginTop: 8 }]}>CHANGE PIN (optional)</Text>
        <TextInput
          label="New PIN (6 digits)"
          value={newPin}
          onChangeText={setNewPin}
          mode="outlined"
          style={styles.input}
          keyboardType="numeric"
          secureTextEntry
          maxLength={6}
          error={!!errors.newPin}
        />
        {errors.newPin && <HelperText type="error">{errors.newPin}</HelperText>}

        <TextInput
          label="Confirm New PIN"
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
        <Text variant="bodySmall" style={styles.pinHint}>Leave PIN fields blank to keep your current PIN.</Text>

        <Button
          mode="contained"
          onPress={handleSave}
          loading={loading}
          disabled={loading}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          Save Changes
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scroll: { padding: 24, paddingTop: 56 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  title: { fontWeight: 'bold', color: '#1B5E20' },
  sectionLabel: { color: '#999', letterSpacing: 1, marginBottom: 8, marginLeft: 2 },
  input: { marginBottom: 4, backgroundColor: '#FFFFFF' },
  label: { marginTop: 12, marginBottom: 8 },
  segment: { marginBottom: 16 },
  pinHint: { color: '#999', marginTop: 4, marginBottom: 8, fontStyle: 'italic' },
  button: { marginTop: 24, borderRadius: 8 },
  buttonContent: { paddingVertical: 8 },
});
