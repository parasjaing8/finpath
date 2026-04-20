import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, Switch, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { createProfile, setBiometricEnabled } from '../../db/queries';
import { useProfile } from '../../hooks/useProfile';
import { useApp, ExportPayload } from '../../context/AppContext';
import type { Profile as EngineProfile } from '../../engine/types';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DateInput } from '../../components/DateInput';

const CURRENCIES: { value: string; label: string }[] = [
  { value: 'INR', label: '₹ INR' },
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
  { value: 'GBP', label: '£ GBP' },
  { value: 'AUD', label: 'A$ AUD' },
  { value: 'CAD', label: 'C$ CAD' },
  { value: 'SGD', label: 'S$ SGD' },
  { value: 'AED', label: 'د.إ AED' },
];

export default function CreateProfile() {
  const router = useRouter();
  const { setCurrentProfileId, refreshProfiles } = useProfile();
  const { setProfile: setAppProfile, importAll } = useApp();

  const [name, setName] = useState('');
  const [dob, setDob] = useState('2000-01-01');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [enableBiometric, setEnableBiometric] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  // Backup restore state
  const [backupPayload, setBackupPayload] = useState<ExportPayload | null>(null);
  const [backupPickLoading, setBackupPickLoading] = useState(false);

  useEffect(() => {
    async function checkBiometric() {
      const hasHW = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHW && isEnrolled);
    }
    checkBiometric();
  }, []);
  async function pickBackup() {
    try {
      setBackupPickLoading(true);
      let jsonText: string;
      if (Platform.OS === 'web') {
        jsonText = await new Promise<string>((resolve, reject) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,application/json';
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) { reject(new Error('No file selected')); return; }
            resolve(await file.text());
          };
          input.oncancel = () => reject(new Error('cancelled'));
          input.click();
        });
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
          copyToCacheDirectory: true,
        });
        if (result.canceled) return;
        jsonText = await FileSystem.readAsStringAsync(result.assets[0].uri);
      }
      let parsed: ExportPayload;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        Alert.alert('Invalid backup', 'The selected file is not valid JSON.');
        return;
      }
      if (!parsed || typeof parsed.version !== 'number' || !parsed.profile) {
        Alert.alert('Invalid backup', 'This does not look like a FinPath backup file.');
        return;
      }
      // Pre-fill form from backup profile
      const p = parsed.profile;
      setName(p.name ?? '');
      setDob(p.dob ?? '2000-01-01');
      setMonthlyIncome(String(p.monthly_income ?? ''));
      setCurrency(p.currency ?? 'INR');
      setBackupPayload(parsed);
      // Clear PIN so the user must consciously set a new one
      setPin('');
      setConfirmPin('');
      setErrors({});
    } catch (e: any) {
      if (e?.message !== 'cancelled') {
        Alert.alert('Pick failed', e?.message ?? 'Could not read backup file.');
      }
    } finally {
      setBackupPickLoading(false);
    }
  }

  function clearBackup() {
    setBackupPayload(null);
    setName('');
    setDob('2000-01-01');
    setMonthlyIncome('');
    setCurrency('INR');
    setErrors({});
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!dob.match(/^\d{4}-\d{2}-\d{2}$/)) newErrors.dob = 'Enter date as YYYY-MM-DD';
    else {
      const [y, m, day] = dob.split('-').map(Number);
      const d = new Date(y, m - 1, day);
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
      // Generate a random 16-byte salt, encode as hex
      const saltBytes = Crypto.getRandomValues(new Uint8Array(16));
      const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        salt + pin
      );
      const hashedPin = `${salt}$${hash}`;
      const profileId = await createProfile(
        name.trim(),
        dob,
        parseFloat(monthlyIncome),
        currency,
        hashedPin
      );
      if (enableBiometric) await setBiometricEnabled(profileId, true);
      await setCurrentProfileId(profileId);
      await refreshProfiles();
      if (backupPayload) {
        // Restore all data from backup, then fix the profile id to the new SQLite record
        await importAll(backupPayload, profileId);
        await setAppProfile({ id: String(profileId), name: name.trim(), dob, currency, monthly_income: parseFloat(monthlyIncome) || 0 });
      } else {
        try {
          await setAppProfile({ id: String(profileId), name: name.trim(), dob, currency, monthly_income: parseFloat(monthlyIncome) || 0 });
        } catch {
          // AppContext sync is non-critical; SQLite data is the source of truth
        }
      }
      router.replace(backupPayload ? '/(tabs)/dashboard' : '/(tabs)/assets');
    } catch (e) {
      if (__DEV__) console.error('Failed to create profile:', e);
      Alert.alert('Error', 'Could not create profile. Please try again.');
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
          maxLength={100}
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
          left={<TextInput.Affix text={CURRENCIES.find(c => c.value === currency)?.label.split(' ')[0] ?? currency} />}
          error={!!errors.income}
        />
        {errors.income && <HelperText type="error">{errors.income}</HelperText>}

        <Text variant="labelLarge" style={styles.label}>Currency</Text>
        <View style={styles.currencyRow}>
          {CURRENCIES.map(c => (
            <TouchableOpacity
              key={c.value}
              style={[styles.currencyChip, currency === c.value && styles.currencyChipSelected]}
              onPress={() => setCurrency(c.value)}
            >
              <Text style={[styles.currencyChipText, currency === c.value && styles.currencyChipTextSelected]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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

        {biometricAvailable && (
          <View style={styles.biometricRow}>
            <MaterialCommunityIcons name="fingerprint" size={22} color="#1B5E20" />
            <View style={styles.biometricText}>
              <Text variant="labelLarge" style={styles.biometricLabel}>Enable Fingerprint Login</Text>
              <Text variant="bodySmall" style={styles.biometricSub}>Use fingerprint instead of PIN to log in</Text>
            </View>
            <Switch
              value={enableBiometric}
              onValueChange={setEnableBiometric}
              thumbColor={enableBiometric ? '#1B5E20' : '#CCC'}
              trackColor={{ false: '#E0E0E0', true: '#A5D6A7' }}
            />
          </View>
        )}

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          style={styles.button}
          contentStyle={styles.buttonContent}
          accessibilityLabel={backupPayload ? 'Set PIN and restore backup' : 'Create profile'}
        >
          {backupPayload ? 'Set PIN & Restore' : 'Create Profile'}
        </Button>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {backupPayload ? (
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={clearBackup}
            accessibilityRole="button"
            accessibilityLabel="Clear backup and start fresh"
          >
            <MaterialCommunityIcons name="close-circle-outline" size={18} color="#888" />
            <Text style={styles.restoreBtnText}>Clear backup — start fresh instead</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={pickBackup}
            disabled={backupPickLoading}
            accessibilityRole="button"
            accessibilityLabel="Restore from backup file"
          >
            <MaterialCommunityIcons name="restore" size={18} color="#1B5E20" />
            <Text style={[styles.restoreBtnText, { color: '#1B5E20' }]}>
              {backupPickLoading ? 'Opening\u2026' : 'Returning user? Restore from backup'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Cause note */}
        <View style={styles.causeNote}>
          <Text style={styles.causeIcon}>🙏</Text>
          <Text style={styles.causeText}>
            51% of FinPath's profits go toward food {'&'} education for underprivileged children in rural India. Your plan. Their future.
          </Text>
        </View>
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
  currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  currencyChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#C8E6C9', backgroundColor: '#F1F8E9' },
  currencyChipSelected: { backgroundColor: '#1B5E20', borderColor: '#1B5E20' },
  currencyChipText: { fontSize: 13, color: '#1B5E20', fontWeight: '500' },
  currencyChipTextSelected: { color: '#fff' },
  biometricRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginTop: 16, gap: 12, elevation: 1 },
  biometricText: { flex: 1 },
  biometricLabel: { color: '#1B5E20' },
  biometricSub: { color: '#888', marginTop: 2 },
  button: { marginTop: 24, borderRadius: 8 },
  causeNote: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFF8E1', borderRadius: 10, padding: 12, marginTop: 20, gap: 8 },
  causeIcon: { fontSize: 15, marginTop: 1 },
  causeText: { flex: 1, fontSize: 12, color: '#5D4037', lineHeight: 18 },
  buttonContent: { paddingVertical: 8 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#DDD' },
  dividerText: { fontSize: 12, color: '#999' },
  restoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#CCC', backgroundColor: '#FFF' },
  restoreBtnText: { fontSize: 14, color: '#888' },
});
