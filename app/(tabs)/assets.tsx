import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { Text, Card, Chip, Portal, Modal, TextInput, Button, SegmentedButtons, IconButton, HelperText } from 'react-native-paper';
import { useProfile } from '../../hooks/useProfile';
import { Asset, getAssets, createAsset, updateAsset, deleteAsset, getTotalNetWorth } from '../../db/queries';
import { ASSET_CATEGORIES, FREQUENCIES } from '../../constants/categories';
import { formatCurrency } from '../../engine/calculator';
import { DateInput } from '../../components/DateInput';
import Svg, { Path, Circle } from 'react-native-svg';

const CATEGORY_COLORS: Record<string, string> = {
  ESOP_RSU: '#80CBC4', STOCKS: '#A5D6A7', MUTUAL_FUND: '#FFF176',
  SAVINGS: '#FFE082', GOLD_SILVER: '#FFD54F', PF: '#90CAF9',
  NPS: '#81D4FA', REAL_ESTATE: '#CE93D8', OTHERS: '#B0BEC5',
};

function MiniPieChart({ data, size = 92 }: { data: { value: number; color: string }[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
  const total = data.reduce((sum, d) => sum + Math.abs(d.value), 0);
  if (total === 0) return null;
  let startAngle = -Math.PI / 2;
  const slices: { d: string; color: string }[] = [];
  for (const item of data) {
    const angle = (Math.abs(item.value) / total) * 2 * Math.PI;
    const end = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = angle > Math.PI ? 1 : 0;
    slices.push({
      d: `M${cx} ${cy} L${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}Z`,
      color: item.color,
    });
    startAngle = end;
  }
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={r + 2} fill="rgba(255,255,255,0.15)" />
      {slices.map((s, i) => <Path key={i} d={s.d} fill={s.color} stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />)}
    </Svg>
  );
}

export default function AssetsScreen() {
  const { currentProfile } = useProfile();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [totalNetWorth, setTotalNetWorth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  // Form fields
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
  const [errors, setErrors] = useState<Record<string, string>>({});

  const chipScrollRef = useRef<ScrollView>(null);
  const chipScrollX = useRef(0);

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
    setExpectedRoi(12);
    setIsRecurring(false);
    setRecurringAmount('');
    setRecurringFrequency('QUARTERLY');
    setNextVestingDate('');
    setVestingEndDate('');
    setIsSelfUse(false);
    setGoldSilverUnit('VALUE');
    setGoldSilverQuantity('');
    setUsdExchangeRate('84');
    setErrors({});
    setEditingAsset(null);
  }

  function openForm(category: string, asset?: Asset) {
    resetForm();
    setSelectedCategory(category);
    // Non-ESOP assets always use profile currency
    if (category !== 'ESOP_RSU') {
      setAssetCurrency(currentProfile?.currency ?? 'INR');
    }
    if (asset) {
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
    }
    setShowForm(true);
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
    // Convert USD → profile currency for ESOP/RSU
    const convertedValue = selectedCategory === 'ESOP_RSU' && assetCurrency === 'USD'
      ? parseFloat(currentValue) * parseFloat(usdExchangeRate || '84')
      : parseFloat(currentValue);
    const finalCurrency = currentProfile.currency;
    const assetData: Omit<Asset, 'id'> = {
      profile_id: currentProfile.id,
      category: selectedCategory,
      name: assetName.trim(),
      current_value: convertedValue,
      currency: finalCurrency,
      expected_roi: 0,
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
      setShowForm(false);
      resetForm();
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Could not save asset. Please try again.');
    }
  }

  async function handleDelete(id: number) {
    Alert.alert('Delete Asset', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteAsset(id); loadData(); } },
    ]);
  }

  // Group assets by category
  const groupedAssets: Record<string, Asset[]> = {};
  for (const a of assets) {
    if (!groupedAssets[a.category]) groupedAssets[a.category] = [];
    groupedAssets[a.category].push(a);
  }

  const categoryLabel = ASSET_CATEGORIES.find(c => c.key === selectedCategory)?.label ?? selectedCategory;

  // Pie chart data — breakdown by category
  const pieData = Object.entries(groupedAssets)
    .map(([cat, catAssets]) => ({
      value: catAssets.reduce((sum, a) => sum + a.current_value, 0),
      color: CATEGORY_COLORS[cat] ?? '#546E7A',
    }))
    .filter(d => d.value > 0);

  if (!currentProfile) {
    return (
      <View style={styles.center}>
        <Text>No profile selected</Text>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1B5E20']} />}
      >
        {/* Net Worth Header with Pie Chart */}
        <Card style={styles.netWorthCard}>
          <Card.Content style={styles.netWorthContent}>
            <View style={styles.netWorthTextWrap}>
              <Text variant="labelMedium" style={{ color: '#FFFFFF99' }}>Total Net Worth</Text>
              <Text variant="headlineMedium" style={styles.netWorthValue}>
                {formatCurrency(totalNetWorth, currentProfile.currency)}
              </Text>
              <Text variant="bodySmall" style={{ color: '#FFFFFF99', marginTop: 2 }}>
                Incl. self-use real estate · excludes from FIRE calc
              </Text>
            </View>
            {pieData.length > 0 && (
              <View style={styles.pieWrap}>
                <MiniPieChart data={pieData} size={92} />
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Category Tiles with arrows */}
        <Text variant="titleMedium" style={styles.sectionTitle}>Add Assets by Category</Text>
        <View style={styles.chipRowWrapper}>
          <IconButton icon="chevron-left" size={18} style={styles.chipArrow} accessibilityLabel="Scroll categories left"
            onPress={() => chipScrollRef.current?.scrollTo({ x: Math.max(0, chipScrollX.current - 120), animated: true })} />
          <ScrollView
            ref={chipScrollRef}
            horizontal showsHorizontalScrollIndicator={false}
            style={styles.chipRow}
            onScroll={(e) => { chipScrollX.current = e.nativeEvent.contentOffset.x; }}
            scrollEventThrottle={50}
          >
            {ASSET_CATEGORIES.map(cat => {
              const count = groupedAssets[cat.key]?.length ?? 0;
              return (
                <Chip key={cat.key} icon={cat.icon} onPress={() => openForm(cat.key)}
                  style={styles.chip} textStyle={styles.chipText}>
                  {cat.label}{count > 0 ? ` (${count})` : ''}
                </Chip>
              );
            })}
          </ScrollView>
          <IconButton icon="chevron-right" size={18} style={styles.chipArrow} accessibilityLabel="Scroll categories right"
            onPress={() => chipScrollRef.current?.scrollTo({ x: chipScrollX.current + 120, animated: true })} />
        </View>

        {/* Asset List */}
        {assets.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.center}>
              <Text variant="bodyLarge" style={{ color: '#999', textAlign: 'center' }}>
                No assets added yet.{'\n'}Tap a category above to add your first asset.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          Object.entries(groupedAssets).map(([cat, catAssets]) => {
            const catInfo = ASSET_CATEGORIES.find(c => c.key === cat);
            return (
              <View key={cat}>
                <Text variant="titleSmall" style={styles.groupTitle}>{catInfo?.label ?? cat}</Text>
                {catAssets.map(asset => (
                  <Card key={asset.id} style={styles.assetCard} onPress={() => openForm(asset.category, asset)}>
                    <Card.Content style={styles.assetContent}>
                      <View style={styles.assetRow}>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyMedium" style={styles.assetName}>{asset.name}</Text>
                        <Text variant="bodySmall" style={styles.assetMetaText}>{asset.currency}</Text>
                      </View>
                      <View style={styles.assetMeta}>
                        <Text variant="bodyMedium" style={styles.assetValue}>
                          {formatCurrency(asset.current_value, asset.currency)}
                        </Text>
                        <IconButton icon="delete-outline" size={16} onPress={() => handleDelete(asset.id)} style={styles.assetDeleteIcon} accessibilityLabel={`Delete ${asset.name}`} />
                      </View>
                      </View>
                    </Card.Content>
                  </Card>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add Asset Form Modal */}
      <Portal>
        <Modal
          visible={showForm}
          onDismiss={() => { setShowForm(false); resetForm(); }}
          contentContainerStyle={styles.modal}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text variant="titleLarge" style={styles.modalTitle}>
              {editingAsset ? 'Edit' : 'Add'} {categoryLabel}
            </Text>

            <TextInput label="Asset Name" value={assetName} onChangeText={setAssetName}
              mode="outlined" style={styles.input} error={!!errors.name} />
            {errors.name && <HelperText type="error">{errors.name}</HelperText>}

            <TextInput label="Current Value" value={currentValue} onChangeText={setCurrentValue}
              mode="outlined" style={styles.input} keyboardType="numeric"
              left={<TextInput.Affix text={selectedCategory === 'ESOP_RSU' && assetCurrency === 'USD' ? '$' : currentProfile?.currency === 'INR' ? '₹' : '$'} />}
              error={!!errors.value} />
            {errors.value && <HelperText type="error">{errors.value}</HelperText>}

            {/* Currency selector only for ESOP/RSU */}
            {selectedCategory === 'ESOP_RSU' && (
              <>
                <SegmentedButtons value={assetCurrency} onValueChange={setAssetCurrency}
                  buttons={[{ value: 'INR', label: '₹ INR' }, { value: 'USD', label: '$ USD' }]}
                  style={styles.segment} />
                {assetCurrency === 'USD' && (
                  <TextInput label="USD → INR Exchange Rate" value={usdExchangeRate}
                    onChangeText={setUsdExchangeRate} mode="outlined" style={styles.input}
                    keyboardType="numeric"
                    right={<TextInput.Affix text={`= ₹${(parseFloat(currentValue || '0') * parseFloat(usdExchangeRate || '84')).toFixed(0)}`} />}
                  />
                )}
              </>
            )}

            {/* ESOP/RSU Fields */}
            {selectedCategory === 'ESOP_RSU' && (
              <View style={styles.extraFields}>
                <Button mode={isRecurring ? 'contained' : 'outlined'} onPress={() => setIsRecurring(!isRecurring)}
                  style={styles.toggleBtn}>
                  {isRecurring ? 'Vesting Schedule: ON' : 'Add Vesting Schedule'}
                </Button>
                {isRecurring && (
                  <>
                    <TextInput label="Vesting Amount per Period" value={recurringAmount}
                      onChangeText={setRecurringAmount} mode="outlined" style={styles.input}
                      keyboardType="numeric" error={!!errors.vesting} />
                    {errors.vesting && <HelperText type="error">{errors.vesting}</HelperText>}

                    <SegmentedButtons value={recurringFrequency}
                      onValueChange={setRecurringFrequency}
                      buttons={FREQUENCIES.map(f => ({ value: f.key, label: f.label }))}
                      style={styles.segment} />

                    <DateInput label="Next Vesting Date" value={nextVestingDate}
                      onChangeText={setNextVestingDate} style={styles.input}
                      error={!!errors.vestingDate} />
                    {errors.vestingDate && <HelperText type="error">{errors.vestingDate}</HelperText>}

                    <DateInput label="Vesting End Date (optional)" value={vestingEndDate}
                      onChangeText={setVestingEndDate} style={styles.input} />
                    <HelperText type="info" style={{ marginTop: -8 }}>
                      Vesting stops after this date. Leave blank to vest indefinitely.
                    </HelperText>
                  </>
                )}
              </View>
            )}


            {/* Real Estate Fields */}
            {selectedCategory === 'REAL_ESTATE' && (
              <View style={styles.extraFields}>
                <Button mode={isSelfUse ? 'contained' : 'outlined'} onPress={() => setIsSelfUse(!isSelfUse)}
                  style={styles.toggleBtn}>
                  {isSelfUse ? 'Self-Use Property (excluded from FIRE)' : 'Investment Property'}
                </Button>
              </View>
            )}

            <View style={styles.formActions}>
              <Button mode="outlined" onPress={() => { setShowForm(false); resetForm(); }}
                style={styles.actionBtn}>Cancel</Button>
              <Button mode="contained" onPress={handleSave} style={styles.actionBtn}>
                {editingAsset ? 'Update' : 'Save'}
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scroll: { padding: 16, paddingBottom: 80 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  netWorthCard: { backgroundColor: '#1B5E20', marginBottom: 16, borderRadius: 12 },
  netWorthContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  netWorthTextWrap: { flex: 1, paddingRight: 8 },
  pieWrap: { alignItems: 'center', justifyContent: 'center' },
  netWorthValue: { color: '#FFFFFF', fontWeight: 'bold', marginTop: 4 },
  sectionTitle: { marginBottom: 8, fontWeight: '600' },
  chipRowWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  chipArrow: { margin: 0, padding: 0 },
  chipRow: { flexGrow: 1, flexShrink: 1 },
  chip: { marginRight: 6, backgroundColor: '#E8F5E9' },
  chipText: { fontSize: 11 },
  emptyCard: { padding: 24, borderRadius: 12 },
  groupTitle: { marginTop: 10, marginBottom: 4, fontWeight: '700', color: '#1B5E20', fontSize: 13 },
  assetCard: { marginBottom: 6, borderRadius: 8, backgroundColor: '#FFFFFF' },
  assetContent: { paddingVertical: 8, paddingHorizontal: 12 },
  assetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  assetName: { fontWeight: '600', fontSize: 15 },
  assetMetaText: { color: '#777', fontSize: 12, marginTop: 2 },
  assetMeta: { flexDirection: 'row', alignItems: 'center', minWidth: 112, justifyContent: 'flex-end' },
  assetValue: { fontWeight: '700', color: '#1B5E20', fontSize: 15, marginRight: 4 },
  assetDeleteIcon: { margin: 0 },
  modal: { backgroundColor: '#FFFFFF', margin: 16, padding: 20, borderRadius: 16, maxHeight: '85%' },
  modalTitle: { fontWeight: 'bold', marginBottom: 16, color: '#1B5E20' },
  input: { marginBottom: 8, backgroundColor: '#FFFFFF' },
  segment: { marginBottom: 12 },
  extraFields: { marginTop: 8 },
  toggleBtn: { marginBottom: 12 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  actionBtn: { flex: 1 },
});
