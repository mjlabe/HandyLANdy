import { useColorScheme } from 'react-native';

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 6, md: 10, lg: 14, full: 999 } as const;
export const typography = {
  hero: { fontSize: 30, fontWeight: '600', letterSpacing: -0.8 },
  title: { fontSize: 22, fontWeight: '600', letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 14, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '500' },
  caption: { fontSize: 11, fontWeight: '400' },
} as const;

export function useTheme() {
  const dark = useColorScheme() === 'dark';
  return {
    dark,
    text: dark ? '#F3F3F3' : '#171717',
    muted: dark ? '#929292' : '#858585',
    background: dark ? '#080808' : '#F5F5F5',
    surface: dark ? '#1B1B1B' : '#FFFFFF',
    control: dark ? '#2B2B2B' : '#EEEEEE',
    line: dark ? '#303030' : '#E8E8E8',
    accent: '#00AE42',
    accentSoft: dark ? '#102A19' : '#EAF7EE',
    onAccent: '#FFFFFF',
    danger: dark ? '#FF9B92' : '#BC3931',
    warning: dark ? '#EDCF85' : '#805E18',
    onCamera: '#FFFFFF',
    cameraBackground: '#101010',
    cameraAccent: '#30D468',
    cameraOverlay: 'rgba(0, 0, 0, 0.48)',
    grid: '#464646',
  };
}
