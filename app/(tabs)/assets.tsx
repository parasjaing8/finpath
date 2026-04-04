import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Chip, Portal, Modal, TextInput, Button, SegmentedButtons, IconButton, HelperText } from 'react-native-paper';
import { useProfile } from '../../hooks/useProfile';
import { Asset, getAssets, createAsset, updateAsset, deleteAsset, getTotalNetWorth } from '../../db/queries';
import { ASSET_CATEGORIES, FREQUENCIES } from '../../constants/categories';
import { formatCurrency } from '../../engine/calculator';
import { Slider } from '@miblanchard/react-native-slider';

export default function AssetsScreen() {
  const { currentProfile } = useProfile();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [totalNetWorth, setTotalNetWorth] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  // Form fields
  const [assetName, setAssetName] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [assetCurrency, setAssetCurrency] = useState('INR');
  const [expectedRoi, setExpectedRoi] = useState(12);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringAmount, setRecurringAmount] = useState('');
  const [recurringFrequency, setRecurringFrequency] = useState('QUARTERLY');
  const [nextVestingDate, setNextVestingDate] = useState('');
  const [isSelfUse, setIsSelfUse] = useState(false);
  const [goldSilverUnit, setGoldSilverUnit] = useState('VALUE');
  const [goldSilverQuantity, setGoldSilverQuantity] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    if (!currentProfile) return;
    const [assetList, nw] = await Promise.all([
      getAssets(currentProfile.id),
      getTotalNetWorth(currentProfile.id),
    ]);
    setAssets(assetList);
    setTotalNetWorth(nw);
  }, [currentProfile]);

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
    setIsSelfUse(false);
    setGoldSilverUnit('VALUE');
    setGoldSilverQuantity('');
    setErrors({});
    setEditingAsset(null);
  }

  function openForm(category: string, asset?: Asset) {
    resetForm();
    setSelectedCategory(category);
    if (asset) {
      setEditingAsset(asset);
      setAssetName(asset.name);
      setCurrentValue(asset.current_value.toString());
      setAssetCurrency(asset.currency);
      setExpectedRoi(asset.expected_roi);
      setIsRecurring(!!asset.is_recurring);
      setRecurringAmount(asset.recurring_amount?.toString() ?? '');
      setRecurringFrequency(asset.recurring_frequency ?? 'QUARTERLY');
      setNextVestingDate(asset.next_vesting_date ?? '');
      setIsSelfUse(!!asset.is_self_use);
      setGoldSilverUnit(asset.gold_silver_unit ?? 'VALUE');
      setGoldSilverQuantity(asset.gold_silver_quantity?.toString() ?? '');
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
    const assetData: Omit<Asset, 'id'> = {
      profile_id: currentProfile.id,
      category: selectedCategory,
      name: assetName.trim(),
      current_value: parseFloat(currentValue),
      currency: assetCurrency,
      expected_roi: expectedRoi,
      is_recurring: isRecurring ? 1 : 0,
      recurring_amount: isRecurring ? parseFloat(recurringAmount) || null : null,
      recurring_frequency: isRecurring ? recurringFrequency : null,
      next_vesting_date: isRecurring ? nextVestingDate || null : null,
      is_self_use: isSelfUse ? 1 : 0,
      gold_silver_unit: selectedCategory === 'GOLD_SILVER' ? goldSilverUnit : null,
      gold_silver_quantity: selectedCategory === 'GOLD_SILVER' && goldSilverUnit === 'GRAMS' ? parseFloat(goldSilverQuantity) || null : null,
    };

    if (editingAsset) {
      await updateAsset({ ...assetData, id: editingAsset.id });
    } else {
      await createAsset(assetData);
    }
    setShowForm(false);
    resetForm();
    loadData();
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

  if (!currentProfile) {
    return (
      <View style={styles.center}>
        <Text>No profile selected</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Net Worth Header */}
        <Card style={styles.netWorthCard}>
          <Card.Content>
            <Text variant="labelMedium" style={{ color: '#FFFFFF99' }}>Total Net Worth</Text>
            <Text variant="headlineLarge" style={styles.netWorthValue}>
              {formatCurrency(totalNetWorth, currentProfile.currency)}
            </Text>
          </Card.Content>
        </Card>

        {/* Category Tiles */}
        <Text variant="titleMedium" style={styles.sectionTitle}>Add Assets by Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {ASSET_CATEGORIES.map(cat => {
            const count = groupedAssets[cat.key]?.length ?? 0;
            return (
              <Chip
                key={cat.key}
                icon={cat.icon}
                onPress={() => openForm(cat.key)}
                style={styles.chip}
                textStyle={styles.chipText}
              >
                {cat.label}{count > 0 ? ` (${count})` : ''}
              </Chip>
            );
          })}
        </ScrollView>

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
                    <Card.Content style={styles.assetRow}>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyLarge" style={{ fontWeight: '600' }}>{asset.name}</Text>
                        <Text variant="bodySmall" style={{ color: '#666' }}>
                          ROI: {asset.expected_roi}% • {asset.currency}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text variant="bodyLarge" style={{ fontWeight: '700', color: '#1B5E20' }}>
                          {formatCurrency(asset.current_value, asset.currency)}
                        </Text>
                        <IconButton icon="delete-outline" size={18} onPress={() => handleDelete(asset.id)} />
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
              left={<TextInput.Affix text={assetCurrency === 'INR' ? '₹' : '$'} />}
              error={!!errors.value} />
            {errors.value && <HelperText type="error">{errors.value}</HelperText>}

            <SegmentedButtons value={assetCurrency} onValueChange={setAssetCurrency}
              buttons={[{ value: 'INR', label: '₹ INR' }, { value: 'USD', label: '$ USD' }]}
              style={styles.segment} />

            <Text variant="labelMedium" style={styles.sliderLabel}>Expected Annual ROI: {expectedRoi}%</Text>
            <Slider
              value={expectedRoi}
              onValueChange={(v: number[]) => setExpectedRoi(Math.round(v[0]))}
              minimumValue={0} maximumValue={30} step={1}
              minimumTrackTintColor="#1B5E20"
              thumbTintColor="#1B5E20"
            />

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

                    <TextInput label="Next Vesting Date (YYYY-MM-DD)" value={nextVestingDate}
                      onChangeText={setNextVestingDate} mode="outlined" style={styles.input}
                      error={!!errors.vestingDate} />
                    {errors.vestingDate && <HelperText type="error">{errors.vestingDate}</HelperText>}
                  </>
                )}
              </View>
            )}

            {/* Gold/Silver Fields */}
            {selectedCategory === 'GOLD_SILVER' && (
              <View style={styles.extraFields}>
                <SegmentedButtons value={goldSilverUnit}
                  onValueChange={setGoldSilverUnit}
                  buttons={[{ value: 'VALUE', label: 'Enter Value' }, { value: 'GRAMS', label: 'Enter Grams' }]}
                  style={styles.segment} />
                {goldSilverUnit === 'GRAMS' && (
                  <TextInput label="Quantity (grams)" value={goldSilverQuantity}
                    onChangeText={setGoldSilverQuantity} mode="outlined" style={styles.input}
                    keyboardType="numeric" />
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
  netWorthValue: { color: '#FFFFFF', fontWeight: 'bold', marginTop: 4 },
  sectionTitle: { marginBottom: 12, fontWeight: '600' },
  chipRow: { marginBottom: 16, flexGrow: 0 },
  chip: { marginRight: 8, backgroundColor: '#E8F5E9' },
  chipText: { fontSize: 12 },
  emptyCard: { padding: 24, borderRadius: 12 },
  groupTitle: { marginTop: 16, marginBottom: 8, fontWeight: '700', color: '#1B5E20' },
  assetCard: { marginBottom: 8, borderRadius: 8, backgroundColor: '#FFFFFF' },
  assetRow: { flexDirection: 'row', alignItems: 'center' },
  modal: { backgroundColor: '#FFFFFF', margin: 16, padding: 20, borderRadius: 16, maxHeight: '85%' },
  modalTitle: { fontWeight: 'bold', marginBottom: 16, color: '#1B5E20' },
  input: { marginBottom: 8, backgroundColor: '#FFFFFF' },
  segment: { marginBottom: 12 },
  sliderLabel: { marginTop: 8, marginBottom: 4 },
  extraFields: { marginTop: 8 },
  toggleBtn: { marginBottom: 12 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  actionBtn: { flex: 1 },
});
