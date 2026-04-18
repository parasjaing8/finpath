import React, { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { TextInput, Text, Button } from 'react-native-paper';

interface DateInputProps {
  label: string;
  value: string; // YYYY-MM-DD
  onChangeText: (val: string) => void;
  style?: object;
  error?: boolean;
  maximumDate?: Date;
  minimumDate?: Date;
  onFocus?: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseDate(value: string): { year: number; month: number; day: number } {
  const parts = value.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    return { year: parts[0], month: parts[1], day: parts[2] };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function DateInput({ label, value, onChangeText, style, error, maximumDate, minimumDate, onFocus }: DateInputProps) {
  const [show, setShow] = useState(false);
  const parsed = parseDate(value);
  const [year, setYear] = useState(parsed.year);
  const [month, setMonth] = useState(parsed.month);
  const [day, setDay] = useState(parsed.day);

  const maxYear = maximumDate ? maximumDate.getFullYear() : new Date().getFullYear();
  const minYear = minimumDate ? minimumDate.getFullYear() : 1920;
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);
  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);

  function openPicker() {
    const p = parseDate(value);
    setYear(p.year);
    setMonth(p.month);
    setDay(p.day);
    onFocus?.();
    setShow(true);
  }

  function confirmDate() {
    const safeDay = Math.min(day, daysInMonth(year, month));
    onChangeText(`${year}-${pad(month)}-${pad(safeDay)}`);
    setShow(false);
  }

  return (
    <>
      <TextInput
        label={label}
        value={value}
        onChangeText={onChangeText}
        mode="outlined"
        style={style}
        error={error}
        showSoftInputOnFocus={false}
        onPressIn={openPicker}
        placeholder="YYYY-MM-DD"
        right={<TextInput.Icon icon="calendar" onPress={openPicker} />}
      />

      <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text variant="titleMedium" style={styles.title}>{label}</Text>

            <View style={styles.columns}>
              {/* Day */}
              <View style={styles.col}>
                <Text variant="labelSmall" style={styles.colLabel}>Day</Text>
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                  {days.map(d => (
                    <TouchableOpacity key={d} style={[styles.item, d === day && styles.itemSelected]} onPress={() => setDay(d)}>
                      <Text style={[styles.itemText, d === day && styles.itemTextSelected]}>{pad(d)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Month */}
              <View style={styles.col}>
                <Text variant="labelSmall" style={styles.colLabel}>Month</Text>
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                  {MONTHS.map((m, i) => (
                    <TouchableOpacity key={i} style={[styles.item, (i + 1) === month && styles.itemSelected]} onPress={() => setMonth(i + 1)}>
                      <Text style={[styles.itemText, (i + 1) === month && styles.itemTextSelected]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Year */}
              <View style={styles.col}>
                <Text variant="labelSmall" style={styles.colLabel}>Year</Text>
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                  {years.map(y => (
                    <TouchableOpacity key={y} style={[styles.item, y === year && styles.itemSelected]} onPress={() => setYear(y)}>
                      <Text style={[styles.itemText, y === year && styles.itemTextSelected]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.actions}>
              <Button onPress={() => setShow(false)} textColor="#666">Cancel</Button>
              <Button mode="contained" onPress={confirmDate} style={styles.confirmBtn}>Confirm</Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  title: { fontWeight: '700', color: '#1B5E20', marginBottom: 16, textAlign: 'center' },
  columns: { flexDirection: 'row', gap: 8, height: 200 },
  col: { flex: 1 },
  colLabel: { textAlign: 'center', color: '#888', marginBottom: 6, letterSpacing: 0.5 },
  scroll: { flex: 1 },
  item: { paddingVertical: 10, paddingHorizontal: 4, borderRadius: 8, alignItems: 'center' },
  itemSelected: { backgroundColor: '#E8F5E9' },
  itemText: { fontSize: 16, color: '#333' },
  itemTextSelected: { color: '#1B5E20', fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  confirmBtn: { borderRadius: 8 },
});
