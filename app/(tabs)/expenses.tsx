import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, Keyboard, ActivityIndicator, RefreshControl } from 'react-native';
import { Text, Card, Chip, Portal, Modal, TextInput, Button, SegmentedButtons, IconButton, Icon, HelperText, RadioButton, TouchableRipple } from 'react-native-paper';
import { useProfile } from '../../hooks/useProfile';
import { Expense, Goals, getExpenses, getGoals, createExpense, updateExpense, deleteExpense } from '../../db/queries';
import { EXPENSE_CATEGORIES, EXPENSE_TYPES, FREQUENCIES, DEFAULT_INFLATION_RATES } from '../../constants/categories';
import { formatCurrency, calculatePresentValueOfExpenses } from '../../engine/calculator';
import { Slider } from '@miblanchard/react-native-slider';
import { DateInput } from '../../components/DateInput';

export default function ExpensesScreen() {
  const { currentProfile } = useProfile();
  // Max date for expense pickers: user's 101st birthday (DOB year + 101, Dec 31)
  const maxExpenseDate = currentProfile?.dob
    ? new Date(new Date(currentProfile.dob).getFullYear() + 101, 11, 31)
    : new Date(new Date().getFullYear() + 80, 11, 31);
  const minExpenseDate = new Date();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [presentValue, setPresentValue] = useState(0);
  const [postRetirementPV, setPostRetirementPV] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const chipScrollRef = useRef<ScrollView>(null);
  const chipScrollX = useRef(0);

  // Form fields
  const [expName, setExpName] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseType, setExpenseType] = useState('CURRENT_RECURRING');
  const [frequency, setFrequency] = useState('MONTHLY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [inflationRate, setInflationRate] = useState(6);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const formScrollRef = useRef<ScrollView>(null);

  const loadData = useCallback(async () => {
    if (!currentProfile) return;
    const [expList, goalsData] = await Promise.all([
      getExpenses(currentProfile.id),
      getGoals(currentProfile.id),
    ]);
    setExpenses(expList);
    setGoals(goalsData);
    const retirementAge = goalsData?.retirement_age ?? 60;
    const discountRate = (goalsData?.inflation_rate ?? 6) / 100;
    // PV of future expenses that fall post-retirement (corpus-funded)
    const futureExps = expList.filter(e => e.expense_type !== 'CURRENT_RECURRING');
    setPresentValue(calculatePresentValueOfExpenses(currentProfile, expList, retirementAge, discountRate));
    const postPV = calculatePresentValueOfExpenses(currentProfile, futureExps, 999, discountRate);
    const prePV  = calculatePresentValueOfExpenses(currentProfile, futureExps, retirementAge, discountRate);
    setPostRetirementPV(Math.max(0, postPV - prePV));
    setLoading(false);
  }, [currentProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardOffset(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardOffset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  function resetForm() {
    setExpName('');
    setAmount('');
    setExpenseType('CURRENT_RECURRING');
    setFrequency('MONTHLY');
    setStartDate('');
    setEndDate('');
    setInflationRate(6);
    setErrors({});
    setEditingExpense(null);
  }

  function openForm(category: string, expense?: Expense) {
    resetForm();
    setSelectedCategory(category);
    setInflationRate(DEFAULT_INFLATION_RATES[category] ?? 6);
    if (expense) {
      setEditingExpense(expense);
      setExpName(expense.name);
      setAmount(expense.amount.toString());
      setExpenseType(expense.expense_type);
      setFrequency(expense.frequency ?? 'MONTHLY');
      setStartDate(expense.start_date ?? '');
      setEndDate(expense.end_date ?? '');
      setInflationRate(expense.inflation_rate);
    } else {
      // Default end date for new recurring expenses to user's retirement year
      if (currentProfile) {
        const retirementAge = goals?.retirement_age ?? 60;
        const birthYear = new Date(currentProfile.dob).getFullYear();
        const retirementYear = birthYear + retirementAge;
        setEndDate(`${retirementYear}-12-31`);
      }
    }
    setShowForm(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!expName.trim()) e.name = 'Name is required';
    if (!amount || parseFloat(amount) <= 0) e.amount = 'Enter a valid amount';
    if (expenseType !== 'CURRENT_RECURRING') {
      if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        e.startDate = 'Enter start date as YYYY-MM-DD';
      } else if (isNaN(new Date(startDate).getTime())) {
        e.startDate = 'Invalid date (e.g. 2024-13-45 is not valid)';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!currentProfile || !validate()) return;
    const data: Omit<Expense, 'id'> = {
      profile_id: currentProfile.id,
      name: expName.trim(),
      category: selectedCategory,
      amount: parseFloat(amount),
      currency: currentProfile.currency,
      expense_type: expenseType,
      frequency: expenseType !== 'FUTURE_ONE_TIME' ? frequency : null,
      start_date: expenseType !== 'CURRENT_RECURRING' ? startDate || null : null,
      end_date: endDate || null,
      inflation_rate: inflationRate,
    };

    try {
      if (editingExpense) {
        await updateExpense({ ...data, id: editingExpense.id });
      } else {
        await createExpense(data);
      }
      setShowForm(false);
      resetForm();
      loadData();
    } catch (err) {
      if (__DEV__) console.error('Failed to save expense:', err);
      Alert.alert('Error', 'Could not save expense. Please try again.');
    }
  }

  async function handleDelete(id: number) {
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteExpense(id); loadData(); } },
    ]);
  }

  const groupedExpenses: Record<string, Expense[]> = {};
  for (const e of expenses) {
    const key = e.expense_type;
    if (!groupedExpenses[key]) groupedExpenses[key] = [];
    groupedExpenses[key].push(e);
  }

  const catLabel = EXPENSE_CATEGORIES.find(c => c.key === selectedCategory)?.label ?? selectedCategory;

  // Pre-compute per-category counts in a single pass instead of O(10N) inline filters (#20)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of expenses) {
      counts[e.category] = (counts[e.category] ?? 0) + 1;
    }
    return counts;
  }, [expenses]);

  if (!currentProfile) {
    return <View style={styles.center}><Text>No profile selected</Text></View>;
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1B5E20']} />}
      >
        {/* PV Banner */}
        <Card style={styles.pvCard}>
          <Card.Content>
            <Text variant="labelMedium" style={{ color: '#FFFFFF99' }}>Pre-Retirement Expenses (Today's Value)</Text>
            <Text variant="headlineMedium" style={styles.pvValue}>
              {formatCurrency(presentValue, currentProfile.currency)}
            </Text>
            <Text variant="bodySmall" style={{ color: '#FFFFFFBB' }}>
              What your salary must cover before retirement.
            </Text>
            {postRetirementPV > 0 && (
              <>
                <Text variant="labelMedium" style={{ color: '#FFFFFF99', marginTop: 12 }}>Post-Retirement Planned Spends</Text>
                <Text variant="titleLarge" style={[styles.pvValue, { fontSize: 22 }]}>
                  {formatCurrency(postRetirementPV, currentProfile.currency)}
                </Text>
                <Text variant="bodySmall" style={{ color: '#FFFFFFBB' }}>
                  One-time or recurring expenses after retirement (corpus-funded).
                </Text>
              </>
            )}
          </Card.Content>
        </Card>

        {/* Category Tiles */}
        <Text variant="titleMedium" style={styles.sectionTitle}>Add Expenses by Category</Text>
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
            {EXPENSE_CATEGORIES.map(cat => {
              const count = categoryCounts[cat.key] ?? 0;
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

        {/* Expense List */}
        {expenses.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Text variant="bodyLarge" style={{ color: '#999', textAlign: 'center' }}>
                No expenses added yet.{'\n'}Tap a category above to add your first expense.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          Object.entries(groupedExpenses).map(([type, typeExpenses]) => {
            const typeInfo = EXPENSE_TYPES.find(t => t.key === type);
            return (
              <View key={type}>
                <Text variant="titleSmall" style={styles.groupTitle}>{typeInfo?.label ?? type}</Text>
                {typeExpenses.map(exp => (
                  <Card key={exp.id} style={styles.expCard} onPress={() => openForm(exp.category, exp)}>
                    <Card.Content style={styles.expRow}>
                      <Icon
                        source={EXPENSE_CATEGORIES.find(c => c.key === exp.category)?.icon ?? 'dots-horizontal-circle-outline'}
                        size={20}
                        color="#777"
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
                          {exp.name}
                        </Text>
                        <Text variant="bodySmall" style={{ color: '#666' }}>
                          {EXPENSE_CATEGORIES.find(c => c.key === exp.category)?.label} • {exp.inflation_rate}% inflation
                          {exp.frequency ? ` • ${exp.frequency}` : ''}
                        </Text>
                      </View>
                      <Text variant="bodyLarge" style={{ fontWeight: '700', color: '#C62828' }}>
                        -{formatCurrency(exp.amount, currentProfile.currency)}
                      </Text>
                    </Card.Content>
                  </Card>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add/Edit Expense Modal */}
      <Portal>
        <Modal visible={showForm} onDismiss={() => { setShowForm(false); resetForm(); }}
          contentContainerStyle={[
            styles.modal,
            keyboardOffset > 0 && { transform: [{ translateY: -Math.min(keyboardOffset * 0.32, 180) }] },
          ]}>
            <ScrollView ref={formScrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text variant="titleLarge" style={styles.modalTitle}>
                {editingExpense ? 'Edit' : 'Add'} {catLabel}
              </Text>

              <TextInput label="Expense Name" value={expName} onChangeText={setExpName}
                mode="outlined" style={styles.input} error={!!errors.name}
                placeholder="e.g. Child 1 School Fees" />
              {errors.name && <HelperText type="error">{errors.name}</HelperText>}

              <TextInput label="Amount (today's value)" value={amount} onChangeText={setAmount}
                mode="outlined" style={styles.input} keyboardType="numeric"
                left={<TextInput.Affix text={currentProfile.currency === 'INR' ? '₹' : '$'} />}
                error={!!errors.amount} />
              {errors.amount && <HelperText type="error">{errors.amount}</HelperText>}

              <Text variant="labelMedium" style={styles.fieldLabel}>Expense Type</Text>
              <RadioButton.Group value={expenseType} onValueChange={setExpenseType}>
                {EXPENSE_TYPES.map(t => (
                  <TouchableRipple key={t.key} onPress={() => setExpenseType(t.key)} style={styles.radioRow}>
                    <View style={styles.radioItem}>
                      <RadioButton value={t.key} color="#37474F" />
                      <Text variant="bodySmall" style={styles.radioLabel}>{t.label}</Text>
                    </View>
                  </TouchableRipple>
                ))}
              </RadioButton.Group>
              <Text variant="bodySmall" style={styles.typeHint}>
                {EXPENSE_TYPES.find(t => t.key === expenseType)?.hint}
              </Text>

              {expenseType !== 'FUTURE_ONE_TIME' && (
                <>
                  <Text variant="labelMedium" style={styles.fieldLabel}>Frequency</Text>
                  <SegmentedButtons value={frequency} onValueChange={setFrequency}
                    buttons={FREQUENCIES.map(f => ({ value: f.key, label: f.label }))}
                    style={styles.segment} />
                </>
              )}

              {expenseType !== 'CURRENT_RECURRING' && (
                <>
                  <DateInput label="Start Date" value={startDate} onChangeText={setStartDate}
                    style={styles.input} error={!!errors.startDate}
                    minimumDate={minExpenseDate}
                    maximumDate={maxExpenseDate}
                    onFocus={() => formScrollRef.current?.scrollToEnd({ animated: true })} />
                  {errors.startDate && <HelperText type="error">{errors.startDate}</HelperText>}
                </>
              )}

              {expenseType !== 'FUTURE_ONE_TIME' && (
                <DateInput label="End Date (optional)" value={endDate} onChangeText={setEndDate}
                  style={styles.input}
                  minimumDate={minExpenseDate}
                  maximumDate={maxExpenseDate}
                  onFocus={() => formScrollRef.current?.scrollToEnd({ animated: true })} />
              )}

              <Text variant="labelMedium" style={styles.sliderLabel}>
                Inflation Rate: {inflationRate}%
              </Text>
              <Slider
                value={inflationRate}
                onValueChange={(v: number[]) => setInflationRate(Math.round(v[0]))}
                minimumValue={0} maximumValue={15} step={1}
                minimumTrackTintColor="#1B5E20" thumbTintColor="#1B5E20"
              />

              <View style={styles.formActions}>
                {editingExpense && (
                  <Button mode="outlined"
                    onPress={() => { setShowForm(false); resetForm(); handleDelete(editingExpense.id); }}
                    style={[styles.actionBtn, { borderColor: '#C62828' }]}
                    textColor="#C62828">Delete</Button>
                )}
                <Button mode="outlined" onPress={() => { setShowForm(false); resetForm(); }}
                  style={styles.actionBtn}>Cancel</Button>
                <Button mode="contained" onPress={handleSave} style={styles.actionBtn}>
                  {editingExpense ? 'Update' : 'Save'}
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
  emptyContent: { justifyContent: 'center', alignItems: 'center', paddingVertical: 32 },
  pvCard: { backgroundColor: '#B71C1C', marginBottom: 16, borderRadius: 12 },
  pvValue: { color: '#FFFFFF', fontWeight: 'bold', marginTop: 4 },
  sectionTitle: { marginBottom: 12, fontWeight: '600' },
  chipRowWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  chipArrow: { margin: 0, padding: 0 },
  chipRow: { flexGrow: 1, flexShrink: 1 },
  chip: { marginRight: 8, backgroundColor: '#ECEFF1' },
  chipText: { fontSize: 12 },
  emptyCard: { padding: 24, borderRadius: 12 },
  groupTitle: { marginTop: 16, marginBottom: 8, fontWeight: '700', color: '#37474F' },
  expCard: { marginBottom: 8, borderRadius: 8, backgroundColor: '#FFFFFF' },
  expRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  modal: { backgroundColor: '#FFFFFF', margin: 16, padding: 20, borderRadius: 16, maxHeight: '85%' },
  modalTitle: { fontWeight: 'bold', marginBottom: 16, color: '#37474F' },
  input: { marginBottom: 8, backgroundColor: '#FFFFFF' },
  segment: { marginBottom: 12 },
  fieldLabel: { marginBottom: 8, marginTop: 4 },
  sliderLabel: { marginTop: 8, marginBottom: 4 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  actionBtn: { flex: 1 },
  radioRow: { marginVertical: 2, borderRadius: 12, backgroundColor: '#FAFAFA' },
  radioItem: { flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  radioLabel: { fontSize: 12, color: '#333', flexShrink: 1 },
  typeHint: { color: '#666', fontSize: 11, marginTop: 4, marginBottom: 8, lineHeight: 16, fontStyle: 'italic' },
});
