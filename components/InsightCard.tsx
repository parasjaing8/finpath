import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  type: 'warning' | 'info' | 'success' | 'critical';
  title: string;
  message: string;
}

const TYPE_CONFIG = {
  warning:  { bg: '#FFF3E0', border: '#E65100', icon: 'alert-outline'        as const, iconColor: '#E65100', titleColor: '#BF360C' },
  info:     { bg: '#F5F5F5', border: '#9E9E9E', icon: 'information-outline'  as const, iconColor: '#757575', titleColor: '#616161' },
  success:  { bg: '#E8F5E9', border: '#1B5E20', icon: 'check-circle-outline' as const, iconColor: '#1B5E20', titleColor: '#1B5E20' },
  critical: { bg: '#FFEBEE', border: '#B71C1C', icon: 'alert-circle-outline' as const, iconColor: '#C62828', titleColor: '#B71C1C' },
};

export function InsightCard({ type, title, message }: Props) {
  const cfg = TYPE_CONFIG[type];
  return (
    <View style={[styles.card, { backgroundColor: cfg.bg, borderLeftColor: cfg.border }]}>
      <View style={styles.titleRow}>
        <MaterialCommunityIcons name={cfg.icon} size={16} color={cfg.iconColor} style={{ marginRight: 6 }} />
        <Text style={[styles.title, { color: cfg.titleColor }]}>{title}</Text>
      </View>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderLeftWidth: 3, padding: 14, marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 13, fontWeight: '800', flex: 1 },
  message: { fontSize: 12, color: '#555', lineHeight: 18 },
});
