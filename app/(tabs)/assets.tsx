import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../hooks/useColors';
import { useProfile } from '../../hooks/useProfile';
import { Asset, getAssets, createAsset, updateAsset, deleteAsset, getTotalNetWorth } from '../../db/queries';
import { ASSET_CATEGORIES, FREQUENCIES, DEFAULT_GROWTH_RATES } from '../../constants/categories';
import { Slider } from '@miblanchard/react-native-slider';
import { formatCurrency } from '../../engine/calculator';
import { DateInput } from '../../components/DateInput';

export default function AssetsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentProfile } = useProfile();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [totalNetWorth, setTotalNetWorth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('MUTUAL_FUND');
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  const [assetName, setAssetName] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [assetCurrency, setAssetCurrency] = useState('INR');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringAmount, setRecurringAmount] = useState('');
  const [recurringFrequency, setRecurringFrequency] = useState('QUARTERLY');
  const [nextVestingDate, setNextVestingDate] = useState('');
  const [vestingEndDate, setVestingEndDate] = useState('');
  const [isSelfUse, setIsSelfUse] = useState(false);
  const [usdExchangeRate, setUsdExchangeRate] = useState('84');
  const [growthRate, setGrowthRate] = useState(8);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    if (!currentProfile) return;
    const [assetList, nw] = await Promise.all([
      getAssets(currentProfile.id),
      getTotalNetWorth(currentProfile.id),
    ]);
    setAssets(assetList);
    setTotalNetWorth(nw);
    setLoading(false);
  }, [currentProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => { loadData(); }, [loadData]);

  function resetForm() {
    setAssetName('');
    setCurrentValue('');
    setAssetCurrency(currentProfile?.currency ?? 'INR');
    setIsRecurring(false);
    setRecurringAmount('');
    setRecurringFrequency('QUARTERLY');
    setNextVestingDate('');
    setVestingEndDate('');
    setIsSelfUse(false);
    setUsdExchangeRate('84');
    setErrors({});
    setEditingAsset(null);
  }

  function openAdd() {
    resetForm();
    setSelectedCategory('MUTUAL_FUND');
    setGrowthRate(DEFAULT_GROWTH_RATES['MUTUAL_FUND'] ?? 8);
    setShowModal(true);
  }

  function openEdit(asset: Asset) {
    resetForm();
    setSelectedCategory(asset.category);
    setEditingAsset(asset);
    setAssetName(asset.name);
    setCurrentValue(asset.current_value.toString());
    setAssetCurrency(asset.currency);
    setIsRecurring(!!asset.is_recurring);
    setRecurringAmount(asset.recurring_amount?.toString() ?? '');
    setRecurringFrequency(asset.recurring_frequency ?? 'QUARTERLY');
    setNextVestingDate(asset.next_vesting_date ?? '');
    setVestingEndDate(asset.vesting_end_date ?? '');
    setIsSelfUse(!!asset.is_self_use);
    setGrowthRate(asset.expected_roi > 0 ? asset.expected_roi : (DEFAULT_GROWTH_RATES[asset.category] ?? 8));
    setShowModal(true);
  }

  function handleCategoryChange(key: string) {
    setSelectedCategory(key);
    if (!editingAsset) setGrowthRate(DEFAULT_GROWTH_RATES[key] ?? 8);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!assetName.trim()) e.name = 'Name is required';
    if (!currentValue || parseFloat(currentValue) < 0) e.value = 'Enter a valid value';
    if (selectedCategory === 'ESOP_RSU' && isRecurring) {
      if (!recurringAmount || parseFloat(recurringAmount) <= 0) e.vesting = 'Enter vesting amount';
      if (!nextVestingDate.match(/^\d{4}-\d{2}-\d{2}$/)) e.vestingDate = 'Enter date as YYYY-MM-DD';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!currentProfile || !validate()) return;
    const convertedValue = selectedCategory === 'ESOP_RSU' && assetCurrency === 'USD'
      ? parseFloat(currentValue) * parseFloat(usdExchangeRate || '84')
      : parseFloat(currentValue);
    const assetData: Omit<Asset, 'id'> = {
      profile_id: currentProfile.id,
      category: selectedCategory,
      name: assetName.trim(),
      current_value: convertedValue,
      currency: currentProfile.currency,
      expected_roi: growthRate,
      is_recurring: isRecurring ? 1 : 0,
      recurring_amount: isRecurring ? parseFloat(recurringAmount) || null : null,
      recurring_frequency: isRecurring ? recurringFrequency : null,
      next_vesting_date: isRecurring ? nextVestingDate || null : null,
      vesting_end_date: isRecurring ? vestingEndDate || null : null,
      is_self_use: isSelfUse ? 1 : 0,
      gold_silver_unit: selectedCategory === 'GOLD_SILVER' ? 'VALUE' : null,
      gold_silver_quantity: null,
    };
    try {
      if (editingAsset) {
        await updateAsset({ ...assetData, id: editingAsset.id });
      } else {
        await createAsset(assetData);
      }
      setShowModal(false);
      resetForm();
      loadData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Could not save asset. Please try again.');
    }
  }

  async function handleDelete(id: number) {
    Alert.alert('Delete Asset', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteAsset(id);
        loadData();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }},
    ]);
  }

  const investableNetWorth = assets
    .filter(a => !(a.category === 'REAL_ESTATE' && a.is_self_use))
    .reduce((s, a) => s + a.current_value, 0);

  const groupedAssets: Record<string, Asset[]> = {};
  for (const a of assets) {
    if (!groupedAssets[a.category]) groupedAssets[a.category] = [];
    groupedAssets[a.category].push(a);
  }

  const currency = currentProfile?.currency ?? 'INR';
  const currSymbol = currency === 'INR' ? '₹' : '$';
  const displaySymbol = selectedCategory === 'ESOP_RSU' && assetCurrency === 'USD' ? '$' : currSymbol;

  if (!currentProfile) {
    return <View style={styles.center}><Text style={{ color: '#666' }}>No profile selected</Text></View>;
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
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

        {assets.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="trending-up" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No assets yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Tap + to add your investments</Text>
          </View>
        )}

        {Object.entries(groupedAssets).map(([cat, catAssets]) => {
          const catInfo = ASSET_CATEGORIES.find(c => c.key === cat);
          return (
            <View key={cat}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{catInfo?.label?.toUpperCase() ?? cat}</Text>
              {catAssets.map(asset => (
                <View key={asset.id} style={[styles.assetCard, { backgroundColor: colors.card }]}>
                  <View style={[styles.iconBox, { backgroundColor: colors.secondary }]}>
                    <MaterialCommunityIcons name={(catInfo?.icon ?? 'dots-horizontal-circle-outline') as any} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.assetInfo}>
                    <Text style={[styles.assetName, { color: colors.foreground }]}>{asset.name}</Text>
                    <Text style={[styles.assetMeta, { color: colors.mutedForeground }]}>
                      {catInfo?.label ?? cat} · {asset.expected_roi}% p.a.{asset.is_self_use ? ' · Self-use' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.assetValue, { color: colors.primary }]}>
                    {formatCurrency(asset.current_value, currency)}
                  </Text>
                  <TouchableOpacity onPress={() => openEdit(asset)} style={styles.actionBtn}>
                    <Feather name="edit-2" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(asset.id)} style={styles.actionBtn}>
                    <Feather name="trash-2" size={16} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: 80 + insets.bottom }]}
        onPress={openAdd}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowModal(false); resetForm(); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {editingAsset ? 'Edit Asset' : 'Add Asset'}
              </Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[styles.fieldLabel, { color: '#666' }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                {ASSET_CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.catChip, {
                      backgroundColor: selectedCategory === c.key ? colors.primary : colors.secondary,
                      borderColor: colors.border,
                    }]}
                    onPress={() => handleCategoryChange(c.key)}
                  >
                    <Text style={[styles.catChipText, { color: selectedCategory === c.key ? '#fff' : colors.foreground }]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.fieldLabel, { color: '#666' }]}>Name</Text>
              <TextInput
                style={[styles.input, {
                  borderColor: errors.name ? colors.destructive : colors.border,
                  color: colors.foreground,
                  backgroundColor: colors.background,
                }]}
                value={assetName}
                onChangeText={setAssetName}
                placeholder="e.g., HDFC Flexi Cap"
                placeholderTextColor={colors.mutedForeground}
              />
              {errors.name ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.name}</Text> : null}

              <Text style={[styles.fieldLabel, { color: '#666' }]}>Current Value ({displaySymbol})</Text>
              <TextInput
                style={[styles.input, {
                  borderColor: errors.value ? colors.destructive : colors.border,
                  color: colors.foreground,
                  backgroundColor: colors.background,
                }]}
                value={currentValue}
                onChangeText={setCurrentValue}
                keyboardType="numeric"
                placeholder="e.g., 500000"
                placeholderTextColor={colors.mutedForeground}
              />
              {errors.value ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.value}</Text> : null}

              {selectedCategory === 'ESOP_RSU' && (
                <>
                  <Text style={[styles.fieldLabel, { color: '#666' }]}>Currency</Text>
                  <View style={styles.freqRow}>
                    {[{ key: 'INR', label: '₹ INR' }, { key: 'USD', label: '$ USD' }].map(c => (
                      <TouchableOpacity
                        key={c.key}
                        style={[styles.freqChip, { backgroundColor: assetCurrency === c.key ? colors.primary : colors.secondary }]}
                        onPress={() => setAssetCurrency(c.key)}
                      >
                        <Text style={[styles.freqText, { color: assetCurrency === c.key ? '#fff' : colors.foreground }]}>{c.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {assetCurrency === 'USD' && (
                    <>
                      <Text style={[styles.fieldLabel, { color: '#666' }]}>USD \u2192 INR Rate</Text>
                      <TextInput
                        style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                        value={usdExchangeRate}
                        onChangeText={setUsdExchangeRate}
                        keyboardType="numeric"
                        placeholder="e.g., 84"
                        placeholderTextColor={colors.mutedForeground}
                      />
                      <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                        = \u20b9{(parseFloat(currentValue || '0') * parseFloat(usdExchangeRate || '84')).toFixed(0)}
                      </Text>
                    </>
                  )}

                  <TouchableOpacity
                    style={[styles.checkRow, { borderColor: isRecurring ? colors.primary : colors.border, backgroundColor: isRecurring ? colors.secondary : colors.background }]}
                    onPress={() => setIsRecurring(!isRecurring)}
                  >
                    <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: isRecurring ? colors.primary : 'transparent' }]}>
                      {isRecurring && <Feather name="check" size={12} color="#fff" />}
                    </View>
                    <Text style={[styles.checkLabel, { color: isRecurring ? colors.primary : colors.foreground }]}>Vesting Schedule</Text>
                  </TouchableOpacity>

                  {isRecurring && (
                    <>
                      <Text style={[styles.fieldLabel, { color: '#666' }]}>Vesting Amount per Period</Text>
                      <TextInput
                        style={[styles.input, {
                          borderColor: errors.vesting ? colors.destructive : colors.border,
                          color: colors.foreground,
                          backgroundColor: colors.background,
                        }]}
                        value={recurringAmount}
                        onChangeText={setRecurringAmount}
                        keyboardType="numeric"
                        placeholder="e.g., 100000"
                        placeholderTextColor={colors.mutedForeground}
                      />
                      {errors.vesting ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.vesting}</Text> : null}

                      <Text style={[styles.fieldLabel, { color: '#666' }]}>Frequency</Text>
                      <View style={styles.freqRow}>
                        {FREQUENCIES.map(f => (
                          <TouchableOpacity
                            key={f.key}
                            style={[styles.freqChip, { backgroundColor: recurringFrequency === f.key ? colors.primary : colors.secondary }]}
                            onPress={() => setRecurringFrequency(f.key)}
                          >
                            <Text style={[styles.freqText, { color: recurringFrequency === f.key ? '#fff' : colors.foreground }]}>{f.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <DateInput
                        label="Next Vesting Date"
                        value={nextVestingDate}
                        onChangeText={setNextVestingDate}
                        style={styles.dateInput}
                        error={!!errors.vestingDate}
                      />
                      {errors.vestingDate ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.vestingDate}</Text> : null}

                      <DateInput
                        label="Vesting End Date (optional)"
                        value={vestingEndDate}
                        onChangeText={setVestingEndDate}
                        style={styles.dateInput}
                      />
                      <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                        Leave end date blank to vest indefinitely.
                      </Text>
                    </>
                  )}
                </>
              )}

              {selectedCategory === 'REAL_ESTATE' && (
                <TouchableOpacity
                  style={[styles.checkRow, { borderColor: isSelfUse ? colors.primary : colors.border, backgroundColor: isSelfUse ? colors.secondary : colors.background }]}
                  onPress={() => setIsSelfUse(!isSelfUse)}
                >
                  <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: isSelfUse ? colors.primary : 'transparent' }]}>
                    {isSelfUse && <Feather name="check" size={12} color="#fff" />}
                  </View>
                  <Text style={[styles.checkLabel, { color: isSelfUse ? colors.primary : colors.foreground }]}>
                    Self-use property (excluded from FIRE calc)
                  </Text>
                </TouchableOpacity>
              )}

              <Text style={[styles.fieldLabel, { color: '#666', marginTop: 16 }]}>
                Expected Annual Growth: {growthRate}%
              </Text>
              <Slider
                value={growthRate}
                onValueChange={(v: number[]) => setGrowthRate(Math.round(v[0]))}
                minimumValue={0}
                maximumValue={25}
                step={1}
                minimumTrackTintColor={colors.primary}
                thumbTintColor={colors.primary}
              />

              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={() => { setShowModal(false); resetForm(); }}
                >
                  <Text style={{ color: colors.mutedForeground, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                  onPress={handleSave}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>{editingAsset ? 'Update' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryTile: { flex: 1, borderRadius: 16, padding: 16 },
  summaryLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  emptyState: { alignItems: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyText: { textAlign: 'center', lineHeight: 22, fontSize: 14 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  assetCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    padding: 14, marginBottom: 10, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  assetInfo: { flex: 1 },
  assetName: { fontSize: 14, fontWeight: '600' },
  assetMeta: { fontSize: 12, marginTop: 2 },
  assetValue: { fontSize: 14, fontWeight: '700' },
  actionBtn: { padding: 6 },
  fab: {
    position: 'absolute', right: 20, width: 56, height: 56,
    borderRadius: 28, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderRadius: 10, padding: 12, fontSize: 15 },
  errorText: { fontSize: 11, marginTop: 4 },
  hintText: { fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  dateInput: { marginTop: 0 },
  catScroll: { marginBottom: 4 },
  catChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1 },
  catChipText: { fontSize: 13, fontWeight: '500' },
  freqRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  freqChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  freqText: { fontSize: 13, fontWeight: '500' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, borderWidth: 1.5, borderRadius: 10, padding: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  checkLabel: { flex: 1, fontSize: 13 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 12 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
});
