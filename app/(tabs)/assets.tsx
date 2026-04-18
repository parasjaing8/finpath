import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { Portal, Dialog } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useProfile } from '../../hooks/useProfile';
import { getAssets, createAsset, updateAsset as updateAssetDb, deleteAsset as deleteAssetDb } from '../../db/queries';
import { Asset } from '@/engine/types';
import { formatCurrency, getCurrencySymbol } from '@/engine/calculator';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { CustomSlider } from '@/components/CustomSlider';
import { WEB_HEADER_OFFSET, WEB_BOTTOM_OFFSET, shadow, FAB_SIZE, FAB_RIGHT, FAB_BOTTOM_NATIVE, FAB_BOTTOM_WEB } from '@/constants/theme';

const ASSET_NAME_PLACEHOLDER: Record<string, string> = {
  EQUITY: 'e.g., Nifty 50 ETF',
  MUTUAL_FUND: 'e.g., HDFC Flexi Cap',
  DEBT: 'e.g., Corporate Bond Fund',
  FIXED_DEPOSIT: 'e.g., SBI Fixed Deposit',
  PPF: 'e.g., PPF Account',
  EPF: 'e.g., EPFO Account',
  GOLD: 'e.g., SGB 2024',
  REAL_ESTATE: 'e.g., Flat in Bangalore',
  CRYPTO: 'e.g., Bitcoin',
  CASH: 'e.g., Savings Account',
  ESOP_RSU: 'e.g., Infosys RSU',
  OTHERS: 'e.g., Startup Investment',
};

const CATEGORIES = [
  { key: 'EQUITY', label: 'Equity', roi: 12 },
  { key: 'MUTUAL_FUND', label: 'Mutual Fund', roi: 11 },
  { key: 'DEBT', label: 'Debt', roi: 7 },
  { key: 'FIXED_DEPOSIT', label: 'Fixed Deposit', roi: 7 },
  { key: 'PPF', label: 'PPF', roi: 7.1 },
  { key: 'EPF', label: 'EPF', roi: 8.15 },
  { key: 'GOLD', label: 'Gold', roi: 8 },
  { key: 'REAL_ESTATE', label: 'Real Estate', roi: 8 },
  { key: 'CRYPTO', label: 'Crypto', roi: 15 },
  { key: 'CASH', label: 'Cash/Savings', roi: 3.5 },
  { key: 'ESOP_RSU', label: 'ESOP/RSU', roi: 12 },
  { key: 'OTHERS', label: 'Others', roi: 8 },
];

const CATEGORY_ICONS: Record<string, string> = {
  EQUITY: 'trending-up',
  MUTUAL_FUND: 'pie-chart',
  DEBT: 'shield',
  FIXED_DEPOSIT: 'lock',
  PPF: 'archive',
  EPF: 'briefcase',
  GOLD: 'star',
  REAL_ESTATE: 'home',
  CRYPTO: 'zap',
  CASH: 'dollar-sign',
  ESOP_RSU: 'award',
  OTHERS: 'box',
};

function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 6);
}

interface AssetForm {
  name: string;
  category: string;
  current_value: string;
  expected_roi: string;
  is_self_use: boolean;
}

const EMPTY_FORM: AssetForm = {
  name: '',
  category: 'MUTUAL_FUND',
  current_value: '',
  expected_roi: '11',
  is_self_use: false,
};

