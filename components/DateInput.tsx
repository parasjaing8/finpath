import React, { useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { TextInput } from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

interface DateInputProps {
  label: string;
  value: string; // YYYY-MM-DD string
  onChangeText: (val: string) => void;
  style?: object;
  error?: boolean;
  maximumDate?: Date;
  minimumDate?: Date;
  onFocus?: () => void;
}

function parseDate(value: string): Date {
  if (!value) return new Date();
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function DateInput({
  label,
  value,
  onChangeText,
  style,
  error,
  maximumDate,
  minimumDate,
  onFocus,
}: DateInputProps) {
  const [show, setShow] = useState(false);

  function openPicker() {
    Keyboard.dismiss();
    onFocus?.();
    setShow(true);
  }

  function handleChange(event: DateTimePickerEvent, selectedDate?: Date) {
    setShow(false);
    if (event.type === 'dismissed' || !selectedDate) return;
    onChangeText(formatDate(selectedDate));
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
        onFocus={openPicker}
        onPressIn={openPicker}
        placeholder="YYYY-MM-DD"
        right={
          <TextInput.Icon
            icon="calendar"
            onPress={openPicker}
          />
        }
      />
      {show && (
        <DateTimePicker
          value={parseDate(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
        />
      )}
    </>
  );
}
