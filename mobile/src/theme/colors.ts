export interface ThemeColors {
  brand: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  bg: string;
  card: string;
  cardBorder: string;
  surfaceSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textWhite: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  danger: string;
  dangerLight: string;
  info: string;
  infoLight: string;
  purple: string;
  purpleLight: string;
  payment: {
    cash: string;
    cashBg: string;
    upi: string;
    upiBg: string;
    card: string;
    cardBg: string;
    credit: string;
    creditBg: string;
  };
}

export const lightColors: ThemeColors = {
  brand: {
    50: '#fdf2f8',
    100: '#fce7f3',
    200: '#fbcfe8',
    300: '#f9a8d4',
    400: '#f472b6',
    500: '#ec4899',
    600: '#db2777',
    700: '#be185d',
    800: '#9d174d',
    900: '#831843',
  },
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#e2e8f0',
  surfaceSubtle: '#f1f5f9',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#64748b',
  textWhite: '#ffffff',
  success: '#10b981',
  successLight: '#ecfdf5',
  warning: '#f59e0b',
  warningLight: '#fffbeb',
  danger: '#ef4444',
  dangerLight: '#fef2f2',
  info: '#3b82f6',
  infoLight: '#eff6ff',
  purple: '#8b5cf6',
  purpleLight: '#f5f3ff',
  payment: {
    cash: '#10b981',
    cashBg: '#d1fae5',
    upi: '#6366f1',
    upiBg: '#e0e7ff',
    card: '#0ea5e9',
    cardBg: '#e0f2fe',
    credit: '#f59e0b',
    creditBg: '#fef3c7',
  },
};

export const darkColors: ThemeColors = {
  brand: {
    50: '#831843',
    100: '#9d174d',
    200: '#be185d',
    300: '#db2777',
    400: '#ec4899',
    500: '#f472b6',
    600: '#f472b6',
    700: '#f9a8d4',
    800: '#fbcfe8',
    900: '#fdf2f8',
  },
  bg: '#090d16', // Deep Obsidian Black
  card: '#131b2e', // Slate 900 elevated surface
  cardBorder: '#23304a', // Slate 800 border
  surfaceSubtle: '#1b253b',
  textPrimary: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#64748b',
  textWhite: '#ffffff',
  success: '#34d399',
  successLight: '#064e3b',
  warning: '#fbbf24',
  warningLight: '#78350f',
  danger: '#f87171',
  dangerLight: '#7f1d1d',
  info: '#60a5fa',
  infoLight: '#1e3a8a',
  purple: '#a78bfa',
  purpleLight: '#3b0764',
  payment: {
    cash: '#34d399',
    cashBg: '#064e3b',
    upi: '#818cf8',
    upiBg: '#312e81',
    card: '#38bdf8',
    cardBg: '#0c4a6e',
    credit: '#fbbf24',
    creditBg: '#78350f',
  },
};

// Default export for backward compatibility
export const colors = lightColors;
