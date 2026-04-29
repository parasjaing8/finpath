import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { Asset, ASSET_CATEGORIES, FREQUENCIES } from '@/engine/types';
import { formatCurrency, getCurrencySymbol } from '@/engine/calculator';
import { formatDateMask } from '@/components/DateInput';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { WEB_HEADER_OFFSET, WEB_BOTTOM_OFFSET, shadow, FAB_SIZE, FAB_RIGHT, FAB_BOTTOM_NATIVE, FAB_BOTTOM_WEB } from '@/constants/theme';


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


interface AssetForm {
  name: string;
  category: string;
  current_value: string;
  expected_roi: string;
  is_self_use: boolean;
  // ESOP/RSU vesting
  is_recurring: boolean;
  recurring_amount: string;
  recurring_frequency: string;
  next_vesting_date: string;
  vesting_end_date: string;
  cliff_date: string;
}

const EMPTY_FORM: AssetForm = {
  name: '',
  category: 'MUTUAL_FUND',
  current_value: '',
  expected_roi: '11',
  is_self_use: false,
  is_recurring: false,
  recurring_amount: '',
  recurring_frequency: 'QUARTERLY',
  next_vesting_date: '',
  vesting_end_date: '',
  cliff_date: '',
};

export default function AssetsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { assets, addAsset, deleteAsset, updateAsset, profile } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AssetForm>(EMPTY_FORM);

  const currency = profile?.currency ?? 'INR';
  const totalNetWorth = assets.reduce((s, a) => s + a.current_value, 0);
  const investable = assets.filter(a => !a.is_self_use);
  const investableNetWorth = investable.reduce((s, a) => s + a.current_value, 0);

  const webTop = Platform.OS === 'web' ? WEB_HEADER_OFFSET : 0;
  const webBottom = Platform.OS === 'web' ? WEB_BOTTOM_OFFSET : 0;

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(a: Asset) {
    setEditId(String(a.id));
    setForm({
      name: a.name,
      category: a.category,
      current_value: String(a.current_value),
      expected_roi: String(a.expected_roi),
      is_self_use: !!(a.is_self_use ?? false),
      is_recurring: !!(a.is_recurring ?? false),
      recurring_amount: a.recurring_amount != null ? String(a.recurring_amount) : '',
      recurring_frequency: a.recurring_frequency ?? 'QUARTERLY',
      next_vesting_date: a.next_vesting_date ?? '',
      vesting_end_date: a.vesting_end_date ?? '',
      cliff_date: a.cliff_date ?? '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    const value = parseFloat(form.current_value);
    const roi = parseFloat(form.expected_roi);
    if (!form.name.trim() || isNaN(value) || value <= 0) {
      Alert.alert('Validation', 'Please enter a valid name and value.');
      return;
    }
    const isEsop = form.category === 'ESOP_RSU';
    const recurringAmt = parseFloat(form.recurring_amount);
    const asset: Asset = {
      id: editId ?? '',
      name: form.name.trim(),
      category: form.category,
      current_value: value,
      expected_roi: isNaN(roi) ? 8 : roi,
      is_self_use: form.is_self_use,
      is_recurring: isEsop ? form.is_recurring : false,
      recurring_amount: isEsop && form.is_recurring && !isNaN(recurringAmt) ? recurringAmt : null,
      recurring_frequency: isEsop && form.is_recurring ? form.recurring_frequency : null,
      next_vesting_date: isEsop && form.is_recurring && form.next_vesting_date ? form.next_vesting_date : null,
      vesting_end_date: isEsop && form.is_recurring && form.vesting_end_date ? form.vesting_end_date : null,
      cliff_date: isEsop && form.is_recurring && form.cliff_date ? form.cliff_date : null,
    };
    if (editId) updateAsset(asset);
    else {
      const ok = await addAsset(asset);
      if (!ok) {
        Alert.alert('Save failed', 'Could not save asset. Please try again.');
        return;
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowModal(false);
  }

  function handleDelete(id: string) {
    Alert.alert('Delete Asset', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteAsset(id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } },
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
          const cat = ASSET_CATEGORIES.find(c => c.key === asset.category);
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
                onPress={() => handleDelete(String(asset.id))}
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

      {/* Add/Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAwareScrollViewCompat
            showsVerticalScrollIndicator={false}
            bottomOffset={20}
          >
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editId ? 'Edit Asset' : 'Add Asset'}</Text>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Close asset form"
                hitSlop={10}
              >
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={form.name}
                onChangeText={t => setForm(f => ({ ...f, name: t }))}
                placeholder="e.g., HDFC Flexi Cap"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="Asset name"
              />

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

              <Text style={styles.fieldLabel}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                    {ASSET_CATEGORIES.map(c => (
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

                  <Text style={styles.fieldLabel}>Expected Return (% p.a.)</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                    value={form.expected_roi}
                    onChangeText={t => setForm(f => ({ ...f, expected_roi: t }))}
                    keyboardType="decimal-pad"
                    placeholder="e.g., 7.5"
                    placeholderTextColor={colors.mutedForeground}
                    accessibilityLabel="Expected annual return in percent"
                  />

                  <TouchableOpacity
                    style={styles.checkRow}
                    onPress={() => setForm(f => ({ ...f, is_self_use: !f.is_self_use }))}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: form.is_self_use }}
                    accessibilityLabel="Self-use asset"
                  >
                    <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: form.is_self_use ? colors.primary : 'transparent' }]}>
                      {form.is_self_use && <Feather name="check" size={12} color="#fff" />}
                    </View>
                    <Text style={[styles.checkLabel, { color: colors.foreground }]}>Self-use asset (excluded from investable net worth)</Text>
                  </TouchableOpacity>

              {/* ESOP/RSU vesting schedule */}
              {form.category === 'ESOP_RSU' && (
                <View style={[styles.vestingSection, { borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={styles.checkRow}
                    onPress={() => setForm(f => ({ ...f, is_recurring: !f.is_recurring }))}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: form.is_recurring }}
                    accessibilityLabel="Has vesting schedule"
                  >
                    <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: form.is_recurring ? colors.primary : 'transparent' }]}>
                      {form.is_recurring && <Feather name="check" size={12} color="#fff" />}
                    </View>
                    <Text style={[styles.checkLabel, { color: colors.foreground }]}>Has vesting schedule</Text>
                  </TouchableOpacity>

                  {form.is_recurring && (
                    <>
                      <Text style={styles.fieldLabel}>Amount per Vesting Event ({getCurrencySymbol(currency)})</Text>
                      <TextInput
                        style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                        value={form.recurring_amount}
                        onChangeText={t => setForm(f => ({ ...f, recurring_amount: t }))}
                        keyboardType="numeric"
                        placeholder="e.g., 50000"
                        placeholderTextColor={colors.mutedForeground}
                        accessibilityLabel="Amount per vesting event"
                      />

                      <Text style={styles.fieldLabel}>Frequency</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                        {FREQUENCIES.filter(f => f.key !== 'ONE_TIME').map(f => (
                          <TouchableOpacity
                            key={f.key}
                            style={[styles.catChip, { backgroundColor: form.recurring_frequency === f.key ? colors.primary : colors.secondary, borderColor: colors.border }]}
                            onPress={() => setForm(prev => ({ ...prev, recurring_frequency: f.key }))}
                            accessibilityRole="button"
                            accessibilityLabel={`Frequency: ${f.label}`}
                            accessibilityState={{ selected: form.recurring_frequency === f.key }}
                          >
                            <Text style={[styles.catChipText, { color: form.recurring_frequency === f.key ? '#fff' : colors.foreground }]}>{f.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      <Text style={styles.fieldLabel}>Cliff Date (YYYY-MM-DD, optional)</Text>
                      <TextInput
                        style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                        value={form.cliff_date}
                        onChangeText={t => setForm(f => ({ ...f, cliff_date: formatDateMask(t) }))}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.mutedForeground}
                        accessibilityLabel="Cliff date"
                      />

                      <Text style={styles.fieldLabel}>First Vesting Date (YYYY-MM-DD)</Text>
                      <TextInput
                        style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                        value={form.next_vesting_date}
                        onChangeText={t => setForm(f => ({ ...f, next_vesting_date: formatDateMask(t) }))}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.mutedForeground}
                        accessibilityLabel="First vesting date"
                      />

                      <Text style={styles.fieldLabel}>Last Vesting Date (YYYY-MM-DD, optional)</Text>
                      <TextInput
                        style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                        value={form.vesting_end_date}
                        onChangeText={t => setForm(f => ({ ...f, vesting_end_date: formatDateMask(t) }))}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.mutedForeground}
                        accessibilityLabel="Last vesting date"
                      />
                    </>
                  )}
                </View>
              )}

              <View style={styles.modalBtns}>
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
              </View>
          </View>
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>
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
  modalSheet: { marginTop: 80, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 6, marginTop: 12, fontFamily: 'Inter_600SemiBold' },
  input: {
    borderWidth: 1.5, borderRadius: 10, padding: 12, fontSize: 15, fontFamily: 'Inter_400Regular',
  },
  catScroll: { marginBottom: 4, flexGrow: 0 },
  catChip: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1,
  },
  catChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  vestingSection: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  checkLabel: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
});
