import { useColorScheme } from 'react-native';

// Tema Biru (seperti referensi gambar 2 & 3)
export const Colors = {
  light: {
    background: '#f3f6fc',
    card: '#ffffff',
    text: '#1f2937',
    textSecondary: '#6b7280',
    primary: '#2563eb',
    primaryLight: '#3b82f6',
    border: '#e5e7eb',
    danger: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
    tabBar: '#ffffff',
    tabBarInactive: '#9ca3af',
    headerText: '#ffffff',
  },
  dark: {
    background: '#111827',
    card: '#1f2937',
    text: '#f9fafb',
    textSecondary: '#9ca3af',
    primary: '#3b82f6',
    primaryLight: '#60a5fa',
    border: '#374151',
    danger: '#f87171',
    success: '#34d399',
    warning: '#fbbf24',
    tabBar: '#1f2937',
    tabBarInactive: '#6b7280',
    headerText: '#ffffff',
  }
};

export function useTheme() {
  // Selalu gunakan tema terang (light) sesuai permintaan agar dominan putih
  const scheme = 'light';
  return {
    colors: Colors[scheme],
    isDark: false
  };
}
