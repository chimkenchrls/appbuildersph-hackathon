import { Platform, type TextStyle } from 'react-native';

// Mint Slate (dark only). Values were sampled from the reviewed theme preview;
// contrast ratios are recorded in the design spec, section 6.
export const colors = {
  background: '#0E0E11',
  surface: '#121216',
  surfaceRaised: '#1C1C22',
  textPrimary: '#C9CFCF',
  textSecondary: '#939E9E',
  primary: '#85ADAD',
  onPrimary: '#0E0E11',
  primaryPressed: '#6F9595',
  border: '#2A2A30',
  controlBorder: '#6E7B7B',
  disabledText: '#6E7B7B',
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
