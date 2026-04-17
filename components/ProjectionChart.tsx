import React, { useMemo, useState, useEffect, memo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, {
  Rect, Path, Line, Circle,
  Text as SvgText,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import { CustomSlider } from './CustomSlider';
import type { Expense } from '../engine/types';
import type { CalculationOutput } from '../engine/calculator';
import { formatCurrency } from '../engine/calculator';

// ─── Layout constants ──────────────────────────────────────────────────────
const CHART_H = 220;
const PAD = { top: 30, bottom: 32, left: 52, right: 16 };

// ─── Category emojis for FUTURE_ONE_TIME event markers ─────────────────────
const CATEGORY_EMOJI: Record<string, string> = {
  RENT: '\uD83C\uDFE0',        // 🏠
  TRANSPORT: '\uD83D\uDE97',   // 🚗
  EDUCATION: '\uD83C\uDF93',   // 🎓
  HEALTHCARE: '\uD83C\uDFE5',  // 🏥
  FOOD: '\uD83C\uDF7D',        // 🍽
  TRAVEL: '\u2708',            // ✈
  ENTERTAINMENT: '\uD83C\uDFAD',// 🎭
  OTHERS: '\uD83D\uDCB0',      // 💰
};

type ProjectionRow = CalculationOutput['projections'][0];

interface EventMarker {
  emoji: string;
  age: number;
  netWorth: number;
}

type RangeOption = 5 | 10 | 25 | null;
const RANGE_OPTIONS: { label: string; value: RangeOption }[] = [
  { label: '5Y', value: 5 },
  { label: '10Y', value: 10 },
  { label: '25Y', value: 25 },
  { label: 'All', value: null },
];

// ─── Props — same interface as previous ProjectionChart ────────────────────
interface Props {
  projections: ProjectionRow[];
  retirementAge: number;
  failureAge: number;
  fireTargetAge: number;
  expenses: Expense[];
  currency: string;
  result: CalculationOutput;
}

// ─── Y-axis label formatter ────────────────────────────────────────────────
function fmtY(v: number, currency: string): string {
  const sym = currency === 'INR' ? '\u20B9' : currency === 'USD' ? '$' : '';
  const abs = Math.abs(v);
  if (abs >= 1e7) return `${sym}${(v / 1e7).toFixed(0)}Cr`;
  if (abs >= 1e5) return `${sym}${(v / 1e5).toFixed(0)}L`;
  if (abs >= 1e3) return `${sym}${(v / 1e3).toFixed(0)}K`;
  return `${sym}${v.toFixed(0)}`;
}

// ─── Main component ────────────────────────────────────────────────────────
function ProjectionChartImpl({
  projections,
  retirementAge,
  failureAge,
  fireTargetAge,
  expenses,
  currency,
  result,
}: Props) {
  const chartW = Dimensions.get('window').width - 64;
  const innerW = chartW - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const chartBottom = PAD.top + innerH;
  const chartRight = PAD.left + innerW;

  const [rangeYears, setRangeYears] = useState<RangeOption>(null);
  const [windowStart, setWindowStart] = useState(0);

  const minAge = projections[0]?.age ?? 0;
  const maxAge = projections[projections.length - 1]?.age ?? 100;
  const totalSpan = Math.max(1, maxAge - minAge);

  // Clamp windowStart when range changes
  useEffect(() => {
    if (rangeYears == null) {
      setWindowStart(0);
    } else {
      const maxStart = Math.max(0, totalSpan - rangeYears);
      setWindowStart(s => Math.min(Math.max(0, s), maxStart));
    }
  }, [rangeYears, totalSpan]);

  // Slice projections to visible window
  const visibleProjections = useMemo(() => {
    if (rangeYears == null) return projections;
    const startAge = minAge + Math.round(windowStart);
    const endAge = startAge + rangeYears;
    return projections.filter(p => p.age >= startAge && p.age <= endAge);
  }, [projections, rangeYears, windowStart, minAge]);

  // Domain: min/max net worth over visible window
  const { maxNW, minNW } = useMemo(() => {
    const vals = visibleProjections.map(p => p.netWorthEOY);
    return { maxNW: Math.max(...vals, 1), minNW: Math.min(...vals, 0) };
  }, [visibleProjections]);

  const nwRange = Math.max(maxNW - minNW, 1);

  // Event markers from FUTURE_ONE_TIME expenses
  const eventMarkers = useMemo<EventMarker[]>(() => {
    return expenses
      .filter(e => e.expense_type === 'FUTURE_ONE_TIME' && e.start_date)
      .map(exp => {
        const yr = new Date(exp.start_date!).getFullYear();
        const p = projections.find(r => r.year === yr);
        if (!p) return null;
        return { emoji: CATEGORY_EMOJI[exp.category] ?? '\uD83D\uDCB0', age: p.age, netWorth: p.netWorthEOY };
      })
      .filter(Boolean) as EventMarker[];
  }, [expenses, projections]);

  // Geometry: coordinate helpers + pre-computed positions
  const geo = useMemo(() => {
    const a0 = visibleProjections[0]?.age ?? minAge;
    const a1 = visibleProjections[visibleProjections.length - 1]?.age ?? maxAge;
    const span = Math.max(1, a1 - a0);

    const xPos = (age: number) => PAD.left + ((age - a0) / span) * innerW;
    const yPos = (val: number) => PAD.top + innerH - ((val - minNW) / nwRange) * innerH;
    const inWindow = (age: number) => age >= a0 && age <= a1;

    // Net worth line + area points
    const nwPts = visibleProjections.map(p => ({ x: xPos(p.age), y: yPos(p.netWorthEOY) }));
    // Expense line (only rows with positive plannedExpenses)
    const expPts = visibleProjections
      .filter(p => p.plannedExpenses > 0)
      .map(p => ({ x: xPos(p.age), y: yPos(p.plannedExpenses) }));

    // Marker positions for retirement + failure
    const retX = inWindow(retirementAge) ? xPos(retirementAge) : null;
    const failX = failureAge > 0 && inWindow(failureAge) ? xPos(failureAge) : null;

    // Peak net worth across ALL projections (not just visible)
    let peakNW = 0, peakAge = retirementAge;
    for (const p of projections) {
      if (p.netWorthEOY > peakNW) { peakNW = p.netWorthEOY; peakAge = p.age; }
    }
    const peakX = inWindow(peakAge) ? xPos(peakAge) : null;
    const peakY = inWindow(peakAge) ? yPos(peakNW) : null;
    const peakIsSameAsRet = retX != null && peakX != null && Math.abs(peakX - retX) < 12;

    // Visible event markers
    const markers = eventMarkers
      .filter(m => inWindow(m.age))
      .map(m => ({ ...m, x: xPos(m.age), y: yPos(m.netWorth) }));

    // X-axis ticks
    const span5 = a1 - a0;
    const rawStep = span5 / 5;
    const tickStep = rawStep < 2 ? 1 : Math.max(5, Math.ceil(rawStep / 5) * 5);
    const xTicks: number[] = [];
    for (let a = a0; a <= a1; a += tickStep) xTicks.push(a);
    if (xTicks[xTicks.length - 1] !== a1) xTicks.push(a1);

    // Y-axis ticks (5 evenly spaced)
    const yStep = nwRange / 4;
    const yTicks = [0, 1, 2, 3, 4].map(i => minNW + yStep * i);

    return { nwPts, expPts, retX, failX, peakNW, peakAge, peakX, peakY, peakIsSameAsRet, markers, xPos, yPos, xTicks, yTicks };
  }, [visibleProjections, minAge, maxAge, innerW, innerH, minNW, nwRange, retirementAge, failureAge, projections, eventMarkers]);

  // SVG path strings
  const pathStrs = useMemo(() => {
    const { nwPts, expPts } = geo;
    const toLine = (pts: { x: number; y: number }[]) =>
      pts.length === 0
        ? ''
        : pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const nwLine = toLine(nwPts);
    const nwArea = nwPts.length === 0 ? '' :
      `${nwLine} L${nwPts[nwPts.length - 1].x.toFixed(1)},${chartBottom} L${nwPts[0].x.toFixed(1)},${chartBottom} Z`;
    return { nwLine, nwArea, expLine: toLine(expPts) };
  }, [geo, chartBottom]);

  const { retX, failX, peakNW, peakX, peakY, peakIsSameAsRet, markers, xPos, yPos, xTicks, yTicks } = geo;

  // Zone widths
  const preRetW = retX != null ? Math.max(0, retX - PAD.left) : innerW;
  const postRetEnd = failX ?? chartRight;
  const postRetW = retX != null ? Math.max(0, postRetEnd - retX) : 0;
  const dangerW = failX != null ? Math.max(0, chartRight - failX) : 0;

  // Window slider state
  const maxStart = rangeYears == null ? 0 : Math.max(0, totalSpan - rangeYears);
  const showSlider = rangeYears != null && maxStart > 0;
  const startAge = minAge + Math.round(windowStart);
  const endAge = rangeYears == null ? maxAge : startAge + rangeYears;

  return (
    <View>
      {/* ── Chart SVG + emoji overlay ─────────────────────────────────────── */}
      <View style={{ width: chartW, height: CHART_H }}>
        <Svg width={chartW} height={CHART_H}>
          <Defs>
            <SvgLinearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#1B5E20" stopOpacity="0.35" />
              <Stop offset="1" stopColor="#1B5E20" stopOpacity="0.02" />
            </SvgLinearGradient>
          </Defs>

          {/* Background zones: green (accumulation), blue (retirement), red (danger) */}
          <Rect x={PAD.left} y={PAD.top} width={preRetW} height={innerH} fill="rgba(200,230,201,0.3)" />
          {retX != null && postRetW > 0 && (
            <Rect x={retX} y={PAD.top} width={postRetW} height={innerH} fill="rgba(179,229,252,0.28)" />
          )}
          {failX != null && dangerW > 0 && (
            <Rect x={failX} y={PAD.top} width={dangerW} height={innerH} fill="rgba(239,154,154,0.40)" />
          )}

          {/* Net worth gradient fill */}
          {pathStrs.nwArea ? <Path d={pathStrs.nwArea} fill="url(#nwGrad)" /> : null}

          {/* Expenses line — dashed red */}
          {pathStrs.expLine ? (
            <Path d={pathStrs.expLine} stroke="#C62828" strokeWidth={1.5} fill="none" strokeDasharray="4,3" />
          ) : null}

          {/* Net worth line — solid green */}
          {pathStrs.nwLine ? (
            <Path d={pathStrs.nwLine} stroke="#1B5E20" strokeWidth={2.5} fill="none" />
          ) : null}

          {/* Retirement dashed vertical */}
          {retX != null && (
            <Line x1={retX} y1={PAD.top} x2={retX} y2={chartBottom}
              stroke="#1B5E20" strokeWidth={1.5} strokeDasharray="6,4" />
          )}

          {/* Y-axis labels */}
          {yTicks.map((v, i) => (
            <SvgText key={`y${i}`}
              x={PAD.left - 4} y={yPos(v) + 4}
              textAnchor="end" fontSize={9} fill="#888">
              {fmtY(v, currency)}
            </SvgText>
          ))}

          {/* X-axis labels */}
          {xTicks.map((a, i) => (
            <SvgText key={`x${i}`}
              x={xPos(a)} y={chartBottom + 14}
              textAnchor="middle" fontSize={10} fill="#888">
              {String(a)}
            </SvgText>
          ))}

          {/* "Retirement (N)" label — top of dashed vertical */}
          {retX != null && (
            <SvgText
              x={Math.min(retX + 3, chartRight - 82)}
              y={PAD.top + 12}
              fontSize={10} fill="#1B5E20" fontWeight="600">
              {`Retirement (${retirementAge})`}
            </SvgText>
          )}

          {/* "Danger zone" label — top of red zone */}
          {failX != null && dangerW > 52 && (
            <SvgText
              x={Math.min(failX + 4, chartRight - 66)}
              y={PAD.top + 12}
              fontSize={10} fill="#C62828" fontWeight="600">
              Danger zone
            </SvgText>
          )}

          {/* Peak dot + two-line label (only when not same position as retirement dot) */}
          {peakX != null && peakY != null && !peakIsSameAsRet && (
            <>
              <Circle cx={peakX} cy={peakY} r={5} fill="#1B5E20" />
              <SvgText
                x={Math.max(PAD.left + 2, Math.min(peakX - 12, chartRight - 56))}
                y={peakY - 16}
                fontSize={10} fill="#1B5E20" fontWeight="700">
                Peak
              </SvgText>
              <SvgText
                x={Math.max(PAD.left + 2, Math.min(peakX - 16, chartRight - 56))}
                y={peakY - 4}
                fontSize={9} fill="#1B5E20">
                {fmtY(peakNW, currency)}
              </SvgText>
            </>
          )}

          {/* Retirement corpus dot */}
          {retX != null && (
            <>
              <Circle cx={retX} cy={yPos(result.netWorthAtRetirement)} r={5} fill="#1B5E20" />
              {/* When peak coincides with retirement, show Peak label here */}
              {peakIsSameAsRet && (
                <>
                  <SvgText
                    x={Math.max(PAD.left + 2, retX + 7)}
                    y={yPos(result.netWorthAtRetirement) - 14}
                    fontSize={10} fill="#1B5E20" fontWeight="700">
                    Peak
                  </SvgText>
                  <SvgText
                    x={Math.max(PAD.left + 2, retX + 7)}
                    y={yPos(result.netWorthAtRetirement) - 2}
                    fontSize={9} fill="#1B5E20">
                    {fmtY(result.netWorthAtRetirement, currency)}
                  </SvgText>
                </>
              )}
            </>
          )}

          {/* Depletion dot + "Runs out at N" label */}
          {failX != null && (
            <>
              <Circle cx={failX} cy={chartBottom} r={6} fill="#C62828" />
              <SvgText
                x={Math.max(PAD.left + 2, failX - 50)}
                y={chartBottom - 8}
                fontSize={10} fill="#C62828" fontWeight="600">
                {`Runs out at ${failureAge}`}
              </SvgText>
            </>
          )}

          {/* "Sustains to N" — shown bottom-right when no depletion */}
          {failX == null && retX != null && (
            <SvgText
              x={chartRight - 2} y={chartBottom - 6}
              textAnchor="end" fontSize={10} fill="#1565C0">
              {`Sustains to ${fireTargetAge}`}
            </SvgText>
          )}

          {/* Event marker: ring on curve (emoji rendered in native overlay below) */}
          {markers.map((m, i) => (
            <Circle key={i}
              cx={m.x} cy={m.y} r={11}
              fill="rgba(255,255,255,0.88)" stroke="#E65100" strokeWidth={1.8} />
          ))}
        </Svg>

        {/* ── Emoji overlay: native Text elements positioned over SVG ── */}
        {markers.map((m, i) => (
          <Text key={i} style={[styles.emojiMarker, { left: m.x - 8, top: m.y - 9 }]}>
            {m.emoji}
          </Text>
        ))}
      </View>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#1B5E20' }]} />
          <Text style={styles.legendText}>Net Worth</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dashLine, { backgroundColor: '#1B5E20' }]} />
          <Text style={styles.legendText}>Retirement ({retirementAge})</Text>
        </View>
        {failureAge > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#C62828' }]} />
            <Text style={[styles.legendText, { color: '#C62828' }]}>Depletes at {failureAge}</Text>
          </View>
        )}
      </View>

      {/* ── Range buttons ────────────────────────────────────────────────── */}
      <View style={styles.rangeRow}>
        {RANGE_OPTIONS.map(opt => {
          const active = rangeYears === opt.value;
          return (
            <TouchableOpacity
              key={opt.label}
              onPress={() => setRangeYears(opt.value)}
              style={[styles.rangeBtn, {
                backgroundColor: active ? '#1B5E20' : '#E8F5E9',
                borderColor: active ? '#1B5E20' : '#D8DED8',
              }]}>
              <Text style={[styles.rangeBtnText, { color: active ? '#fff' : '#333' }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Window slider (only in ranged mode) ─────────────────────────── */}
      {showSlider && (
        <View style={styles.sliderWrap}>
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>Age {startAge}</Text>
            <Text style={styles.sliderLabel}>Age {endAge}</Text>
          </View>
          <CustomSlider
            value={windowStart}
            onValueChange={setWindowStart}
            minimumValue={0}
            maximumValue={maxStart}
            step={1}
            minimumTrackTintColor="#1B5E20"
            thumbTintColor="#1B5E20"
            maximumTrackTintColor="#D8DED8"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emojiMarker: {
    position: 'absolute',
    fontSize: 14,
    lineHeight: 18,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  rangeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  rangeBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sliderWrap: {
    marginTop: 6,
    marginBottom: 2,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: -2,
  },
  sliderLabel: {
    fontSize: 11,
    color: '#6B7A6B',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dashLine: {
    width: 14,
    height: 2,
    borderRadius: 1,
  },
  legendText: {
    fontSize: 11,
    color: '#555',
  },
});

export const ProjectionChart = memo(ProjectionChartImpl);
