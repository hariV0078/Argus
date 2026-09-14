export const colors = {
  bg: '#081210',
  bgAlt: '#0A1815',
  surface: '#12201C',
  surfaceAlt: '#16261F',
  elevated: '#1A2C27',
  elevated2: '#213931',
  border: '#2E463D',
  borderBright: '#3A5A4C',
  text: '#E7F2EC',
  muted: '#9BB5AB',
  dim: '#6F877D',
  navy: '#0B1C18',
  ink: '#10212B',
  field: '#F4F7F5',
  blue: '#2AD4A1',
  blueDim: '#1A8F6E',
  brass: '#C4A35A',
  brassDim: '#8A733E',
  signal: '#2AD4A1',
  signalSoft: 'rgba(42, 212, 161, 0.14)',
  signalBorder: 'rgba(42, 212, 161, 0.4)',
  glow: 'rgba(42, 212, 161, 0.35)',
  green: '#3DDC97',
  amber: '#E0B14A',
  amberSoft: 'rgba(224, 177, 74, 0.14)',
  red: '#E05A5A',
  redSoft: 'rgba(224, 90, 90, 0.14)',
  semantic: '#3DDC97',
  white: '#FFFFFF',
  overlay: 'rgba(4, 10, 8, 0.6)',
};

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  raised: {
    shadowColor: '#000000',
    shadowOpacity: 0.36,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  glow: {
    shadowColor: colors.signal,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
};

export const fonts = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const type = {
  kicker: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.brass,
    textTransform: 'uppercase' as const,
  },
  title: { fontFamily: fonts.bold, fontSize: 26, color: colors.text },
  subtitle: { fontFamily: fonts.semibold, fontSize: 18, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.muted },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.signal },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.dim },
};
