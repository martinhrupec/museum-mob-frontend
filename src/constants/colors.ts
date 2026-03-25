/**
 * Glavne boje aplikacije
 */
export const COLORS = {
  // Primarne boje
  darkGreen: '#0A3323',
  mossGreen: '#A6C27A',
  beige: '#F7F4D5',
  rosyBrown: '#D3968C',
  midnightGreen: '#105666',

  // Semantičke boje
  background: '#F7F4D5', // beige
  text: '#0A3323', // dark green (default na beige pozadini)
  
  // Stanja
  success: '#A6C27A', // moss green
  warning: '#D3968C', // rosy brown
  error: '#D3968C', // rosy brown
  info: '#105666', // midnight green

  // Transparentne verzije
  overlay: 'rgba(10, 51, 35, 0.5)', // dark green overlay
  cardShadow: 'rgba(10, 51, 35, 0.1)',
};

/**
 * Boje za periode (timer)
 */
export const PERIOD_COLORS = {
  configuration: {
    background: '#D3968C', // rosy brown
    text: '#F7F4D5', // beige
  },
  fair: {
    background: '#A6C27A', // moss green
    text: '#105666', // midnight green
  },
  manual: {
    background: '#105666', // midnight green
    text: '#A6C27A', // moss green
  },
  neutral: {
    background: '#F7F4D5', // beige
    text: '#0A3323', // dark green
  },
};

/**
 * Helper za dobivanje boje teksta na osnovu pozadine
 */
export const getTextColorForBackground = (backgroundColor: string): string => {
  switch (backgroundColor) {
    case COLORS.darkGreen:
      return COLORS.mossGreen;
    case COLORS.mossGreen:
      return COLORS.midnightGreen;
    case COLORS.beige:
      return COLORS.darkGreen;
    case COLORS.rosyBrown:
      return COLORS.beige;
    case COLORS.midnightGreen:
      return COLORS.mossGreen;
    default:
      return COLORS.mossGreen;
  }
};

/**
 * Stilovi za tipografiju
 */
export const TYPOGRAPHY = {
  // Font family - koristi sistemski font
  fontFamily: undefined, // React Native default

  // Veličine
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 20,
    xxxl: 24,
    title: 28,
  },

  // Debljine
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

/**
 * Zajednički stilovi
 */
export const COMMON_STYLES = {
  // Container
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Kartice
  card: {
    backgroundColor: COLORS.beige,
    borderRadius: 12,
    padding: 16,
    shadowColor: COLORS.darkGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // Dugmad
  buttonPrimary: {
    backgroundColor: COLORS.darkGreen,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  buttonPrimaryText: {
    color: COLORS.mossGreen,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  buttonSecondary: {
    backgroundColor: COLORS.mossGreen,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  buttonSecondaryText: {
    color: COLORS.midnightGreen,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  buttonDanger: {
    backgroundColor: COLORS.rosyBrown,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  buttonDangerText: {
    color: COLORS.beige,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.darkGreen,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  buttonOutlineText: {
    color: COLORS.darkGreen,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  // Input polja
  input: {
    backgroundColor: COLORS.beige,
    borderWidth: 1,
    borderColor: COLORS.mossGreen,
    borderRadius: 8,
    padding: 12,
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.darkGreen,
  },

  // Tekst
  title: {
    fontSize: TYPOGRAPHY.fontSize.title,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.darkGreen,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.darkGreen,
  },
  body: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.darkGreen,
  },
  caption: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.darkGreen,
  },
};
