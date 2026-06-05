import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
  Alert,
  Image,
  TextInput as RNTextInput,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { getAllProfiles, Profile, recordFailedAttempt, resetFailedAttempts, getProfilePin, getBiometricEnabled, deleteProfile } from '../db/queries';
import { useProfile } from '../hooks/useProfile';
import { useApp } from '../context/AppContext';
import { runLegacyMigration } from '../storage/legacyMigration';

const MAX_FREE_ATTEMPTS = 5;
const PIN_LENGTH = 4;

export default function LoginScreen() {
  const router = useRouter();
  const { setCurrentProfileId, refreshProfiles } = useProfile();
  const { loadProfile } = useApp();
  const insets = useSafeAreaInsets();
  const pinInputRef = useRef<RNTextInput>(null);

  useEffect(() => {
    runLegacyMigration().catch(() => {});
  }, []);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const autoSelectedRef = useRef(false);

  const loadProfiles = useCallback(async () => {
    const all = await getAllProfiles();
    setProfiles(all);
    if (all.length === 1 && !autoSelectedRef.current) {
      autoSelectedRef.current = true;
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
    const remaining = Math.ceil((profile.lockout_until - Date.now()) / 1000);
    setLockoutSeconds(remaining > 0 ? remaining : 0);
    getBiometricEnabled(profile.id).then(enabled => {
      setBiometricEnabled(enabled);
      if (enabled && remaining <= 0) triggerBiometric(profile);
    });
    setTimeout(() => pinInputRef.current?.focus(), 300);
  }

  async function triggerBiometric(profile: Profile) {
    try {
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
        try {
          await loadProfile(profile.id);
          router.replace('/(tabs)/assets');
        } catch {
          Alert.alert('Load failed', 'Could not load profile data. Please try again.');
        }
      } else {
        // Dialog dismissed without success — focus PIN input after Android regains window focus
        setTimeout(() => pinInputRef.current?.focus(), 800);
      }
    } catch {
      // Some Android versions throw on cancel instead of returning success:false
      setTimeout(() => pinInputRef.current?.focus(), 800);
    }
  }

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
      const [salt, expectedHash] = storedValue.split('$');
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + pin);
      return hash === expectedHash;
    }
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
    return hash === storedValue;
  }

  async function handleLogin() {
    if (!selectedProfile) return;
    if (lockoutSeconds > 0) return;
    if (pin.length !== PIN_LENGTH) {
      setError('Enter your 4-digit PIN');
      return;
    }
    setLoading(true);
    try {
      const storedPin = await getProfilePin(selectedProfile.id);
      const isCorrect = storedPin ? await hashPin(pin, storedPin) : false;
      if (isCorrect) {
        await resetFailedAttempts(selectedProfile.id);
        await setCurrentProfileId(selectedProfile.id);
        await refreshProfiles();
        try {
          await loadProfile(selectedProfile.id);
          router.replace('/(tabs)/assets');
        } catch {
          Alert.alert('Load failed', 'Could not load profile data. Please try again.');
        }
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
        const all = await getAllProfiles();
        setProfiles(all);
        const updated = all.find(p => p.id === selectedProfile.id) ?? null;
        setSelectedProfile(updated);
      }
    } finally {
      setLoading(false);
    }
  }

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === PIN_LENGTH && selectedProfile && lockoutSeconds <= 0) {
      handleLogin();
    }
  }, [pin]);

  const isLocked = lockoutSeconds > 0;
  const canUnlock = pin.length === PIN_LENGTH && !loading && !isLocked;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.header}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>FinPath</Text>
          <Text style={styles.subtitle}>
            {selectedProfile
              ? `Welcome back, ${selectedProfile.name} 👋`
              : 'Welcome back 👋'}
          </Text>
        </View>

        {/* Profile pill */}
        <View style={styles.profileSection}>
          {profiles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-off-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>No profiles found</Text>
            </View>
          ) : (
            <View style={styles.profileList}>
              {profiles.map(item => {
                const isSelected = selectedProfile?.id === item.id;
                return (
                  <TouchableOpacity
                    key={String(item.id)}
                    style={[styles.profilePill, isSelected && styles.profilePillSelected]}
                    onPress={() => selectProfile(item)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                      <Text style={[styles.avatarText, isSelected && styles.avatarTextSelected]}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.profileName, isSelected && styles.profileNameSelected]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={20} color="#1B5E20" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* PIN section */}
        {selectedProfile && (
          <View style={styles.pinSection}>
            <Text style={styles.pinLabel}>Enter your PIN</Text>

            {/* Dot indicators — transparent input overlaid so any tap directly hits it */}
            <View style={styles.pinInputWrapper}>
              <View style={styles.dotsRow} pointerEvents="none">
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      pin.length > i && styles.dotFilled,
                      isLocked && styles.dotLocked,
                    ]}
                  />
                ))}
              </View>
              <RNTextInput
                ref={pinInputRef}
                value={pin}
                onChangeText={text => {
                  setPin(text.replace(/\D/g, '').slice(0, PIN_LENGTH));
                  setError('');
                }}
                keyboardType="number-pad"
                maxLength={PIN_LENGTH}
                secureTextEntry
                style={styles.hiddenInput}
                editable={!isLocked && !loading}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Unlock button */}
            <TouchableOpacity
              style={[styles.unlockBtn, !canUnlock && styles.unlockBtnDisabled]}
              onPress={handleLogin}
              disabled={!canUnlock}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons
                name={isLocked ? 'lock' : 'lock-open-outline'}
                size={20}
                color="#fff"
              />
              <Text style={styles.unlockBtnText}>
                {isLocked ? `Locked (${lockoutSeconds}s)` : loading ? 'Unlocking…' : 'Unlock'}
              </Text>
              {!isLocked && !loading && (
                <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
              )}
            </TouchableOpacity>

            {/* Biometric */}
            {biometricEnabled && !isLocked && (
              <>
                <Text style={styles.orSeparator}>or</Text>
                <TouchableOpacity
                  style={styles.biometricBtn}
                  onPress={() => selectedProfile && triggerBiometric(selectedProfile)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="fingerprint" size={22} color="#1B5E20" />
                  <Text style={styles.biometricBtnText}>Unlock with Fingerprint</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Forgot PIN */}
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Forgot PIN?',
                  `Without your PIN, the only recovery option is to delete the profile.\n\nHave you exported a backup recently? Without a backup, all assets, expenses, and goals for "${selectedProfile.name}" will be permanently lost.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete Profile',
                      style: 'destructive',
                      onPress: () => {
                        Alert.alert(
                          'Are you sure?',
                          `Tap "Delete" to permanently erase "${selectedProfile.name}" and all associated data. This cannot be undone.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: async () => {
                                await deleteProfile(selectedProfile.id);
                                setSelectedProfile(null);
                                setPin('');
                                setError('');
                                autoSelectedRef.current = false;
                                await loadProfiles();
                              },
                            },
                          ]
                        );
                      },
                    },
                  ]
                );
              }}
              style={styles.forgotPin}
              accessibilityRole="button"
            >
              <Text style={styles.forgotPinText}>Forgot PIN?</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.trustRow}>
            <MaterialCommunityIcons name="shield-check-outline" size={14} color="#888" />
            <Text style={styles.trustText}>Your data is safe and encrypted</Text>
          </View>
          <TouchableOpacity onPress={() => Linking.openURL('https://aihomecloud.com/finpath/privacy')}>
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAF7',
  },
  scroll: {
    padding: 24,
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1B5E20',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 15,
    color: '#555',
    marginTop: 4,
  },
  profileSection: {
    marginBottom: 16,
  },
  profileList: {
    gap: 8,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 40,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    gap: 12,
  },
  profilePillSelected: {
    borderColor: '#1B5E20',
    backgroundColor: '#F1F8E9',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#C8E6C9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSelected: {
    backgroundColor: '#1B5E20',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B5E20',
  },
  avatarTextSelected: {
    color: '#FFF',
  },
  profileName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  profileNameSelected: {
    color: '#1B5E20',
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
    borderRadius: 20,
    padding: 24,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    alignItems: 'center',
  },
  pinLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    fontWeight: '500',
  },
  pinInputWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 20,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#BDBDBD',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#1B5E20',
    borderColor: '#1B5E20',
  },
  dotLocked: {
    borderColor: '#EF9A9A',
    backgroundColor: '#FFCDD2',
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
    color: 'transparent',
  },
  errorText: {
    color: '#B71C1C',
    fontSize: 12,
    marginTop: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B5E20',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 20,
    width: '100%',
    gap: 10,
  },
  unlockBtnDisabled: {
    backgroundColor: '#A5D6A7',
  },
  unlockBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  orSeparator: {
    color: '#999',
    fontSize: 13,
    marginVertical: 12,
  },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#1B5E20',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    gap: 8,
  },
  biometricBtnText: {
    color: '#1B5E20',
    fontSize: 15,
    fontWeight: '600',
  },
  forgotPin: {
    marginTop: 16,
    paddingVertical: 4,
  },
  forgotPinText: {
    fontSize: 13,
    color: '#1B5E20',
    textDecorationLine: 'underline',
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 24,
    paddingBottom: 8,
    gap: 6,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trustText: {
    fontSize: 12,
    color: '#888',
  },
  linkText: {
    fontSize: 12,
    color: '#999',
  },
});
