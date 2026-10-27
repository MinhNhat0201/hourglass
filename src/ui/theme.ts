import { useColorScheme } from 'react-native';

export interface Theme {
  dark: boolean;
  bg: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  danger: string;
  chip: string;
}

const light: Theme = {
  dark: false,
  bg: '#F6F2EC',
  surface: '#FFFDFA',
  border: '#E6DDD0',
  text: '#2A241E',
  textMuted: '#7B7064',
  accent: '#9C6C3A',
  accentText: '#FFFDFA',
  danger: '#B4483C',
  chip: '#EFE7DB',
};

const dark: Theme = {
  dark: true,
  bg: '#16130F',
  surface: '#211C17',
  border: '#352D25',
  text: '#F1EAE0',
  textMuted: '#A69A8C',
  accent: '#D3A66C',
  accentText: '#1D1813',
  danger: '#E07D70',
  chip: '#2C251E',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };
