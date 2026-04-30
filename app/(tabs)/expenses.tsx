import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { Expense, Frequency, FrequencyInput, FREQUENCY_TO_MONTHS_PER_PAYMENT } from '@/engine/types';
import { formatCurrency, getCurrencySymbol, calculateFutureGoalsCorpus } from '@/engine/calculator';
import { BottomSheet } from '@/components/BottomSheet';
import { WEB_HEADER_OFFSET, WEB_BOTTOM_OFFSET, shadow, FAB_SIZE, FAB_RIGHT, FAB_BOTTOM_NATIVE, FAB_BOTTOM_WEB } from '@/constants/theme';
import { formatDateMask } from '@/components/DateInput';

const EXPENSE_TYPES = [
  { key: 'CURRENT_RECURRING', label: 'Current Recurring', desc: 'Ongoing lifestyle costs (salary-funded)' },
  { key: 'FUTURE_ONE_TIME', label: 'Future One-time', desc: 'A big purchase on a specific date' },
  { key: 'FUTURE_RECURRING', label: 'Future Recurring', desc: 'Future recurring cost (corpus-funded)' },
];

const FREQUENCY_OPTIONS: { key: Frequency; label: string }[] = [
  { key: 'MONTHLY', label: 'Monthly' },
  { key: 'QUARTERLY', label: 'Quarterly' },
  { key: 'ANNUALLY', label: 'Annually' },
];

const TYPE_ICONS: Record<string, string> = {
  CURRENT_RECURRING: 'repeat',
  FUTURE_ONE_TIME: 'calendar',
  FUTURE_RECURRING: 'refresh-cw',
};


interface ExpenseForm {
  name: string;
  category: string;
  expense_type: string;
  amount: string;
  frequency: Frequency;
  inflation_rate: string;
  start_date: string;
  end_date: string;
}

const EMPTY_FORM: ExpenseForm = {
  name: '',
  category: 'OTHERS',
  expense_type: 'CURRENT_RECURRING',
  amount: '',
  frequency: 'MONTHLY',
  inflation_rate: '6',
  start_date: '',
  end_date: '',
};

