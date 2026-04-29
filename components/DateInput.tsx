import React, { useState } from 'react';
import { Platform } from 'react-native';
import { TextInput } from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

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

export function formatDateMask(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function parseDateSafe(value: string): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(2000, 0, 1);
}

export function DateInput({ label, value, onChangeText, style, error, onFocus, maximumDate, minimumDate }: DateInputProps) {
  const [showPicker, setShowPicker] = useState(false);

  function handlePickerChange(event: DateTimePickerEvent, date?: Date) {
    setShowPicker(false);
    if (event.type === 'set' && date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      onChangeText(`${y}-${m}-${d}`);
    }
  }

  return (
    <>
      <TextInput
        label={label}
        value={value}
        onChangeText={t => onChangeText(formatDateMask(t))}
        mode="outlined"
        style={style}
        error={error}
        keyboardType="number-pad"
        placeholder="YYYY-MM-DD"
        maxLength={10}
        onFocus={onFocus}
        right={<TextInput.Icon icon="calendar" onPress={() => setShowPicker(true)} />}
      />
      {showPicker && (
        <DateTimePicker
          value={parseDateSafe(value)}
          mode="date"
          display={Platform.OS === 'android' ? 'calendar' : 'spinner'}
          maximumDate={maximumDate ?? new Date()}
          minimumDate={minimumDate}
          onChange={handlePickerChange}
        />
      )}
    </>
  );
}
