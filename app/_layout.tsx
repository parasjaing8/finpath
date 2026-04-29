import React, { useEffect, useRef, useState } from 'react';
import { Slot } from 'expo-router';
import {
  Linking, Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { ProfileProvider } from '../hooks/useProfile';
import { ProProvider } from '../hooks/usePro';
import { AppProvider, ExportPayload, useApp } from '../context/AppContext';
import * as Sentry from '@sentry/react-native';
import { ErrorBoundary } from '../components/ErrorBoundary';
import * as FileSystem from 'expo-file-system/legacy';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { getProfilePin } from '../db/queries';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
});

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1B5E20',
    primaryContainer: '#C8E6C9',
    secondary: '#33691E',
    secondaryContainer: '#DCEDC8',
    surface: '#FFFFFF',
    background: '#F5F5F5',
  },
};

function LinkingHandler() {
  const { profile, importAll } = useApp();
  const [pendingPayload, setPendingPayload] = useState<ExportPayload | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const pendingUriRef = useRef<string | null>(null);

  useEffect(() => {
    async function init() {
      const hasHW = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHW && enrolled);
    }
    init();

    const sub = Linking.addEventListener('url', ({ url }) => { tryReadUri(url); });

    Linking.getInitialURL().then(url => {
      if (!url || !isJsonUri(url)) return;
      if (profile) {
        tryReadUri(url);
      } else {
        pendingUriRef.current = url;
      }
    });

    return () => sub.remove();
  }, []);

  // Process deferred URI once profile loads
  useEffect(() => {
    if (profile && pendingUriRef.current) {
      const uri = pendingUriRef.current;
      pendingUriRef.current = null;
      tryReadUri(uri);
    }
  }, [profile]);

  function isJsonUri(url: string): boolean {
    return url.startsWith('content://') || url.startsWith('file://');
  }

  async function tryReadUri(url: string) {
    if (!isJsonUri(url)) return;
    try {
      const text = await FileSystem.readAsStringAsync(url);
      const parsed: ExportPayload = JSON.parse(text);
      if (!parsed?.profile || typeof parsed.version !== 'number') return;
      setPendingPayload(parsed);
    } catch {
      // not a valid backup — ignore silently
    }
  }

  function dismiss() {
    setPendingPayload(null);
    setPinInput('');
    setPinError('');
    setLoading(false);
  }

  async function doImport(payload: ExportPayload) {
    if (!profile) return;
    const profileId = parseInt(String(profile.id), 10);
    setLoading(true);
    try {
      await importAll(payload, profileId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      dismiss();
      Alert.alert('Restored', 'Backup imported successfully.');
    } catch (e: any) {
      Alert.alert('Import failed', e?.message ?? 'Could not import backup.');
      setLoading(false);
    }
  }

  async function confirmWithPin() {
    if (!profile || !pendingPayload) return;
    if (!/^\d{6}$/.test(pinInput)) { setPinError('Enter your 6-digit PIN'); return; }
    const profileId = parseInt(String(profile.id), 10);
    setLoading(true);
    try {
      const stored = await getProfilePin(profileId);
      let valid = false;
      if (stored) {
        if (stored.includes('$')) {
          const [salt, hash] = stored.split('$');
          const computed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + pinInput);
          valid = computed === hash;
        } else {
          const computed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pinInput);
          valid = computed === stored;
        }
      }
      if (!valid) { setPinError('Incorrect PIN'); setLoading(false); return; }
      await doImport(pendingPayload);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Auth failed');
      setLoading(false);
    }
  }

  async function confirmWithBiometric() {
    if (!pendingPayload) return;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirm backup restore',
      cancelLabel: 'Cancel',
    });
    if (!result.success) return;
    doImport(pendingPayload);
  }

  if (!pendingPayload || !profile) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={dismiss}>
      <View style={ls.overlay}>
        <View style={ls.sheet}>
          <Text style={ls.title}>Restore Backup?</Text>
          <Text style={ls.subtitle}>
            Backup for <Text style={ls.bold}>{pendingPayload.profile?.name ?? 'unknown'}</Text> detected.{'\n'}
            This will replace your current profile, assets, expenses, and goals.
          </Text>

          <TextInput
            style={ls.pinInput}
            placeholder="6-digit PIN"
            placeholderTextColor="#999"
            value={pinInput}
            onChangeText={t => { setPinInput(t.replace(/\D/g, '').slice(0, 6)); setPinError(''); }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
          />
          {!!pinError && <Text style={ls.error}>{pinError}</Text>}

          <TouchableOpacity style={ls.confirmBtn} onPress={confirmWithPin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={ls.confirmBtnText}>Confirm with PIN</Text>}
          </TouchableOpacity>

          {biometricAvailable && (
            <TouchableOpacity style={ls.bioBtn} onPress={confirmWithBiometric} disabled={loading}>
              <Text style={ls.bioBtnText}>Use Fingerprint</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={ls.cancelBtn} onPress={dismiss} disabled={loading}>
            <Text style={ls.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const ls = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 28, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '700', color: '#1B5E20', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#444', marginBottom: 20, lineHeight: 20 },
  bold: { fontWeight: '700' },
  pinInput: {
    borderWidth: 1.5, borderColor: '#C8E6C9', borderRadius: 10,
    padding: 12, fontSize: 18, letterSpacing: 4, marginBottom: 6, color: '#222',
  },
  error: { color: '#C62828', fontSize: 12, marginBottom: 10 },
  confirmBtn: { backgroundColor: '#1B5E20', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  bioBtn: { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10 },
  bioBtnText: { color: '#1B5E20', fontSize: 15, fontWeight: '600' },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 6 },
  cancelBtnText: { color: '#888', fontSize: 14 },
});

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ErrorBoundary>
          <PaperProvider theme={theme}>
            <AppProvider>
              <ProProvider>
                <ProfileProvider>
                  <LinkingHandler />
                  <Slot />
                </ProfileProvider>
              </ProProvider>
            </AppProvider>
          </PaperProvider>
        </ErrorBoundary>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