export default function ExpensesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { expenses, addExpense, deleteExpense, updateExpense, profile, assets } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseForm>(EMPTY_FORM);

  const currency = profile?.currency ?? 'INR';

  const webTop = Platform.OS === 'web' ? WEB_HEADER_OFFSET : 0;
  const webBottom = Platform.OS === 'web' ? WEB_BOTTOM_OFFSET : 0;

  const currentRecurring = expenses.filter(e => e.expense_type === 'CURRENT_RECURRING');
  const futureExpenses = expenses.filter(e => e.expense_type !== 'CURRENT_RECURRING');

  const { corpus: futureGoalsCorpus, discountRatePct } = calculateFutureGoalsCorpus(
    profile ?? { id: '', name: '', dob: '1990-01-01', currency: currency, monthly_income: 0 },
    expenses,
    assets,
  );

  const monthlyTotal = currentRecurring.reduce((s, e) => {
    const months = FREQUENCY_TO_MONTHS_PER_PAYMENT[(e.frequency ?? 'MONTHLY') as FrequencyInput] ?? 1;
    return s + e.amount / months;
  }, 0);

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(e: Expense) {
    setEditId(String(e.id));
    setForm({
      name: e.name,
      category: e.category,
      expense_type: e.expense_type,
      amount: String(e.amount),
      frequency: ((e.frequency as Frequency) ?? 'MONTHLY'),
      inflation_rate: String(e.inflation_rate),
      start_date: e.start_date ?? '',
      end_date: e.end_date ?? '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    const amount = parseFloat(form.amount);
    const inflation = parseFloat(form.inflation_rate);
    if (!form.name.trim() || isNaN(amount) || amount <= 0) {
      Alert.alert('Validation', 'Please enter a valid name and amount.');
      return;
    }
    const exp: Expense = {
      id: editId ?? '',
      name: form.name.trim(),
      category: form.category as any,
      expense_type: form.expense_type as any,
      amount,
      frequency: form.frequency,
      inflation_rate: isNaN(inflation) ? 6 : inflation,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
    };
    if (editId) updateExpense(exp);
    else {
      const ok = await addExpense(exp);
      if (!ok) {
        Alert.alert('Save failed', 'Could not save expense. Please try again.');
        return;
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowModal(false);
  }

  function handleDelete(id: string) {
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteExpense(id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } },
    ]);
  }

  function renderExpense(e: Expense) {
    const icon = TYPE_ICONS[e.expense_type] ?? 'dollar-sign';
    return (
      <View key={e.id} style={[styles.expCard, { backgroundColor: colors.card }]}>
        <View style={[styles.iconBox, { backgroundColor: colors.secondary }]}>
          <Feather name={icon as any} size={18} color={colors.primary} />
        </View>
        <View style={styles.expInfo}>
          <Text style={[styles.expName, { color: colors.foreground }]}>{e.name}</Text>
          <Text style={[styles.expMeta, { color: colors.mutedForeground }]}>
            {e.frequency ? `${e.frequency.charAt(0) + e.frequency.slice(1).toLowerCase()} · ` : ''}
            {e.inflation_rate}% inflation
            {e.start_date ? ` · from ${e.start_date.slice(0, 7)}` : ''}
          </Text>
        </View>
        <Text style={[styles.expAmount, { color: colors.foreground }]}>
          {formatCurrency(e.amount, currency)}
        </Text>
        <TouchableOpacity
          onPress={() => openEdit(e)}
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${e.name}`}
          hitSlop={8}
        >
          <Feather name="edit-2" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDelete(String(e.id))}
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${e.name}`}
          hitSlop={8}
        >
          <Feather name="trash-2" size={15} color={colors.destructive} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 16 + webTop, paddingBottom: 40 + webBottom + insets.bottom }]}>
        {/* Summary */}
        <View style={[styles.summaryCard, { backgroundColor: colors.warningLight }]}>
          <Text style={[styles.summaryLabel, { color: colors.warning }]}>MONTHLY EXPENSES</Text>
          <Text style={[styles.summaryValue, { color: colors.warning }]}>{formatCurrency(monthlyTotal, currency)}</Text>
          <Text style={[styles.summarySub, { color: colors.warning }]}>Current recurring lifestyle costs</Text>
        </View>

        {futureExpenses.length > 0 && (
          <View style={[styles.summaryCard, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.summaryLabel, { color: colors.success }]}>FUTURE GOALS CORPUS</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(futureGoalsCorpus, currency)}</Text>
            <Text style={[styles.summarySub, { color: colors.success }]}>
              Lump sum needed today at {discountRatePct}% portfolio return to fund all planned goals
            </Text>
          </View>
        )}

        {expenses.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="credit-card" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No expenses yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Track your spending to plan your FIRE journey</Text>
            <TouchableOpacity
              style={[styles.emptyCta, { backgroundColor: colors.warning }]}
              onPress={openAdd}
              accessibilityRole="button"
              accessibilityLabel="Add your first expense"
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.emptyCtaText}>Add your first expense</Text>
            </TouchableOpacity>
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
        style={[styles.fab, { backgroundColor: colors.warning, bottom: (Platform.OS === 'web' ? FAB_BOTTOM_WEB + webBottom : FAB_BOTTOM_NATIVE) + insets.bottom }]}
        onPress={openAdd}
        accessibilityRole="button"
        accessibilityLabel="Add new expense"
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      <BottomSheet visible={showModal} onClose={() => setShowModal(false)} backgroundColor={colors.card} bottomInset={tabBarHeight}>
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{editId ? 'Edit Expense' : 'Add Expense'}</Text>
          <TouchableOpacity
            onPress={() => setShowModal(false)}
            accessibilityRole="button"
            accessibilityLabel="Close expense form"
            hitSlop={10}
          >
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

              <Text style={styles.fieldLabel}>Type</Text>
              {EXPENSE_TYPES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeRow, { borderColor: form.expense_type === t.key ? colors.primary : colors.border, backgroundColor: form.expense_type === t.key ? colors.secondary : colors.background }]}
                  onPress={() => setForm(f => ({ ...f, expense_type: t.key }))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: form.expense_type === t.key }}
                  accessibilityLabel={`${t.label}: ${t.desc}`}
                >
                  <Text style={[styles.typeLabel, { color: form.expense_type === t.key ? colors.primary : colors.foreground }]}>{t.label}</Text>
                  <Text style={[styles.typeDesc, { color: colors.mutedForeground }]}>{t.desc}</Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={form.name}
                onChangeText={t => setForm(f => ({ ...f, name: t }))}
                placeholder="e.g., Rent"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="Expense name"
              />

              <Text style={styles.fieldLabel}>Amount ({getCurrencySymbol(currency)})</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={form.amount}
                onChangeText={t => setForm(f => ({ ...f, amount: t }))}
                keyboardType="numeric"
                placeholder="e.g., 30000"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="Expense amount"
              />

              {form.expense_type !== 'FUTURE_ONE_TIME' && (
                <>
                  <Text style={styles.fieldLabel}>Frequency</Text>
                  <View style={styles.freqRow}>
                    {FREQUENCY_OPTIONS.map(freq => (
                      <TouchableOpacity
                        key={freq.key}
                        style={[styles.freqChip, { backgroundColor: form.frequency === freq.key ? colors.primary : colors.secondary }]}
                        onPress={() => setForm(f => ({ ...f, frequency: freq.key }))}
                        accessibilityRole="button"
                        accessibilityState={{ selected: form.frequency === freq.key }}
                        accessibilityLabel={`Frequency: ${freq.label}`}
                      >
                        <Text style={[styles.freqText, { color: form.frequency === freq.key ? '#fff' : colors.foreground }]}>{freq.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.fieldLabel}>Inflation Rate (%)</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={form.inflation_rate}
                onChangeText={t => setForm(f => ({ ...f, inflation_rate: t }))}
                keyboardType="numeric"
                placeholder="e.g., 6"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="Annual inflation rate in percent"
              />

              {form.expense_type !== 'CURRENT_RECURRING' && (
                <>
                  <Text style={styles.fieldLabel}>Start Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                    value={form.start_date}
                    onChangeText={t => setForm(f => ({ ...f, start_date: formatDateMask(t) }))}
                    keyboardType="number-pad"
                    maxLength={10}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.mutedForeground}
                    accessibilityLabel="Start date in year month day format"
                  />
                </>
              )}

              {form.expense_type === 'FUTURE_RECURRING' && (
                <>
                  <Text style={styles.fieldLabel}>End Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                    value={form.end_date}
                    onChangeText={t => setForm(f => ({ ...f, end_date: formatDateMask(t) }))}
                    keyboardType="number-pad"
                    maxLength={10}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.mutedForeground}
                    accessibilityLabel="End date in year month day format"
                  />
                </>
              )}

              <View style={styles.formBtns}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={() => setShowModal(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.warning }]}
                  onPress={handleSave}
                  accessibilityRole="button"
                  accessibilityLabel={editId ? 'Save changes to expense' : 'Save new expense'}
                >
                  <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Save</Text>
                </TouchableOpacity>
              </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  summaryCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  summaryLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4, fontFamily: 'Inter_700Bold' },
  summaryValue: { fontSize: 28, fontWeight: '800', fontFamily: 'Inter_700Bold', marginBottom: 2 },
  summarySub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  emptyState: { alignItems: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  emptyText: { textAlign: 'center', lineHeight: 22, fontFamily: 'Inter_400Regular', fontSize: 14 },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22, marginTop: 8,
  },
  emptyCtaText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 4, fontFamily: 'Inter_700Bold' },
  expCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    padding: 14, marginBottom: 8, gap: 10,
    ...shadow(1),
  },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  expInfo: { flex: 1 },
  expName: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  expMeta: { fontSize: 11, marginTop: 2, fontFamily: 'Inter_400Regular' },
  expAmount: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  actionBtn: { padding: 6 },
  fab: {
    position: 'absolute', right: FAB_RIGHT, width: FAB_SIZE, height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2, justifyContent: 'center', alignItems: 'center',
    ...shadow(4),
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 4 },
  sheetTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 6, marginTop: 12, fontFamily: 'Inter_600SemiBold' },
  input: { borderWidth: 1.5, borderRadius: 10, padding: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  typeRow: { borderWidth: 1.5, borderRadius: 10, padding: 12, marginBottom: 8 },
  typeLabel: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  typeDesc: { fontSize: 12, marginTop: 2, fontFamily: 'Inter_400Regular' },
  freqRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  freqChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  freqText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  formBtns: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
});
