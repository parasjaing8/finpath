import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Redirect } from 'expo-router';

import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { Profile } from '@/engine/types';
import { setCredentials, isBiometricSupported } from '@/storage/auth';
import { shadow } from '@/constants/theme';

const CURRENCIES: { key: 'INR' | 'USD'; symbol: string; label: string }[] = [
  { key: 'INR', symbol: '₹', label: 'INR' },
  { key: 'USD', symbol: '$', label: 'USD' },
];

const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PIN_REGEX = /^\d{6}$/;

function validateDob(dob: string): { ok: true; age: number } | { ok: false; error: string } {
  if (!DOB_REGEX.test(dob)) return { ok: false, error: 'Use format YYYY-MM-DD' };
  const [y, m, d] = dob.split('-').map(n => parseInt(n, 10));
  if (m < 1 || m > 12 || d < 1 || d > 31) return { ok: false, error: 'Invalid date' };
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return { ok: false, error: 'Invalid date' };
  }
  const today = new Date();
  let age = today.getFullYear() - y;
  const md = today.getMonth() - (m - 1);
  if (md < 0 || (md === 0 && today.getDate() < d)) age--;
  if (age < 0 || age > 120) return { ok: false, error: 'Age must be 0–120' };
  return { ok: true, age };
}

export default function Onboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { completeOnboarding, onboarded, isLoaded } = useApp();

  const [name, setName] = useState('');
  const [dob, setDob] = useState('2000-01-01');
  const [income, setIncome] = useState('');
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [biometric, setBiometric] = useState(true);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    isBiometricSupported().then(setBiometricSupported);
  }, []);

  const incomeNum = useMemo(() => {
    const n = Number(income.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [income]);

  const dobCheck = validateDob(dob);
  const nameOk = name.trim().length > 0;
  const incomeOk = incomeNum > 0;
  const pinOk = PIN_REGEX.test(pin);
  const pinMatch = pin === pinConfirm;
  const canSubmit =
    nameOk && dobCheck.ok && incomeOk && pinOk && pinMatch && !submitting;

  function showError(msg: string) {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      window.alert(msg);
    } else {
      Alert.alert('Check your details', msg);
    }
  }

  async function onSubmit() {
    if (!nameOk) return showError('Please enter your full name.');
    if (!dobCheck.ok) return showError(dobCheck.error);
    if (!incomeOk) return showError('Please enter a valid monthly income.');
    if (!pinOk) return showError('PIN must be exactly 6 digits.');
    if (!pinMatch) return showError('PINs do not match.');

    setSubmitting(true);
    try {
      const profile: Profile = {
        id: '1',
        name: name.trim(),
        dob,
        currency,
        monthly_income: incomeNum,
      };
      await setCredentials(pin, biometric && biometricSupported);
      await completeOnboarding(profile);
      router.replace('/(tabs)/dashboard');
    } catch (err) {
      setSubmitting(false);
      showError(err instanceof Error ? err.message : 'Could not create profile.');
    }
  }

  // Self-guard (hooks-safe — placed AFTER all hooks): prevent overwriting an
  // existing user's data via deep link to /onboarding. Only the explicit
  // "clear app data" path (which wipes storage and resets `onboarded`) should
  // ever land here.
  if (isLoaded && onboarded) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  const inputStyle = [
    styles.input,
    {
      borderColor: colors.border,
      color: colors.foreground,
      backgroundColor: colors.card,
    },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.primary }]}>
          Welcome to FinPath
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Your personal financial freedom planner. Let's set up your profile.
        </Text>

        <TextInput
          style={inputStyle}
          value={name}
          onChangeText={setName}
          placeholder="Full Name"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <View style={[styles.dobBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.dobLabel, { color: colors.mutedForeground }]}>Date of Birth</Text>
          <View style={styles.dobRow}>
            <TextInput
              style={[styles.dobInput, { color: colors.foreground }]}
              value={dob}
              onChangeText={setDob}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
            />
            <Feather name="calendar" size={18} color={colors.mutedForeground} />
          </View>
        </View>

        <TextInput
          style={inputStyle}
          value={income}
          onChangeText={setIncome}
          placeholder="Monthly Take-Home Income"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="numeric"
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Currency</Text>
        <View style={[styles.segWrap, { backgroundColor: colors.muted }]}>
          {CURRENCIES.map(c => {
            const active = currency === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                onPress={() => setCurrency(c.key)}
                style={[
                  styles.segBtn,
                  active && [styles.segBtnActive, { backgroundColor: colors.secondary, borderColor: colors.primary }],
                ]}
                activeOpacity={0.8}
              >
                <Text style={[styles.segText, { color: active ? colors.primary : colors.mutedForeground }]}>
                  {c.symbol} {c.key}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          style={inputStyle}
          value={pin}
          onChangeText={t => setPin(t.replace(/\D/g, '').slice(0, 6))}
          placeholder="Set PIN (6 digits)"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
        />
        <TextInput
          style={inputStyle}
          value={pinConfirm}
          onChangeText={t => setPinConfirm(t.replace(/\D/g, '').slice(0, 6))}
          placeholder="Confirm PIN"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
        />
        {pinConfirm.length > 0 && !pinMatch && (
          <Text style={[styles.helpText, { color: '#C62828' }]}>PINs do not match.</Text>
        )}

        {biometricSupported && (
          <View style={[styles.bioRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="shield" size={20} color={colors.primary} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bioTitle, { color: colors.primary }]}>Enable Fingerprint Login</Text>
              <Text style={[styles.bioSub, { color: colors.mutedForeground }]}>
                Use fingerprint instead of PIN to log in
              </Text>
            </View>
            <Switch
              value={biometric}
              onValueChange={setBiometric}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.cta,
            { backgroundColor: canSubmit ? colors.primary : colors.muted },
            shadow(2),
          ]}
          onPress={onSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          <Text style={[styles.ctaText, { color: canSubmit ? '#fff' : colors.mutedForeground }]}>
            {submitting ? 'Creating…' : 'Create Profile'}
          </Text>
        </TouchableOpacity>

        <View style={[styles.donateBanner, { backgroundColor: '#FFF8E1', borderColor: '#FFE082' }]}>
          <Text style={styles.donateEmoji}>{'\uD83D\uDE4F'}</Text>
          <Text style={[styles.donateText, { color: '#5D4037' }]}>
            51% of FinPath's profits go toward food & education for underprivileged children in rural India. Your plan. Their future.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 15,
    marginBottom: 12,
  },
  dobBox: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 6,
    marginBottom: 12,
  },
  dobLabel: { fontSize: 11, marginBottom: 2 },
  dobRow: { flexDirection: 'row', alignItems: 'center' },
  dobInput: { flex: 1, fontSize: 15, paddingVertical: Platform.OS === 'ios' ? 6 : 4 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  segWrap: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    marginBottom: 16,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segBtnActive: {},
  segText: { fontSize: 14, fontWeight: '600' },
  helpText: { fontSize: 12, marginTop: -8, marginBottom: 8 },
  bioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    marginTop: 4,
  },
  bioTitle: { fontSize: 14, fontWeight: '600' },
  bioSub: { fontSize: 12, marginTop: 2 },
  cta: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  ctaText: { fontSize: 16, fontWeight: '700' },
  donateBanner: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  donateEmoji: { fontSize: 22, marginRight: 10 },
  donateText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
