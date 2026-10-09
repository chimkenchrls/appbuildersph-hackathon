import { Platform, type TextStyle } from 'react-native';

// Mint Teal (dark only). Neutrals are tinted toward the mascot's teal, text is brighter,
// and the mint accent carries more colour than the earlier Mint Slate values.
// Contrast ratios are recorded in the design spec, section 6.
export const colors = {
  background: '#0B1214',
  surface: '#111C1F',
  surfaceRaised: '#1A2A2E',
  textPrimary: '#E8F0EE',
  textSecondary: '#9DB2B0',
  primary: '#86D3C5',
  onPrimary: '#0B1214',
  primaryPressed: '#68B8AA',
  // Kwagi's body teal, for large brand fields. Not for controls.
  brand: '#2C6E78',
  onBrand: '#F0F8F6',
  border: '#263A3E',
  controlBorder: '#6F8C8C',
  disabledText: '#6F8C8C',
  successText: '#86D9A0',
  successSurface: '#11261B',
  warningText: '#F0B866',
  warningSurface: '#2B200E',
  infoText: '#8FB4F5',
  infoSurface: '#131E36',
  errorText: '#F2A0A0',
  errorSurface: '#2E1516',
  aiText: '#CDB4DD',
  aiSurface: '#36293D',
  destructive: '#7A1F1F',
  onDestructive: '#FFFFFF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const layout = {
  gutter: spacing.lg,
  minTouch: 48,
  // Keeps one readable column on tablets and in landscape.
  maxContentWidth: 720,
} as const;

export const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

export const type = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: colors.textPrimary },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.textPrimary },
  subheading: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: colors.textPrimary },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400', color: colors.textPrimary },
  support: { fontSize: 14, lineHeight: 20, fontWeight: '400', color: colors.textSecondary },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.textPrimary },
  mono: { fontSize: 14, lineHeight: 20, fontWeight: '600', fontFamily: mono, color: colors.textPrimary },
} satisfies Record<string, TextStyle>;
