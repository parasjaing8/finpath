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
import { Expense, Goals, getExpenses, getGoals, createExpense, updateExpense, deleteExpense } from '../../db/queries';
import { EXPENSE_CATEGORIES, EXPENSE_TYPES, FREQUENCIES, DEFAULT_INFLATION_RATES } from '../../constants/categories';
import { formatCurrency, calculatePresentValueOfExpenses } from '../../engine/calculator';
import { Slider } from '@miblanchard/react-native-slider';
import { DateInput } from '../../components/DateInput';

const TYPE_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  CURRENT_RECURRING: 'repeat',
  FUTURE_ONE_TIME: 'calendar-outline',
  FUTURE_RECURRING: 'refresh',
};

export default function ExpensesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentProfile } = useProfile();

  const maxExpenseDate = currentProfile?.dob
    ? new Date(new Date(currentProfile.dob).getFullYear() + 101, 11, 31)
    : new Date(new Date().getFullYear() + 80, 11, 31);
  const minExpenseDate = new Date();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [postRetirementPV, setPostRetirementPV] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('OTHERS');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [expName, setExpName] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseType, setExpenseType] = useState('CURRENT_RECURRING');
  const [frequency, setFrequency] = useState('MONTHLY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [inflationRate, setInflationRate] = useState(6);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formScrollRef = React.useRef<ScrollView>(null);

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
    const futureExps = expList.filter(e => e.expense_type !== 'CURRENT_RECURRING');
    const postPV = calculatePresentValueOfExpenses(currentProfile, futureExps, 999, discountRate);
    const prePV = calculatePresentValueOfExpenses(currentProfile, futureExps, retirementAge, discountRate);
    setPostRetirementPV(Math.max(0, postPV - prePV));
    setLoading(false);
  }, [currentProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => { loadData(); }, [loadData]);

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

  function openAdd() {
    resetForm();
    setSelectedCategory('OTHERS');
    setInflationRate(DEFAULT_INFLATION_RATES['OTHERS'] ?? 6);
    if (currentProfile) {
      const retirementAge = goals?.retirement_age ?? 60;
      const retirementYear = new Date(currentProfile.dob).getFullYear() + retirementAge;
      setEndDate(`${retirementYear}-12-31`);
    }
    setShowModal(true);
  }

  function openEdit(exp: Expense) {
    resetForm();
    setSelectedCategory(exp.category);
    setEditingExpense(exp);
    setExpName(exp.name);
    setAmount(exp.amount.toString());
    setExpenseType(exp.expense_type);
    setFrequency(exp.frequency ?? 'MONTHLY');
    setStartDate(exp.start_date ?? '');
    setEndDate(exp.end_date ?? '');
    setInflationRate(exp.inflation_rate);
    setShowModal(true);
  }

  function handleCategoryChange(key: string) {
    setSelectedCategory(key);
    if (!editingExpense) setInflationRate(DEFAULT_INFLATION_RATES[key] ?? 6);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!expName.trim()) e.name = 'Name is required';
    if (!amount || parseFloat(amount) <= 0) e.amount = 'Enter a valid amount';
    if (expenseType !== 'CURRENT_RECURRING') {
      if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        e.startDate = 'Enter start date as YYYY-MM-DD';
      } else if (isNaN(new Date(startDate).getTime())) {
        e.startDate = 'Invalid date';
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
      setShowModal(false);
      resetForm();
      loadData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Could not save expense. Please try again.');
    }
  }

  async function handleDelete(id: number) {
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteExpense(id);
        loadData();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }},
    ]);
  }

  const currentRecurring = expenses.filter(e => e.expense_type === 'CURRENT_RECURRING');
  const futureExpenses = expenses.filter(e => e.expense_type !== 'CURRENT_RECURRING');

  const monthlyTotal = currentRecurring.reduce((s, e) => {
    const divMap: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, ANNUALLY: 12, YEARLY: 12 };
    return s + e.amount / (divMap[e.frequency ?? 'MONTHLY'] ?? 1);
  }, 0);

  const currency = currentProfile?.currency ?? 'INR';

  if (!currentProfile) {
    return <View style={styles.center}><Text style={{ color: '#666' }}>No profile selected</Text></View>;
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;
  }

  function renderExpense(exp: Expense) {
    const catInfo = EXPENSE_CATEGORIES.find(c => c.key === exp.category);
    const icon = TYPE_ICONS[exp.expense_type] ?? 'currency-usd';
    return (
      <View key={exp.id} style={[styles.expCard, { backgroundColor: colors.card }]}>
        <View style={[styles.iconBox, { backgroundColor: colors.secondary }]}>
          <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
        </View>
        <View style={styles.expInfo}>
          <Text style={[styles.expName, { color: colors.foreground }]}>{exp.name}</Text>
          <Text style={[styles.expMeta, { color: colors.mutedForeground }]}>
            {catInfo?.label ?? exp.category}
            {exp.frequency ? ` \u00b7 ${exp.frequency.charAt(0) + exp.frequency.slice(1).toLowerCase()}` : ''}
            {` \u00b7 ${exp.inflation_rate}% infl.`}
            {exp.start_date ? ` \u00b7 from ${exp.start_date.slice(0, 7)}` : ''}
          </Text>
        </View>
        <Text style={[styles.expAmount, { color: colors.foreground }]}>
          {formatCurrency(exp.amount, currency)}
        </Text>
        <TouchableOpacity onPress={() => openEdit(exp)} style={styles.actionBtn}>
          <Feather name="edit-2" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(exp.id)} style={styles.actionBtn}>
          <Feather name="trash-2" size={15} color={colors.destructive} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        <View style={[styles.summaryCard, { backgroundColor: colors.warningLight }]}>
          <Text style={[styles.summaryLabel, { color: colors.warning }]}>MONTHLY EXPENSES</Text>
          <Text style={[styles.summaryValue, { color: colors.warning }]}>{formatCurrency(monthlyTotal, currency)}</Text>
          <Text style={[styles.summarySub, { color: colors.warning }]}>Current recurring lifestyle costs</Text>
        </View>
        {postRetirementPV > 0 && (
          <View style={[styles.summaryCard, { backgroundColor: colors.secondary, marginTop: -4 }]}>
            <Text style={[styles.summaryLabel, { color: colors.primary }]}>POST-RETIREMENT SPENDS</Text>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>{formatCurrency(postRetirementPV, currency)}</Text>
            <Text style={[styles.summarySub, { color: colors.primary }]}>Corpus-funded future expenses</Text>
          </View>
        )}

        {expenses.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="credit-card" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No expenses yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Tap + to track your spending</Text>
          </View>
        )}

        {currentRecurring.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>CURRENT RECURRING</Text>
            {currentRecurring.map(renderExpense)}
          </>
        )}

        {futureExpenses.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>FUTURE EXPENSES</Text>
            {futureExpenses.map(renderExpense)}
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.warning, bottom: 80 + insets.bottom }]}
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
        <View style={styles.overlay}>
          <ScrollView ref={formScrollRef} keyboardShouldPersistTaps="handled">
            <View style={[styles.sheet, { backgroundColor: colors.card }]}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                  {editingExpense ? 'Edit Expense' : 'Add Expense'}
                </Text>
                <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                  <Feather name="x" size={22} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { color: '#666' }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                {EXPENSE_CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.catChip, {
                      backgroundColor: selectedCategory === c.key ? colors.warning : colors.secondary,
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

              <Text style={[styles.fieldLabel, { color: '#666' }]}>Type</Text>
              {EXPENSE_TYPES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeRow, {
                    borderColor: expenseType === t.key ? colors.warning : colors.border,
                    backgroundColor: expenseType === t.key ? colors.secondary : colors.background,
                  }]}
                  onPress={() => setExpenseType(t.key)}
                >
                  <Text style={[styles.typeLabel, { color: expenseType === t.key ? colors.warning : colors.foreground }]}>{t.label}</Text>
                  <Text style={[styles.typeDesc, { color: colors.mutedForeground }]}>{t.hint}</Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.fieldLabel, { color: '#666' }]}>Name</Text>
              <TextInput
                style={[styles.input, {
                  borderColor: errors.name ? colors.destructive : colors.border,
                  color: colors.foreground,
                  backgroundColor: colors.background,
                }]}
                value={expName}
                onChangeText={setExpName}
                placeholder="e.g., Rent"
                placeholderTextColor={colors.mutedForeground}
              />
              {errors.name ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.name}</Text> : null}

              <Text style={[styles.fieldLabel, { color: '#666' }]}>
                Amount ({currency === 'INR' ? '\u20b9' : '$'})
              </Text>
              <TextInput
                style={[styles.input, {
                  borderColor: errors.amount ? colors.destructive : colors.border,
                  color: colors.foreground,
                  backgroundColor: colors.background,
                }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="e.g., 30000"
                placeholderTextColor={colors.mutedForeground}
              />
              {errors.amount ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.amount}</Text> : null}

              {expenseType !== 'FUTURE_ONE_TIME' && (
                <>
                  <Text style={[styles.fieldLabel, { color: '#666' }]}>Frequency</Text>
                  <View style={styles.freqRow}>
                    {FREQUENCIES.map(f => (
                      <TouchableOpacity
                        key={f.key}
                        style={[styles.freqChip, { backgroundColor: frequency === f.key ? colors.warning : colors.secondary }]}
                        onPress={() => setFrequency(f.key)}
                      >
                        <Text style={[styles.freqText, { color: frequency === f.key ? '#fff' : colors.foreground }]}>{f.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {expenseType !== 'CURRENT_RECURRING' && (
                <>
                  <DateInput
                    label="Start Date"
                    value={startDate}
                    onChangeText={setStartDate}
                    style={styles.dateInput}
                    error={!!errors.startDate}
                    minimumDate={minExpenseDate}
                    maximumDate={maxExpenseDate}
                    onFocus={() => formScrollRef.current?.scrollToEnd({ animated: true })}
                  />
                  {errors.startDate ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.startDate}</Text> : null}
                </>
              )}

              {expenseType !== 'FUTURE_ONE_TIME' && (
                <DateInput
                  label="End Date (optional)"
                  value={endDate}
                  onChangeText={setEndDate}
                  style={styles.dateInput}
                  minimumDate={minExpenseDate}
                  maximumDate={maxExpenseDate}
                  onFocus={() => formScrollRef.current?.scrollToEnd({ animated: true })}
                />
              )}

              <Text style={[styles.fieldLabel, { color: '#666', marginTop: 16 }]}>
                Inflation Rate: {inflationRate}%
              </Text>
              <Slider
                value={inflationRate}
                onValueChange={(v: number[]) => setInflationRate(Math.round(v[0]))}
                minimumValue={0}
                maximumValue={15}
                step={1}
                minimumTrackTintColor={colors.warning}
                thumbTintColor={colors.warning}
              />

              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={() => { setShowModal(false); resetForm(); }}
                >
                  <Text style={{ color: colors.mutedForeground, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.warning }]}
                  onPress={handleSave}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>{editingExpense ? 'Update' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  summaryCard: { borderRadius: 16, padding: 20, marginBottom: 12 },
  summaryLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  summaryValue: { fontSize: 28, fontWeight: '800', marginBottom: 2 },
  summarySub: { fontSize: 12 },
  emptyState: { alignItems: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyText: { textAlign: 'center', lineHeight: 22, fontSize: 14 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  expCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    padding: 14, marginBottom: 8, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  expInfo: { flex: 1 },
  expName: { fontSize: 14, fontWeight: '600' },
  expMeta: { fontSize: 11, marginTop: 2 },
  expAmount: { fontSize: 13, fontWeight: '700' },
  actionBtn: { padding: 6 },
  fab: {
    position: 'absolute', right: 20, width: 56, height: 56,
    borderRadius: 28, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { marginTop: 80, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: '100%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderRadius: 10, padding: 12, fontSize: 15 },
  errorText: { fontSize: 11, marginTop: 4 },
  dateInput: { marginTop: 0 },
  typeRow: { borderWidth: 1.5, borderRadius: 10, padding: 12, marginBottom: 8 },
  typeLabel: { fontSize: 14, fontWeight: '600' },
  typeDesc: { fontSize: 12, marginTop: 2 },
  catScroll: { marginBottom: 4 },
  catChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1 },
  catChipText: { fontSize: 13, fontWeight: '500' },
  freqRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  freqChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  freqText: { fontSize: 13, fontWeight: '500' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 32 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
});
