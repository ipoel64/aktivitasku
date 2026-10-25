import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

import { Platform } from 'react-native';

// SSR-safe storage adapter: Only bypass on Web SSR (Node.js). On Android/iOS, always use AsyncStorage!
const isWebSSR = Platform.OS === 'web' && typeof window === 'undefined';

const SafeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (isWebSSR) return null;
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (isWebSSR) return;
    try {
      await AsyncStorage.setItem(key, value);
    } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    if (isWebSSR) return;
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};

let supabaseClient: any;
try {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: SafeStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
} catch (e) {
  console.error("Supabase init error:", e);
}

export const supabase = supabaseClient;

