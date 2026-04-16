import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { CartesianChart, Line } from 'victory-native';
import {
  Path as SkiaPath,
  Circle as SkiaCircle,
  Text as SkiaText,
  Rect as SkiaRect,
  DashPathEffect,
  LinearGradient as SkiaLinearGradient,
  Skia,
  vec,
  matchFont,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import type { Expense } from '../db/queries';
import type { CalculationOutput } from '../engine/calculator';
import { formatCurrency } from '../engine/calculator';

const CHART_HEIGHT = 300;

const CATEGORY_EMOJI: Record<string, string> = {
  RENT: '\u{1F3E0}',
  TRANSPORT: '\u{1F697}',
  EDUCATION: '\u{1F393}',
  HEALTHCARE: '\u{1F3E5}',
  OTHERS: '\u{1F4B0}',
};

type ProjectionRow = CalculationOutput['projections'][0];

interface EventMarker {
  emoji: string;
  name: string;
  amount: number;
  age: number;
  netWorth: number;
}

interface Props {
  projections: ProjectionRow[];
  retirementAge: number;
  failureAge: number;
  fireTargetAge: number;
  expenses: Expense[];
  currency: string;
  result: CalculationOutput;
}

export function ProjectionChart({
  projections,
  retirementAge,
  failureAge,
  fireTargetAge,
  expenses,
  currency,
  result,
}: Props) {
  const font = useMemo(() => {
    try { return matchFont({ fontSize: 11 }); } catch { return null; }
  }, []);

  const fontMd = useMemo(() => {
    try { return matchFont({ fontSize: 13 }); } catch { return null; }
  }, []);

  // ── Gesture: pinch to zoom + pan ──────────────────────────────────────────
  const chartW = Dimensions.get('window').width - 64;
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      'worklet';
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), 4);
    })
    .onEnd(() => {
      'worklet';
      savedScale.value = scale.value;
      // After zooming out fully, reset pan
      if (scale.value <= 1.01) {
        translateX.value = 0;
        translateY.value = 0;
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      const maxX = (chartW * (scale.value - 1)) / 2;
      const maxY = (CHART_HEIGHT * (scale.value - 1)) / 2;
      translateX.value = Math.min(Math.max(savedX.value + e.translationX, -maxX), maxX);
      translateY.value = Math.min(Math.max(savedY.value + e.translationY, -maxY), maxY);
    })
    .onEnd(() => {
      'worklet';
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // ── Derived: FUTURE_ONE_TIME event markers ────────────────────────────────
  const eventMarkers = useMemo<EventMarker[]>(() => {
    return expenses
      .filter(e => e.expense_type === 'FUTURE_ONE_TIME' && e.start_date)
      .map(exp => {
        const startYear = new Date(exp.start_date!).getFullYear();
        const matchP = projections.find(p => p.year === startYear);
        if (!matchP) return null;
        return {
          emoji: CATEGORY_EMOJI[exp.category] ?? '\u{1F4B0}',
          name: exp.name,
          amount: exp.amount,
          age: matchP.age,
          netWorth: matchP.netWorthEOY,
        };
      })
      .filter(Boolean) as EventMarker[];
  }, [expenses, projections]);

  const chartData = projections.map(p => ({ age: p.age, netWorth: p.netWorthEOY }));
  // Orange: post-retirement pension/withdrawal drawn from corpus
  const postRetPensionProj = projections.filter(p => p.age >= retirementAge && p.pensionIncome > 0);
  // Red: planned expenses across ALL years (pre + post retirement)
  const expLineProj = projections.filter(p => p.plannedExpenses > 0);

  const currSymbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '';

  return (
    <View>
      {/* ── Pinch/pan chart container ── */}
      <View style={{ height: CHART_HEIGHT, overflow: 'hidden', borderRadius: 8 }}>
        <GestureDetector gesture={composed}>
          <Animated.View style={[{ flex: 1 }, animatedStyle]}>
            {chartData.length === 0 ? (
              <View style={styles.center}>
                <Text style={{ color: '#999' }}>No projection data available</Text>
              </View>
            ) : (
              <CartesianChart
                data={chartData}
                xKey="age"
                yKeys={['netWorth']}
                domainPadding={{ top: 20, bottom: 20 }}
                axisOptions={{
                  formatXLabel: (v) => `${Math.round(v)}`,
                  formatYLabel: (v) => {
                    const abs = Math.abs(v);
                    if (abs >= 1e7) return `${currSymbol}${(v / 1e7).toFixed(0)} Cr`;
                    if (abs >= 1e5) return `${currSymbol}${(v / 1e5).toFixed(0)} L`;
                    return `${currSymbol}${(v / 1e3).toFixed(0)}K`;
                  },
                  tickCount: { x: 8, y: 6 },
                  labelColor: '#555',
                  lineColor: { grid: 'rgba(0,0,0,0.07)', frame: 'transparent' },
                }}
              >
                {({ points, yScale, xScale, chartBounds }) => {
                  const retX = xScale(retirementAge);
                  const retY = yScale(result.netWorthAtRetirement);
                  // Danger zone starts where net worth hits 0 (failureAge)
                  const failX = failureAge > 0 ? xScale(failureAge) : null;
                  const failY = failureAge > 0 ? yScale(0) : null;

                  // Peak net worth point
                  let peakNW = 0, peakAge = retirementAge;
                  for (const p of projections) {
                    if (p.netWorthEOY > peakNW) { peakNW = p.netWorthEOY; peakAge = p.age; }
                  }
                  const peakX = xScale(peakAge);
                  const peakY = yScale(peakNW);
                  const peakIsSameAsRet = Math.abs(peakX - retX) < 12;

                  // Background zone dimensions
                  const zoneH = chartBounds.bottom - chartBounds.top;
                  const preRetW = Math.max(0, retX - chartBounds.left);
                  const postRetEnd = failX ?? chartBounds.right;
                  const postRetW = Math.max(0, postRetEnd - retX);
                  // Danger zone: from where net worth = 0 to right edge
                  const dangerW = failX != null ? Math.max(0, chartBounds.right - failX) : 0;

                  // Net worth area fill path
                  const nwPts = points.netWorth.filter((p: any) => p.y != null);
                  const nwAreaPath = Skia.Path.Make();
                  if (nwPts.length > 0) {
                    nwAreaPath.moveTo(nwPts[0].x, chartBounds.bottom);
                    for (const p of nwPts as any[]) nwAreaPath.lineTo(p.x, p.y);
                    nwAreaPath.lineTo(nwPts[nwPts.length - 1].x, chartBounds.bottom);
                    nwAreaPath.close();
                  }

                  // Orange: pension/withdrawal line (post-retirement)
                  const pensionLinePath = Skia.Path.Make();
                  const pensionAreaPath = Skia.Path.Make();
                  if (postRetPensionProj.length > 0) {
                    pensionLinePath.moveTo(xScale(postRetPensionProj[0].age), yScale(postRetPensionProj[0].pensionIncome));
                    for (const p of postRetPensionProj) pensionLinePath.lineTo(xScale(p.age), yScale(p.pensionIncome));
                    pensionAreaPath.moveTo(xScale(postRetPensionProj[0].age), chartBounds.bottom);
                    for (const p of postRetPensionProj) pensionAreaPath.lineTo(xScale(p.age), yScale(p.pensionIncome));
                    pensionAreaPath.lineTo(xScale(postRetPensionProj[postRetPensionProj.length - 1].age), chartBounds.bottom);
                    pensionAreaPath.close();
                  }

                  // Red: planned expenses across all years
                  const expLinePath = Skia.Path.Make();
                  if (expLineProj.length > 0) {
                    expLinePath.moveTo(xScale(expLineProj[0].age), yScale(expLineProj[0].plannedExpenses));
                    for (const p of expLineProj) expLinePath.lineTo(xScale(p.age), yScale(p.plannedExpenses));
                  }

                  // Retirement dashed vertical
                  const retPath = Skia.Path.Make();
                  retPath.moveTo(retX, chartBounds.top);
                  retPath.lineTo(retX, chartBounds.bottom);

                  // Event marker canvas positions
                  const canvasMarkers = eventMarkers.map(m => ({
                    cx: xScale(m.age),
                    cy: yScale(m.netWorth),
                  }));

                  // "Danger zone" label: inside the red zone, top-right aligned
                  const dangerLabelX = failX != null
                    ? Math.min(failX + 4, chartBounds.right - 70)
                    : chartBounds.right - 70;

                  return (
                    <>
                      {/* ── Background zones ── */}
                      <SkiaRect x={chartBounds.left} y={chartBounds.top} width={preRetW} height={zoneH} color="rgba(200,230,201,0.28)" />
                      <SkiaRect x={retX} y={chartBounds.top} width={postRetW} height={zoneH} color="rgba(179,229,252,0.25)" />
                      {dangerW > 0 && (
                        <SkiaRect x={failX!} y={chartBounds.top} width={dangerW} height={zoneH} color="rgba(239,154,154,0.38)" />
                      )}

                      {/* ── Net worth gradient fill ── */}
                      {nwPts.length > 0 && (
                        <SkiaPath path={nwAreaPath} style="fill" opacity={0.3}>
                          <SkiaLinearGradient
                            start={vec(0, chartBounds.top)}
                            end={vec(0, chartBounds.bottom)}
                            colors={['rgba(27,94,32,0.7)', 'rgba(27,94,32,0)']}
                          />
                        </SkiaPath>
                      )}

                      {/* ── Orange pension area fill (post-retirement) ── */}
                      {postRetPensionProj.length > 0 && (
                        <SkiaPath path={pensionAreaPath} style="fill" opacity={0.20}>
                          <SkiaLinearGradient
                            start={vec(0, chartBounds.top)}
                            end={vec(0, chartBounds.bottom)}
                            colors={['rgba(230,145,0,0.55)', 'rgba(230,145,0,0)']}
                          />
                        </SkiaPath>
                      )}

                      {/* ── Lines: net worth (green), expenses (red), pension (orange) ── */}
                      <Line points={points.netWorth} color="#1B5E20" strokeWidth={2.5} />
                      {expLineProj.length > 0 && (
                        <SkiaPath path={expLinePath} color="#C62828" strokeWidth={1.8} style="stroke" />
                      )}
                      {postRetPensionProj.length > 0 && (
                        <SkiaPath path={pensionLinePath} color="#E65100" strokeWidth={2} style="stroke" />
                      )}

                      {/* ── Retirement dashed vertical ── */}
                      <SkiaPath path={retPath} color="#1B5E20" strokeWidth={1.5} style="stroke">
                        <DashPathEffect intervals={[8, 5]} />
                      </SkiaPath>

                      {/* ── "Retirement (X)" label at top of dashed line ── */}
                      {font && (
                        <SkiaText
                          x={Math.max(chartBounds.left + 2, retX - 26)}
                          y={chartBounds.top + 14}
                          text={`Retirement (${retirementAge})`}
                          font={font}
                          color="#555"
                        />
                      )}

                      {/* ── "Danger zone" label at top of red zone ── */}
                      {dangerW > 0 && font && (
                        <SkiaText
                          x={dangerLabelX}
                          y={chartBounds.top + 14}
                          text="Danger zone"
                          font={font}
                          color="#C62828"
                        />
                      )}

                      {/* ── Peak net worth dot + two-line label (only if differs from retirement) ── */}
                      {!peakIsSameAsRet && (
                        <>
                          <SkiaCircle cx={peakX} cy={peakY} r={5} color="#1B5E20" />
                          {fontMd && (
                            <>
                              <SkiaText
                                x={Math.max(chartBounds.left + 2, peakX - 14)}
                                y={peakY - 20}
                                text="Peak"
                                font={fontMd}
                                color="#1B5E20"
                              />
                              <SkiaText
                                x={Math.max(chartBounds.left + 2, peakX - 24)}
                                y={peakY - 5}
                                text={formatCurrency(peakNW, currency)}
                                font={fontMd}
                                color="#1B5E20"
                              />
                            </>
                          )}
                        </>
                      )}

                      {/* ── Retirement corpus dot + label ── */}
                      <SkiaCircle cx={retX} cy={retY} r={5} color="#1B5E20" />
                      {/* When peak == retirement: show two-line "Peak / value" label */}
                      {peakIsSameAsRet && fontMd && (
                        <>
                          <SkiaText
                            x={Math.max(chartBounds.left + 2, retX + 8)}
                            y={retY - 16}
                            text="Peak"
                            font={fontMd}
                            color="#1B5E20"
                          />
                          <SkiaText
                            x={Math.max(chartBounds.left + 2, retX + 8)}
                            y={retY - 2}
                            text={formatCurrency(result.netWorthAtRetirement, currency)}
                            font={fontMd}
                            color="#1B5E20"
                          />
                        </>
                      )}
                      {!peakIsSameAsRet && font && (
                        <SkiaText
                          x={Math.max(chartBounds.left + 2, retX - 30)}
                          y={retY - 9}
                          text={formatCurrency(result.netWorthAtRetirement, currency)}
                          font={font}
                          color="#1B5E20"
                        />
                      )}

                      {/* ── Depletion dot + prominent label ── */}
                      {failX != null && failY != null && (
                        <>
                          <SkiaCircle cx={failX} cy={failY} r={7} color="#C62828" />
                          {fontMd && (
                            <SkiaText
                              x={Math.max(chartBounds.left + 2, failX - 56)}
                              y={failY - 20}
                              text={`Runs out at ${failureAge}`}
                              font={fontMd}
                              color="#C62828"
                            />
                          )}
                        </>
                      )}

                      {/* ── Sustains label (no depletion) ── */}
                      {failX == null && font && (
                        <SkiaText
                          x={Math.max(retX + 4, chartBounds.right - 72)}
                          y={chartBounds.top + 14}
                          text={`Sustains to ${fireTargetAge}`}
                          font={font}
                          color="#1565C0"
                        />
                      )}

                      {/* ── Event marker rings on the curve ── */}
                      {canvasMarkers.map((m, i) => (
                        <React.Fragment key={i}>
                          <SkiaCircle cx={m.cx} cy={m.cy} r={9} color="rgba(255,255,255,0.85)" />
                          <SkiaCircle cx={m.cx} cy={m.cy} r={9} color="#E65100" strokeWidth={2} style="stroke" />
                        </React.Fragment>
                      ))}

                    </>
                  );
                }}
              </CartesianChart>
            )}
          </Animated.View>
        </GestureDetector>
      </View>

      {/* ── Legend ── */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#1B5E20' }]} />
          <Text variant="bodySmall">Net Worth</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#1B5E20', borderRadius: 0, height: 3, width: 16 }]} />
          <Text variant="bodySmall">Retirement ({retirementAge})</Text>
        </View>
        {expLineProj.length > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#C62828', borderRadius: 0, height: 3, width: 16 }]} />
            <Text variant="bodySmall" style={{ color: '#C62828' }}>Expenses</Text>
          </View>
        )}
        {postRetPensionProj.length > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#E65100', borderRadius: 0, height: 3, width: 16 }]} />
            <Text variant="bodySmall" style={{ color: '#E65100' }}>Withdrawals</Text>
          </View>
        )}
        {failureAge > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#C62828' }]} />
            <Text variant="bodySmall" style={{ color: '#C62828' }}>Depletes at {failureAge}</Text>
          </View>
        )}
        <Text variant="bodySmall" style={styles.zoomHint}>Pinch to zoom</Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  legendRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  zoomHint: { color: '#999', fontStyle: 'italic', fontSize: 10 },
});
