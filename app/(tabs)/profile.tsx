import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Modal, Share, Alert, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp, ExportPayload } from '@/context/AppContext';
import { Profile } from '@/engine/types';
import { WEB_HEADER_OFFSET, WEB_BOTTOM_OFFSET, shadow } from '@/constants/theme';

const CURRENCIES = [
  { key: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { key: 'USD', symbol: '$', label: 'US Dollar' },
];

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
  const { profile, setProfile, exportAll, importAll } = useApp();
  const [saved, setSaved] = useState(false);

  const webTop = Platform.OS === 'web' ? WEB_HEADER_OFFSET : 0;
  const webBottom = Platform.OS === 'web' ? WEB_BOTTOM_OFFSET : 0;

  const [form, setForm] = useState<Profile>({
    id: '1',
    name: '',
    dob: '1995-01-01',
    currency: 'INR',
    monthly_income: 0,
  });

  const [importVisible, setImportVisible] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

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
        await Share.share({
          title: filename,
          message: json,
        });
      } catch (e: any) {
        Alert.alert('Export failed', e?.message ?? 'Unknown error');
      }
    }
  }, [exportAll]);

  const openImport = useCallback(() => {
    setImportText('');
    setImportError(null);
    setImportVisible(true);
  }, []);

  const runImport = useCallback(async (parsed: ExportPayload) => {
    try {
      await importAll(parsed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setImportVisible(false);
    } catch (e: any) {
      setImportError(e?.message ?? 'Import failed.');
    }
  }, [importAll]);

  const confirmImport = useCallback(async () => {
    let parsed: ExportPayload;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setImportError('Not valid JSON.');
      return;
    }
    const message = 'This will overwrite your current profile, assets, expenses, and goals. This cannot be undone.';
    // react-native-web's Alert is unreliable for multi-button prompts — use the
    // browser-native confirm so the destructive callback actually fires.
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm
        ? window.confirm(`Replace all data?\n\n${message}`)
        : true;
      if (confirmed) await runImport(parsed);
      return;
    }
    Alert.alert(
      'Replace all data?',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: () => runImport(parsed) },
      ],
    );
  }, [importText, runImport]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: 16 + webTop, paddingBottom: 40 + webBottom + insets.bottom }]}
    >
      <View style={styles.avatarArea}>
        <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {(form.name || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        {currentAge > 0 && (
          <Text style={[styles.ageText, { color: colors.mutedForeground }]}>Age {currentAge}</Text>
        )}
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
          onChangeText={t => setForm(f => ({ ...f, dob: t }))}
          placeholder="e.g., 1995-04-15"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
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

        <Text style={styles.fieldLabel}>Currency</Text>
        <View style={styles.currencyRow}>
          {CURRENCIES.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[styles.currChip, {
                borderColor: form.currency === c.key ? colors.primary : colors.border,
                backgroundColor: form.currency === c.key ? colors.secondary : colors.background,
              }]}
              onPress={() => setForm(f => ({ ...f, currency: c.key }))}
              accessibilityRole="button"
              accessibilityLabel={`Set currency to ${c.label}`}
            >
              <Text style={[styles.currSymbol, { color: form.currency === c.key ? colors.primary : colors.foreground }]}>{c.symbol}</Text>
              <Text style={[styles.currLabel, { color: form.currency === c.key ? colors.primary : colors.mutedForeground }]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.statsCard, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>Quick Stats</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{currentAge}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Current Age</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{form.currency}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Currency</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {form.monthly_income > 0 ? `${(form.monthly_income / 1000).toFixed(0)}K` : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Monthly Income</Text>
          </View>
        </View>
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
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Backup & Restore</Text>
        <Text style={styles.helpText}>
          Export your full plan as JSON, or restore from a previous backup. All data is stored
          locally on this device.
        </Text>
        <View style={styles.backupRow}>
          <TouchableOpacity
            style={[styles.backupBtn, { borderColor: colors.primary }]}
            onPress={handleExport}
            accessibilityRole="button"
            accessibilityLabel="Export backup"
          >
            <Feather name="download" size={16} color={colors.primary} />
            <Text style={[styles.backupBtnText, { color: colors.primary }]}>Export</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.backupBtn, { borderColor: colors.primary }]}
            onPress={openImport}
            accessibilityRole="button"
            accessibilityLabel="Import backup"
          >
            <Feather name="upload" size={16} color={colors.primary} />
            <Text style={[styles.backupBtnText, { color: colors.primary }]}>Import</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* About */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About</Text>
        <TouchableOpacity
          style={[styles.linkRow, { borderBottomColor: colors.border }]}
          onPress={() => Linking.openURL('https://aihomecloud.com/finpath/')}
          accessibilityRole="link"
          accessibilityLabel="About us"
        >
          <Feather name="info" size={18} color={colors.primary} />
          <Text style={[styles.linkLabel, { color: colors.foreground }]}>About Us</Text>
          <Feather name="external-link" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => Linking.openURL('https://aihomecloud.com/finpath/privacy')}
          accessibilityRole="link"
          accessibilityLabel="Privacy policy"
        >
          <Feather name="shield" size={18} color={colors.primary} />
          <Text style={[styles.linkLabel, { color: colors.foreground }]}>Privacy Policy</Text>
          <Feather name="external-link" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.credit, { color: colors.mutedForeground }]}>
        Made with {'\u2764\uFE0F'} in {'\uD83C\uDDEE\uD83C\uDDF3'} for the world
      </Text>

      <Modal visible={importVisible} animationType="slide" transparent onRequestClose={() => setImportVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Restore from backup</Text>
            <Text style={styles.helpText}>Paste the contents of your backup JSON below.</Text>
            <TextInput
              style={[
                styles.input,
                styles.importInput,
                {
                  borderColor: importError ? '#C62828' : colors.border,
                  color: colors.foreground,
                  backgroundColor: colors.background,
                },
              ]}
              value={importText}
              onChangeText={setImportText}
              placeholder='{"version":1, ...}'
              placeholderTextColor={colors.mutedForeground}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Backup JSON"
            />
            {importError && <Text style={styles.errorText}>{importError}</Text>}
            <View style={styles.modalRow}>
              <TouchableOpacity
                style={[styles.backupBtn, { borderColor: colors.border }]}
                onPress={() => setImportVisible(false)}
              >
                <Text style={[styles.backupBtnText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.backupBtn, { borderColor: colors.primary, backgroundColor: colors.primary }]}
                onPress={confirmImport}
                disabled={!importText.trim()}
              >
                <Text style={[styles.backupBtnText, { color: '#fff' }]}>Restore</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  avatarArea: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  avatarText: { fontSize: 32, fontWeight: '800', fontFamily: 'Inter_700Bold' },
  ageText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  card: {
    borderRadius: 16, padding: 20, marginBottom: 16,
    ...shadow(2),
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16, fontFamily: 'Inter_700Bold' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 6, marginTop: 12, fontFamily: 'Inter_600SemiBold' },
  input: { borderWidth: 1.5, borderRadius: 10, padding: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  errorText: { color: '#C62828', fontSize: 12, marginTop: 6, fontFamily: 'Inter_500Medium' },
  helpText: { color: '#666', fontSize: 12, marginBottom: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  currencyRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  currChip: { flex: 1, borderWidth: 1.5, borderRadius: 12, padding: 14, alignItems: 'center' },
  currSymbol: { fontSize: 22, fontWeight: '800', fontFamily: 'Inter_700Bold' },
  currLabel: { fontSize: 12, marginTop: 2, fontFamily: 'Inter_400Regular' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  linkLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium' },
  credit: {
    textAlign: 'center',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 8,
    fontFamily: 'Inter_500Medium',
  },
  statsCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, marginTop: 2, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  statDivider: { width: 1, height: 40 },
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
  modalBackdrop: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32,
  },
  importInput: { minHeight: 140, textAlignVertical: 'top', fontSize: 12, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },
  modalRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
});