export default function AssetsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentProfile } = useProfile();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AssetForm>(EMPTY_FORM);

  const currency = currentProfile?.currency ?? 'INR';
  const totalNetWorth = assets.reduce((s, a) => s + a.current_value, 0);
  const investable = assets.filter(a => !a.is_self_use);
  const investableNetWorth = investable.reduce((s, a) => s + a.current_value, 0);

  const webTop = Platform.OS === 'web' ? WEB_HEADER_OFFSET : 0;
  const webBottom = Platform.OS === 'web' ? WEB_BOTTOM_OFFSET : 0;

  async function loadAssets() {
    if (!currentProfile) return;
    const dbAssets = await getAssets(currentProfile.id);
    setAssets(dbAssets);
  }

  React.useEffect(() => {
    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProfile]);

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(a: Asset) {
    setEditId(a.id);
    setForm({
      name: a.name,
      category: a.category,
      current_value: String(a.current_value),
      expected_roi: String(a.expected_roi),
      is_self_use: a.is_self_use ?? false,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!currentProfile) return;
    const value = parseFloat(form.current_value);
    const roi = parseFloat(form.expected_roi);
    if (!form.name.trim() || isNaN(value) || value <= 0) {
      Alert.alert('Validation', 'Please enter a valid name and value.');
      return;
    }
    const asset: Omit<Asset, 'id'> = {
      profile_id: currentProfile.id,
      name: form.name.trim(),
      category: form.category,
      current_value: value,
      expected_roi: isNaN(roi) ? 8 : roi,
      is_self_use: form.is_self_use,
    };
    if (editId) {
      await updateAssetDb({ ...asset, id: editId });
    } else {
      await createAsset(asset);
    }
    await loadAssets();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowModal(false);
  }

  function handleDelete(id: string) {
    Alert.alert('Delete Asset', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteAssetDb(id);
        await loadAssets();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } },
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: 16 + webTop, paddingBottom: 40 + webBottom + insets.bottom }]}
      >
        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryTile, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.summaryLabel, { color: colors.success }]}>TOTAL NET WORTH</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(totalNetWorth, currency)}</Text>
          </View>
          <View style={[styles.summaryTile, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.summaryLabel, { color: colors.primary }]}>INVESTABLE</Text>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>{formatCurrency(investableNetWorth, currency)}</Text>
          </View>
        </View>

        {/* Asset list */}
        {assets.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="trending-up" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No assets yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Add your investments to get a complete picture</Text>
            <TouchableOpacity
              style={[styles.emptyCta, { backgroundColor: colors.primary }]}
              onPress={openAdd}
              accessibilityRole="button"
              accessibilityLabel="Add your first asset"
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.emptyCtaText}>Add your first asset</Text>
            </TouchableOpacity>
          </View>
        )}

        {assets.map(asset => {
          const cat = CATEGORIES.find(c => c.key === asset.category);
          const icon = CATEGORY_ICONS[asset.category] ?? 'box';
          return (
            <View key={asset.id} style={[styles.assetCard, { backgroundColor: colors.card }]}>
              <View style={[styles.iconBox, { backgroundColor: colors.secondary }]}>
                <Feather name={icon as any} size={20} color={colors.primary} />
              </View>
              <View style={styles.assetInfo}>
                <Text style={[styles.assetName, { color: colors.foreground }]}>{asset.name}</Text>
                <Text style={[styles.assetMeta, { color: colors.mutedForeground }]}>
                  {cat?.label ?? asset.category} · {asset.expected_roi}% p.a.
                  {asset.is_self_use ? ' · Self-use' : ''}
                </Text>
              </View>
              <Text style={[styles.assetValue, { color: colors.primary }]}>
                {formatCurrency(asset.current_value, currency)}
              </Text>
              <TouchableOpacity
                onPress={() => openEdit(asset)}
                style={styles.editBtn}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${asset.name}`}
                hitSlop={8}
              >
                <Feather name="edit-2" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(asset.id)}
                style={styles.editBtn}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${asset.name}`}
                hitSlop={8}
              >
                <Feather name="trash-2" size={16} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: (Platform.OS === 'web' ? FAB_BOTTOM_WEB + webBottom : FAB_BOTTOM_NATIVE) + insets.bottom }]}
        onPress={openAdd}
        accessibilityRole="button"
        accessibilityLabel="Add new asset"
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Add/Edit Dialog */}
      <Portal>
        <Dialog visible={showModal} onDismiss={() => setShowModal(false)} style={{ backgroundColor: colors.card, borderRadius: 24, maxHeight: '85%' }}>
          <Dialog.Title style={{ color: colors.foreground }}>{editId ? 'Edit Asset' : 'Add Asset'}</Dialog.Title>
          <Dialog.Content style={{ paddingHorizontal: 0 }}>
            <KeyboardAwareScrollViewCompat
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              bottomOffset={20}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={form.name}
                onChangeText={t => setForm(f => ({ ...f, name: t }))}
                placeholder={ASSET_NAME_PLACEHOLDER[form.category] ?? 'e.g., Asset Name'}
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="Asset name"
              />

              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.catChip, { backgroundColor: form.category === c.key ? colors.primary : colors.secondary, borderColor: colors.border }]}
                    onPress={() => setForm(f => ({ ...f, category: c.key, expected_roi: String(c.roi) }))}
                    accessibilityRole="button"
                    accessibilityLabel={`Category: ${c.label}`}
                    accessibilityState={{ selected: form.category === c.key }}
                  >
                    <Text style={[styles.catChipText, { color: form.category === c.key ? '#fff' : colors.foreground }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Current Value ({getCurrencySymbol(currency)})</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={form.current_value}
                onChangeText={t => setForm(f => ({ ...f, current_value: t }))}
                keyboardType="numeric"
                placeholder="e.g., 500000"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="Current value in your currency"
              />

              <View style={styles.sliderRow}>
                <Text style={styles.fieldLabel}>Expected Return (% p.a.)</Text>
                <Text style={[styles.sliderVal, { color: colors.primary }]}>{parseFloat(form.expected_roi) || 0}%</Text>
              </View>
              <CustomSlider
                value={parseFloat(form.expected_roi) || 0}
                onValueChange={v => setForm(f => ({ ...f, expected_roi: String(Math.round(v * 10) / 10) }))}
                minimumValue={0}
                maximumValue={20}
                step={0.5}
              />

              {['REAL_ESTATE', 'GOLD', 'OTHERS'].includes(form.category) && (
                <TouchableOpacity
                  style={styles.checkRow}
                  onPress={() => setForm(f => ({ ...f, is_self_use: !f.is_self_use }))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: form.is_self_use }}
                  accessibilityLabel="Self-use property"
                >
                  <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: form.is_self_use ? colors.primary : 'transparent' }]}> 
                    {form.is_self_use && <Feather name="check" size={12} color="#fff" />}
                  </View>
                  <Text style={[styles.checkLabel, { color: colors.foreground }]}>Self-use property (excluded from investable net worth)</Text>
                </TouchableOpacity>
              )}
            </KeyboardAwareScrollViewCompat>
          </Dialog.Content>
          <Dialog.Actions style={{ flexDirection: 'row', gap: 12, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={() => setShowModal(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              accessibilityRole="button"
              accessibilityLabel={editId ? 'Save changes to asset' : 'Save new asset'}
            >
              <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Save</Text>
            </TouchableOpacity>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryTile: { flex: 1, borderRadius: 16, padding: 16 },
  summaryLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4, fontFamily: 'Inter_700Bold' },
  summaryValue: { fontSize: 20, fontWeight: '800', fontFamily: 'Inter_700Bold' },
  emptyState: { alignItems: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  emptyText: { textAlign: 'center', lineHeight: 22, fontFamily: 'Inter_400Regular', fontSize: 14 },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22, marginTop: 8,
  },
  emptyCtaText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  assetCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    padding: 14, marginBottom: 10, gap: 10,
    ...shadow(1),
  },
  iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  assetInfo: { flex: 1 },
  assetName: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  assetMeta: { fontSize: 12, marginTop: 2, fontFamily: 'Inter_400Regular' },
  assetValue: { fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  editBtn: { padding: 6 },
  fab: {
    position: 'absolute', right: FAB_RIGHT, width: FAB_SIZE, height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2, justifyContent: 'center', alignItems: 'center',
    ...shadow(4),
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  kavWrapper: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { flex: 1, maxHeight: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingHorizontal: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground, marginBottom: 6, marginTop: 12, fontFamily: 'Inter_600SemiBold' },
  input: {
    borderWidth: 1.5, borderRadius: 10, padding: 12, fontSize: 15, fontFamily: 'Inter_400Regular',
  },
  catScroll: { marginBottom: 4 },
  catChip: {
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginRight: 8,
    borderWidth: 1,
  },
  catChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  sliderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 2 },
  sliderVal: { fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  checkLabel: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  modalBtns: { flexDirection: 'row', gap: 12, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
});
