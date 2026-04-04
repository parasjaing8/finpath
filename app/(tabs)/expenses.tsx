import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Chip, Portal, Modal, TextInput, Button, SegmentedButtons, IconButton, HelperText, Switch } from 'react-native-paper';
import { useProfile } from '../../hooks/useProfile';
import { Expense, getExpenses, createExpense, updateExpense, deleteExpense, getAssets } from '../../db/queries';
import { EXPENSE_CATEGORIES, EXPENSE_TYPES, FREQUENCIES, DEFAULT_INFLATION_RATES } from '../../constants/categories';
import { formatCurrency, calculateProjections } from '../../engine/calculator';
import { getGoals } from '../../db/queries';
import { Slider } from '@miblanchard/react-native-slider';
import { DateInput } from '../../components/DateInput';

export default function ExpensesScreen() {
  const { currentProfile } = useProfile();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [presentValue, setPresentValue] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form fields
  const [expName, setExpName] = useState('');
  const [amount, setAmount] = useState('');
  const [expCurrency, setExpCurrency] = useState('INR');
  const [expenseType, setExpenseType] = useState('CURRENT_RECURRING');
  const [frequency, setFrequency] = useState('MONTHLY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [inflationRate, setInflationRate] = useState(6);
  const [isIncome, setIsIncome] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    if (!currentProfile) return;
    const expList = await getExpenses(currentProfile.id);
    setExpenses(expList);

    // Calculate PV of all expenses
    const assets = await getAssets(currentProfile.id);
    const goals = await getGoals(currentProfile.id);
    if (goals && expList.length > 0) {
      const result = calculateProjections({
        profile: currentProfile,
        assets,
        expenses: expList,
        goals,
        sipAmount: 0,
        sipReturnRate: 12,
        postSipReturnRate: 10,
        stepUpRate: 0,
      });
      setPresentValue(result.presentValueOfExpenses);
    }
  }, [currentProfile]);

  useEffect(() => { loadData(); }, [loadData]);

  function resetForm() {
    setExpName('');
    setAmount('');
    setExpCurrency(currentProfile?.currency ?? 'INR');
    setExpenseType('CURRENT_RECURRING');
    setFrequency('MONTHLY');
    setStartDate('');
    setEndDate('');
    setInflationRate(6);
    setIsIncome(false);
    setErrors({});
    setEditingExpense(null);
  }

  function openForm(category: string, expense?: Expense) {
    resetForm();
    setSelectedCategory(category);
    setInflationRate(DEFAULT_INFLATION_RATES[category] ?? 6);
    if (category === 'PENSION_INCOME') setIsIncome(true);
    if (expense) {
      setEditingExpense(expense);
      setExpName(expense.name);
      setAmount(expense.amount.toString());
      setExpCurrency(expense.currency);
      setExpenseType(expense.expense_type);
      setFrequency(expense.frequency ?? 'MONTHLY');
      setStartDate(expense.start_date ?? '');
      setEndDate(expense.end_date ?? '');
      setInflationRate(expense.inflation_rate);
      setIsIncome(!!expense.is_income);
    }
    setShowForm(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!expName.trim()) e.name = 'Name is required';
    if (!amount || parseFloat(amount) <= 0) e.amount = 'Enter a valid amount';
    if (expenseType !== 'CURRENT_RECURRING' && !startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      e.startDate = 'Enter start date as YYYY-MM-DD';
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
      currency: expCurrency,
      expense_type: expenseType,
      frequency: expenseType !== 'FUTURE_ONE_TIME' ? frequency : null,
      start_date: expenseType !== 'CURRENT_RECURRING' ? startDate || null : null,
      end_date: endDate || null,
      inflation_rate: inflationRate,
      is_income: isIncome ? 1 : 0,
    };

    if (editingExpense) {
      await updateExpense({ ...data, id: editingExpense.id });
    } else {
      await createExpense(data);
    }
    setShowForm(false);
    resetForm();
    loadData();
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

  if (!currentProfile) {
    return <View style={styles.center}><Text>No profile selected</Text></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* PV Banner */}
        <Card style={styles.pvCard}>
          <Card.Content>
            <Text variant="labelMedium" style={{ color: '#FFFFFF99' }}>Present Value of All Lifetime Expenses</Text>
            <Text variant="headlineMedium" style={styles.pvValue}>
              {formatCurrency(presentValue, currentProfile.currency)}
            </Text>
            <Text variant="bodySmall" style={{ color: '#FFFFFFBB' }}>
              If you have this amount today, you are financially free.
            </Text>
          </Card.Content>
        </Card>

        {/* Category Tiles */}
        <Text variant="titleMedium" style={styles.sectionTitle}>Add Expenses by Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {EXPENSE_CATEGORIES.map(cat => {
            const count = expenses.filter(e => e.category === cat.key).length;
            return (
              <Chip key={cat.key} icon={cat.icon} onPress={() => openForm(cat.key)}
                style={styles.chip} textStyle={styles.chipText}>
                {cat.label}{count > 0 ? ` (${count})` : ''}
              </Chip>
            );
          })}
        </ScrollView>

        {/* Expense List */}
        {expenses.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.center}>
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
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
                          {exp.is_income ? '📈 ' : ''}{exp.name}
                        </Text>
                        <Text variant="bodySmall" style={{ color: '#666' }}>
                          {EXPENSE_CATEGORIES.find(c => c.key === exp.category)?.label} • {exp.inflation_rate}% inflation
                          {exp.frequency ? ` • ${exp.frequency}` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text variant="bodyLarge" style={{ fontWeight: '700', color: exp.is_income ? '#1B5E20' : '#C62828' }}>
                          {exp.is_income ? '+' : '-'}{formatCurrency(exp.amount, exp.currency)}
                        </Text>
                        <IconButton icon="delete-outline" size={18} onPress={() => handleDelete(exp.id)} />
                      </View>
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
          contentContainerStyle={styles.modal}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text variant="titleLarge" style={styles.modalTitle}>
              {editingExpense ? 'Edit' : 'Add'} {catLabel}
            </Text>

            <TextInput label="Expense Name" value={expName} onChangeText={setExpName}
              mode="outlined" style={styles.input} error={!!errors.name}
              placeholder="e.g. Child 1 School Fees" />
            {errors.name && <HelperText type="error">{errors.name}</HelperText>}

            <TextInput label="Amount (today's value)" value={amount} onChangeText={setAmount}
              mode="outlined" style={styles.input} keyboardType="numeric"
              left={<TextInput.Affix text={expCurrency === 'INR' ? '₹' : '$'} />}
              error={!!errors.amount} />
            {errors.amount && <HelperText type="error">{errors.amount}</HelperText>}

            <SegmentedButtons value={expCurrency} onValueChange={setExpCurrency}
              buttons={[{ value: 'INR', label: '₹ INR' }, { value: 'USD', label: '$ USD' }]}
              style={styles.segment} />

            <Text variant="labelMedium" style={styles.fieldLabel}>Expense Type</Text>
            <SegmentedButtons value={expenseType} onValueChange={setExpenseType}
              buttons={EXPENSE_TYPES.map(t => ({ value: t.key, label: t.label }))}
              style={styles.segment} />

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
                  style={styles.input} error={!!errors.startDate} />
                {errors.startDate && <HelperText type="error">{errors.startDate}</HelperText>}
              </>
            )}

            {expenseType !== 'FUTURE_ONE_TIME' && (
              <DateInput label="End Date (optional)" value={endDate} onChangeText={setEndDate}
                style={styles.input} />
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

            <View style={styles.switchRow}>
              <Text variant="bodyMedium">This is an income stream (pension, rental, etc.)</Text>
              <Switch value={isIncome} onValueChange={setIsIncome} color="#1B5E20" />
            </View>

            <View style={styles.formActions}>
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
  pvCard: { backgroundColor: '#B71C1C', marginBottom: 16, borderRadius: 12 },
  pvValue: { color: '#FFFFFF', fontWeight: 'bold', marginTop: 4 },
  sectionTitle: { marginBottom: 12, fontWeight: '600' },
  chipRow: { marginBottom: 16, flexGrow: 0 },
  chip: { marginRight: 8, backgroundColor: '#FFEBEE' },
  chipText: { fontSize: 12 },
  emptyCard: { padding: 24, borderRadius: 12 },
  groupTitle: { marginTop: 16, marginBottom: 8, fontWeight: '700', color: '#B71C1C' },
  expCard: { marginBottom: 8, borderRadius: 8, backgroundColor: '#FFFFFF' },
  expRow: { flexDirection: 'row', alignItems: 'center' },
  modal: { backgroundColor: '#FFFFFF', margin: 16, padding: 20, borderRadius: 16, maxHeight: '85%' },
  modalTitle: { fontWeight: 'bold', marginBottom: 16, color: '#B71C1C' },
  input: { marginBottom: 8, backgroundColor: '#FFFFFF' },
  segment: { marginBottom: 12 },
  fieldLabel: { marginBottom: 8, marginTop: 4 },
  sliderLabel: { marginTop: 8, marginBottom: 4 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12, paddingHorizontal: 4 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  actionBtn: { flex: 1 },
});
