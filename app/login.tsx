import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
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
import { getAllProfiles, Profile, recordFailedAttempt, resetFailedAttempts, getProfilePin } from '../db/queries';
import { useProfile } from '../hooks/useProfile';

const MAX_FREE_ATTEMPTS = 5; // lockout kicks in after this many failures

export default function LoginScreen() {
  const router = useRouter();
  const { setCurrentProfileId, refreshProfiles } = useProfile();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const loadProfiles = useCallback(async () => {
    const all = await getAllProfiles();
    setProfiles(all);
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  function selectProfile(profile: Profile) {
    setSelectedProfile(profile);
    setPin('');
    setError('');
    // Restore lockout countdown if profile is still locked out
    const remaining = Math.ceil((profile.lockout_until - Date.now()) / 1000);
    setLockoutSeconds(remaining > 0 ? remaining : 0);
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

  const numColumns = profiles.length === 1 ? 1 : 2;

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
        <FlatList
          data={profiles}
          keyExtractor={item => String(item.id)}
          numColumns={numColumns}
          key={numColumns}
          scrollEnabled={false}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => {
            const isSelected = selectedProfile?.id === item.id;
            return (
              <TouchableOpacity
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
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-off-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>No profiles found</Text>
            </View>
          }
        />

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
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={pin.length !== 6 || loading || lockoutSeconds > 0}
              style={styles.loginBtn}
              contentStyle={styles.loginBtnContent}
            >
              {lockoutSeconds > 0 ? `Locked (${lockoutSeconds}s)` : 'Login'}
            </Button>
          </View>
        )}

        {/* Add New Profile */}
        <Button
          mode="text"
          onPress={() => router.push('/onboarding/create-profile')}
          style={styles.newProfileBtn}
          textColor="#1B5E20"
          icon="account-plus-outline"
        >
          Add New Profile
        </Button>

        {/* Privacy Policy */}
        <TouchableOpacity
          onPress={() => Linking.openURL('https://parasjaing8.github.io/finpath/PRIVACY_POLICY')}
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
  loginBtnContent: {
    height: 48,
  },
  newProfileBtn: {
    marginTop: 12,
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
