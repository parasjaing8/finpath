import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { createProfile, setBiometricEnabled } from '../../db/queries';
import { useProfile } from '../../hooks/useProfile';
import { useApp, ExportPayload } from '../../context/AppContext';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DateInput } from '../../components/DateInput';
import { CurrencyPicker } from '../../components/CurrencyPicker';
import { getCurrencyByCode } from '../../constants/currencies';

const BRAND = '#1B5E20';
const BRAND_LIGHT = '#A5D6A7';
const AMBER = '#FF8F00';
const BG = '#F5F5F5';

export default function CreateProfile() {
  const router = useRouter();
  const { setCurrentProfileId, refreshProfiles } = useProfile();
  const { setProfile: setAppProfile, importAll } = useApp();

  // Step state (0 = hero, 1 = mission, 2 = about you, 3 = income, 4 = security)
  const [step, setStep] = useState(0);

  // Form fields
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
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
  const [backupLoaded, setBackupLoaded] = useState(false);

  useEffect(() => {
    async function checkBiometric() {
      const hasHW = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHW && isEnrolled);
    }
    checkBiometric();
  }, []);

  // ─── Backup helpers ────────────────────────────────────────────────────────

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
      const p = parsed.profile;
      setName(p.name ?? '');
      setDob(p.dob ?? '');
      setMonthlyIncome(String(p.monthly_income ?? ''));
      setCurrency(p.currency ?? 'INR');
      setBackupPayload(parsed);
      setBackupLoaded(true);
      setPin('');
      setConfirmPin('');
      setErrors({});
      // Jump straight to PIN step — profile is pre-filled
      setStep(4);
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
    setBackupLoaded(false);
    setName('');
    setDob('');
    setMonthlyIncome('');
    setCurrency('INR');
    setErrors({});
    setStep(0);
  }

  // ─── Per-step validators ───────────────────────────────────────────────────

  function validateStep2(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!dob.match(/^\d{4}-\d{2}-\d{2}$/)) {
      errs.dob = 'Enter date as YYYY-MM-DD';
    } else {
      const [y, m, day] = dob.split('-').map(Number);
      const d = new Date(y, m - 1, day);
      if (isNaN(d.getTime()) || d > new Date()) errs.dob = 'Enter a valid past date';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep3(): boolean {
    const errs: Record<string, string> = {};
    if (!monthlyIncome || parseFloat(monthlyIncome) < 0)
      errs.income = 'Enter a valid income';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep4(): boolean {
    const errs: Record<string, string> = {};
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) errs.pin = 'PIN must be 6 digits';
    if (pin !== confirmPin) errs.confirmPin = 'PINs do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function goNext() {
    setErrors({});
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    setStep(s => s + 1);
  }

  function goBack() {
    setErrors({});
    setStep(s => Math.max(0, s - 1));
  }

  // ─── Submit (step 4) ───────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!validateStep4()) return;
    setLoading(true);
    try {
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
        await importAll(backupPayload, profileId);
        await setAppProfile({
          id: String(profileId),
          name: name.trim(),
          dob,
          currency,
          monthly_income: parseFloat(monthlyIncome) || 0,
        });
      } else {
        try {
          await setAppProfile({
            id: String(profileId),
            name: name.trim(),
            dob,
            currency,
            monthly_income: parseFloat(monthlyIncome) || 0,
          });
        } catch {
          // AppContext sync is non-critical
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

  // ─── Progress dots ─────────────────────────────────────────────────────────

  function ProgressDots() {
    if (step === 0) return null;
    return (
      <View style={styles.dotsRow}>
        {[0, 1, 2, 3, 4].map(i => {
          const filled = i < step;
          const current = i === step;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                filled && styles.dotFilled,
                current && styles.dotCurrent,
              ]}
            />
          );
        })}
      </View>
    );
  }

  // ─── Back button ───────────────────────────────────────────────────────────

  function BackButton() {
    if (step === 0) return null;
    return (
      <TouchableOpacity onPress={goBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
        <MaterialCommunityIcons name="chevron-left" size={28} color={BRAND} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
    );
  }

  // ─── Step 0: Hero ──────────────────────────────────────────────────────────

  function StepHero() {
    return (
      <View style={styles.heroContainer}>
        {/* Logo area */}
        <View style={styles.logoCircle}>
          <MaterialCommunityIcons name="leaf" size={48} color="#FFF" />
        </View>

        <Text style={styles.heroHeadline}>Your Path to{'\n'}Financial Freedom</Text>
        <Text style={styles.heroSubtext}>Track assets · Plan FIRE · Zero compromise</Text>

        {/* Feature pills */}
        <View style={styles.pillsRow}>
          {['🏠 Net Worth', '📈 FIRE Date', '🔒 Private'].map(label => (
            <View key={label} style={styles.pill}>
              <Text style={styles.pillText}>{label}</Text>
            </View>
          ))}
        </View>

        <Button
          mode="contained"
          onPress={() => setStep(1)}
          style={styles.heroBtn}
          contentStyle={styles.heroBtnContent}
          buttonColor={BRAND}
          labelStyle={styles.heroBtnLabel}
        >
          Get Started
        </Button>

        <TouchableOpacity
          onPress={pickBackup}
          disabled={backupPickLoading}
          style={styles.restoreLink}
          accessibilityRole="button"
          accessibilityLabel="Returning user? Restore from backup"
        >
          <Text style={styles.restoreLinkText}>
            {backupPickLoading ? 'Opening…' : 'Returning user? Restore from backup →'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Step 1: Mission ───────────────────────────────────────────────────────

  function StepMission() {
    return (
      <ScrollView contentContainerStyle={styles.stepScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.missionIconWrap}>
          <MaterialCommunityIcons name="hand-heart" size={64} color={AMBER} />
        </View>
        <Text style={styles.stepTitle}>Built with Purpose</Text>
        <Text style={styles.missionBody}>
          51% of FinPath's profits go toward food and education for underprivileged children in rural India.
        </Text>

        {/* Impact stats */}
        <View style={styles.statsRow}>
          {[
            { icon: '🍱', label: 'Meals funded', value: '2,400+' },
            { icon: '📚', label: 'Kids supported', value: '180+' },
            { icon: '🌱', label: 'Since', value: '2025' },
          ].map(stat => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statIcon}>{stat.icon}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.missionQuote}>"Your plan. Their future."</Text>

        <Button
          mode="contained"
          onPress={() => setStep(2)}
          style={styles.nextBtn}
          contentStyle={styles.nextBtnContent}
          buttonColor={BRAND}
          labelStyle={styles.nextBtnLabel}
        >
          Next →
        </Button>

        <TouchableOpacity onPress={() => setStep(2)} style={styles.skipLink} accessibilityRole="button">
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ─── Step 2: About You ─────────────────────────────────────────────────────

  function StepAboutYou() {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.stepScroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepTitle}>Tell us about yourself</Text>

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

          <View style={styles.currencyWrap}>
            <CurrencyPicker value={currency} onChange={setCurrency} />
          </View>

          <Button
            mode="contained"
            onPress={goNext}
            style={styles.nextBtn}
            contentStyle={styles.nextBtnContent}
            buttonColor={BRAND}
            labelStyle={styles.nextBtnLabel}
          >
            Next →
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Step 3: Income ────────────────────────────────────────────────────────

  function StepIncome() {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.stepScroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepTitle}>What do you earn?</Text>
          <Text style={styles.stepSubtext}>
            We use this to calculate your savings potential. Adjust anytime.
          </Text>

          <TextInput
            label="Monthly Take-Home Income"
            value={monthlyIncome}
            onChangeText={setMonthlyIncome}
            mode="outlined"
            style={styles.input}
            keyboardType="numeric"
            left={<TextInput.Affix text={getCurrencyByCode(currency)?.symbol ?? currency} />}
            error={!!errors.income}
          />
          {errors.income && <HelperText type="error">{errors.income}</HelperText>}

          <Button
            mode="contained"
            onPress={goNext}
            style={styles.nextBtn}
            contentStyle={styles.nextBtnContent}
            buttonColor={BRAND}
            labelStyle={styles.nextBtnLabel}
          >
            Next →
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Step 4: Security ──────────────────────────────────────────────────────

  function StepSecurity() {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.stepScroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepTitle}>Protect your data</Text>

          {backupLoaded && (
            <View style={styles.backupBanner}>
              <MaterialCommunityIcons name="check-circle" size={18} color={BRAND} />
              <Text style={styles.backupBannerText}>Backup loaded — just set your PIN</Text>
              <TouchableOpacity onPress={clearBackup} accessibilityRole="button" accessibilityLabel="Clear backup">
                <MaterialCommunityIcons name="close-circle-outline" size={18} color="#888" />
              </TouchableOpacity>
            </View>
          )}

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
              <MaterialCommunityIcons name="fingerprint" size={22} color={BRAND} />
              <View style={styles.biometricText}>
                <Text variant="labelLarge" style={styles.biometricLabel}>Enable Fingerprint Login</Text>
                <Text variant="bodySmall" style={styles.biometricSub}>Use fingerprint instead of PIN to log in</Text>
              </View>
              <Switch
                value={enableBiometric}
                onValueChange={setEnableBiometric}
                thumbColor={enableBiometric ? BRAND : '#CCC'}
                trackColor={{ false: '#E0E0E0', true: BRAND_LIGHT }}
              />
            </View>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={styles.nextBtn}
            contentStyle={styles.nextBtnContent}
            buttonColor={BRAND}
            labelStyle={styles.nextBtnLabel}
            accessibilityLabel={backupPayload ? 'Set PIN and restore backup' : 'Create profile'}
          >
            {backupPayload ? 'Set PIN & Restore' : 'Create Profile'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Root render ───────────────────────────────────────────────────────────

  if (step === 0) {
    return (
      <View style={styles.container}>
        <StepHero />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackButton />
      <ProgressDots />
      {step === 1 && <StepMission />}
      {step === 2 && <StepAboutYou />}
      {step === 3 && <StepIncome />}
      {step === 4 && <StepSecurity />}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Hero
  heroContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  heroHeadline: {
    fontSize: 28,
    fontWeight: 'bold',
    color: BRAND,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 36,
  },
  heroSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 28,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 36,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: BRAND_LIGHT,
  },
  pillText: { fontSize: 13, color: BRAND, fontWeight: '500' },
  heroBtn: { borderRadius: 10, width: '100%', marginBottom: 20 },
  heroBtnContent: { paddingVertical: 10 },
  heroBtnLabel: { fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  restoreLink: { paddingVertical: 8 },
  restoreLinkText: { fontSize: 13, color: BRAND, textDecorationLine: 'underline' },

  // Progress dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 56,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CCC',
  },
  dotFilled: { backgroundColor: BRAND },
  dotCurrent: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BRAND,
  },

  // Back button
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 52,
    left: 12,
    zIndex: 10,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backText: { fontSize: 15, color: BRAND, fontWeight: '500' },

  // Shared step layout
  stepScroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: BRAND,
    marginBottom: 10,
    marginTop: 8,
  },
  stepSubtext: { fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 20 },

  // Next / submit button
  nextBtn: { marginTop: 24, borderRadius: 8 },
  nextBtnContent: { paddingVertical: 8 },
  nextBtnLabel: { fontSize: 16, fontWeight: '600' },

  // Input
  input: { marginBottom: 4, backgroundColor: '#FFFFFF' },
  currencyWrap: { marginTop: 8 },

  // Mission
  missionIconWrap: { alignItems: 'center', marginBottom: 16, marginTop: 8 },
  missionBody: { fontSize: 15, color: '#444', lineHeight: 24, marginBottom: 24 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24, justifyContent: 'space-between' },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '700', color: BRAND, marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#888', textAlign: 'center' },
  missionQuote: {
    fontStyle: 'italic',
    fontSize: 16,
    color: BRAND,
    textAlign: 'center',
    marginBottom: 28,
    fontWeight: '500',
  },
  skipLink: { alignItems: 'center', marginTop: 12, paddingVertical: 8 },
  skipText: { fontSize: 13, color: '#999' },

  // Security / biometric
  biometricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    gap: 12,
    elevation: 1,
  },
  biometricText: { flex: 1 },
  biometricLabel: { color: BRAND },
  biometricSub: { color: '#888', marginTop: 2 },

  // Backup banner
  backupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  backupBannerText: { flex: 1, fontSize: 14, color: BRAND, fontWeight: '500' },
});
