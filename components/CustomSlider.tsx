import React, { useCallback, useRef } from 'react';
import { View, StyleSheet, PanResponder, LayoutChangeEvent, Platform, StyleProp, ViewStyle, DimensionValue } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { shadow } from '@/constants/theme';

interface Props {
  value: number;
  onValueChange?: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  minimumTrackTintColor?: string;
  thumbTintColor?: string;
  maximumTrackTintColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function CustomSlider({
  value,
  onValueChange,
  onSlidingComplete,
  minimumValue,
  maximumValue,
  step = 1,
  minimumTrackTintColor,
  thumbTintColor,
  maximumTrackTintColor,
  style,
}: Props) {
  const colors = useColors();
  const trackColor = maximumTrackTintColor ?? colors.border;
  const fillColor = minimumTrackTintColor ?? colors.primary;
  const thumbColor = thumbTintColor ?? colors.primary;

  const containerWidth = useRef(0);

  // Keep mutable refs in sync on every render so the PanResponder (created
  // once) always reads the latest prop values rather than stale closure values.
  const minRef = useRef(minimumValue);
  const maxRef = useRef(maximumValue);
  const stepRef = useRef(step);
  const onValueChangeRef = useRef(onValueChange);
  const onSlidingCompleteRef = useRef(onSlidingComplete);
  minRef.current = minimumValue;
  maxRef.current = maximumValue;
  stepRef.current = step;
  onValueChangeRef.current = onValueChange;
  onSlidingCompleteRef.current = onSlidingComplete;

  const clamp = useCallback((v: number) => {
    const min = minRef.current;
    const max = maxRef.current;
    const s = stepRef.current;
    let clamped = Math.max(min, Math.min(max, v));
    if (s > 0) {
      clamped = Math.round((clamped - min) / s) * s + min;
    }
    return clamped;
  }, []);

  const ratio = (value - minimumValue) / (maximumValue - minimumValue);
  const percent = Math.max(0, Math.min(1, ratio)) * 100;

  // Tap-to-jump on native works because `onStartShouldSetPanResponder`
  // claims the gesture immediately, and `onPanResponderGrant` fires for
  // pure taps as well as the start of a drag.
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX } = evt.nativeEvent;
      const w = containerWidth.current;
      if (w <= 0) return;
      const r = locationX / w;
      const raw = minRef.current + r * (maxRef.current - minRef.current);
      const clamped = clamp(raw);
      onValueChangeRef.current?.(clamped);
    },
    onPanResponderMove: (evt) => {
      const { locationX } = evt.nativeEvent;
      const w = containerWidth.current;
      if (w <= 0) return;
      const r = locationX / w;
      const raw = minRef.current + r * (maxRef.current - minRef.current);
      const clamped = clamp(raw);
      onValueChangeRef.current?.(clamped);
    },
    onPanResponderRelease: (evt) => {
      const { locationX } = evt.nativeEvent;
      const w = containerWidth.current;
      if (w <= 0) return;
      const r = locationX / w;
      const raw = minRef.current + r * (maxRef.current - minRef.current);
      const clamped = clamp(raw);
      onValueChangeRef.current?.(clamped);
      onSlidingCompleteRef.current?.(clamped);
    },
  })).current;

  function handleLayout(e: LayoutChangeEvent) {
    containerWidth.current = e.nativeEvent.layout.width;
  }

  // On web, use native input range for best UX
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webWrap, style]}>
        <input
          type="range"
          min={minimumValue}
          max={maximumValue}
          step={step}
          value={value}
          onChange={e => {
            const v = clamp(parseFloat(e.target.value));
            onValueChange?.(v);
          }}
          onMouseUp={e => {
            const v = clamp(parseFloat((e.target as HTMLInputElement).value));
            onSlidingComplete?.(v);
          }}
          onTouchEnd={e => {
            const v = clamp(parseFloat((e.target as HTMLInputElement).value));
            onSlidingComplete?.(v);
          }}
          style={{
            width: '100%',
            accentColor: fillColor,
            height: 36,
            cursor: 'pointer',
          } as any}
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.container, style]}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      <View style={[styles.track, { backgroundColor: trackColor }]}>
        <View style={[styles.fill, { backgroundColor: fillColor, width: (`${percent}%` as DimensionValue) }]} />
      </View>
      <View style={[styles.thumb, { backgroundColor: thumbColor, left: (`${percent}%` as DimensionValue) }]} />
    </View>
  );
}

const THUMB_SIZE = 20;

const styles = StyleSheet.create({
  container: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: THUMB_SIZE / 2,
    position: 'relative',
  },
  webWrap: {
    height: 36,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    marginLeft: -THUMB_SIZE / 2,
    ...shadow(2),
  },
});
