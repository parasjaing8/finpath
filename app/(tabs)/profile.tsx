import React, { useState, useEffect, useCallback } from 'react';
import { Portal, Dialog, Button as PaperButton } from 'react-native-paper';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Alert, Linking } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp, ExportPayload } from '@/context/AppContext';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { Profile } from '@/engine/types';
import { WEB_HEADER_OFFSET, WEB_BOTTOM_OFFSET, shadow } from '@/constants/theme';
import { formatDateMask } from '@/components/DateInput';
import * as Crypto from 'expo-crypto';
import { getProfilePin, saveProfilePin } from '@/db/queries';


const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateDob(dob: string): { ok: true; age: number } | { ok: false; error: string } {
  if (!DOB_REGEX.test(dob)) {
    return { ok: false, error: 'Use format YYYY-MM-DD' };
  }
  const [yStr, mStr, dStr] = dob.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return { ok: false, error: 'Invalid month or day' };
  }
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return { ok: false, error: 'Date does not exist' };
  }
  const now = new Date();
  if (date > now) {
    return { ok: false, error: 'Date is in the future' };
  }
  let age = now.getFullYear() - y;
  if (now.getMonth() < m - 1 || (now.getMonth() === m - 1 && now.getDate() < d)) age--;
  if (age < 0 || age > 120) {
    return { ok: false, error: 'Age must be between 0 and 120' };
  }
  return { ok: true, age };
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, setProfile, exportAll, importAll, logout, deleteAllData } = useApp();
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  const webTop = Platform.OS === 'web' ? WEB_HEADER_OFFSET : 0;
  const webBottom = Platform.OS === 'web' ? WEB_BOTTOM_OFFSET : 0;

  const [form, setForm] = useState<Profile>({
    id: '1',
    name: '',
    dob: '',
    currency: 'INR',
    monthly_income: 0,
  });

  const [importLoading, setImportLoading] = useState(false);
  const [showBackupInfo, setShowBackupInfo] = useState(false);
  const [showPinChange, setShowPinChange] = useState(false);
  const [pinFields, setPinFields] = useState({ current: '', next: '', confirm: '' });
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinChanging, setPinChanging] = useState(false);

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  const dobCheck = validateDob(form.dob);
  const dobError = dobCheck.ok ? null : dobCheck.error;
  const currentAge = dobCheck.ok ? dobCheck.age : 0;

  function handleSave() {
    if (!dobCheck.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid date of birth', dobCheck.error);
      return;
    }
    setProfile(form);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleChangePin() {
    const { current, next, confirm } = pinFields;
    if (current.length !== 6 || !/^\d{6}$/.test(current)) { setPinError('Current PIN must be 6 digits'); return; }
    if (next.length !== 6 || !/^\d{6}$/.test(next)) { setPinError('New PIN must be 6 digits'); return; }
    if (next !== confirm) { setPinError('New PINs do not match'); return; }
    setPinChanging(true);
    setPinError(null);
    try {
      const profileId = parseInt(String(profile!.id), 10);
      const stored = await getProfilePin(profileId);
      let valid = false;
      if (stored) {
        if (stored.includes('$')) {
          const [salt, expectedHash] = stored.split('$');
          const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + current);
          valid = hash === expectedHash;
        } else {
          const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, current);
          valid = hash === stored;
        }
      }
      if (!valid) { setPinError('Current PIN is incorrect'); return; }
      const saltBytes = Crypto.getRandomValues(new Uint8Array(16));
      const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + next);
      await saveProfilePin(profileId, `${salt}$${hash}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowPinChange(false);
      setPinFields({ current: '', next: '', confirm: '' });
    } catch (e: any) {
      setPinError(e?.message ?? 'Failed to change PIN');
    } finally {
      setPinChanging(false);
    }
  }

  function openPinChange() {
    setPinFields({ current: '', next: '', confirm: '' });
    setPinError(null);
    setShowPinChange(true);
  }

  function handleLogout() {
    Alert.alert(
      'Log out',
      'You will be returned to the login screen. Your data will remain saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out', style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login' as any);
          },
        },
      ],
    );
  }

  function handleDeleteProfile() {
    Alert.alert(
      'Delete all data',
      'This will permanently erase your profile, assets, expenses, and goals. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything', style: 'destructive',
          onPress: async () => {
            await deleteAllData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            router.replace('/onboarding/create-profile' as any);
          },
        },
      ],
    );
  }

  const handleExport = useCallback(async () => {
    const payload = exportAll();
    const json = JSON.stringify(payload, null, 2);
    const filename = `fire-planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    if (Platform.OS === 'web') {
      try {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e: any) {
        Alert.alert('Export failed', e?.message ?? 'Unknown error');
      }
    } else {
      try {
        const tmpUri = FileSystem.cacheDirectory + filename;
        await FileSystem.writeAsStringAsync(tmpUri, json, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(tmpUri, { mimeType: 'application/json', dialogTitle: 'Save Backup File' });
          Alert.alert(
            'Backup shared',
            'Tip: If WhatsApp or Telegram saves the file as .bin, you can still open it directly — FinPath will recognise it. Or save to Google Drive / Files for a clean .json copy.',
            [{ text: 'OK' }],
          );
        } else {
          Alert.alert('Export failed', 'Sharing is not available on this device.');
        }
      } catch (e: any) {
        Alert.alert('Export failed', e?.message ?? 'Unknown error');
      }
    }
  }, [exportAll]);

  const openImport = useCallback(async () => {
    if (Platform.OS === 'web') {
      // Web: fallback to a hidden file input since DocumentPicker is Android/iOS only
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const text = await file.text();
        runImport(text);
      };
      input.click();
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      const text = await FileSystem.readAsStringAsync(uri);
      runImport(text);
    } catch (e: any) {
      Alert.alert('Pick failed', e?.message ?? 'Could not open file.');
    }
  }, []);

  const runImport = useCallback(async (jsonText: string) => {
    if (!profile) {
      Alert.alert("Not logged in", "Log in before importing a backup.");
      return;
    }
    const profileId = parseInt(String(profile.id), 10);
    let parsed: ExportPayload;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      Alert.alert('Invalid backup', 'The file is not valid JSON.');
      return;
    }
    const message = 'This will overwrite your current profile, assets, expenses, and goals. This cannot be undone.';
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm
        ? window.confirm(`Replace all data?\n\n${message}`)
        : true;
      if (!confirmed) return;
      try {
        await importAll(parsed, profileId);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e: any) {
        Alert.alert('Restore failed', e?.message ?? 'Import failed.');
      }
      return;
    }
    Alert.alert(
      'Replace all data?',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace', style: 'destructive',
          onPress: async () => {
            setImportLoading(true);
            try {
              await importAll(parsed, profileId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e: any) {
              Alert.alert('Restore failed', e?.message ?? 'Import failed.');
            } finally {
              setImportLoading(false);
            }
          },
        },
      ],
    );
  }, [importAll, profile]);

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: 16 + webTop, paddingBottom: 40 + webBottom + insets.bottom }]}
    >
      <View style={styles.avatarRow}>
        <View style={[styles.avatarSmall, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.avatarSmallText, { color: colors.primary }]}>
            {(form.name || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.avatarRowText}>
          {form.name ? (
            <Text style={[styles.avatarName, { color: colors.foreground }]} numberOfLines={1}>{form.name}</Text>
          ) : null}
          {currentAge > 0 ? (
            <Text style={[styles.avatarAge, { color: colors.mutedForeground }]}>Age {currentAge}</Text>
          ) : null}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Personal Info</Text>

        <Text style={styles.fieldLabel}>Full Name</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
          value={form.name}
          onChangeText={t => setForm(f => ({ ...f, name: t }))}
          placeholder="Your name"
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel="Full name"
        />

        <Text style={styles.fieldLabel}>Date of Birth (YYYY-MM-DD)</Text>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: dobError ? '#C62828' : colors.border,
              color: colors.foreground,
              backgroundColor: colors.background,
            },
          ]}
          value={form.dob}
          onChangeText={t => setForm(f => ({ ...f, dob: formatDateMask(t) }))}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel="Date of birth"
        />
        {dobError && <Text style={styles.errorText}>{dobError}</Text>}

        <Text style={styles.fieldLabel}>Monthly Income</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
          value={String(form.monthly_income || '')}
          onChangeText={t => setForm(f => ({ ...f, monthly_income: parseFloat(t) || 0 }))}
          keyboardType="numeric"
          placeholder="e.g., 150000"
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel="Monthly income"
        />

        <CurrencyPicker
          value={form.currency}
          onChange={c => setForm(f => ({ ...f, currency: c }))}
        />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: saved ? '#2E7D32' : colors.primary }]}
        onPress={handleSave}
        accessibilityRole="button"
        accessibilityLabel="Save profile"
      >
        {saved ? (
          <Feather name="check" size={20} color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Save Profile</Text>
        )}
      </TouchableOpacity>

      {/* Backup & Restore */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Backup & Restore</Text>
          <TouchableOpacity
            onPress={() => setShowBackupInfo(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Learn about backup and restore"
          >
            <Feather name="info" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <View style={styles.backupRow}>
          <TouchableOpacity
            style={[styles.backupBtn, { borderColor: colors.primary }]}
            onPress={handleExport}
            accessibilityRole="button"
            accessibilityLabel="Export backup"
          >
            <Feather name="upload" size={16} color={colors.primary} />
            <Text style={[styles.backupBtnText, { color: colors.primary }]}>Export</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.backupBtn, { borderColor: colors.primary, opacity: importLoading ? 0.6 : 1 }]}
            onPress={openImport}
            disabled={importLoading}
            accessibilityRole="button"
            accessibilityLabel="Import backup"
          >
            <Feather name="download" size={16} color={colors.primary} />
            <Text style={[styles.backupBtnText, { color: colors.primary }]}>{importLoading ? 'Restoring…' : 'Import'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* About — subtle footer links, moved above Account */}
      {/* Danger Zone */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.destructive }]}>Account</Text>
        <TouchableOpacity
          style={[styles.dangerRow, { borderBottomColor: colors.border }]}
          onPress={openPinChange}
          accessibilityRole="button"
          accessibilityLabel="Change PIN"
        >
          <Feather name="lock" size={18} color={colors.foreground} />
          <Text style={[styles.dangerLabel, { color: colors.foreground }]}>Change PIN</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dangerRow, { borderBottomColor: colors.border }]}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <Feather name="log-out" size={18} color={colors.warning} />
          <Text style={[styles.dangerLabel, { color: colors.warning }]}>Log out</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dangerRow}
          onPress={handleDeleteProfile}
          accessibilityRole="button"
          accessibilityLabel="Delete all data"
        >
          <Feather name="trash-2" size={18} color={colors.destructive} />
          <Text style={[styles.dangerLabel, { color: colors.destructive }]}>Delete all data</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Credit + footer links at very bottom */}
      <Text style={[styles.credit, { color: colors.mutedForeground }]}>Made with ❤️ from 🇮🇳 for the world</Text>
      <View style={styles.footerLinks}>
        <TouchableOpacity
          onPress={() => Linking.openURL('https://aihomecloud.com/finpath/')}
          accessibilityRole="link"
          accessibilityLabel="About us"
        >
          <Text style={[styles.footerLink, { color: colors.mutedForeground }]}>About Us</Text>
        </TouchableOpacity>
        <Text style={[styles.footerDot, { color: colors.mutedForeground }]}>·</Text>
        <TouchableOpacity
          onPress={() => Linking.openURL('https://aihomecloud.com/finpath/privacy')}
          accessibilityRole="link"
          accessibilityLabel="Privacy policy"
        >
          <Text style={[styles.footerLink, { color: colors.mutedForeground }]}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>

    <Portal>
      <Dialog visible={showBackupInfo} onDismiss={() => setShowBackupInfo(false)} style={{ backgroundColor: colors.card, borderRadius: 16 }}>
        <Dialog.Title style={{ color: colors.foreground, fontWeight: '700' }}>Backup & Restore</Dialog.Title>
        <Dialog.Content>
          <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 22, marginBottom: 12 }}>
            <Text style={{ fontWeight: '700' }}>Export</Text> saves your entire plan — profile, assets, expenses, and goals — as a{' '}
            <Text style={{ fontFamily: 'Inter_500Medium' }}>.json</Text> file you can share or save anywhere.
          </Text>
          <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 22, marginBottom: 12 }}>
            <Text style={{ fontWeight: '700' }}>Import</Text> restores a previously exported file. It replaces all current data.
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 20 }}>
            🔒 All your data lives only on this device. FinPath never sends anything to a server or cloud. The backup file stays wherever you save it — your phone, email, or cloud drive of your choice.
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <PaperButton onPress={() => setShowBackupInfo(false)} textColor={colors.primary}>Got it</PaperButton>
        </Dialog.Actions>
      </Dialog>
    </Portal>

    <Portal>
      <Dialog visible={showPinChange} onDismiss={() => setShowPinChange(false)} style={{ backgroundColor: colors.card, borderRadius: 16 }}>
        <Dialog.Title style={{ color: colors.foreground, fontWeight: '700' }}>Change PIN</Dialog.Title>
        <Dialog.Content>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 12, fontFamily: 'Inter_400Regular' }}>Enter your current PIN, then choose a new 6-digit PIN.</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background, marginBottom: 10 }]}
            placeholder="Current PIN"
            placeholderTextColor={colors.mutedForeground}
            value={pinFields.current}
            onChangeText={t => setPinFields(f => ({ ...f, current: t.replace(/\D/g, '').slice(0, 6) }))}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            accessibilityLabel="Current PIN"
          />
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background, marginBottom: 10 }]}
            placeholder="New PIN"
            placeholderTextColor={colors.mutedForeground}
            value={pinFields.next}
            onChangeText={t => setPinFields(f => ({ ...f, next: t.replace(/\D/g, '').slice(0, 6) }))}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            accessibilityLabel="New PIN"
          />
          <TextInput
            style={[styles.input, { borderColor: pinError ? '#C62828' : colors.border, color: colors.foreground, backgroundColor: colors.background }]}
            placeholder="Confirm new PIN"
            placeholderTextColor={colors.mutedForeground}
            value={pinFields.confirm}
            onChangeText={t => setPinFields(f => ({ ...f, confirm: t.replace(/\D/g, '').slice(0, 6) }))}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            accessibilityLabel="Confirm new PIN"
          />
          {pinError ? <Text style={{ color: '#C62828', fontSize: 12, marginTop: 8, fontFamily: 'Inter_500Medium' }}>{pinError}</Text> : null}
        </Dialog.Content>
        <Dialog.Actions>
          <PaperButton onPress={() => setShowPinChange(false)} textColor={colors.mutedForeground}>Cancel</PaperButton>
          <PaperButton onPress={handleChangePin} textColor={colors.primary} disabled={pinChanging}>
            {pinChanging ? 'Saving…' : 'Change PIN'}
          </PaperButton>
        </Dialog.Actions>
      </Dialog>
    </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  avatarSmall: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarSmallText: { fontSize: 18, fontWeight: '800', fontFamily: 'Inter_700Bold' },
  avatarRowText: { flex: 1, justifyContent: 'center' },
  avatarName: { fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  avatarAge: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  card: {
    borderRadius: 16, padding: 14, marginBottom: 16,
    ...shadow(2),
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16, fontFamily: 'Inter_700Bold' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 6, marginTop: 12, fontFamily: 'Inter_600SemiBold' },
  input: { borderWidth: 1.5, borderRadius: 10, padding: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  errorText: { color: '#C62828', fontSize: 12, marginTop: 6, fontFamily: 'Inter_500Medium' },
  saveBtn: {
    borderRadius: 16, padding: 18, alignItems: 'center', justifyContent: 'center',
    ...shadow(3),
    marginBottom: 16,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  backupRow: { flexDirection: 'row', gap: 12 },
  backupBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
  },
  backupBtnText: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  dangerRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dangerLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium' },
  footerLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 12, marginTop: 4 },
  credit: { textAlign: 'center', fontSize: 12, marginTop: 8, marginBottom: 4, fontFamily: 'Inter_400Regular' },
  footerLink: { fontSize: 12, textDecorationLine: 'underline', fontFamily: 'Inter_400Regular' },
  footerDot: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
