import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '../hooks/useColors';
import { CURRENCIES, COMMON_CURRENCY_CODES, filterCurrencies, getCurrencyByCode, CurrencyInfo } from '../constants/currencies';

interface Props {
  value: string;
  onChange: (code: string) => void;
  label?: string;
}

export function CurrencyPicker({ value, onChange, label = 'Currency' }: Props) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = getCurrencyByCode(value);
  const results = useMemo(() => filterCurrencies(query), [query]);

  function handleSelect(c: CurrencyInfo) {
    onChange(c.code);
    setOpen(false);
    setQuery('');
  }

  return (
    <>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.trigger, { borderColor: colors.border, backgroundColor: colors.background }]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Selected currency: ${selected?.name ?? value}. Tap to change.`}
      >
        <Text style={[styles.triggerFlag]}>{selected?.flag ?? '🌐'}</Text>
        <Text style={[styles.triggerCode, { color: colors.foreground }]}>
          {value} — {selected?.name ?? value}
        </Text>
        <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => { setOpen(false); setQuery(''); }}>
        <Pressable style={styles.backdrop} onPress={() => { setOpen(false); setQuery(''); }} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.searchRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search currency or country…"
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {!query && (
            <View style={styles.commonRow}>
              {COMMON_CURRENCY_CODES.map(code => {
                const c = getCurrencyByCode(code);
                if (!c) return null;
                return (
                  <TouchableOpacity
                    key={code}
                    style={[
                      styles.commonChip,
                      {
                        borderColor: value === code ? colors.primary : colors.border,
                        backgroundColor: value === code ? colors.secondary : colors.background,
                      },
                    ]}
                    onPress={() => handleSelect(c)}
                  >
                    <Text style={styles.commonChipFlag}>{c.flag}</Text>
                    <Text style={[styles.commonChipCode, { color: value === code ? colors.primary : colors.foreground }]}>{code}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <FlatList
            data={results}
            keyExtractor={item => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.row,
                  value === item.code && { backgroundColor: colors.secondary },
                ]}
                onPress={() => handleSelect(item)}
              >
                <Text style={styles.rowFlag}>{item.flag}</Text>
                <View style={styles.rowText}>
                  <Text style={[styles.rowCode, { color: colors.foreground }]}>{item.code}</Text>
                  <Text style={[styles.rowName, { color: colors.mutedForeground }]}>{item.name}</Text>
                </View>
                {value === item.code && <Feather name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: colors.border }]} />}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, marginBottom: 6, marginTop: 12 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  triggerFlag: { fontSize: 18 },
  triggerCode: { flex: 1, fontSize: 14, fontWeight: '500' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '75%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  commonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  commonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  commonChipFlag: { fontSize: 14 },
  commonChipCode: { fontSize: 13, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  rowFlag: { fontSize: 22, width: 32, textAlign: 'center' },
  rowText: { flex: 1 },
  rowCode: { fontSize: 14, fontWeight: '600' },
  rowName: { fontSize: 12 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
});
