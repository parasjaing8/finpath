import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, Switch, Button, DataTable } from 'react-native-paper';
import { useProfile } from '../../hooks/useProfile';
import { getAssets, getExpenses, getGoals, Asset, Expense, Goals } from '../../db/queries';
import { calculateProjections, CalculationOutput, formatCurrency, formatCurrencyFull } from '../../engine/calculator';
import { exportToCSV } from '../../utils/export';
import { Slider } from '@miblanchard/react-native-slider';
import { CartesianChart, Line } from 'victory-native';
import { Path as SkiaPath, Line as SkiaLine, Circle as SkiaCircle, Text as SkiaText, DashPathEffect, Skia, vec, matchFont } from '@shopify/react-native-skia';
import { useNavigation, useRouter, useFocusEffect } from 'expo-router';
import { usePro } from '../../hooks/usePro';
import { ProPaywall } from '../../components/ProPaywall';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const { currentProfile, logout } = useProfile();
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
  const [showPaywall, setShowPaywall] = useState(false);
  const { isPro } = usePro();

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

  const handleLogout = useCallback(() => {
    logout();
    router.replace('/login');
  }, [logout, router]);


  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleLogout} style={{ marginRight: 14, padding: 4 }} accessibilityLabel="Logout" accessibilityRole="button">
          <MaterialCommunityIcons name="logout" size={22} color="#FFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleLogout]);

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
        <Text variant="bodyLarge" style={{ textAlign: 'center', color: '#666' }}>
          Set your goals first to see projections.
        </Text>
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
  const chartData = projections.map(p => ({
    age: p.age,
    netWorth: p.netWorthEOY,
    totalOutflow: p.totalOutflow,
  }));
  const retirementAge = goals.retirement_age;
  const firstFireYear = projections.find(p => p.isFireAchieved)?.year ?? -1;

  // SIP burden warning card — computed here to avoid inline IIFE in JSX
  let sipWarningCard: React.ReactNode = null;
  if (result.sipBurdenWarning) {
    const income = currentProfile.monthly_income ?? 0;
    const sipExceedsIncome = result.requiredMonthlySIP > income;
    const combinedWarning = result.sipBurdenWarning.startsWith('Required SIP') && result.sipBurdenWarning.includes('expenses');
    const bufferWarning = result.sipBurdenWarning.startsWith('SIP + expenses leave');
    const isRed = sipExceedsIncome || combinedWarning;
    const bgColor = isRed ? '#FFEBEE' : '#FFF8E1';
    const textColor = isRed ? '#C62828' : '#E65100';
    const title = sipExceedsIncome
      ? '⚠️ Required SIP Exceeds Salary'
      : combinedWarning
      ? '⚠️ SIP + Expenses Exceed Salary'
      : bufferWarning
      ? '⚠️ Low Income Buffer'
      : '⚠️ High SIP Burden';
    sipWarningCard = (
      <Card style={[styles.netWorthClarityCard, { backgroundColor: bgColor }]}>
        <Card.Content>
          <Text variant="labelSmall" style={{ color: textColor, fontWeight: 'bold', marginBottom: 4 }}>
            {title}
          </Text>
          <Text variant="bodySmall" style={{ color: '#555' }}>{result.sipBurdenWarning}</Text>
        </Card.Content>
      </Card>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>


      {/* Section A — Summary Tiles */}
      <Card style={[styles.tileFullWidth, { backgroundColor: '#E8F5E9' }]}>
        <Card.Content>
          <Text variant="labelSmall" style={styles.tileLabel}>Monthly SIP Required</Text>
          {result.requiredMonthlySIP > 0 ? (
            <Text variant="headlineSmall" style={[styles.tileValue, { color: '#1B5E20' }]}>
              {formatCurrencyFull(result.requiredMonthlySIP, currency)}
            </Text>
          ) : (
            <Text variant="headlineSmall" style={[styles.tileValue, { color: '#1B5E20' }]}>
              No SIP needed
            </Text>
          )}
        </Card.Content>
      </Card>
      <View style={styles.tilesRow}>
        <Card style={[styles.tile, { backgroundColor: '#FFF3E0' }]}>
          <Card.Content>
            <Text variant="labelSmall" style={styles.tileLabel}>Time to FIRE</Text>
            <Text variant="titleMedium" style={styles.tileValue}>
              {result.timeToFire > 0 ? `${result.timeToFire} years (age ${result.fireAchievedAge})` : result.fireAchievedAge > 0 ? `FIRE Reached! (age ${result.fireAchievedAge})` : 'Set goals first'}
            </Text>
          </Card.Content>
        </Card>
        <Card style={[styles.tile, { backgroundColor: result.isOnTrack ? '#E8F5E9' : '#FFEBEE' }]}>
          <Card.Content>
            <Text variant="labelSmall" style={styles.tileLabel}>Goal Status</Text>
            <Text variant="titleMedium" style={[styles.tileValue, { color: result.isOnTrack ? '#1B5E20' : '#C62828' }]}>
              {result.isOnTrack ? '🟢 On Track' : '🔴 Off Track'}
            </Text>
            {result.requiredMonthlySIP > 0 && (() => {
              const delta = sipAmount - result.requiredMonthlySIP;
              const label = delta >= 0
                ? `+${formatCurrency(delta, currency)}/mo surplus`
                : `${formatCurrency(Math.abs(delta), currency)}/mo short`;
              return (
                <Text variant="labelMedium" style={{ color: result.isOnTrack ? '#2E7D32' : '#C62828', marginTop: 4, fontWeight: '700' }}>
                  {label}
                </Text>
              );
            })()}
          </Card.Content>
        </Card>
      </View>

      {/* Row 3 — Today (left) vs Projections (right) */}
      <View style={styles.tilesRow}>
        <Card style={[styles.tile, { backgroundColor: '#F9FBF9' }]}>
          <Card.Content>
            <Text variant="labelSmall" style={styles.columnHeaderToday}>Today</Text>
            <Text variant="labelSmall" style={styles.tileLabel}>Investable Net Worth</Text>
            <Text variant="titleSmall" style={[styles.tileValue, { color: '#1B5E20' }]}>
              {formatCurrencyFull(result.investableNetWorth, currency)}
            </Text>
            <View style={styles.horizontalDivider} />
            <Text variant="labelSmall" style={styles.tileLabel}>Total NW (incl. home/car)</Text>
            <Text variant="titleSmall" style={styles.tileValue}>
              {formatCurrencyFull(result.totalNetWorth, currency)}
            </Text>
          </Card.Content>
        </Card>
        <Card style={[styles.tile, { backgroundColor: '#EDE7F6' }]}>
          <Card.Content>
            <Text variant="labelSmall" style={styles.columnHeaderProjections}>Projections</Text>
            <Text variant="labelSmall" style={styles.tileLabel}>At Retirement (Age {goals.retirement_age})</Text>
            <Text variant="titleSmall" style={styles.tileValue}>
              {formatCurrency(result.netWorthAtRetirement, currency)}
            </Text>
            <Text variant="bodySmall" style={styles.netWorthNote}>FIRE Corpus</Text>
            <View style={styles.horizontalDivider} />
            <Text variant="labelSmall" style={styles.tileLabel}>At Age 100</Text>
            <Text variant="titleSmall" style={[styles.tileValue, { color: result.netWorthAtAge100 < 0 ? '#C62828' : '#333' }]}>
              {formatCurrency(result.netWorthAtAge100, currency)}
            </Text>
            <Text variant="bodySmall" style={styles.netWorthNote}>
              {result.netWorthAtAge100 < 0 ? '⚠️ Corpus depleted' : 'Remaining corpus'}
            </Text>
          </Card.Content>
        </Card>
      </View>
      {/* SIP burden warning — shown when required SIP exceeds or strains salary */}
      {sipWarningCard}

      <Card style={styles.strategyCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.strategyTitle}>Adjust Your Plan</Text>

          <Text variant="labelMedium" style={styles.sliderLabel}>
            Monthly SIP: {formatCurrencyFull(sipAmountDisplay, currency)}
          </Text>
          <Slider
            value={sipAmountDisplay}
            onValueChange={(v: number[]) => setSipAmountDisplay(Math.round(v[0] / 1000) * 1000)}
            onSlidingComplete={(v: number[]) => setSipAmount(Math.round(v[0] / 1000) * 1000)}
            minimumValue={1000} maximumValue={500000} step={1000}
            minimumTrackTintColor="#1B5E20" thumbTintColor="#1B5E20"
          />

          <Text variant="bodySmall" style={styles.infoText}>
            SIP contributions stop at age {goals.sip_stop_age}. After that, your corpus grows through returns only.
          </Text>

          <Text variant="labelMedium" style={styles.sliderLabel}>
            Expected Return (SIP Phase): {sipReturnRateDisplay}%
          </Text>
          <Slider
            value={sipReturnRateDisplay}
            onValueChange={(v: number[]) => setSipReturnRateDisplay(Math.round(v[0]))}
            onSlidingComplete={(v: number[]) => setSipReturnRate(Math.round(v[0]))}
            minimumValue={5} maximumValue={20} step={1}
            minimumTrackTintColor="#1B5E20" thumbTintColor="#1B5E20"
          />
          <Text variant="labelMedium" style={styles.sliderLabel}>
            Expected Return (Post-Retirement): {postSipReturnRateDisplay}%
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
              yKeys={["netWorth", "totalOutflow"]}
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
                // FIRE corpus horizontal dashed line
                const fireY = yScale(result.fireCorpus);
                const firePath = Skia.Path.Make();
                firePath.moveTo(chartBounds.left, fireY);
                firePath.lineTo(chartBounds.right, fireY);

                // FIRE intersection point (net worth crosses FIRE corpus)
                const fireIdx = points.netWorth.findIndex(pt => (pt.yValue ?? 0) >= result.fireCorpus);
                const fp = fireIdx >= 0 ? points.netWorth[fireIdx] : null;

                // Retirement age vertical dashed line
                const retX = xScale(retirementAge);
                const retPath = Skia.Path.Make();
                retPath.moveTo(retX, chartBounds.top);
                retPath.lineTo(retX, canvasSize.height);

                return <>
                  <Line points={points.netWorth} color="#1B5E20" strokeWidth={2.5} />
                  <Line points={points.totalOutflow} color="#C62828" strokeWidth={2} />

                  {/* FIRE corpus horizontal dashed line */}
                  <SkiaPath path={firePath} color="#FF9800" strokeWidth={2} style="stroke">
                    <DashPathEffect intervals={[10, 6]} />
                  </SkiaPath>

                  {/* Retirement age vertical dashed line */}
                  <SkiaPath path={retPath} color="rgba(63,81,181,0.5)" strokeWidth={1.5} style="stroke">
                    <DashPathEffect intervals={[6, 4]} />
                  </SkiaPath>

                  {/* FIRE intersection — vertical line + dot + age label */}
                  {fp && <>
                    <SkiaLine
                      p1={vec(fp.x, chartBounds.top)}
                      p2={vec(fp.x, canvasSize.height)}
                      color="rgba(255,152,0,0.3)"
                      strokeWidth={1.5}
                      style="stroke"
                    />
                    <SkiaCircle cx={fp.x} cy={fireY} r={5} color="#FF9800" />
                    {fireAgeFont && (
                      <SkiaText
                        x={Math.max(chartBounds.left + 2, fp.x - 18)}
                        y={fireY - 9}
                        text={`Age ${result.fireAchievedAge}`}
                        font={fireAgeFont}
                        color="#E65100"
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
              <View style={[styles.legendDot, { backgroundColor: '#C62828' }]} />
              <Text variant="bodySmall">Outflow</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF9800', borderRadius: 0, height: 3, width: 16 }]} />
              <Text variant="bodySmall">
                {result.fireAchievedAge > 0 ? `FIRE @ Age ${result.fireAchievedAge}` : 'FIRE'}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: 'rgba(63,81,181,0.7)', borderRadius: 0, height: 3, width: 16 }]} />
              <Text variant="bodySmall">{`Retire @ ${retirementAge}`}</Text>
            </View>
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
            <ProPaywall visible={showPaywall} onDismiss={() => setShowPaywall(false)} reason="export" />
          </View>

          <ScrollView horizontal>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title style={styles.colNarrow}>Year</DataTable.Title>
                <DataTable.Title style={styles.colNarrow}>Age</DataTable.Title>
                <DataTable.Title style={styles.colWide} numeric>Annual SIP</DataTable.Title>
                <DataTable.Title style={styles.colWide} numeric>Vesting</DataTable.Title>
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
                    <DataTable.Cell style={styles.colWide} numeric>
                      {row.vestingIncome > 0 ? formatCurrency(row.vestingIncome, currency) : '—'}
                    </DataTable.Cell>
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
  netWorthClarityCard: { borderRadius: 12, marginBottom: 12 },
  horizontalDivider: { height: 1, backgroundColor: '#DDD', marginVertical: 10 },
  columnHeaderToday: { fontWeight: '700', color: '#1B5E20', marginBottom: 8, letterSpacing: 0.5 },
  columnHeaderProjections: { fontWeight: '700', color: '#5E35B1', marginBottom: 8, letterSpacing: 0.5 },
  strategyCard: { marginTop: 8, marginBottom: 16, borderRadius: 12 },
  strategyTitle: { fontWeight: 'bold', color: '#1B5E20', marginBottom: 12 },
  sliderLabel: { marginTop: 12, marginBottom: 4, fontWeight: '600' },
  infoText: { color: '#666', marginTop: 8, fontStyle: 'italic' },
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
  fireRow: { backgroundColor: '#C8E6C9' },
});
