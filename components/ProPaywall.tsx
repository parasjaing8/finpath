import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePro } from '../hooks/usePro';

interface ProPaywallProps {
  visible: boolean;
  onDismiss: () => void;
  currency?: string;
}

// Regional pricing map — amounts are app store equivalents
const PRICE_MAP: Record<string, { display: string }> = {
  INR: { display: '₹199' },
  USD: { display: '$4.99' },
  EUR: { display: '€4.99' },
  GBP: { display: '£3.99' },
  AUD: { display: 'A$7.99' },
  CAD: { display: 'C$6.99' },
  SGD: { display: 'S$6.99' },
  AED: { display: 'AED 18' },
  CHF: { display: 'CHF 4.99' },
  JPY: { display: '¥749' },
  NZD: { display: 'NZ$7.99' },
  MYR: { display: 'RM 19' },
  THB: { display: '฿169' },
  IDR: { display: 'Rp 79,000' },
  PHP: { display: '₱289' },
  ZAR: { display: 'R 89' },
  BRL: { display: 'R$24.90' },
  MXN: { display: 'MX$99' },
  HKD: { display: 'HK$39' },
  SEK: { display: 'kr 54' },
  NOK: { display: 'kr 54' },
  DKK: { display: 'kr 37' },
};

function getPrice(currency?: string): string {
  if (!currency) return '$4.99';
  return PRICE_MAP[currency]?.display ?? '$4.99';
}

const FEATURES = [
  { icon: 'download', text: 'CSV export — full year-by-year projection with summary' },
  { icon: 'file-pdf-box', text: 'PDF report with net worth chart and FIRE summary' },
];

export function ProPaywall({ visible, onDismiss, currency }: ProPaywallProps) {
  const { purchasePro, restorePurchases, purchasing, errorMessage, clearError } = usePro();

  const handleDismiss = () => { clearError(); onDismiss(); };
  const priceDisplay = getPrice(currency);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleDismiss}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleDismiss} />
      <View style={styles.sheet}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <MaterialCommunityIcons name="crown" size={28} color="#F9A825" />
          </View>
          <Text variant="headlineSmall" style={styles.title}>FinPath Pro</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>Export your full FIRE projection</Text>
        </View>

        {/* Feature list */}
        <View style={styles.features}>
          {FEATURES.map(f => (
            <View key={f.text} style={styles.featureRow}>
              <MaterialCommunityIcons name={f.icon as any} size={20} color="#1B5E20" />
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Price — regional */}
        <View style={styles.priceRow}>
          <Text variant="headlineMedium" style={styles.price}>{priceDisplay}</Text>
          <Text style={styles.priceSub}> · One-time</Text>
        </View>

        {/* Cause note */}
        <View style={styles.causeNote}>
          <Text style={styles.causeIcon}>🙏</Text>
          <Text style={styles.causeText}>
            51% of FinPath's profits go toward food {'&'} education for underprivileged children in rural India. Your plan. Their future.
          </Text>
        </View>

        {/* Actions */}
        <Button
          mode="contained"
          onPress={purchasePro}
          loading={purchasing}
          disabled={purchasing}
          style={styles.buyBtn}
          contentStyle={styles.buyBtnContent}
          buttonColor="#1B5E20"
        >
          Upgrade to Pro
        </Button>

        {errorMessage && (
          <Text style={styles.errorText}>{errorMessage}</Text>
        )}

        <Button
          mode="text"
          onPress={restorePurchases}
          disabled={purchasing}
          textColor="#888"
          style={styles.restoreBtn}
        >
          Restore purchase
        </Button>

        <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn}>
          <Text style={styles.closeText}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 24 },
  badge: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF8E1', alignItems: 'center', justifyContent: 'center', marginBottom: 12, elevation: 2 },
  title: { fontWeight: '700', color: '#1B5E20', marginBottom: 4 },
  subtitle: { color: '#666', textAlign: 'center' },
  features: { backgroundColor: '#F1F8E9', borderRadius: 12, padding: 16, marginBottom: 20, gap: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { fontSize: 14, color: '#333', flex: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: 20 },
  price: { fontWeight: '800', color: '#1B5E20' },
  priceSub: { color: '#888', fontSize: 14 },
  buyBtn: { borderRadius: 12, marginBottom: 8 },
  buyBtnContent: { height: 52 },
  errorText: { color: '#C62828', fontSize: 13, textAlign: 'center', marginBottom: 4 },
  restoreBtn: { marginBottom: 4 },
  closeBtn: { alignItems: 'center', paddingVertical: 8 },
  closeText: { color: '#AAA', fontSize: 13 },
  causeNote: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFF8E1', borderRadius: 10, padding: 12, marginBottom: 16, gap: 8 },
  causeIcon: { fontSize: 16, marginTop: 1 },
  causeText: { flex: 1, fontSize: 12, color: '#5D4037', lineHeight: 18 },
});
