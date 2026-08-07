export interface CategoryTheme {
  label: string;
  emoji: string;
  bg: string;
  border: string;
  accent: string;
  bgDark: string;
  borderDark: string;
  accentDark: string;
}

export const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  geography: {
    label: 'Geography',
    emoji: '\u{1F30D}',
    bg: '#e3f1e6',
    border: '#c3e0c9',
    accent: '#2f6b4a',
    bgDark: '#1b2b21',
    borderDark: '#2c4432',
    accentDark: '#8fd6a8',
  },
  demographics: {
    label: 'Demographics',
    emoji: '\u{1F465}',
    bg: '#e1eefb',
    border: '#c3dff5',
    accent: '#2b5f8a',
    bgDark: '#16232f',
    borderDark: '#223a4d',
    accentDark: '#7db8e8',
  },
  economics: {
    label: 'Economics',
    emoji: '\u{1F4B0}',
    bg: '#fbf0d9',
    border: '#f3ddab',
    accent: '#8a6a1f',
    bgDark: '#2c2510',
    borderDark: '#453a19',
    accentDark: '#e0c069',
  },
  politics: {
    label: 'Politics',
    emoji: '\u{1F3DB}\u{FE0F}',
    bg: '#fbe3e3',
    border: '#f5c8c8',
    accent: '#9c3b3b',
    bgDark: '#2f1b1b',
    borderDark: '#4a2828',
    accentDark: '#e59a9a',
  },
  society: {
    label: 'Society',
    emoji: '\u{1F91D}',
    bg: '#ece1f7',
    border: '#dcc7ef',
    accent: '#6b4894',
    bgDark: '#241a2f',
    borderDark: '#38284a',
    accentDark: '#c9a8e8',
  },
  culture: {
    label: 'Culture',
    emoji: '\u{1F3AD}',
    bg: '#fbe6d9',
    border: '#f5cfae',
    accent: '#a15a2a',
    bgDark: '#2e2013',
    borderDark: '#48331e',
    accentDark: '#e8a672',
  },
  industry: {
    label: 'Industry',
    emoji: '\u{1F3ED}',
    bg: '#dcf3f0',
    border: '#bfe9e2',
    accent: '#1f7d6f',
    bgDark: '#142b27',
    borderDark: '#1f453d',
    accentDark: '#6fd1bf',
  },
  technology: {
    label: 'Technology',
    emoji: '\u{1F4E1}',
    bg: '#e2e9fb',
    border: '#c7d3f5',
    accent: '#3450a1',
    bgDark: '#1a2035',
    borderDark: '#293458',
    accentDark: '#9db0ea',
  },
  health: {
    label: 'Health',
    emoji: '\u{1FA7A}',
    bg: '#fce4ec',
    border: '#f6c9db',
    accent: '#a13a63',
    bgDark: '#301a24',
    borderDark: '#4a2836',
    accentDark: '#e894b3',
  },
  transport: {
    label: 'Transport',
    emoji: '\u{1F697}',
    bg: '#eef2d9',
    border: '#dee6b0',
    accent: '#5c6e1f',
    bgDark: '#232a13',
    borderDark: '#38431f',
    accentDark: '#b8cc6a',
  },
};

const FALLBACK_THEME: CategoryTheme = {
  label: '',
  emoji: '\u{1F4C4}',
  bg: '#ececec',
  border: '#dcdcdc',
  accent: '#5a5a5a',
  bgDark: '#232323',
  borderDark: '#343434',
  accentDark: '#b8b8b8',
};

export function getCategoryTheme(slug: string): CategoryTheme {
  const found = CATEGORY_THEMES[slug];
  if (found) return found;
  return {
    ...FALLBACK_THEME,
    label: slug.charAt(0).toUpperCase() + slug.slice(1),
  };
}
