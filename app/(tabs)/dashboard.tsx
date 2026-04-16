import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, Switch, Button, DataTable, Portal, Dialog, IconButton } from 'react-native-paper';
import { useProfile } from '../../hooks/useProfile';
import { getAssets, getExpenses, getGoals, Asset, Expense, Goals } from '../../db/queries';
import { calculateProjections, CalculationOutput, formatCurrency, formatCurrencyFull } from '../../engine/calculator';
import { exportToCSV } from '../../utils/export';
import { Slider } from '@miblanchard/react-native-slider';
import { CartesianChart, Line } from 'victory-native';
import { Path as SkiaPath, Circle as SkiaCircle, Text as SkiaText, DashPathEffect, LinearGradient as SkiaLinearGradient, Skia, vec, matchFont } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter, useFocusEffect } from 'expo-router';
import { usePro } from '../../hooks/usePro';
import { ProPaywall } from '../../components/ProPaywall';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const { currentProfile } = useProfile();
  const navigation = useNavigation();
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const { isPro } = usePro();
  const [showCorpusInfo, setShowCorpusInfo] = useState(false);
  const [showDepletionInfo, setShowDepletionInfo] = useState(false);

  // Table pagination
  const [tablePage, setTablePage] = useState(0);
  const rowsPerPage = 10;

  // Track the goals snapshot that was used for the last SIP auto-set.
  // Auto-set only fires again when goals actually change, not on every tab focus.
  const lastAutoSetGoalsKey = useRef<string | null>(null);

  // Create Skia font for chart labels using system typeface (Skia.Font(undefined) crashes in release)
  const fireAgeFont = useMemo(() => {
    try { return matchFont({ fontSize: 11 }); } catch { return null; }
  }, []);


  useEffect(() => {
    navigation.setOptions({ headerRight: undefined });
  }, [navigation]);

  const loadData = useCallback(async () => {
    if (!currentProfile) return;
    const [a, e, g] = await Promise.all([
      getAssets(currentProfile.id),
      getExpenses(currentProfile.id),
      getGoals(currentProfile.id),
    ]);
    setAssets(a);
    setExpenses(e);
    setGoals(g);
    // goals fingerprint is updated below — auto-set will re-fire if goals changed
    setDataLoaded(true);
  }, [currentProfile]);

  // Reload data every time this tab comes into focus — ensures fresh goals after saving
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const result: CalculationOutput | null = useMemo(() => {
    if (!currentProfile || !goals || !dataLoaded) return null;
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
  }, [currentProfile, assets, expenses, goals, sipAmount, sipReturnRate, postSipReturnRate, stepUpEnabled, stepUpRate, dataLoaded]);

  // Reset table to page 0 when projections change
  useEffect(() => {
    setTablePage(0);
  }, [result]);

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
  const paginatedRows = projections.slice(tablePage * rowsPerPage, (tablePage + 1) * rowsPerPage);

  // Plain variables — must NOT be hooks (useMemo) here because they are after early returns,
  // which would violate React's Rules of Hooks and crash on first load.
  const retirementAge = goals.retirement_age;
  const currentAge = (() => {
    const b = new Date(currentProfile.dob), n = new Date();
    let a = n.getFullYear() - b.getFullYear();
    if (n.getMonth() - b.getMonth() < 0 || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
    return a;
  })();
  // Only show withdrawal line post-retirement — pre-retirement expenses are salary-funded
  // and don't reduce corpus, so showing them alongside net worth growth is misleading.
  const chartData = projections.map(p => ({
    age: p.age,
    netWorth: p.netWorthEOY,
  }));
  const firstFireYear = projections.find(p => p.isFireAchieved)?.year ?? -1;
  const hasVesting = projections.some(p => p.vestingIncome > 0);

  // SIP burden warning card — four severity levels based on how badly SIP strains income
  let sipWarningCard: React.ReactNode = null;
  if (result.sipBurdenWarning) {
    const income = currentProfile.monthly_income ?? 0;
    const sipRatio = income > 0 ? result.requiredMonthlySIP / income : 0;
    // Detect combined-expense conditions from message (calculator encodes these)
    const isCombinedExceed = result.sipBurdenWarning.startsWith('Required SIP') && result.sipBurdenWarning.includes('expenses');
    const isBufferLow = result.sipBurdenWarning.startsWith('SIP + expenses leave');

    let severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'INFO';
    if (sipRatio > 1) severity = 'CRITICAL';
    else if (sipRatio > 0.6) severity = 'HIGH';
    else if (isCombinedExceed) severity = 'MODERATE';
    else if (isBufferLow) severity = 'INFO';
    else severity = 'INFO';

    const warningStyles: Record<typeof severity, { bg: string; titleColor: string; bodyColor: string; icon: string; title: string }> = {
      CRITICAL: { bg: '#FFEBEE', titleColor: '#B71C1C', bodyColor: '#C62828', icon: '⛔', title: 'Required SIP Exceeds Your Salary' },
      HIGH:     { bg: '#FFF3E0', titleColor: '#BF360C', bodyColor: '#E64A19', icon: '🔴', title: 'Very High SIP Burden (>60% of Income)' },
      MODERATE: { bg: '#FFFDE7', titleColor: '#F57F17', bodyColor: '#795548', icon: '⚠️', title: 'SIP + Expenses Exceed Monthly Income' },
      INFO:     { bg: '#F5F5F5', titleColor: '#616161', bodyColor: '#757575', icon: 'ℹ️', title: 'Low Income Buffer After SIP' },
    };
    const ws = warningStyles[severity];

    sipWarningCard = (
      <Card style={[styles.netWorthClarityCard, { backgroundColor: ws.bg, borderLeftWidth: severity === 'CRITICAL' ? 4 : severity === 'HIGH' ? 3 : 0, borderLeftColor: ws.titleColor }]}>
        <Card.Content>
          <Text variant="labelSmall" style={{ color: ws.titleColor, fontWeight: severity === 'CRITICAL' ? '900' : 'bold', marginBottom: 4, fontSize: severity === 'CRITICAL' ? 13 : 11 }}>
            {ws.icon} {ws.title}
          </Text>
          <Text variant="bodySmall" style={{ color: ws.bodyColor, fontStyle: severity === 'INFO' ? 'italic' : 'normal' }}>
            {result.sipBurdenWarning}
          </Text>
        </Card.Content>
      </Card>
    );
  }

  const sipRatio = result.requiredMonthlySIP > 0 ? sipAmountDisplay / result.requiredMonthlySIP : 1;
  const heroColors: [string, string] = sipRatio >= 1.15
    ? ['#1B5E20', '#2E7D32']
    : sipRatio >= 1.0
    ? ['#2E7D32', '#388E3C']
    : sipRatio >= 0.7
    ? ['#E65100', '#BF360C']
    : ['#B71C1C', '#7F0000'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>


      {/* Section A — Hero Card */}
      <LinearGradient colors={heroColors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.heroCard}>
        <Text style={styles.heroLabel}>YOUR MONTHLY SIP</Text>
        {result.requiredMonthlySIP > 0 ? (
          <Text style={styles.heroAmount}>{formatCurrencyFull(sipAmountDisplay, currency)}</Text>
        ) : (
          <Text style={styles.heroAmount}>No SIP needed</Text>
        )}
        <Text style={styles.heroSubtitle}>
          {result.requiredMonthlySIP > 0
            ? `Min. required: ${formatCurrency(result.requiredMonthlySIP, currency)} · Retire at ${retirementAge}`
            : `Assets cover retirement · Retire at ${retirementAge}`}
        </Text>
        <View style={styles.heroPillRow}>
          <View style={[styles.heroPill, styles.heroPillStatus]}>
            <Text style={[styles.heroPillText, { color: result.isOnTrack ? '#1B5E20' : '#C62828' }]}>
              {result.isOnTrack ? '✓ On Track' : '✗ Off Track'}
            </Text>
          </View>
          {result.fireAchievedAge > 0 && (
            result.failureAge > 0 ? (
              <TouchableOpacity
                style={[styles.heroPill, { backgroundColor: 'rgba(255,167,38,0.9)' }]}
                onPress={() => setShowDepletionInfo(true)}
                accessibilityRole="button"
                accessibilityLabel="Corpus depletion detail"
              >
                <Text style={styles.heroPillText}>⚠ Runs out at {result.failureAge} ›</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>✓ Lasts till {goals.fire_target_age ?? 100}</Text>
              </View>
            )
          )}
        </View>
      </LinearGradient>

      {/* Inflation Insight Card */}
      {(() => {
        const yearsToRetire = retirementAge - currentAge;
        const inflRate = (goals.inflation_rate ?? 6);
        const monthlyW = (goals.pension_income ?? 0);
        if (monthlyW <= 0 || yearsToRetire <= 0) return null;
        const inflatedMonthly = Math.round(monthlyW * Math.pow(1 + inflRate / 100, yearsToRetire));
        const annualNeed = Math.round(inflatedMonthly * 12);
        return (
          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>💡 Why {formatCurrency(result.fireCorpus, currency)}?</Text>
            <Text style={styles.insightBody}>
              {formatCurrencyFull(monthlyW, currency)}/month today{' = '}
              <Text style={styles.insightHighlight}>{formatCurrencyFull(inflatedMonthly, currency)}/month</Text>
              {' at age '}{retirementAge}{' ('}{inflRate}{'% inflation, '}{yearsToRetire}{' yrs). Corpus must cover '}{formatCurrency(annualNeed, currency)}{'/year.'}
            </Text>
          </View>
        );
      })()}

      {/* Snapshot Row */}
      <View style={styles.tilesRow}>
        <View style={[styles.snapTile, { backgroundColor: '#E8F5E9' }]}>
          <Text style={[styles.snapLabel, { color: '#1B5E20' }]}>TODAY</Text>
          <Text style={[styles.snapNumber, { color: '#1B5E20' }]}>{formatCurrency(result.investableNetWorth, currency)}</Text>
          <Text style={styles.snapSub}>Investable Net Worth</Text>
        </View>
        <View style={[styles.snapTile, { backgroundColor: '#EDE7F6' }]}>
          <IconButton
            icon="information-outline"
            size={16}
            iconColor="#7E57C2"
            style={{ position: 'absolute', top: 0, right: 0, margin: 0 }}
            onPress={() => setShowCorpusInfo(true)}
            accessibilityLabel="Why is the corpus this large?"
          />
          <Text style={[styles.snapLabel, { color: '#5E35B1' }]}>AT AGE {retirementAge}</Text>
          <Text style={[styles.snapNumber, { color: '#5E35B1' }]}>{formatCurrency(result.netWorthAtRetirement, currency)}</Text>
          <Text style={styles.snapSub}>Projected Corpus</Text>
        </View>
      </View>

      {/* SIP burden warning — shown when required SIP exceeds or strains salary */}
      {sipWarningCard}

      <Card style={styles.strategyCard}>
        <Card.Content>
          <View style={styles.strategyHeader}>
            <Text variant="titleMedium" style={styles.strategyTitle}>Adjust Your Plan</Text>
            <Text style={styles.strategyLiveValue}>{formatCurrency(sipAmountDisplay, currency)}/mo</Text>
          </View>

          {/* Primary control — always visible */}
          <Slider
            value={sipAmountDisplay}
            onValueChange={(v: number[]) => setSipAmountDisplay(Math.round(v[0] / 1000) * 1000)}
            onSlidingComplete={(v: number[]) => setSipAmount(Math.round(v[0] / 1000) * 1000)}
            minimumValue={1000} maximumValue={500000} step={1000}
            minimumTrackTintColor="#1B5E20" thumbTintColor="#1B5E20"
          />
          {(() => {
            if (result.requiredMonthlySIP <= 0) {
              return (
                <Text variant="bodySmall" style={[styles.infoText, { color: '#2E7D32', fontWeight: '700', fontStyle: 'normal' }]}>
                  ✓ Your existing assets cover retirement — no SIP needed
                </Text>
              );
            }
            const delta = sipAmount - result.requiredMonthlySIP;
            if (delta > 500 && result.fireAchievedAge > 0 && result.fireAchievedAge < retirementAge) {
              const ageDelta = retirementAge - result.fireAchievedAge;
              return (
                <Text variant="bodySmall" style={[styles.infoText, { color: '#2E7D32', fontWeight: '700', fontStyle: 'normal' }]}>
                  📍 At {formatCurrencyFull(sipAmount, currency)} → retire at {result.fireAchievedAge}, {ageDelta} yr{ageDelta !== 1 ? 's' : ''} earlier
                </Text>
              );
            }
            return (
              <Text variant="bodySmall" style={[styles.infoText, { color: '#616161', fontStyle: 'italic' }]}>
                Minimum to retire at {retirementAge} · SIP stops at {goals.sip_stop_age} · Step-up {stepUpEnabled ? `${stepUpRate}%/yr` : 'off'}
              </Text>
            );
          })()}

          {/* Advanced toggle */}
          <TouchableOpacity
            style={styles.advancedToggle}
            onPress={() => setShowAdvanced(v => !v)}
            accessibilityRole="button"
            accessibilityLabel={showAdvanced ? 'Hide advanced settings' : 'Show advanced settings'}
          >
            <Text variant="labelMedium" style={styles.advancedToggleText}>
              Advanced {showAdvanced ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {showAdvanced && (
            <>
              <Text variant="labelMedium" style={styles.sliderLabel}>
                Return While Investing (until age {goals.sip_stop_age}): {sipReturnRateDisplay}%
              </Text>
              <Slider
                value={sipReturnRateDisplay}
                onValueChange={(v: number[]) => setSipReturnRateDisplay(Math.round(v[0]))}
                onSlidingComplete={(v: number[]) => setSipReturnRate(Math.round(v[0]))}
                minimumValue={5} maximumValue={20} step={1}
                minimumTrackTintColor="#1B5E20" thumbTintColor="#1B5E20"
              />
              <Text variant="labelMedium" style={styles.sliderLabel}>
                Return After SIP Stops (from age {goals.sip_stop_age}): {postSipReturnRateDisplay}%
              </Text>
              <Slider
                value={postSipReturnRateDisplay}
                onValueChange={(v: number[]) => setPostSipReturnRateDisplay(Math.round(v[0]))}
                onSlidingComplete={(v: number[]) => setPostSipReturnRate(Math.round(v[0]))}
                minimumValue={3} maximumValue={15} step={1}
                minimumTrackTintColor="#1B5E20" thumbTintColor="#1B5E20"
              />
              <Text variant="bodySmall" style={styles.infoText}>
                Only withdrawn amounts are taxed. Remaining corpus compounds at gross return rate.
              </Text>

              <View style={styles.switchRow}>
                <Text variant="bodyMedium">Step-Up SIP</Text>
                <Switch value={stepUpEnabled} onValueChange={setStepUpEnabled} color="#1B5E20" />
              </View>
              {stepUpEnabled && (
                <>
                  <Text variant="labelMedium" style={styles.sliderLabel}>
                    Step-Up Rate: {stepUpRateDisplay}%/year
                  </Text>
                  <Slider
                    value={stepUpRateDisplay}
                    onValueChange={(v: number[]) => setStepUpRateDisplay(Math.round(v[0]))}
                    onSlidingComplete={(v: number[]) => setStepUpRate(Math.round(v[0]))}
                    minimumValue={5} maximumValue={20} step={1}
                    minimumTrackTintColor="#1B5E20" thumbTintColor="#1B5E20"
                  />
                </>
              )}
            </>
          )}
        </Card.Content>
      </Card>

      {/* Section C — Net Worth Projection Graph */}
      <Card style={styles.chartCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.chartTitle}>Net Worth Projection</Text>
          <View style={{ height: 300 }}>
            {chartData.length === 0 ? (
              <View style={styles.center}>
                <Text style={{ color: '#999' }}>No projection data available</Text>
              </View>
            ) : (
            <CartesianChart
              data={chartData}
              xKey="age"
              yKeys={["netWorth"]}
              domainPadding={{ top: 20, bottom: 20 }}
              axisOptions={{
                formatXLabel: (v) => `${Math.round(v)}`,
                formatYLabel: (v) => {
                  const abs = Math.abs(v);
                  if (abs >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
                  if (abs >= 1e5) return `${(v / 1e5).toFixed(0)}L`;
                  return `${(v / 1e3).toFixed(0)}K`;
                },
                tickCount: { x: 8, y: 5 },
                labelColor: '#555',
                lineColor: { grid: 'rgba(0,0,0,0.07)', frame: 'transparent' },
              }}
            >
              {({ points, yScale, xScale, canvasSize, chartBounds }) => {
                const retX = xScale(retirementAge);
                const retY = yScale(result.netWorthAtRetirement);
                const retPath = Skia.Path.Make();
                retPath.moveTo(retX, chartBounds.top);
                retPath.lineTo(retX, chartBounds.bottom);

                const failX = result.failureAge > 0 ? xScale(result.failureAge) : null;
                const failY = result.failureAge > 0 ? yScale(0) : null;

                // Net worth area fill (green gradient)
                const nwPts = points.netWorth.filter((p: any) => p.y != null);
                const nwAreaPath = Skia.Path.Make();
                if (nwPts.length > 0) {
                  nwAreaPath.moveTo(nwPts[0].x, chartBounds.bottom);
                  nwPts.forEach((p: any) => nwAreaPath.lineTo(p.x, p.y));
                  nwAreaPath.lineTo(nwPts[nwPts.length - 1].x, chartBounds.bottom);
                  nwAreaPath.close();
                }

                // Post-retirement outflow paths (red dashed + red fill)
                const postRetProj = projections.filter(p => p.age >= retirementAge && p.totalOutflow > 0);
                const ofLinePath = Skia.Path.Make();
                const ofAreaPath = Skia.Path.Make();
                if (postRetProj.length > 0) {
                  ofLinePath.moveTo(xScale(postRetProj[0].age), yScale(postRetProj[0].totalOutflow));
                  postRetProj.forEach(p => ofLinePath.lineTo(xScale(p.age), yScale(p.totalOutflow)));
                  ofAreaPath.moveTo(xScale(postRetProj[0].age), chartBounds.bottom);
                  postRetProj.forEach(p => ofAreaPath.lineTo(xScale(p.age), yScale(p.totalOutflow)));
                  ofAreaPath.lineTo(xScale(postRetProj[postRetProj.length - 1].age), chartBounds.bottom);
                  ofAreaPath.close();
                }

                return <>
                  {/* Green gradient fill under net worth */}
                  {nwPts.length > 0 && (
                    <SkiaPath path={nwAreaPath} style="fill" opacity={0.3}>
                      <SkiaLinearGradient
                        start={vec(0, chartBounds.top)}
                        end={vec(0, chartBounds.bottom)}
                        colors={['rgba(27,94,32,0.7)', 'rgba(27,94,32,0)']}
                      />
                    </SkiaPath>
                  )}

                  {/* Red gradient fill under post-retirement withdrawals */}
                  {postRetProj.length > 0 && (
                    <SkiaPath path={ofAreaPath} style="fill" opacity={0.25}>
                      <SkiaLinearGradient
                        start={vec(0, chartBounds.top)}
                        end={vec(0, chartBounds.bottom)}
                        colors={['rgba(198,40,40,0.5)', 'rgba(198,40,40,0)']}
                      />
                    </SkiaPath>
                  )}

                  <Line points={points.netWorth} color="#1B5E20" strokeWidth={2.5} />

                  {/* Red dashed outflow line (post-retirement withdrawals) */}
                  {postRetProj.length > 0 && (
                    <SkiaPath path={ofLinePath} color="#C62828" strokeWidth={2} style="stroke">
                      <DashPathEffect intervals={[6, 4]} />
                    </SkiaPath>
                  )}

                  {/* Retirement age vertical dashed line */}
                  <SkiaPath path={retPath} color="#1B5E20" strokeWidth={1.5} style="stroke">
                    <DashPathEffect intervals={[8, 5]} />
                  </SkiaPath>

                  {/* Age label at top of retirement line */}
                  {fireAgeFont && (
                    <SkiaText
                      x={Math.max(chartBounds.left + 2, retX - 20)}
                      y={chartBounds.top + 14}
                      text={`Age ${retirementAge}`}
                      font={fireAgeFont}
                      color="#1B5E20"
                    />
                  )}

                  {/* Peak corpus dot + value label at retirement age */}
                  <SkiaCircle cx={retX} cy={retY} r={5} color="#1B5E20" />
                  {fireAgeFont && (
                    <SkiaText
                      x={Math.max(chartBounds.left + 2, retX - 30)}
                      y={retY - 9}
                      text={formatCurrency(result.netWorthAtRetirement, currency)}
                      font={fireAgeFont}
                      color="#1B5E20"
                    />
                  )}

                  {/* Failure age red dot + label — only when corpus depletes */}
                  {failX != null && failY != null && <>
                    <SkiaCircle cx={failX} cy={failY} r={6} color="#C62828" />
                    {fireAgeFont && (
                      <SkiaText
                        x={Math.max(chartBounds.left + 2, failX - 35)}
                        y={failY - 9}
                        text={`Runs out at ${result.failureAge}`}
                        font={fireAgeFont}
                        color="#C62828"
                      />
                    )}
                  </>}

                </>;
              }}
            </CartesianChart>
            )}
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#1B5E20' }]} />
              <Text variant="bodySmall">Net Worth</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#1B5E20', borderRadius: 0, height: 3, width: 16 }]} />
              <Text variant="bodySmall">Retirement (Age {retirementAge})</Text>
            </View>
            {projections.some(p => p.age >= retirementAge && p.totalOutflow > 0) && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#C62828', borderRadius: 0, height: 3, width: 16 }]} />
                <Text variant="bodySmall" style={{ color: '#C62828' }}>Withdrawals</Text>
              </View>
            )}
            {result.failureAge > 0 && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#C62828' }]} />
                <Text variant="bodySmall" style={{ color: '#C62828' }}>Depletes at {result.failureAge}</Text>
              </View>
            )}
          </View>

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

          <ScrollView horizontal>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title style={styles.colNarrow}>Year</DataTable.Title>
                <DataTable.Title style={styles.colNarrow}>Age</DataTable.Title>
                <DataTable.Title style={styles.colWide} numeric>Annual SIP</DataTable.Title>
                {hasVesting && <DataTable.Title style={styles.colWide} numeric>Vesting</DataTable.Title>}
                <DataTable.Title style={styles.colWide} numeric>Expenses</DataTable.Title>
                <DataTable.Title style={styles.colWide} numeric>Pension</DataTable.Title>
                <DataTable.Title style={styles.colWide} numeric>Net Worth</DataTable.Title>
              </DataTable.Header>

              {paginatedRows.map(row => {
                const isFireRow = row.year === firstFireYear;
                return (
                  <DataTable.Row key={row.year} style={isFireRow ? styles.fireRow : undefined}>
                    <DataTable.Cell style={styles.colNarrow}>{row.year}</DataTable.Cell>
                    <DataTable.Cell style={styles.colNarrow}>{row.age}</DataTable.Cell>
                    <DataTable.Cell style={styles.colWide} numeric>
                      {formatCurrency(row.annualSIP, currency)}
                    </DataTable.Cell>
                    {hasVesting && (
                      <DataTable.Cell style={styles.colWide} numeric>
                        {row.vestingIncome > 0 ? formatCurrency(row.vestingIncome, currency) : '—'}
                      </DataTable.Cell>
                    )}
                    <DataTable.Cell style={styles.colWide} numeric>
                      {formatCurrency(row.plannedExpenses, currency)}
                    </DataTable.Cell>
                    <DataTable.Cell style={styles.colWide} numeric>
                      {formatCurrency(row.pensionIncome, currency)}
                    </DataTable.Cell>
                    <DataTable.Cell style={styles.colWide} numeric>
                      {formatCurrency(row.netWorthEOY, currency)}
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })}

              <DataTable.Pagination
                page={tablePage}
                numberOfPages={Math.ceil(projections.length / rowsPerPage)}
                onPageChange={setTablePage}
                label={`${tablePage * rowsPerPage + 1}-${Math.min((tablePage + 1) * rowsPerPage, projections.length)} of ${projections.length}`}
                numberOfItemsPerPage={rowsPerPage}
                showFastPaginationControls
              />
            </DataTable>
          </ScrollView>
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
  pageTitle: { fontWeight: 'bold', color: '#1B5E20', marginBottom: 16 },
  tilesRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  tile: { flex: 1, borderRadius: 12 },
  tileFullWidth: { borderRadius: 12, marginBottom: 12 },
  tileLabel: { color: '#666', marginBottom: 4 },
  tileValue: { fontWeight: 'bold' },
  netWorthNote: { color: '#888', marginTop: 2 },
  projectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  projectionRowLabel: { color: '#666', flex: 1 },
  gapChip: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, marginTop: 6, alignSelf: 'stretch', alignItems: 'center' },
  netWorthClarityCard: { borderRadius: 12, marginBottom: 12 },
  horizontalDivider: { height: 1, backgroundColor: '#DDD', marginVertical: 10 },
  columnHeaderToday: { fontWeight: '700', color: '#1B5E20', marginBottom: 8, letterSpacing: 0.5 },
  columnHeaderProjections: { fontWeight: '700', color: '#5E35B1', marginBottom: 8, letterSpacing: 0.5 },
  strategyCard: { marginTop: 8, marginBottom: 16, borderRadius: 12 },
  strategyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  strategyTitle: { fontWeight: 'bold', color: '#1B5E20' },
  strategyLiveValue: { fontSize: 14, fontWeight: '700', color: '#1B5E20' },
  sliderLabel: { marginTop: 12, marginBottom: 4, fontWeight: '600' },
  infoText: { color: '#666', marginTop: 8, fontStyle: 'italic' },
  advancedToggle: { marginTop: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  advancedToggleText: { color: '#1B5E20', fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  chartCard: { marginBottom: 16, borderRadius: 12 },
  chartTitle: { fontWeight: 'bold', marginBottom: 12 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  tableCard: { marginBottom: 16, borderRadius: 12 },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  colNarrow: { width: 60 },
  colWide: { width: 100 },
  heroCard: { borderRadius: 16, padding: 20, marginBottom: 12, overflow: 'hidden' },
  heroLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  heroAmount: { fontSize: 36, fontWeight: '800', color: '#fff', marginBottom: 4 },
  heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 14 },
  heroPillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  heroPill: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  heroPillStatus: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  heroPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  insightCard: { backgroundColor: '#FFFDE7', borderLeftWidth: 3, borderLeftColor: '#F9A825', borderRadius: 8, padding: 14, marginBottom: 12 },
  insightTitle: { fontSize: 13, fontWeight: '800', color: '#4E342E', marginBottom: 6 },
  insightBody: { fontSize: 12, color: '#4E342E', lineHeight: 18 },
  insightHighlight: { fontWeight: '800', color: '#BF360C' },
  snapTile: { flex: 1, borderRadius: 12, padding: 14 },
  snapLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  snapNumber: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  snapSub: { fontSize: 11, color: '#666' },
  fireRow: { backgroundColor: '#C8E6C9' },
});
