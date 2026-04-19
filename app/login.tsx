import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { getAllProfiles, getAssets, getExpenses, getGoals, Profile, recordFailedAttempt, resetFailedAttempts, getProfilePin, getBiometricEnabled } from '../db/queries';
import { useProfile } from '../hooks/useProfile';
import { useApp } from '../context/AppContext';
import type { Profile as EngineProfile, Asset as EngineAsset, Expense as EngineExpense, Goals as EngineGoals } from '../engine/types';

const MAX_FREE_ATTEMPTS = 5; // lockout kicks in after this many failures

export default function LoginScreen() {
  const router = useRouter();
  const { setCurrentProfileId, refreshProfiles } = useProfile();
  const { profile: currentProfile, setProfile, setAssets, setExpenses, setGoals } = useApp();

  /**
   * Hydrate AppContext from SQLite so V2 screens have live data after login.
   *
   * IMPORTANT: When the same profile is already loaded (from encrypted
   * AsyncStorage via loadData), we only refresh the profile metadata and
   * skip overwriting assets/expenses/goals.  Encrypted AsyncStorage is the
   * canonical store — it may contain data (e.g. from importAll) that SQLite
   * doesn't have.  Blindly overwriting it from SQLite was the root cause of
   * the "data lost after restart" bug.
   *
   * We DO perform a full SQLite sync when switching to a different profile.
   */
  async function syncToAppContext(p: Profile) {
    const selectedId = String(p.id);
    const engineProfile: EngineProfile = {
      id: selectedId, name: p.name, dob: p.dob,
      currency: p.currency, monthly_income: p.monthly_income,
    };

    // Always update profile metadata (name, income, etc.)
    await setProfile(engineProfile);

    // If loadData already populated the correct profile's data, don't
    // overwrite assets/expenses/goals from SQLite.
    if (currentProfile?.id === selectedId) {
      return;
    }

    // Different profile selected — hydrate from SQLite
    const [sqlAssets, sqlExpenses, sqlGoals] = await Promise.all([
      getAssets(p.id),
      getExpenses(p.id),
      getGoals(p.id),
    ]);
    const engineAssets: EngineAsset[] = sqlAssets.map(a => ({
      id: String(a.id), name: a.name, category: a.category,
      current_value: a.current_value, expected_roi: a.expected_roi,
      is_self_use: !!a.is_self_use, is_recurring: !!a.is_recurring,
      recurring_amount: a.recurring_amount ?? undefined,
      recurring_frequency: a.recurring_frequency ?? undefined,
      next_vesting_date: a.next_vesting_date ?? undefined,
      vesting_end_date: a.vesting_end_date ?? undefined,
    }));
    const engineExpenses: EngineExpense[] = sqlExpenses.map(e => ({
      id: String(e.id), name: e.name, category: e.category,
      expense_type: e.expense_type as EngineExpense['expense_type'],
      amount: e.amount, frequency: e.frequency ?? undefined,
      inflation_rate: e.inflation_rate,
      start_date: e.start_date ?? undefined,
      end_date: e.end_date ?? undefined,
    }));
    await setAssets(engineAssets);
    await setExpenses(engineExpenses);
    if (sqlGoals) {
      const engineGoals: EngineGoals = {
        retirement_age: sqlGoals.retirement_age,
        sip_stop_age: sqlGoals.sip_stop_age,
        pension_income: sqlGoals.pension_income ?? undefined,
        fire_type: sqlGoals.fire_type,
        fire_target_age: sqlGoals.fire_target_age,
        withdrawal_rate: sqlGoals.withdrawal_rate,
        inflation_rate: sqlGoals.inflation_rate,
      };
      await setGoals(engineGoals);
    }
  }

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const loadProfiles = useCallback(async () => {
    const all = await getAllProfiles();
    setProfiles(all);
    // Auto-select single profile for Groww-like experience
    if (all.length === 1 && !selectedProfile) {
      selectProfile(all[0]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfiles();
    }, [loadProfiles])
  );

  function selectProfile(profile: Profile) {
    setSelectedProfile(profile);
    setPin('');
    setError('');
    // Restore lockout countdown if profile is still locked out
    const remaining = Math.ceil((profile.lockout_until - Date.now()) / 1000);
    setLockoutSeconds(remaining > 0 ? remaining : 0);
    // Check biometric setting and auto-trigger if enabled
    getBiometricEnabled(profile.id).then(enabled => {
      setBiometricEnabled(enabled);
      if (enabled && remaining <= 0) triggerBiometric(profile);
    });
  }

  async function triggerBiometric(profile: Profile) {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) return;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Login as ${profile.name}`,
      fallbackLabel: 'Use PIN instead',
      cancelLabel: 'Cancel',
    });
    if (result.success) {
      await resetFailedAttempts(profile.id);
      await setCurrentProfileId(profile.id);
      await refreshProfiles();
      try { await syncToAppContext(profile); } catch { /* non-critical */ }
      router.replace('/(tabs)/assets');
    }
  }

  // Countdown ticker for lockout
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const id = setInterval(() => {
      setLockoutSeconds(s => {
        if (s <= 1) { clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [lockoutSeconds]);

  async function hashPin(pin: string, storedValue: string): Promise<boolean> {
    if (storedValue.includes('$')) {
      // New format: salt$hash
      const [salt, expectedHash] = storedValue.split('$');
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + pin);
      return hash === expectedHash;
    }
    // Legacy format: bare SHA-256 (profiles created before this update)
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
    return hash === storedValue;
  }

  async function handleLogin() {
    if (!selectedProfile) return;
    if (lockoutSeconds > 0) return;
    if (pin.length !== 6) {
      setError('Enter your 6-digit PIN');
      return;
    }
    setLoading(true);
    try {
      const storedPin = await getProfilePin(selectedProfile.id);
      const isCorrect = storedPin
        ? await hashPin(pin, storedPin)
        : false;
      if (isCorrect) {
        await resetFailedAttempts(selectedProfile.id);
        await setCurrentProfileId(selectedProfile.id);
        await refreshProfiles();
        try { await syncToAppContext(selectedProfile); } catch { /* non-critical */ }
        router.replace('/(tabs)/assets');
      } else {
        const { lockoutUntil } = await recordFailedAttempt(selectedProfile.id);
        const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
        if (remaining > 0) {
          setLockoutSeconds(remaining);
          setError(`Too many attempts. Locked for ${remaining}s.`);
        } else {
          setError('Incorrect PIN. Try again.');
        }
        setPin('');
        // Refresh profile list to get updated attempt counts
        const all = await getAllProfiles();
        setProfiles(all);
        const updated = all.find(p => p.id === selectedProfile.id) ?? null;
        setSelectedProfile(updated);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Title */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <MaterialCommunityIcons name="leaf" size={36} color="#FFF" />
          </View>
          <Text variant="headlineMedium" style={styles.title}>FinPath</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Select your profile to continue
          </Text>
        </View>

        {/* Profile Grid */}
        <View style={styles.grid}>
          {profiles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-off-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>No profiles found</Text>
            </View>
          ) : (
            <View style={styles.gridRow}>
              {profiles.map(item => {
                const isSelected = selectedProfile?.id === item.id;
                return (
                  <TouchableOpacity
                    key={String(item.id)}
                    style={[
                      styles.profileCard,
                      profiles.length === 1 && styles.profileCardSingle,
                      isSelected && styles.profileCardSelected,
                    ]}
                    onPress={() => selectProfile(item)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                      <Text style={styles.avatarText}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.profileName, isSelected && styles.profileNameSelected]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={16} color="#1B5E20" style={styles.checkIcon} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* PIN Entry */}
        {selectedProfile && (
          <View style={styles.pinSection}>
            <Text variant="titleSmall" style={styles.pinLabel}>
              Enter PIN for <Text style={styles.pinProfileName}>{selectedProfile.name}</Text>
            </Text>
            <TextInput
              mode="outlined"
              label="6-digit PIN"
              value={pin}
              onChangeText={text => {
                setPin(text.replace(/\D/g, '').slice(0, 6));
                setError('');
              }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              style={styles.pinInput}
              error={!!error}
              outlineColor="#C8E6C9"
              activeOutlineColor="#1B5E20"
              accessibilityLabel={`PIN for ${selectedProfile?.name}`}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={pin.length !== 6 || loading || lockoutSeconds > 0}
              style={styles.loginBtn}
              contentStyle={styles.loginBtnContent}
              textColor="#fff"
              accessibilityLabel={lockoutSeconds > 0 ? `Account locked, wait ${lockoutSeconds} seconds` : 'Login'}
            >
              {lockoutSeconds > 0 ? `Locked (${lockoutSeconds}s)` : 'Login'}
            </Button>
            {biometricEnabled && lockoutSeconds <= 0 && (
              <TouchableOpacity
                style={styles.biometricBtn}
                onPress={() => selectedProfile && triggerBiometric(selectedProfile)}
                accessibilityLabel="Login with fingerprint"
              >
                <MaterialCommunityIcons name="fingerprint" size={32} color="#1B5E20" />
                <Text style={styles.biometricBtnText}>Use Fingerprint</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Privacy Policy */}
        <TouchableOpacity
          onPress={() => Linking.openURL('https://aihomecloud.com/finpath/privacy')}
          style={styles.privacyLink}
          accessibilityRole="link"
        >
          <Text style={styles.privacyLinkText}>Privacy Policy</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scroll: {
    padding: 24,
    paddingTop: 60,
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1B5E20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  title: {
    fontWeight: '700',
    color: '#1B5E20',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#666',
    marginTop: 4,
  },
  grid: {
    paddingBottom: 8,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  profileCard: {
    flex: 1,
    margin: 8,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  profileCardSingle: {
    maxWidth: 200,
    alignSelf: 'center',
  },
  profileCardSelected: {
    borderColor: '#1B5E20',
    backgroundColor: '#F1F8E9',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#C8E6C9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarSelected: {
    backgroundColor: '#1B5E20',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B5E20',
  },
  profileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  profileNameSelected: {
    color: '#1B5E20',
  },
  checkIcon: {
    marginTop: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: '#AAA',
    marginTop: 8,
    fontSize: 14,
  },
  pinSection: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  pinLabel: {
    color: '#555',
    marginBottom: 12,
    textAlign: 'center',
  },
  pinProfileName: {
    fontWeight: '700',
    color: '#1B5E20',
  },
  pinInput: {
    backgroundColor: '#FFF',
    marginBottom: 4,
    letterSpacing: 8,
    fontSize: 20,
  },
  errorText: {
    color: '#B71C1C',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
    textAlign: 'center',
  },
  loginBtn: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#1B5E20',
  },
  biometricBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 4,
  },
  biometricBtnText: {
    color: '#1B5E20',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '600',
  },
  loginBtnContent: {
    height: 48,
  },
  privacyLink: {
    alignItems: 'center',
    marginTop: 24,
    paddingBottom: 8,
  },
  privacyLinkText: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'underline',
  },
});
