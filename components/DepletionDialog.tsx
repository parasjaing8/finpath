import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { formatCurrencyFull } from '../engine/calculator';
import { shadow } from '@/constants/theme';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  failureAge: number;
  retirementAge: number;
  sipAmountDisplay: number;
  requiredMonthlySIP: number;
  fireTargetAge: number;
  currency: string;
}

export function DepletionDialog({ visible, onDismiss, failureAge, retirementAge, sipAmountDisplay, requiredMonthlySIP, fireTargetAge, currency }: Props) {
  const colors = useColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={[styles.dialog, { backgroundColor: colors.card }]}>
          <Text style={styles.title}>Corpus runs out at {failureAge}</Text>
          <Text style={styles.body}>
            At your current SIP of{' '}
            <Text style={styles.bold}>{formatCurrencyFull(sipAmountDisplay, currency)}/month</Text>
            {', your corpus is depleted at age '}{failureAge}
            {' — '}{failureAge - retirementAge}{' year'}
            {failureAge - retirementAge !== 1 ? 's' : ''}{' into retirement.'}
          </Text>
          {requiredMonthlySIP > sipAmountDisplay && (
            <Text style={styles.body}>
              Increase your SIP to{' '}
              <Text style={[styles.bold, { color: colors.primary }]}>{formatCurrencyFull(requiredMonthlySIP, currency)}/month</Text>
              {' or extend your retirement age to sustain withdrawals through age '}{fireTargetAge}.
            </Text>
          )}
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#E65100' }]} onPress={onDismiss}>
            <Text style={styles.btnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface CorpusDialogProps {
  visible: boolean;
  onDismiss: () => void;
  pensionIncome: number;
  inflationRate: number;
  retirementAge: number;
  currentAge: number;
  currency: string;
}

export function CorpusInfoDialog({ visible, onDismiss, pensionIncome, inflationRate, retirementAge, currentAge, currency }: CorpusDialogProps) {
  const colors = useColors();
  const yearsToRetire = retirementAge - currentAge;
  const inflatedMonthly = yearsToRetire > 0 ? Math.round(pensionIncome * Math.pow(1 + inflationRate / 100, yearsToRetire)) : pensionIncome;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={[styles.dialog, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.purple }]}>Why is this corpus so large?</Text>
          {pensionIncome > 0 && yearsToRetire > 0 ? (
            <>
              <Text style={styles.body}>
                Your withdrawal target of{' '}
                <Text style={[styles.bold, { color: colors.purple }]}>{formatCurrencyFull(pensionIncome, currency)}/month</Text>
                {' '}is in today's money.
              </Text>
              <Text style={styles.body}>
                At {inflationRate}% inflation, by age {retirementAge} ({yearsToRetire} years), it will cost{' '}
                <Text style={[styles.bold, { color: '#C62828' }]}>{formatCurrencyFull(inflatedMonthly, currency)}/month</Text>.
              </Text>
              <Text style={styles.body}>
                Your corpus must fund these inflation-adjusted withdrawals for the rest of retirement.
              </Text>
            </>
          ) : (
            <Text style={styles.body}>
              Your projected corpus is what your SIP and existing investments grow to by retirement.
            </Text>
          )}
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.purple }]} onPress={onDismiss}>
            <Text style={styles.btnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    ...shadow(4),
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 12,
    fontFamily: 'Inter_700Bold',
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
    marginBottom: 10,
    fontFamily: 'Inter_400Regular',
  },
  bold: {
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  btn: {
    marginTop: 8,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
});
