import React from 'react';
import { TextInput } from 'react-native-paper';

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

/**
 * Strip non-digits and auto-insert dashes for YYYY-MM-DD keyboard entry.
 * User types only digits; dashes appear automatically after year (4) and month (6).
 */
export function formatDateMask(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export function DateInput({ label, value, onChangeText, style, error, onFocus }: DateInputProps) {
  return (
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
      right={<TextInput.Icon icon="calendar" />}
    />
  );
}


