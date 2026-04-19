import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, Portal, Dialog } from 'react-native-paper';
import { useApp } from '../../context/AppContext';
import { calculateProjections, CalculationOutput, formatCurrency, formatCurrencyFull, getAge } from '../../engine/calculator';
import { exportToCSV } from '../../utils/export';
import { useNavigation, useRouter } from 'expo-router';
import { usePro } from '../../hooks/usePro';
import { ProPaywall } from '../../components/ProPaywall';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ProjectionChart } from '../../components/ProjectionChart';
import { HeroCard } from '../../components/HeroCard';
import { SnapshotTiles } from '../../components/SnapshotTiles';
import { InsightCard } from '../../components/InsightCard';
import { SIPControls } from '../../components/SIPControls';
import { ProjectionTable } from '../../components/ProjectionTable';

export default function DashboardScreen() {
  const { profile: currentProfile, assets, expenses, goals, isLoaded } = useApp();
  const navigation = useNavigation();
  const router = useRouter();

  // Dashboard Controls — calc states trigger useMemo projection
  const [sipAmount, setSipAmount] = useState(10000);
  const [sipReturnRate, setSipReturnRate] = useState(12);
  const [postSipReturnRate, setPostSipReturnRate] = useState(7);
  const [stepUpEnabled, setStepUpEnabled] = useState(true);
  const [stepUpRate, setStepUpRate] = useState(10);
  // Display states — update live while dragging; calc states update on finger lift
  const [sipAmountDisplay, setSipAmountDisplay] = useState(10000);
  const [sipReturnRateDisplay, setSipReturnRateDisplay] = useState(12);
  const [postSipReturnRateDisplay, setPostSipReturnRateDisplay] = useState(7);
  const [stepUpRateDisplay, setStepUpRateDisplay] = useState(10);
  const [showPaywall, setShowPaywall] = useState(false);
  const { isPro } = usePro();
  const [showCorpusInfo, setShowCorpusInfo] = useState(false);
  const [showDepletionInfo, setShowDepletionInfo] = useState(false);

  // Track the goals snapshot that was used for the last SIP auto-set.
  // Auto-set only fires again when goals actually change, not on every tab focus.
  const lastAutoSetGoalsKey = useRef<string | null>(null);


  useEffect(() => {
    navigation.setOptions({ headerRight: undefined });
  }, [navigation]);

  const result: CalculationOutput | null = useMemo(() => {
    if (!currentProfile || !goals || !isLoaded) return null;
    try {
      return calculateProjections({
        profile: currentProfile,
        assets,
        expenses,
        goals,
        sipAmount,
        sipReturnRate,
        postSipReturnRate,
        stepUpRate: stepUpEnabled ? stepUpRate : 0,
      });
    } catch (e) {
      if (__DEV__) console.error('calculateProjections error:', e);
      return null;
    }
  }, [currentProfile, assets, expenses, goals, sipAmount, sipReturnRate, postSipReturnRate, stepUpEnabled, stepUpRate, isLoaded]);

  // Insights: peak, depletion, affordability
  const insights = useMemo(() => {
    if (!result || !currentProfile) return null;
    const projs = result.projections;
    if (projs.length === 0) return null;
    let peak = projs[0];
    for (const p of projs) {
      if (p.netWorthEOY > peak.netWorthEOY) peak = p;
    }
    const monthlyIncome = currentProfile.monthly_income ?? 0;
    const freqDiv: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, ANNUALLY: 12, ANNUAL: 12, YEARLY: 12 };
    const monthlyExp = expenses
      .filter(e => e.expense_type === 'CURRENT_RECURRING')
      .reduce((sum, e) => sum + e.amount / (freqDiv[e.frequency ?? 'MONTHLY'] ?? 1), 0);
    const isAffordable = monthlyIncome <= 0 || (sipAmount + monthlyExp) <= monthlyIncome;
    const sipGap = result.requiredMonthlySIP - sipAmount;
    return {
      peakAge: peak.age,
      peakValue: peak.netWorthEOY,
      depletionAge: result.failureAge > 0 ? result.failureAge : null,
      isAffordable,
      sipGap,
    };
  }, [result, sipAmount, expenses, currentProfile]);

  // Auto-set SIP when goals change (not on every tab focus)
  useEffect(() => {
    if (!goals || !result || result.requiredMonthlySIP <= 0) return;
    const goalsKey = `${goals.retirement_age}-${goals.fire_type}-${goals.pension_income}-${goals.withdrawal_rate}`;
    if (lastAutoSetGoalsKey.current === goalsKey) return;
    lastAutoSetGoalsKey.current = goalsKey;
    const rounded = Math.ceil(result.requiredMonthlySIP / 1000) * 1000;
    setSipAmount(rounded);
    setSipAmountDisplay(rounded);
  }, [goals, result]);

  if (!currentProfile) {
    return <View style={styles.center}><Text>No profile selected</Text></View>;
  }

  if (!goals) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="flag-outline" size={48} color="#C8E6C9" />
        <Text variant="titleMedium" style={{ textAlign: 'center', color: '#333', marginTop: 16, fontWeight: '700' }}>
          No plan set yet
        </Text>
        <Text variant="bodyMedium" style={{ textAlign: 'center', color: '#666', marginTop: 8, marginHorizontal: 32, lineHeight: 22 }}>
          Set your retirement age, withdrawal target, and withdrawal rate to see your projection here.
        </Text>
        <Button
          mode="contained"
          icon="flag-outline"
          onPress={() => router.push('/(tabs)/goals')}
          style={{ marginTop: 24, borderRadius: 8 }}
          contentStyle={{ paddingVertical: 6 }}
        >
          Set Your Plan
        </Button>
      </View>
    );
  }

  if (!result) {
    return <View style={styles.center}><Text>Calculating...</Text></View>;
  }

  const currency = currentProfile.currency;
  const projections = result.projections;

  // Plain variables — must NOT be hooks (useMemo) here because they are after early returns,
  // which would violate React's Rules of Hooks and crash on first load.
  const retirementAge = goals.retirement_age;
  const currentAge = getAge(currentProfile.dob);
  const firstFireYear = projections.find(p => p.isFireAchieved)?.year ?? -1;

  // Plan status: 5-state decision engine for hero card
  const planStatus = (() => {
    const targetAge = goals.fire_target_age ?? 100;
    if (result.requiredMonthlySIP <= 0)
      return { title: 'Assets cover retirement', subtitle: `No SIP needed · Retire at ${retirementAge}`, color: '#1B5E20' };
    if (insights?.depletionAge)
      return { title: 'Plan needs adjustment', subtitle: `Money runs out at ${insights.depletionAge}`, color: '#C62828' };
    if (insights && !insights.isAffordable)
      return { title: 'Cash flow is tight', subtitle: 'SIP + expenses exceed monthly income', color: '#F57C00' };
    if (insights && insights.sipGap > 500)
      return { title: `${formatCurrency(insights.sipGap, currency)}/mo short of target`, subtitle: 'Increase SIP to stay on track', color: '#F57C00' };
    if (sipAmount - result.requiredMonthlySIP > 500 && result.fireAchievedAge > 0 && result.fireAchievedAge < retirementAge) {
      const yrs = retirementAge - result.fireAchievedAge;
      return { title: `🎯 Retire at ${result.fireAchievedAge}`, subtitle: `${yrs} yr${yrs !== 1 ? 's' : ''} ahead of plan`, color: '#1B5E20' };
    }
    return { title: "You're on track", subtitle: `Money lasts till ${targetAge}`, color: '#1B5E20' };
  })();

  const sipBurdenInsight: { type: 'critical' | 'warning' | 'info'; title: string } | null = (() => {
    if (!result.sipBurdenWarning) return null;
    const income = currentProfile.monthly_income ?? 0;
    const ratio = income > 0 ? result.requiredMonthlySIP / income : 0;
    return {
      type: ratio > 1 ? 'critical' : ratio > 0.6 ? 'warning' : 'info',
      title: ratio > 1 ? 'SIP Exceeds Salary' : ratio > 0.6 ? 'High SIP Burden' : 'Low Income Buffer',
    };
  })();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>


      {/* Section A — Hero Card */}
      <HeroCard
        sipAmountDisplay={sipAmountDisplay}
        requiredMonthlySIP={result.requiredMonthlySIP}
        currency={currency}
        fireTargetAge={goals.fire_target_age ?? 100}
        failureAge={result.failureAge}
        fireAchievedAge={result.fireAchievedAge}
        isOnTrack={result.isOnTrack}
        planStatus={planStatus}
        onDepletionPress={() => setShowDepletionInfo(true)}
      />

      {/* Snapshot Row */}
      <SnapshotTiles
        investableNetWorth={result.investableNetWorth}
        netWorthAtRetirement={result.netWorthAtRetirement}
        retirementAge={retirementAge}
        currency={currency}
        onCorpusInfoPress={() => setShowCorpusInfo(true)}
      />

      {/* SIP burden warning — shown when required SIP exceeds or strains salary */}
      {sipBurdenInsight && result.sipBurdenWarning && (
        <InsightCard type={sipBurdenInsight.type} title={sipBurdenInsight.title} message={result.sipBurdenWarning} />
      )}
      {result.isOnTrack && !result.failureAge && insights && (
        <InsightCard
          type="success"
          title={`Peak wealth at age ${insights.peakAge}`}
          message={`Your portfolio peaks at ${formatCurrency(insights.peakValue, currency)}.`}
        />
      )}
      {insights && !insights.isAffordable && !result.sipBurdenWarning && (
        <InsightCard
          type="warning"
          title="Cash Flow Tight"
          message="SIP + expenses exceed your monthly income. Consider reducing expenses."
        />
      )}

      <SIPControls
        sipAmountDisplay={sipAmountDisplay}
        sipReturnRateDisplay={sipReturnRateDisplay}
        postSipReturnRateDisplay={postSipReturnRateDisplay}
        stepUpEnabled={stepUpEnabled}
        stepUpRateDisplay={stepUpRateDisplay}
        sipStopAge={goals.sip_stop_age}
        currency={currency}
        onSipChange={setSipAmountDisplay}
        onSipCommit={setSipAmount}
        onReturnChange={setSipReturnRateDisplay}
        onReturnCommit={setSipReturnRate}
        onPostReturnChange={setPostSipReturnRateDisplay}
        onPostReturnCommit={setPostSipReturnRate}
        onStepUpToggle={setStepUpEnabled}
        onStepUpChange={setStepUpRateDisplay}
        onStepUpCommit={setStepUpRate}
      />

      {/* Section C — Net Worth Projection Graph 2.0 */}
      <Card style={styles.chartCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.chartTitle}>Net Worth Projection</Text>
          <Text variant="bodySmall" style={styles.chartSubtitle}>{`Your financial journey till age ${goals.fire_target_age ?? 100}`}</Text>
          <ProjectionChart
            projections={projections}
            retirementAge={retirementAge}
            failureAge={result.failureAge}
            fireTargetAge={goals.fire_target_age ?? 100}
            expenses={expenses}
            currency={currency}
            result={result}
          />
        </Card.Content>
      </Card>

      {/* Section D — Year-by-Year Table */}
      <Card style={styles.tableCard}>
        <Card.Content>
          <View style={styles.tableHeader}>
            <Text variant="titleMedium" style={styles.chartTitle}>Year-by-Year Projection</Text>
            <Button mode="text" icon="download" compact
              onPress={() => {
                if (!isPro) { setShowPaywall(true); return; }
                exportToCSV(currentProfile, assets, expenses, projections);
              }}>
              {isPro ? 'CSV' : '👑 CSV'}
            </Button>
            <ProPaywall visible={showPaywall} onDismiss={() => setShowPaywall(false)} />
          </View>
          <ProjectionTable
            projections={projections}
            currency={currency}
            firstFireYear={firstFireYear}
          />
        </Card.Content>
      </Card>


      {/* Depletion info dialog — tapped from warning pill in hero card */}
      <Portal>
        <Dialog visible={showDepletionInfo} onDismiss={() => setShowDepletionInfo(false)} style={{ backgroundColor: '#FFF', borderRadius: 16 }}>
          <Dialog.Title style={{ color: '#E65100', fontWeight: '700' }}>⚠ Corpus runs out at {result.failureAge}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ lineHeight: 22, color: '#333', marginBottom: 12 }}>
              At your current SIP of{' '}
              <Text style={{ fontWeight: '700' }}>{formatCurrencyFull(sipAmountDisplay, currency)}/month</Text>
              {', your corpus is depleted at age '}{result.failureAge}
              {' — '}{result.failureAge - retirementAge}{' year'}
              {result.failureAge - retirementAge !== 1 ? 's' : ''}{' into retirement.'}
            </Text>
            {result.requiredMonthlySIP > sipAmountDisplay && (
              <Text variant="bodyMedium" style={{ lineHeight: 22, color: '#555' }}>
                Increase your SIP to{' '}
                <Text style={{ fontWeight: '700', color: '#1B5E20' }}>{formatCurrencyFull(result.requiredMonthlySIP, currency)}/month</Text>
                {' or set a later retirement age to sustain withdrawals through age '}{goals.fire_target_age ?? 100}.
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDepletionInfo(false)} textColor="#E65100">Got it</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Corpus info dialog — explains why the projected corpus is large */}
      <Portal>
        <Dialog visible={showCorpusInfo} onDismiss={() => setShowCorpusInfo(false)} style={{ backgroundColor: '#FFF', borderRadius: 16 }}>
          <Dialog.Title style={{ color: '#5E35B1', fontWeight: '700' }}>Why is this corpus so large?</Dialog.Title>
          <Dialog.Content>
            {(() => {
              const monthlyW = goals.pension_income ?? 0;
              const inflRate = goals.inflation_rate ?? 6;
              const yearsToRetire = retirementAge - currentAge;
              if (monthlyW <= 0 || yearsToRetire <= 0) {
                return (
                  <Text variant="bodyMedium" style={{ lineHeight: 22, color: '#333' }}>
                    Your projected corpus is what your SIP and existing investments are expected to grow to by retirement. The larger your inflation rate and the longer your retirement horizon, the bigger the corpus needs to be.
                  </Text>
                );
              }
              const inflatedMonthly = Math.round(monthlyW * Math.pow(1 + inflRate / 100, yearsToRetire));
              return (
                <>
                  <Text variant="bodyMedium" style={{ lineHeight: 22, color: '#333', marginBottom: 12 }}>
                    Your withdrawal target of{' '}
                    <Text style={{ fontWeight: '700', color: '#5E35B1' }}>{formatCurrencyFull(monthlyW, currency)}/month</Text>
                    {' '}is in today's money.
                  </Text>
                  <Text variant="bodyMedium" style={{ lineHeight: 22, color: '#333', marginBottom: 12 }}>
                    At{' '}{inflRate}{'% annual inflation, by age '}{retirementAge}{' ('}
                    {yearsToRetire}{' years from now), that same lifestyle will cost '}
                    <Text style={{ fontWeight: '700', color: '#BF360C' }}>{formatCurrencyFull(inflatedMonthly, currency)}/month</Text>.
                  </Text>
                  <Text variant="bodyMedium" style={{ lineHeight: 22, color: '#555' }}>
                    Your corpus at retirement must be large enough to fund these inflation-adjusted withdrawals for the rest of your retirement — which is why the number looks much larger than today's figures.
                  </Text>
                </>
              );
            })()}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowCorpusInfo(false)} textColor="#5E35B1">Got it</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  chartCard: { marginBottom: 16, borderRadius: 12 },
  chartTitle: { fontWeight: 'bold', marginBottom: 2 },
  chartSubtitle: { color: '#6B7A6B', marginBottom: 12, marginTop: 2 },
  tableCard: { marginBottom: 16, borderRadius: 12 },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
