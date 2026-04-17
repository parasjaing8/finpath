import { Platform, ViewStyle } from 'react-native';

/**
 * Cross-platform shadow helper.
 *
 * - Web uses CSS `boxShadow` to avoid the React Native Web "shadow* style props
 *   are deprecated" warning.
 * - iOS keeps the legacy `shadow*` props (still the only path that produces
 *   real shadows on iOS).
 * - Android uses `elevation`.
 */
export type ShadowLevel = 1 | 2 | 3 | 4;

interface ShadowSpec {
  offsetY: number;
  blur: number;
  opacity: number;
  elevation: number;
}

const SHADOW_SPECS: Record<ShadowLevel, ShadowSpec> = {
  1: { offsetY: 1, blur: 3, opacity: 0.05, elevation: 1 },
  2: { offsetY: 1, blur: 4, opacity: 0.06, elevation: 2 },
  3: { offsetY: 2, blur: 6, opacity: 0.12, elevation: 4 },
  4: { offsetY: 4, blur: 8, opacity: 0.2, elevation: 6 },
};

export function shadow(level: ShadowLevel): ViewStyle {
  const s = SHADOW_SPECS[level];
  return Platform.select<ViewStyle>({
    web: {
      // boxShadow is honored by react-native-web ≥0.19 and is the
      // non-deprecated replacement for shadowColor/Offset/Opacity/Radius.
      ...({ boxShadow: `0px ${s.offsetY}px ${s.blur}px rgba(0,0,0,${s.opacity})` } as ViewStyle),
    },
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: s.offsetY },
      shadowOpacity: s.opacity,
      shadowRadius: s.blur / 2,
    },
    android: {
      elevation: s.elevation,
    },
    default: {},
  })!;
}

/** Web-only safe-area approximation used by stacked screens. */
export const WEB_HEADER_OFFSET = 67;
export const WEB_BOTTOM_OFFSET = 34;

/** Floating-action button geometry. */
export const FAB_SIZE = 56;
export const FAB_RIGHT = 20;
export const FAB_BOTTOM_NATIVE = 80;
export const FAB_BOTTOM_WEB = 24;

/** Chart layout. */
export const CHART_HEIGHT = 200;
export const CHART_PADDING = { top: 24, bottom: 28, left: 48, right: 16 };

/** Brand / status colors that aren't part of the themed palette. */
export const BRAND_COLORS = {
  successDeep: '#1B5E20',
  successDark: '#2E7D32',
  successMid: '#388E3C',
  warningDeep: '#E65100',
  warningDark: '#BF360C',
  dangerDeep: '#B71C1C',
  dangerDark: '#7F0000',
  dangerMid: '#C62828',
  infoMid: '#1565C0',
  successPale: '#C8E6C9',
} as const;
