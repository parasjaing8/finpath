import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Modal, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { CustomSlider as Slider } from '@/components/CustomSlider';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { Goals } from '@/engine/types';
import { formatCurrency, getCurrencySymbol, getAge } from '@/engine/calculator';
import { WEB_HEADER_OFFSET, WEB_BOTTOM_OFFSET, shadow } from '@/constants/theme';

const FIRE_TYPES = [
  { key: 'slim', label: 'Lean FIRE', desc: 'Survive to 85 — minimal corpus', color: '#E65100' },
  { key: 'moderate', label: 'Moderate FIRE', desc: 'Sustain to 100 — comfortable', color: '#1B5E20' },
  { key: 'fat', label: 'Fat FIRE', desc: 'Preserve wealth to 120', color: '#5E35B1' },
];

export default function GoalsScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { goals, setGoals, profile } = useApp();
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currency = profile?.currency ?? 'INR';

  const webTop = Platform.OS === 'web' ? WEB_HEADER_OFFSET : 0;
  const webBottom = Platform.OS === 'web' ? WEB_BOTTOM_OFFSET : 0;

  const [form, setForm] = useState<Goals>({
    retirement_age: 50,
    sip_stop_age: 50,
    pension_income: 100000,
    inflation_rate: 6,
    fire_type: 'moderate',
    fire_target_age: 100,
  });

  const [saved, setSaved] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (goals) setForm(goals);
  }, [goals]);

  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) clearTimeout(navigationTimeoutRef.current);
    };
  }, []);

  async function handleSave() {
    await setGoals(form);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    setCalculating(true);
    setSaved(false);
    setCalculating(false);
    router.push('/(tabs)/dashboard');
  }

  function InfoRow({ label, value, suffix = '' }: { label: string; value: string | number; suffix?: string }) {
    return (
      <View style={styles.infoRow}>
        <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}{suffix}</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingTop: 16 + webTop, paddingBottom: 40 + webBottom + insets.bottom }]}
      >
        {/* Retirement Plan */}
        <View style={[styles.card, { backgroundColor: colors.card }]}> 
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Retirement Plan</Text>

          <View style={styles.sliderRow}>
            <Text style={[styles.sliderLabel, { color: colors.mutedForeground }]}>Retire at</Text>
            <Text style={[styles.sliderValue, { color: colors.primary }]}>{form.retirement_age}</Text>
          </View>
          <Slider
            value={form.retirement_age}
            onValueChange={v => setForm(f => ({ ...f, retirement_age: Math.round(v), sip_stop_age: Math.min(f.sip_stop_age, Math.round(v)) }))}
            minimumValue={35}
            maximumValue={70}
            step={1}
            minimumTrackTintColor={colors.primary}
            thumbTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
          />

          <View style={[styles.sliderRow, { marginTop: 12 }]}>
            <Text style={[styles.sliderLabel, { color: colors.mutedForeground }]}>Stop SIP at</Text>
            <Text style={[styles.sliderValue, { color: colors.primary }]}>{form.sip_stop_age}</Text>
          </View>
          <Slider
            value={form.sip_stop_age}
            onValueChange={v => setForm(f => ({ ...f, sip_stop_age: Math.min(Math.round(v), f.retirement_age) }))}
            minimumValue={35}
            maximumValue={form.retirement_age}
            step={1}
            minimumTrackTintColor={colors.primary}
            thumbTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
          />

          <InfoRow label="Years to retirement" value={Math.max(0, form.retirement_age - (profile ? getAge(profile.dob) : 30))} suffix=" yrs" />
        </View>

        {/* Income & Withdrawal */}
        <View style={[styles.card, { backgroundColor: colors.card }]}> 
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Withdrawal Target</Text>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}> 
            Monthly withdrawal in today's money ({getCurrencySymbol(currency)})
          </Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
            value={String(form.pension_income ?? '')}
            onChangeText={t => setForm(f => ({ ...f, pension_income: parseFloat(t) || 0 }))}
            keyboardType="numeric"
            placeholder="e.g., 100000"
            placeholderTextColor={colors.mutedForeground}
            accessibilityLabel="Desired monthly withdrawal in today's money"
          />

          <Text style={[styles.subSectionTitle, { color: colors.foreground }]}>FIRE Strategy</Text>
          {FIRE_TYPES.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.fireTypeRow,
                { borderColor: form.fire_type === t.key ? t.color : colors.border, backgroundColor: form.fire_type === t.key ? `${t.color}15` : colors.background },
              ]}
              onPress={() => setForm(f => ({ ...f, fire_type: t.key }))}
              accessibilityRole="radio"
              accessibilityState={{ selected: form.fire_type === t.key }}
              accessibilityLabel={`${t.label}: ${t.desc}`}
            >
              <View style={[styles.radioOuter, { borderColor: t.color }]}> 
                {form.fire_type === t.key && <View style={[styles.radioInner, { backgroundColor: t.color }]} />}
              </View>
              <View style={styles.fireTypeContent}>
                <Text style={[styles.fireTypeLabel, { color: form.fire_type === t.key ? t.color : colors.foreground }]}>{t.label}</Text>
                <Text style={[styles.fireTypeDesc, { color: colors.mutedForeground }]}>{t.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <View style={[styles.sliderRow, { marginTop: 16 }]}> 
            <Text style={[styles.sliderLabel, { color: colors.mutedForeground }]}>Inflation Rate</Text>
            <Text style={[styles.sliderValue, { color: colors.warning }]}>{form.inflation_rate ?? 6}%</Text>
          </View>
          <Slider
            value={form.inflation_rate ?? 6}
            onValueChange={v => setForm(f => ({ ...f, inflation_rate: parseFloat(v.toFixed(1)) }))}
            minimumValue={3}
            maximumValue={10}
            step={0.5}
            minimumTrackTintColor={colors.warning}
            thumbTintColor={colors.warning}
            maximumTrackTintColor={colors.border}
          />

          <View style={[styles.sliderRow, { marginTop: 12 }]}> 
            <Text style={[styles.sliderLabel, { color: colors.mutedForeground }]}>Survive to age</Text>
            <Text style={[styles.sliderValue, { color: colors.purple }]}>{form.fire_target_age ?? 100}</Text>
          </View>
          <Slider
            value={form.fire_target_age ?? 100}
            onValueChange={v => setForm(f => ({ ...f, fire_target_age: Math.round(v) }))}
            minimumValue={80}
            maximumValue={120}
            step={1}
            minimumTrackTintColor={colors.purple}
            thumbTintColor={colors.purple}
            maximumTrackTintColor={colors.border}
          />
        </View>

        {/* Summary */}
        <View style={[styles.summaryCard, { backgroundColor: colors.successLight }]}> 
          <Text style={[styles.summaryTitle, { color: colors.success }]}>Plan Summary</Text>
          <InfoRow label="Retire at" value={form.retirement_age} suffix={` (${FIRE_TYPES.find(t => t.key === form.fire_type)?.label})`} />
          <InfoRow label="Monthly income (today)" value={formatCurrency(form.pension_income ?? 0, currency)} />
          <InfoRow label="Inflation" value={`${form.inflation_rate ?? 6}%`} />
          <InfoRow label="Corpus must last to" value={`age ${form.fire_target_age ?? 100}`} />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saved ? '#2E7D32' : colors.primary }]}
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Goals saved and calculating' : 'Save goals and calculate'}
          accessibilityState={{ disabled: calculating }}
          disabled={calculating}
        >
          {saved ? (
            <Feather name="check" size={20} color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save Goals and Calculate</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={calculating} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.calculatingOverlay}>
          <View style={[styles.calculatingCard, { backgroundColor: colors.card }]}> 
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.calculatingTitle, { color: colors.foreground }]}>Calculating your FIRE plan</Text>
            <Text style={[styles.calculatingText, { color: colors.mutedForeground }]}>Refreshing the dashboard with your updated retirement assumptions.</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  card: {
    borderRadius: 16, padding: 20, marginBottom: 16,
    ...shadow(2),
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16, fontFamily: 'Inter_700Bold' },
  fireTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 12, padding: 14, marginBottom: 10 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  fireTypeContent: { flex: 1 },
  fireTypeLabel: { fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  fireTypeDesc: { fontSize: 12, marginTop: 2, fontFamily: 'Inter_400Regular' },
  subSectionTitle: { fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 10, fontFamily: 'Inter_700Bold' },
  sliderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sliderLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  sliderValue: { fontSize: 20, fontWeight: '800', fontFamily: 'Inter_700Bold' },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, fontFamily: 'Inter_600SemiBold' },
  input: { borderWidth: 1.5, borderRadius: 10, padding: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E8F5E9' },
  infoLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  infoValue: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  summaryCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  summaryTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8, fontFamily: 'Inter_700Bold' },
  saveBtn: {
    borderRadius: 16, padding: 18, alignItems: 'center', justifyContent: 'center',
    ...shadow(3),
    marginBottom: 16,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  calculatingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  calculatingCard: { width: '100%', maxWidth: 360, borderRadius: 20, padding: 24, alignItems: 'center' },
  calculatingTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  calculatingText: { fontSize: 13, marginTop: 8, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
});
