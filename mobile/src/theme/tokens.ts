/**
 * SafeStep — Design Tokens
 * Centralized color palette, typography, spacing, and shadow system
 */

export const Colors = {
  // Brand
  primary: '#6C63FF',       // Vibrant purple
  primaryLight: '#9D97FF',
  primaryDark: '#3D35CC',
  accent: '#00E676',        // Safe green
  accentWarm: '#FFD600',    // Warning yellow
  danger: '#FF1744',        // Danger red
  warning: '#FF6D00',       // Risky orange

  // Backgrounds (deep dark)
  bg: '#0A0A1A',
  bgCard: '#12122A',
  bgElevated: '#1A1A35',
  bgGlass: 'rgba(255,255,255,0.07)',
  bgGlassBorder: 'rgba(255,255,255,0.12)',

  // Text
  textPrimary: '#F0F0FF',
  textSecondary: '#9090B0',
  textMuted: '#5A5A7A',
  textInverse: '#0A0A1A',

  // Safety Risk Colors
  safe: '#00E676',
  moderate: '#FFEA00',
  risky: '#FF6D00',
  dangerZone: '#D50000',

  // Overlays
  overlay: 'rgba(10,10,26,0.85)',
  overlayLight: 'rgba(108,99,255,0.15)',

  // Map Overlays (semi-transparent)
  safeRoute: 'rgba(0,230,118,0.8)',
  riskyRoute: 'rgba(255,109,0,0.8)',
  dangerRoute: 'rgba(213,0,0,0.8)',
};

export const Typography = {
  // Font sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 32,
  display: 42,

  // Font weights (React Native uses string)
  thin: '100' as const,
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
  extraBold: '800' as const,
  black: '900' as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const Radius = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  full: 999,
};

export const Shadows = {
  sm: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  md: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  lg: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },
  danger: {
    shadowColor: '#FF1744',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
};

export const getRiskColor = (score: number): string => {
  if (score >= 7.5) return Colors.safe;
  if (score >= 5.0) return Colors.moderate;
  if (score >= 2.5) return Colors.risky;
  return Colors.dangerZone;
};

export const getRiskLevel = (score: number): string => {
  if (score >= 7.5) return 'SAFE';
  if (score >= 5.0) return 'MODERATE';
  if (score >= 2.5) return 'RISKY';
  return 'DANGER';
};
