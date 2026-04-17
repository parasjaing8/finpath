import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { formatCurrency } from '../engine/calculator';

interface Props {
  investableNetWorth: number;
  netWorthAtRetirement: number;
  retirementAge: number;
  currency: string;
  onCorpusInfoPress: () => void;
}

export function SnapshotTiles({
  investableNetWorth,
  netWorthAtRetirement,
  retirementAge,
  currency,
  onCorpusInfoPress,
}: Props) {
  return (
    <View style={styles.tilesRow}>
      <View style={[styles.snapTile, { backgroundColor: '#E8F5E9' }]}>
        <Text style={[styles.snapLabel, { color: '#1B5E20' }]}>TODAY</Text>
        <Text style={[styles.snapNumber, { color: '#1B5E20' }]}>{formatCurrency(investableNetWorth, currency)}</Text>
        <Text style={styles.snapSub}>Investable Net Worth</Text>
      </View>
      <View style={[styles.snapTile, { backgroundColor: '#EDE7F6' }]}>
        <IconButton
          icon="information-outline"
          size={16}
          iconColor="#7E57C2"
          style={{ position: 'absolute', top: 0, right: 0, margin: 0 }}
          onPress={onCorpusInfoPress}
          accessibilityLabel="Why is the corpus this large?"
        />
        <Text style={[styles.snapLabel, { color: '#5E35B1' }]}>AT AGE {retirementAge}</Text>
        <Text style={[styles.snapNumber, { color: '#5E35B1' }]}>{formatCurrency(netWorthAtRetirement, currency)}</Text>
        <Text style={styles.snapSub}>Projected Corpus</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tilesRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  snapTile: { flex: 1, borderRadius: 12, padding: 14 },
  snapLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  snapNumber: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  snapSub: { fontSize: 11, color: '#666' },
});
