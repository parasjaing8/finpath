import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, Switch, Button, DataTable } from 'react-native-paper';
import { useProfile } from '../../hooks/useProfile';
import { getAssets, getExpenses, getGoals, Asset, Expense, Goals } from '../../db/queries';
import { calculateProjections, CalculationOutput, formatCurrency, formatCurrencyFull } from '../../engine/calculator';
import { exportToCSV } from '../../utils/export';
import { Slider } from '@miblanchard/react-native-slider';
import { CartesianChart, Line } from 'victory-native';
import { Path as SkiaPath, Line as SkiaLine, DashPathEffect, Skia, vec } from '@shopify/react-native-skia';
import { useNavigation } from 'expo-router';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const { currentProfile, logout } = useProfile();
  const navigation = useNavigation();
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Dashboard Controls
  const [sipAmount, setSipAmount] = useState(10000);
  const [sipReturnRate, setSipReturnRate] = useState(12);
  const [postSipReturnRate, setPostSipReturnRate] = useState(10);
  const [stepUpEnabled, setStepUpEnabled] = useState(false);
  const [stepUpRate, setStepUpRate] = useState(10);

  // Table pagination
  const [tablePage, setTablePage] = useState(0);
  const rowsPerPage = 10;

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleLogout} style={{ marginRight: 14, padding: 4 }}>
          <MaterialCommunityIcons name="logout" size={22} color="#FFF" />
        </TouchableOpacity>
      ),
    });
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
    setDataLoaded(true);
  }, [currentProfile]);

  useEffect(() => { loadData(); }, [loadData]);

  const result: CalculationOutput | null = useMemo(() => {
    if (!currentProfile || !goals || !dataLoaded) return null;
    const output = calculateProjections({
      profile: currentProfile,
      assets,
      expenses,
      goals,
      sipAmount,
      sipReturnRate,
      postSipReturnRate,
      stepUpRate: stepUpEnabled ? stepUpRate : 0,
    });
    return output;
  }, [currentProfile, assets, expenses, goals, sipAmount, sipReturnRate, postSipReturnRate, stepUpEnabled, stepUpRate, dataLoaded]);

  // Set initial SIP from calculation
  useEffect(() => {
    if (result && result.requiredMonthlySIP > 0 && sipAmount === 10000) {
      setSipAmount(Math.ceil(result.requiredMonthlySIP / 1000) * 1000);
    }
  }, [result?.requiredMonthlySIP]);

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

  // Chart data
  const chartData = projections.map(p => ({
    age: p.age,
    netWorth: p.netWorthEOY,
    expenses: p.plannedExpenses,
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text variant="titleLarge" style={styles.pageTitle}>Your Path to Financial Freedom</Text>

      {/* Section A — Summary Tiles */}
      <View style={styles.tilesRow}>
        <Card style={[styles.tile, { backgroundColor: '#E8F5E9' }]}>
          <Card.Content>
            <Text variant="labelSmall" style={styles.tileLabel}>Monthly SIP Required</Text>
            <Text variant="titleMedium" style={styles.tileValue}>
              {formatCurrencyFull(result.requiredMonthlySIP, currency)}
            </Text>
          </Card.Content>
        </Card>
        <Card style={[styles.tile, { backgroundColor: '#E3F2FD' }]}>
          <Card.Content>
            <Text variant="labelSmall" style={styles.tileLabel}>FIRE Corpus</Text>
            <Text variant="titleMedium" style={styles.tileValue}>
              {formatCurrency(result.fireCorpus, currency)}
            </Text>
          </Card.Content>
        </Card>
      </View>
      <View style={styles.tilesRow}>
        <Card style={[styles.tile, { backgroundColor: '#FFF3E0' }]}>
          <Card.Content>
            <Text variant="labelSmall" style={styles.tileLabel}>Time to FIRE</Text>
            <Text variant="titleMedium" style={styles.tileValue}>
              {result.timeToFire > 0 ? `${result.timeToFire} years (age ${result.fireAchievedAge})` : 'N/A'}
            </Text>
          </Card.Content>
        </Card>
        <Card style={[styles.tile, { backgroundColor: result.isOnTrack ? '#E8F5E9' : '#FFEBEE' }]}>
          <Card.Content>
            <Text variant="labelSmall" style={styles.tileLabel}>Goal Status</Text>
            <Text variant="titleMedium" style={[styles.tileValue, { color: result.isOnTrack ? '#1B5E20' : '#C62828' }]}>
              {result.isOnTrack ? '🟢 On Track' : '🔴 Off Track'}
            </Text>
          </Card.Content>
        </Card>
      </View>

      {/* Section B — SIP Investment Strategy */}
      <Card style={styles.strategyCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.strategyTitle}>SIP Investment Strategy</Text>

          <Text variant="labelMedium" style={styles.sliderLabel}>
            Monthly SIP: {formatCurrencyFull(sipAmount, currency)}
          </Text>
          <Slider
            value={sipAmount}
            onValueChange={(v: number[]) => setSipAmount(Math.round(v[0] / 1000) * 1000)}
            minimumValue={1000} maximumValue={500000} step={1000}
            minimumTrackTintColor="#1B5E20" thumbTintColor="#1B5E20"
          />

          <Text variant="bodySmall" style={styles.infoText}>
            SIP contributions stop at age {goals.sip_stop_age}. After that, your corpus grows through returns only.
          </Text>

          <Text variant="labelMedium" style={styles.sliderLabel}>
            Expected Return (SIP Phase): {sipReturnRate}%
          </Text>
          <Slider
            value={sipReturnRate}
            onValueChange={(v: number[]) => setSipReturnRate(Math.round(v[0]))}
            minimumValue={5} maximumValue={20} step={1}
            minimumTrackTintColor="#1B5E20" thumbTintColor="#1B5E20"
          />

          <Text variant="labelMedium" style={styles.sliderLabel}>
            Expected Return (Post-SIP): {postSipReturnRate}%
          </Text>
          <Slider
            value={postSipReturnRate}
            onValueChange={(v: number[]) => setPostSipReturnRate(Math.round(v[0]))}
            minimumValue={5} maximumValue={20} step={1}
            minimumTrackTintColor="#1B5E20" thumbTintColor="#1B5E20"
          />

          <View style={styles.switchRow}>
            <Text variant="bodyMedium">Step-Up SIP</Text>
            <Switch value={stepUpEnabled} onValueChange={setStepUpEnabled} color="#1B5E20" />
          </View>
          {stepUpEnabled && (
            <>
              <Text variant="labelMedium" style={styles.sliderLabel}>
                Step-Up Rate: {stepUpRate}%/year
              </Text>
              <Slider
                value={stepUpRate}
                onValueChange={(v: number[]) => setStepUpRate(Math.round(v[0]))}
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
              yKeys={["netWorth", "expenses"]}
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
              {({ points, yScale, canvasSize, chartBounds }) => {
                const fireY = yScale(result.fireCorpus);
                const firePath = Skia.Path.Make();
                firePath.moveTo(chartBounds.left, fireY);
                firePath.lineTo(chartBounds.right, fireY);
                const fireIdx = points.netWorth.findIndex(pt => (pt.yValue ?? 0) >= result.fireCorpus);
                const fp = fireIdx >= 0 ? points.netWorth[fireIdx] : null;
                return <>
                  <Line points={points.netWorth} color="#1B5E20" strokeWidth={2.5} />
                  <Line points={points.expenses} color="#C62828" strokeWidth={2} />
                  <SkiaPath path={firePath} color="#FF9800" strokeWidth={2} style="stroke">
                    <DashPathEffect intervals={[10, 6]} />
                  </SkiaPath>
                  {fp && (
                    <SkiaLine
                      p1={vec(fp.x, 0)}
                      p2={vec(fp.x, canvasSize.height)}
                      color="rgba(255,152,0,0.35)"
                      strokeWidth={1.5}
                      style="stroke"
                    />
                  )}
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
              <Text variant="bodySmall">Expenses</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF9800', borderRadius: 0, height: 3, width: 16 }]} />
              <Text variant="bodySmall">
                FIRE{result.fireAchievedAge > 0 ? ` @ Age ${result.fireAchievedAge}` : ''}
              </Text>
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
              onPress={() => exportToCSV(currentProfile, assets, expenses, projections)}>
              CSV
            </Button>
          </View>

          <ScrollView horizontal>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title style={styles.colNarrow}>Year</DataTable.Title>
                <DataTable.Title style={styles.colNarrow}>Age</DataTable.Title>
                <DataTable.Title style={styles.colWide} numeric>Annual SIP</DataTable.Title>
                <DataTable.Title style={styles.colWide} numeric>Expenses</DataTable.Title>
                <DataTable.Title style={styles.colWide} numeric>Pension</DataTable.Title>
                <DataTable.Title style={styles.colWide} numeric>Net Worth</DataTable.Title>
              </DataTable.Header>

              {paginatedRows.map(row => {
                const isFireRow = row.isFireAchieved &&
                  (projections.findIndex(p => p.isFireAchieved) === projections.indexOf(row));
                return (
                  <DataTable.Row key={row.year} style={isFireRow ? styles.fireRow : undefined}>
                    <DataTable.Cell style={styles.colNarrow}>{row.year}</DataTable.Cell>
                    <DataTable.Cell style={styles.colNarrow}>{row.age}</DataTable.Cell>
                    <DataTable.Cell style={styles.colWide} numeric>
                      {formatCurrency(row.annualSIP, currency)}
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
  tileLabel: { color: '#666', marginBottom: 4 },
  tileValue: { fontWeight: 'bold' },
  strategyCard: { marginTop: 8, marginBottom: 16, borderRadius: 12 },
  strategyTitle: { fontWeight: 'bold', color: '#1B5E20', marginBottom: 12 },
  sliderLabel: { marginTop: 12, marginBottom: 4, fontWeight: '600' },
  infoText: { color: '#666', marginTop: 8, fontStyle: 'italic' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  chartCard: { marginBottom: 16, borderRadius: 12 },
  chartTitle: { fontWeight: 'bold', marginBottom: 12 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  tableCard: { marginBottom: 16, borderRadius: 12 },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  colNarrow: { width: 60 },
  colWide: { width: 100 },
  fireRow: { backgroundColor: '#C8E6C9' },
});
