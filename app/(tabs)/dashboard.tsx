import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text, Card, Button, Portal, Dialog } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../../context/AppContext';
import { calculateProjections, CalculationOutput, formatCurrency, formatCurrencyFull, getAge } from '../../engine/calculator';
import { exportToCSV } from '../../utils/export';
import { exportToPDF } from '../../utils/exportPdf';
import { getFxRates, FxRates } from '../../utils/fx';
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
import { getContextualQuote } from '../../constants/quotes';

export default function DashboardScreen() {
  const { profile: currentProfile, assets, expenses, goals, isLoaded } = useApp();
  const navigation = useNavigation();
  const router = useRouter();

  // Dashboard Controls — calc states trigger useMemo projection
  const [sipAmount, setSipAmount] = useState(0);
  const [sipReturnRate, setSipReturnRate] = useState(12);
  const [postSipReturnRate, setPostSipReturnRate] = useState(7);
  const [stepUpEnabled, setStepUpEnabled] = useState(true);
  const [stepUpRate, setStepUpRate] = useState(10);
  // Display states — update live while dragging; calc states update on finger lift
  const [sipAmountDisplay, setSipAmountDisplay] = useState(0);
  const [sipReturnRateDisplay, setSipReturnRateDisplay] = useState(12);
  const [postSipReturnRateDisplay, setPostSipReturnRateDisplay] = useState(7);
  const [stepUpRateDisplay, setStepUpRateDisplay] = useState(10);
  const [showPaywall, setShowPaywall] = useState(false);
  const { isPro } = usePro();
  const [showCorpusInfo, setShowCorpusInfo] = useState(false);
  const [showDepletionInfo, setShowDepletionInfo] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [fxRates, setFxRates] = useState<FxRates | undefined>(undefined);
  const [showOnboardingStrip, setShowOnboardingStrip] = useState(false);

  // Track the goals snapshot that was used for the last SIP auto-set.
  // Auto-set only fires again when goals actually change, not on every tab focus.
  const lastAutoSetGoalsKey = useRef<string | null>(null);


  useEffect(() => {
    navigation.setOptions({ headerRight: undefined });
  }, [navigation]);

  useEffect(() => {
    AsyncStorage.getItem('@finpath_disclaimer_ack').then(val => {
      if (!val) setShowDisclaimer(true);
    });
  }, []);

  useEffect(() => {
    getFxRates().then(setFxRates).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('@finpath_onboarding_strip_dismissed').then(v => {
      if (!v) setShowOnboardingStrip(true);
    });
  }, []);

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
        fxRates,
      });
    } catch (e) {
      if (__DEV__) console.error('calculateProjections error:', e);
      return null;
    }
  }, [currentProfile, assets, expenses, goals, sipAmount, sipReturnRate, postSipReturnRate, stepUpEnabled, stepUpRate, isLoaded, retryKey, fxRates]);

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
    const goalsKey = `${goals.retirement_age}-${goals.fire_type}-${goals.pension_income}`;
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
    if (!isLoaded) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1B5E20" />
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#C62828" />
        <Text variant="titleMedium" style={{ textAlign: 'center', color: '#333', marginTop: 16, fontWeight: '700' }}>
          Calculation error
        </Text>
        <Text variant="bodyMedium" style={{ textAlign: 'center', color: '#666', marginTop: 8, marginHorizontal: 32, lineHeight: 22 }}>
          Something went wrong with your projection. Try reviewing your goals or assets.
        </Text>
        <Button
          mode="contained"
          icon="refresh"
          onPress={() => setRetryKey(k => k + 1)}
          style={{ marginTop: 24, borderRadius: 8 }}
          contentStyle={{ paddingVertical: 6 }}
        >
          Retry
        </Button>
        <Button
          mode="outlined"
          icon="flag-outline"
          onPress={() => router.push('/(tabs)/goals')}
          style={{ marginTop: 12, borderRadius: 8 }}
          contentStyle={{ paddingVertical: 6 }}
        >
          Review Plan
        </Button>
      </View>
    );
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

  const noData = assets.length === 0 && expenses.length === 0;
  const noIncome = (currentProfile.monthly_income ?? 0) <= 0;

  // Onboarding strip step completion
  const stepGoalsDone = !!goals;
  const stepAssetsDone = assets.length > 0;
  const stepDashDone = stepGoalsDone && stepAssetsDone;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>

      {/* Onboarding progress strip */}
      {showOnboardingStrip && !stepDashDone && (
        <View style={styles.onboardingStrip}>
          <View style={styles.onboardingSteps}>
            {[
              { num: 1, label: 'Set Goals', done: stepGoalsDone, onPress: () => router.push('/(tabs)/goals') },
              { num: 2, label: 'Add Assets', done: stepAssetsDone, onPress: () => router.push('/(tabs)/assets') },
              { num: 3, label: 'View Dashboard', done: stepDashDone, onPress: undefined },
            ].map((step, i) => (
              <React.Fragment key={step.num}>
                {i > 0 && <View style={[styles.onboardingConnector, { backgroundColor: step.done ? '#1B5E20' : '#C8E6C9' }]} />}
                <TouchableOpacity
                  style={[styles.onboardingStep, { borderColor: step.done ? '#1B5E20' : '#C8E6C9', backgroundColor: step.done ? '#E8F5E9' : '#fff' }]}
                  onPress={step.onPress}
                  disabled={!step.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={step.label}
                >
                  <Text style={[styles.onboardingStepNum, { color: step.done ? '#1B5E20' : '#9E9E9E' }]}>
                    {step.done ? '✓' : String(step.num)}
                  </Text>
                  <Text style={[styles.onboardingStepLabel, { color: step.done ? '#1B5E20' : '#9E9E9E' }]}>{step.label}</Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => {
              setShowOnboardingStrip(false);
              AsyncStorage.setItem('@finpath_onboarding_strip_dismissed', '1');
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Dismiss onboarding guide"
          >
            <MaterialCommunityIcons name="close" size={16} color="#9E9E9E" />
          </TouchableOpacity>
        </View>
      )}

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

      {/* Empty-state nudge: no assets and no expenses */}
      {noData && (
        <InsightCard
          type="info"
          title="Add data for accurate projections"
          message="Add your assets and expenses so your FIRE projections reflect your actual situation."
        />
      )}

      {/* SIP burden warning — shown when required SIP exceeds or strains salary */}
      {sipBurdenInsight && result.sipBurdenWarning && (
        <InsightCard type={sipBurdenInsight.type} title={sipBurdenInsight.title} message={result.sipBurdenWarning} />
      )}
      {/* Zero-income nudge */}
      {noIncome && !result.sipBurdenWarning && (
        <InsightCard
          type="info"
          title="Add Monthly Income"
          message="Enter your monthly income in the Profile tab to get a SIP sustainability check."
        />
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

      {/* Finance wisdom — Pro only, context-matched daily quote */}
      {isPro && goals && (() => {
        const q = getContextualQuote(result, currentProfile, goals, currentProfile.id as number);
        return (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowPaywall(false)}
            style={styles.quoteCard}
          >
            <Text style={styles.quoteIcon}>"</Text>
            <Text style={styles.quoteText}>{q.text}</Text>
            <Text style={styles.quoteAttrib}>— {q.author}</Text>
            <Text style={styles.quoteBook}>{q.book}</Text>
          </TouchableOpacity>
        );
      })()}

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
                exportToCSV(currentProfile, assets, expenses, projections, result ?? undefined);
              }}>
              {isPro ? 'CSV' : '👑 CSV'}
            </Button>
            <Button mode="text" icon="file-pdf-box" compact
              onPress={() => {
                if (!isPro) { setShowPaywall(true); return; }
                if (result) exportToPDF(currentProfile, assets, expenses, projections, result, goals, sipAmount, sipReturnRate, postSipReturnRate, stepUpEnabled ? stepUpRate : 0, fxRates);
              }}>
              {isPro ? 'PDF' : '👑 PDF'}
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


      {/* One-time financial disclaimer — shown once per device, persisted in AsyncStorage */}
      <Portal>
        <Dialog
          visible={showDisclaimer}
          dismissable={false}
          style={{ backgroundColor: '#FFF', borderRadius: 16, marginHorizontal: 16 }}
        >
          <Dialog.Title style={{ color: '#1B5E20', fontWeight: '700' }}>
            FinPath is a planning tool
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ lineHeight: 22, color: '#333', marginBottom: 12 }}>
              Projections are <Text style={{ fontWeight: '700' }}>estimates</Text> based on your inputs and assumed growth rates. Returns are not guaranteed and actual results will vary.
            </Text>
            <Text variant="bodyMedium" style={{ lineHeight: 22, color: '#555' }}>
              FinPath is not a SEBI-registered investment advisor. Consult a licensed financial advisor before making major investment decisions.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              mode="contained"
              onPress={() => {
                AsyncStorage.setItem('@finpath_disclaimer_ack', '1');
                setShowDisclaimer(false);
              }}
              style={{ borderRadius: 8, paddingHorizontal: 8 }}
              textColor="#fff"
            >
              Got it
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
  onboardingStrip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 12, gap: 8, borderWidth: 1, borderColor: '#C8E6C9' },
  onboardingSteps: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  onboardingConnector: { height: 2, flex: 1 },
  onboardingStep: { alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  onboardingStepNum: { fontSize: 13, fontWeight: '700' },
  onboardingStepLabel: { fontSize: 10, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  chartCard: { marginBottom: 16, borderRadius: 12 },
  chartTitle: { fontWeight: 'bold', marginBottom: 2 },
  chartSubtitle: { color: '#6B7A6B', marginBottom: 12, marginTop: 2 },
  tableCard: { marginBottom: 16, borderRadius: 12 },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quoteCard: {
    backgroundColor: '#F9FBE7',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#558B2F',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  quoteIcon: { fontSize: 32, color: '#AED581', lineHeight: 32, marginBottom: 2 },
  quoteText: { fontSize: 13, color: '#33691E', lineHeight: 20, fontStyle: 'italic', marginBottom: 8 },
  quoteAttrib: { fontSize: 12, color: '#558B2F', fontWeight: '600' },
  quoteBook: { fontSize: 11, color: '#7CB342', marginTop: 2 },
});
