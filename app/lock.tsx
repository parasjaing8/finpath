import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';
import {
  getCredentials,
  isBiometricSupported,
  promptBiometric,
  verifyPin,
} from '@/storage/auth';
import { markUnlockedForSession } from '@/storage/session';

export default function Lock() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bioAvailable, setBioAvailable] = useState(false);
  const triedBio = useRef(false);

  useEffect(() => {
    (async () => {
      const [creds, hwOk] = await Promise.all([getCredentials(), isBiometricSupported()]);
      const enabled = !!creds?.biometricEnabled && hwOk;
      setBioAvailable(enabled);
      if (enabled && !triedBio.current) {
        triedBio.current = true;
        const ok = await promptBiometric('Unlock FinPath');
        if (ok) {
          markUnlockedForSession();
          router.replace('/(tabs)/dashboard');
        }
      }
    })();
  }, []);

  async function tryPin(value: string) {
    setError(null);
    if (value.length !== 6) return;
    const ok = await verifyPin(value);
    if (ok) {
      markUnlockedForSession();
      router.replace('/(tabs)/dashboard');
    } else {
      setError('Incorrect PIN. Try again.');
      setPin('');
    }
  }

  async function onUseFingerprint() {
    const ok = await promptBiometric('Unlock FinPath');
    if (ok) {
      markUnlockedForSession();
      router.replace('/(tabs)/dashboard');
    }
  }

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background, paddingTop: insets.top + 64 }]}>
      <View style={[styles.logoCircle, { backgroundColor: colors.secondary }]}>
        <Feather name="lock" size={28} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.primary }]}>FinPath</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>Enter your 6-digit PIN to unlock</Text>

      <TextInput
        style={[
          styles.pinInput,
          {
            borderColor: error ? '#C62828' : colors.border,
            color: colors.foreground,
            backgroundColor: colors.card,
          },
        ]}
        value={pin}
        onChangeText={t => {
          const digits = t.replace(/\D/g, '').slice(0, 6);
          setPin(digits);
          if (digits.length === 6) tryPin(digits);
        }}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        autoFocus={Platform.OS !== 'web'}
        placeholder="••••••"
        placeholderTextColor={colors.mutedForeground}
        textAlign="center"
      />
      {error && <Text style={styles.err}>{error}</Text>}

      {bioAvailable && (
        <TouchableOpacity onPress={onUseFingerprint} style={styles.bioBtn} activeOpacity={0.7}>
          <Feather name="shield" size={18} color={colors.primary} />
          <Text style={[styles.bioText, { color: colors.primary }]}>Use Fingerprint</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
  logoCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  sub: { fontSize: 14, marginBottom: 32 },
  pinInput: {
    width: 220,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    fontSize: 22,
    letterSpacing: 8,
  },
  err: { color: '#C62828', marginTop: 12, fontSize: 13 },
  bioBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, padding: 8 },
  bioText: { fontSize: 14, fontWeight: '600' },
});
