/**
 * OwlSet Theme Tokens - Light Mode First
 * Derived from the approved UI design specification.
 */

export const colors = {
  // Canvases and surfaces
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceSubtle: '#F9FAFB',
  surfaceRaised: '#F0F6F6',

  // Typography
  textPrimary: '#1E1E1E',
  textSecondary: '#4B5563',
  textMuted: '#64748B',
  placeholder: '#9CA3AF',

  // Primary brand accents (Mockup Teal)
  primary: '#4D8B8B',
  primaryPressed: '#3C6F6F',
  primaryMuted: '#8FB8B8',
  primaryLight: '#E8F2F2',
  onPrimary: '#FFFFFF',

  // Borders and dividers
  border: '#E5E7EB',
  cardBorder: '#E2E8F0',
  cardBorderSubtle: '#F1F5F9',
  cardDivider: '#E5E7EB',
  controlBorder: '#CBD5E1',
  controlBorderInactive: '#94A3B8',

  // Bottom Nav
  tabActive: '#4D8B8B',
  tabInactive: '#6B7280',
  tabBarBorder: '#E5E7EB',

  // Card & Badge tokens from UI Design
  cardHeaderBg: '#E9F2F2',
  badgeBg: '#E9F2F2',
  badgeText: '#334155',

  // Semantic statuses
  successText: '#15803D',
  successSurface: '#F0FDF4',
  successBorder: '#86EFAC',

  warningText: '#B45309',
  warningSurface: '#FFFBEB',
  warningBorder: '#FCD34D',

  infoText: '#1D4ED8',
  infoSurface: '#EFF6FF',
  infoBorder: '#93C5FD',

  errorText: '#DC2626',
  errorSurface: '#FEF2F2',
  errorBorder: '#FCA5A5',

  aiText: '#6B21A8',
  aiSurface: '#FAF5FF',
  aiBorder: '#DDD6FE',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  button: 12,
  card: 14,
  full: 9999,
} as const;

export const shadows = {
  // Subtle card elevation for modern light UI
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHover: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  subtle: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  modal: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
} as const;

export const theme = {
  colors,
  spacing,
  radii,
  shadows,
} as const;

export default theme;
