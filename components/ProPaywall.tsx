import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePro } from '../hooks/usePro';

interface ProPaywallProps {
  visible: boolean;
  onDismiss: () => void;
}

const FEATURES = [
  { icon: 'download', text: 'CSV export — full year-by-year projection' },
  { icon: 'file-chart', text: 'PDF report with charts (coming soon)' },
  { icon: 'lightbulb-on', text: 'Personalized financial tips (coming soon)' },
];

export function ProPaywall({ visible, onDismiss }: ProPaywallProps) {
  const { purchasePro, restorePurchases, purchasing, errorMessage, clearError } = usePro();

  const headline = 'Export your full projection to CSV';

  const handleDismiss = () => { clearError(); onDismiss(); };

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
          <Text variant="bodyMedium" style={styles.subtitle}>{headline}</Text>
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

        {/* Price */}
        <View style={styles.priceRow}>
          <Text variant="headlineMedium" style={styles.price}>₹199</Text>
          <Text style={styles.priceSub}> / $4.99 · One-time</Text>
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  badge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF8E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 2,
  },
  title: {
    fontWeight: '700',
    color: '#1B5E20',
    marginBottom: 4,
  },
  subtitle: {
    color: '#666',
    textAlign: 'center',
  },
  features: {
    backgroundColor: '#F1F8E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 20,
  },
  price: {
    fontWeight: '800',
    color: '#1B5E20',
  },
  priceSub: {
    color: '#888',
    fontSize: 14,
  },
  buyBtn: {
    borderRadius: 12,
    marginBottom: 8,
  },
  buyBtnContent: {
    height: 52,
  },
  errorText: {
    color: '#C62828',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 4,
  },
  restoreBtn: {
    marginBottom: 4,
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeText: {
    color: '#AAA',
    fontSize: 13,
  },
  causeNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  causeIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  causeText: {
    flex: 1,
    fontSize: 12,
    color: '#5D4037',
    lineHeight: 18,
  },
});
