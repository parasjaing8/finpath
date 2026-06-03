import React, { useState, useEffect, useCallback } from 'react';
import { Portal, Dialog, Button as PaperButton } from 'react-native-paper';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Alert, Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Feather } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useApp, ExportPayload } from '@/context/AppContext';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { Profile } from '@/engine/types';
import { WEB_HEADER_OFFSET, WEB_BOTTOM_OFFSET } from '@/constants/theme';
import { formatDateMask } from '@/components/DateInput';
import { getCurrencyByCode } from '@/constants/currencies';
import { formatCurrencyFull } from '@/engine/calculator';
import * as Crypto from 'expo-crypto';
import { getProfilePin, saveProfilePin } from '@/db/queries';
import { isEncryptedBackup, encryptBackup, decryptBackup } from '@/utils/backupCrypto';

// Compact regional number format: INR → 1.35 L / 2.5 Cr; others → 100 K / 1.2 M
function formatCompact(amount: number, currency: string): string {
  if (currency === 'INR') {
    if (amount >= 10000000) return `${+(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000)   return `${+(amount / 100000).toFixed(2)} L`;
    if (amount >= 1000)     return `${+(amount / 1000).toFixed(1)} K`;
    return String(Math.round(amount));
  }
  if (amount >= 1000000) return `${+(amount / 1000000).toFixed(2)} M`;
  if (amount >= 1000)    return `${+(amount / 1000).toFixed(1)} K`;
  return String(Math.round(amount));
}

const BRAND = '#1B5E20';
const BRAND_MED = '#2E7D32';
const BRAND_LIGHT = '#E8F5E9';
const AMBER = '#F57C00';
const RED = '#C62828';

const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateDob(dob: string): { ok: true; age: number } | { ok: false; error: string } {
  if (!DOB_REGEX.test(dob)) return { ok: false, error: 'Use format YYYY-MM-DD' };
  const [yStr, mStr, dStr] = dob.split('-');
  const y = parseInt(yStr, 10); const m = parseInt(mStr, 10); const d = parseInt(dStr, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return { ok: false, error: 'Invalid month or day' };
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d)
    return { ok: false, error: 'Date does not exist' };
  const now = new Date();
  if (date > now) return { ok: false, error: 'Date is in the future' };
  let age = now.getFullYear() - y;
  if (now.getMonth() < m - 1 || (now.getMonth() === m - 1 && now.getDate() < d)) age--;
  if (age < 0 || age > 120) return { ok: false, error: 'Age must be between 0 and 120' };
  return { ok: true, age };
}

// Daily wisdom — cycles by day-of-year
const QUOTES = [
  { text: "Do not save what is left after spending; instead spend what is left after saving.", author: "Warren Buffett" },
  { text: "The stock market is a device for transferring money from the impatient to the patient.", author: "Warren Buffett" },
  { text: "Financial freedom is available to those who learn about it and work for it.", author: "Robert Kiyosaki" },
  { text: "It's not how much money you make, but how much money you keep.", author: "Robert Kiyosaki" },
  { text: "Invest in yourself. Your career is the engine of your wealth.", author: "Paul Clitheroe" },
  { text: "Time in the market beats timing the market.", author: "Ken Fisher" },
  { text: "The goal isn't more money. The goal is living life on your own terms.", author: "Chris Brogan" },
];
function getDailyQuote() {
  const day = Math.floor(Date.now() / 86400000);
  return QUOTES[day % QUOTES.length];
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, assets, goals, setProfile, exportAll, importAll, logout, deleteAllData } = useApp();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const webTop = Platform.OS === 'web' ? WEB_HEADER_OFFSET : 0;
  const webBottom = Platform.OS === 'web' ? WEB_BOTTOM_OFFSET : 0;

  const [form, setForm] = useState<Profile>({ id: '1', name: '', dob: '', currency: 'INR', monthly_income: 0 });
  const [importLoading, setImportLoading] = useState(false);
  const [showBackupInfo, setShowBackupInfo] = useState(false);
  const [showPinChange, setShowPinChange] = useState(false);
  const [pinFields, setPinFields] = useState({ current: '', next: '', confirm: '' });
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinChanging, setPinChanging] = useState(false);
  const [showExportPassphrase, setShowExportPassphrase] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [showImportPassphrase, setShowImportPassphrase] = useState(false);
  const [importPassphrase, setImportPassphrase] = useState('');
  const [importPassphraseError, setImportPassphraseError] = useState('');
  const [pendingEncryptedText, setPendingEncryptedText] = useState<string | null>(null);

  useEffect(() => { if (profile) setForm(profile); }, [profile]);

  const dobCheck = validateDob(form.dob);
  const dobError = dobCheck.ok ? null : dobCheck.error;
  const currentAge = dobCheck.ok ? dobCheck.age : 0;
  const retirementAge = goals?.retirement_age ?? 0;
  const workingYearsLeft = retirementAge > 0 && currentAge > 0 ? Math.max(0, retirementAge - currentAge) : null;

  // Current net worth = sum of all asset current values
  const currentNW = assets.reduce((sum, a) => sum + (a.current_value ?? 0), 0);
  const currency = form.currency;

  const quote = getDailyQuote();

  function handleSave() {
    if (!dobCheck.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid date of birth', dobCheck.error);
      return;
    }
    setProfile(form);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    setEditMode(false);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleChangePin() {
    const { current, next, confirm } = pinFields;
    if (current.length !== 6 || !/^\d{6}$/.test(current)) { setPinError('Current PIN must be 6 digits'); return; }
    if (next.length !== 6 || !/^\d{6}$/.test(next)) { setPinError('New PIN must be 6 digits'); return; }
    if (next !== confirm) { setPinError('New PINs do not match'); return; }
    setPinChanging(true); setPinError(null);
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
      setShowPinChange(false); setPinFields({ current: '', next: '', confirm: '' });
    } catch (e: any) {
      setPinError(e?.message ?? 'Failed to change PIN');
    } finally { setPinChanging(false); }
  }

  function openPinChange() { setPinFields({ current: '', next: '', confirm: '' }); setPinError(null); setShowPinChange(true); }

  function handleLogout() {
    Alert.alert('Log out', 'You will be returned to the login screen. Your data will remain saved.',
      [{ text: 'Cancel', style: 'cancel' },
       { text: 'Log out', style: 'destructive', onPress: async () => { await logout(); router.replace('/login' as any); } }]);
  }

  function handleDeleteProfile() {
    Alert.alert('Delete all data', 'This will permanently erase your profile, assets, expenses, and goals. This cannot be undone.',
      [{ text: 'Cancel', style: 'cancel' },
       { text: 'Delete everything', style: 'destructive', onPress: async () => {
           await deleteAllData();
           Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
           router.replace('/onboarding/create-profile' as any);
         }}]);
  }

  const handleExport = useCallback(() => { setExportPassphrase(''); setShowExportPassphrase(true); }, []);

  const doExport = useCallback(async (passphrase: string | null) => {
    setShowExportPassphrase(false);
    const payload = exportAll();
    const json = JSON.stringify(payload, null, 2);
    let content = json;
    if (passphrase) {
      try { content = await encryptBackup(json, passphrase); } catch (e: any) { Alert.alert('Encryption failed', e?.message); return; }
    }
    const filename = `fire-planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    if (Platform.OS === 'web') {
      try {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = filename;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e: any) { Alert.alert('Export failed', e?.message); }
    } else {
      try {
        const tmpUri = FileSystem.cacheDirectory + filename;
        await FileSystem.writeAsStringAsync(tmpUri, content, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(tmpUri, { mimeType: 'application/json', dialogTitle: 'Save Backup File' });
          if (!passphrase) Alert.alert('Backup shared', 'Tip: If WhatsApp saves as .bin, FinPath will still recognise it.', [{ text: 'OK' }]);
        } else { Alert.alert('Export failed', 'Sharing not available on this device.'); }
      } catch (e: any) { Alert.alert('Export failed', e?.message); }
    }
  }, [exportAll]);

  const openImport = useCallback(async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.json,application/json';
      input.onchange = async () => { const file = input.files?.[0]; if (!file) return; runImport(await file.text()); };
      input.click(); return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (result.canceled) return;
      runImport(await FileSystem.readAsStringAsync(result.assets[0].uri));
    } catch (e: any) { Alert.alert('Pick failed', e?.message); }
  }, []);

  const runImport = useCallback(async (jsonText: string) => {
    if (!profile) { Alert.alert("Not logged in", "Log in before importing a backup."); return; }
    if (isEncryptedBackup(jsonText)) {
      setPendingEncryptedText(jsonText); setImportPassphrase(''); setImportPassphraseError(''); setShowImportPassphrase(true); return;
    }
    const profileId = parseInt(String(profile.id), 10);
    let parsed: ExportPayload;
    try { parsed = JSON.parse(jsonText); } catch { Alert.alert('Invalid backup', 'The file is not valid JSON.'); return; }
    const message = 'This will overwrite your current profile, assets, expenses, and goals. This cannot be undone.';
    if (Platform.OS === 'web') {
      if (!window.confirm?.(`Replace all data?\n\n${message}`)) return;
      try { await importAll(parsed, profileId); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e: any) { Alert.alert('Restore failed', e?.message); }
      return;
    }
    Alert.alert('Replace all data?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace', style: 'destructive', onPress: async () => {
          setImportLoading(true);
          try { await importAll(parsed, profileId); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
          catch (e: any) { Alert.alert('Restore failed', e?.message); }
          finally { setImportLoading(false); }
        }},
    ]);
  }, [importAll, profile]);

  const doDecryptAndImport = useCallback(async () => {
    if (!pendingEncryptedText) return;
    try {
      const decrypted = await decryptBackup(pendingEncryptedText, importPassphrase);
      setShowImportPassphrase(false); setPendingEncryptedText(null); setImportPassphrase(''); setImportPassphraseError('');
      runImport(decrypted);
    } catch { setImportPassphraseError('Wrong passphrase. Try again.'); }
  }, [pendingEncryptedText, importPassphrase, runImport]);

  // ─── Render helpers ────────────────────────────────────────────────────────

  const initial = (form.name || 'U').charAt(0).toUpperCase();
  const currencyLabel = getCurrencyByCode(currency);
  const currencyDisplay = currencyLabel ? `${currencyLabel.flag}  ${currency}` : currency;
  const incomeDisplay = form.monthly_income > 0
    ? `${currencyLabel?.symbol ?? currency}${formatCompact(form.monthly_income, currency)} / month`
    : '—';

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 + webBottom + insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero Section ──────────────────────────────────────────────────── */}
      <LinearGradient colors={[BRAND, BRAND_MED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: 16 + webTop + insets.top }]}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroTitle}>Profile</Text>
        </View>

        <View style={styles.heroBody}>
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>{initial}</Text>
            </View>
            <TouchableOpacity style={styles.avatarEditFab} onPress={() => setEditMode(true)} accessibilityRole="button" accessibilityLabel="Edit profile">
              <Feather name="edit-2" size={12} color={BRAND} />
            </TouchableOpacity>
          </View>

          {/* Name + Age */}
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{form.name || 'My Profile'}</Text>
            {currentAge > 0 && <Text style={styles.heroAge}>Age {currentAge}</Text>}

            {/* Pills */}
            <View style={styles.pillRow}>
              {retirementAge > 0 && (
                <TouchableOpacity style={styles.pill} onPress={() => router.push('/(tabs)/goals' as any)} accessibilityRole="button">
                  <Text style={styles.pillText}>🎯 FI Goal: Retire at {retirementAge}</Text>
                  <Feather name="chevron-right" size={12} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              )}
              {currentNW > 0 && (
                <TouchableOpacity style={styles.pill} onPress={() => router.push('/(tabs)/assets' as any)} accessibilityRole="button">
                  <Text style={styles.pillText}>💰 Net Worth: {formatCurrencyFull(currentNW, currency)}</Text>
                  <Feather name="chevron-right" size={12} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.body}>

        {/* ── Personal Information Card ──────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialCommunityIcons name="account-outline" size={20} color={BRAND} />
              <Text style={styles.cardTitle}>Personal Information</Text>
            </View>
            <TouchableOpacity
              style={[styles.editBtn, editMode && styles.editBtnActive]}
              onPress={() => editMode ? handleSave() : setEditMode(true)}
              accessibilityRole="button"
              accessibilityLabel={editMode ? 'Save changes' : 'Edit profile'}
            >
              {editMode
                ? <><Feather name="check" size={13} color={BRAND} /><Text style={styles.editBtnText}> Save</Text></>
                : <><Feather name="edit-2" size={13} color={BRAND} /><Text style={styles.editBtnText}> Edit</Text></>
              }
            </TouchableOpacity>
          </View>

          {editMode ? (
            /* Edit mode — input fields */
            <>
              <View style={styles.divider} />
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} placeholder="Your name" placeholderTextColor="#AAA" accessibilityLabel="Full name" />

              <Text style={styles.fieldLabel}>Date of Birth</Text>
              <TextInput
                style={[styles.input, dobError && { borderColor: RED }]}
                value={form.dob}
                onChangeText={t => setForm(f => ({ ...f, dob: formatDateMask(t) }))}
                keyboardType="number-pad" maxLength={10}
                placeholder="YYYY-MM-DD" placeholderTextColor="#AAA"
                accessibilityLabel="Date of birth"
              />
              {dobError && <Text style={styles.errorText}>{dobError}</Text>}

              <Text style={styles.fieldLabel}>Monthly Income</Text>
              <TextInput
                style={styles.input} value={String(form.monthly_income || '')}
                onChangeText={t => setForm(f => ({ ...f, monthly_income: parseFloat(t) || 0 }))}
                keyboardType="numeric" placeholder="e.g. 150000" placeholderTextColor="#AAA"
                accessibilityLabel="Monthly income"
              />

              <Text style={styles.fieldLabel}>Currency</Text>
              <CurrencyPicker value={form.currency} onChange={c => setForm(f => ({ ...f, currency: c }))} />
            </>
          ) : (
            /* View mode — display rows */
            <>
              <InfoRow icon="account-outline" label="Full Name" value={form.name || '—'} />
              <InfoRow icon="calendar-outline" label="Date of Birth" value={form.dob || '—'} />
              <InfoRow icon="cash-multiple" label="Monthly Income" value={incomeDisplay} />
              <InfoRow icon="earth" label="Currency" value={currencyDisplay} />
            </>
          )}

          {/* Bottom stats bar */}
          {currentAge > 0 && (
            <View style={styles.statsBar}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="account" size={14} color={BRAND} />
                <Text style={styles.statLabel}>Current Age</Text>
                <Text style={styles.statValue}>{currentAge} Years</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="briefcase-outline" size={14} color={BRAND} />
                <Text style={styles.statLabel}>Working Years Left</Text>
                <Text style={styles.statValue}>{workingYearsLeft !== null ? `${workingYearsLeft} Years` : '—'}</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Data Management Card ───────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialCommunityIcons name="cloud-outline" size={20} color={BRAND} />
              <View>
                <Text style={styles.cardTitle}>Data Management</Text>
                <Text style={styles.cardSubtitle}>Backup and manage your FinPath data.</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setShowBackupInfo(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Backup info">
              <Feather name="info" size={16} color="#AAA" />
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          <View style={styles.backupRow}>
            <TouchableOpacity style={styles.backupBtn} onPress={handleExport} accessibilityRole="button" accessibilityLabel="Export data">
              <Feather name="upload" size={16} color={BRAND} />
              <Text style={styles.backupBtnText}>Export Data</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.backupBtn, { opacity: importLoading ? 0.6 : 1 }]}
              onPress={openImport} disabled={importLoading}
              accessibilityRole="button" accessibilityLabel="Import data"
            >
              <Feather name="download" size={16} color={BRAND} />
              <Text style={styles.backupBtnText}>{importLoading ? 'Restoring…' : 'Import Data'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Account Card ───────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <MaterialCommunityIcons name="shield-outline" size={20} color={BRAND} />
              <Text style={styles.cardTitle}>Account</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <AccountRow icon="lock-outline" label="Change PIN" onPress={openPinChange} />
          <AccountRow icon="message-outline" label="Send Feedback" onPress={() => Linking.openURL('mailto:parasgidd1008@gmail.com?subject=FinPath Feedback')} />
          <AccountRow icon="star-outline" label="Rate FinPath" onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=com.aihomecloud.finpath')} />
          <AccountRow icon="shield-lock-outline" label="Privacy Policy" onPress={() => Linking.openURL('https://aihomecloud.com/finpath/privacy')} />
          <AccountRow icon="logout" label="Log out" onPress={handleLogout} color={AMBER} />
          <AccountRow icon="trash-can-outline" label="Delete All Data" onPress={handleDeleteProfile} color={RED} last />
        </View>

        {/* ── Today's Wisdom Card ─────────────────────────────────────────── */}
        <View style={[styles.card, styles.wisdomCard]}>
          <View style={styles.wisdomHeader}>
            <Text style={styles.wisdomQuoteMark}>"</Text>
            <Text style={styles.wisdomTitle}>Today's Wisdom</Text>
          </View>
          <Text style={styles.wisdomText}>{quote.text}</Text>
          <View style={styles.wisdomFooter}>
            <Text style={styles.wisdomAuthor}>— {quote.author}</Text>
            <Text style={styles.wisdomRefresh}>↻ Refreshes daily</Text>
          </View>
        </View>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <Text style={styles.footerVersion}>FinPath v1.0.1</Text>
        <Text style={styles.footerMade}>Made with ❤️ from 🇮🇳 for the world</Text>
        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={() => Linking.openURL('https://aihomecloud.com/finpath/')} accessibilityRole="link" accessibilityLabel="About us">
            <Text style={styles.footerLink}>About Us</Text>
          </TouchableOpacity>
          <Text style={styles.footerDot}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://aihomecloud.com/finpath/privacy')} accessibilityRole="link" accessibilityLabel="Privacy policy">
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

      </View>
    </ScrollView>

    {/* ── Dialogs (unchanged logic) ─────────────────────────────────────── */}
    <Portal>
      <Dialog visible={showBackupInfo} onDismiss={() => setShowBackupInfo(false)} style={styles.dialog}>
        <Dialog.Title style={styles.dialogTitle}>Backup & Restore</Dialog.Title>
        <Dialog.Content>
          <Text style={styles.dialogBody}><Text style={{ fontWeight: '700' }}>Export</Text> saves your entire plan as a .json file you can save anywhere.{'\n\n'}<Text style={{ fontWeight: '700' }}>Import</Text> restores a previously exported file and replaces all current data.{'\n\n'}🔒 All data lives only on this device. FinPath never sends anything to a server.</Text>
        </Dialog.Content>
        <Dialog.Actions><PaperButton onPress={() => setShowBackupInfo(false)} textColor={BRAND}>Got it</PaperButton></Dialog.Actions>
      </Dialog>
    </Portal>

    <Portal>
      <Dialog visible={showPinChange} onDismiss={() => setShowPinChange(false)} style={styles.dialog}>
        <Dialog.Title style={styles.dialogTitle}>Change PIN</Dialog.Title>
        <Dialog.Content>
          <Text style={styles.dialogHint}>Enter your current PIN, then choose a new 6-digit PIN.</Text>
          {(['current', 'next', 'confirm'] as const).map((field, i) => (
            <TextInput
              key={field}
              style={[styles.dialogInput, i === 2 && pinError ? { borderColor: RED } : {}]}
              placeholder={['Current PIN', 'New PIN', 'Confirm new PIN'][i]}
              placeholderTextColor="#AAA"
              value={pinFields[field]}
              onChangeText={t => setPinFields(f => ({ ...f, [field]: t.replace(/\D/g, '').slice(0, 6) }))}
              keyboardType="number-pad" maxLength={6} secureTextEntry
            />
          ))}
          {pinError ? <Text style={{ color: RED, fontSize: 12, marginTop: 6 }}>{pinError}</Text> : null}
        </Dialog.Content>
        <Dialog.Actions>
          <PaperButton onPress={() => setShowPinChange(false)} textColor="#999">Cancel</PaperButton>
          <PaperButton onPress={handleChangePin} textColor={BRAND} disabled={pinChanging}>{pinChanging ? 'Saving…' : 'Change PIN'}</PaperButton>
        </Dialog.Actions>
      </Dialog>
    </Portal>

    <Portal>
      <Dialog visible={showExportPassphrase} onDismiss={() => setShowExportPassphrase(false)} style={styles.dialog}>
        <Dialog.Title style={styles.dialogTitle}>Protect your backup</Dialog.Title>
        <Dialog.Content>
          <Text style={styles.dialogHint}>Set a passphrase to encrypt your backup. Leave blank to export unencrypted.</Text>
          <TextInput placeholder="Passphrase (optional)" placeholderTextColor="#AAA" secureTextEntry value={exportPassphrase} onChangeText={setExportPassphrase} style={styles.dialogInput} />
        </Dialog.Content>
        <Dialog.Actions>
          <PaperButton onPress={() => setShowExportPassphrase(false)} textColor="#999">Cancel</PaperButton>
          <PaperButton onPress={() => doExport(null)} textColor="#999">No encryption</PaperButton>
          <PaperButton onPress={() => doExport(exportPassphrase || null)} textColor={BRAND}>{exportPassphrase ? 'Encrypt & Export' : 'Export'}</PaperButton>
        </Dialog.Actions>
      </Dialog>
    </Portal>

    <Portal>
      <Dialog visible={showImportPassphrase} onDismiss={() => { setShowImportPassphrase(false); setPendingEncryptedText(null); }} style={styles.dialog}>
        <Dialog.Title style={styles.dialogTitle}>Encrypted backup</Dialog.Title>
        <Dialog.Content>
          <Text style={styles.dialogHint}>Enter the passphrase used when this backup was exported.</Text>
          <TextInput placeholder="Passphrase" placeholderTextColor="#AAA" secureTextEntry value={importPassphrase} onChangeText={t => { setImportPassphrase(t); setImportPassphraseError(''); }} style={[styles.dialogInput, importPassphraseError ? { borderColor: RED } : {}]} />
          {importPassphraseError ? <Text style={{ color: RED, fontSize: 12, marginTop: 4 }}>{importPassphraseError}</Text> : null}
        </Dialog.Content>
        <Dialog.Actions>
          <PaperButton onPress={() => { setShowImportPassphrase(false); setPendingEncryptedText(null); }} textColor="#999">Cancel</PaperButton>
          <PaperButton onPress={doDecryptAndImport} textColor={BRAND} disabled={!importPassphrase}>Unlock</PaperButton>
        </Dialog.Actions>
      </Dialog>
    </Portal>
    </>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <MaterialCommunityIcons name={icon as any} size={18} color="#888" style={infoStyles.icon} />
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function AccountRow({ icon, label, onPress, color, last }: { icon: string; label: string; onPress: () => void; color?: string; last?: boolean }) {
  return (
    <TouchableOpacity style={[accStyles.row, !last && accStyles.rowBorder]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <MaterialCommunityIcons name={icon as any} size={20} color={color ?? '#555'} />
      <Text style={[accStyles.label, color ? { color } : {}]}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={18} color="#CCC" />
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },

  // Hero
  hero: { paddingHorizontal: 20, paddingBottom: 24 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  heroBody: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  avatarWrap: { position: 'relative' },
  avatarCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.5)' },
  avatarLetter: { fontSize: 38, fontWeight: '800', color: '#fff' },
  avatarEditFab: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 3 },
  heroInfo: { flex: 1, paddingTop: 4 },
  heroName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 2 },
  heroAge: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 12 },
  pillRow: { gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, gap: 4, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, color: '#fff', fontWeight: '600' },

  // Body
  body: { padding: 16, gap: 12 },

  // Card
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  cardSubtitle: { fontSize: 11, color: '#AAA', marginTop: 2 },
  editBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: BRAND, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  editBtnActive: { backgroundColor: BRAND_LIGHT },
  editBtnText: { fontSize: 13, fontWeight: '600', color: BRAND },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EFEFEF', marginBottom: 12 },

  // Personal Info fields (edit mode)
  fieldLabel: { fontSize: 12, color: '#888', marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12, padding: 12, fontSize: 15, color: '#1A1A1A', backgroundColor: '#FAFAFA' },
  errorText: { color: RED, fontSize: 12, marginTop: 4 },

  // Stats bar
  statsBar: { flexDirection: 'row', backgroundColor: BRAND_LIGHT, borderRadius: 14, marginTop: 14, overflow: 'hidden' },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: '#C8E6C9', marginVertical: 10 },
  statLabel: { fontSize: 11, color: '#666' },
  statValue: { fontSize: 15, fontWeight: '700', color: BRAND },

  // Backup
  backupRow: { flexDirection: 'row', gap: 12 },
  backupBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: BRAND, borderRadius: 14, paddingVertical: 12 },
  backupBtnText: { fontSize: 14, fontWeight: '600', color: BRAND },

  // Wisdom
  wisdomCard: { backgroundColor: '#FAFDF7' },
  wisdomHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  wisdomQuoteMark: { fontSize: 36, color: BRAND, lineHeight: 36, fontWeight: '800' },
  wisdomTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  wisdomText: { fontSize: 14, color: '#444', lineHeight: 22, fontStyle: 'italic', marginBottom: 12 },
  wisdomFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wisdomAuthor: { fontSize: 13, fontWeight: '600', color: BRAND },
  wisdomRefresh: { fontSize: 11, color: '#AAA' },

  // Footer
  footerVersion: { textAlign: 'center', fontSize: 13, color: '#999', fontWeight: '600', marginTop: 8 },
  footerMade: { textAlign: 'center', fontSize: 12, color: '#BBB', marginTop: 4 },
  footerLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 8 },
  footerLink: { fontSize: 12, color: '#BBB', textDecorationLine: 'underline' },
  footerDot: { fontSize: 12, color: '#CCC' },

  // Dialogs
  dialog: { backgroundColor: '#fff', borderRadius: 20, marginHorizontal: 16 },
  dialogTitle: { color: '#1A1A1A', fontWeight: '700' },
  dialogBody: { color: '#555', fontSize: 14, lineHeight: 22 },
  dialogHint: { color: '#888', fontSize: 13, marginBottom: 12 },
  dialogInput: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12, padding: 12, fontSize: 15, color: '#1A1A1A', marginBottom: 8 },
});

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0', gap: 10 },
  icon: { width: 24, textAlign: 'center' },
  label: { fontSize: 14, color: '#888', flex: 1 },
  value: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', maxWidth: '55%', textAlign: 'right' },
});

const accStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0' },
  label: { flex: 1, fontSize: 15, color: '#333' },
});
