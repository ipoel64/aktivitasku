import React, { useEffect, useRef } from 'react';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Animated, Image, Alert } from 'react-native';
import { useTheme } from '../../theme/colors';
import kaihLogoAsset from '../../../assets/kaih_logo.png';
import { getUserStudentProfile, isProfileComplete } from '../../utils/userCache';

const GlowingAddButton = React.memo(() => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: 0.8,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.2,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <View style={{
      width: 68,
      height: 68,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 35,
    }}>
      <Animated.View style={{
        position: 'absolute',
        width: 68,
        height: 68,
        borderRadius: 34,
        borderWidth: 2.5,
        borderColor: '#60a5fa',
        opacity: glowOpacity,
        transform: [{ scale: pulseAnim }],
      }} />

      <View style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        borderWidth: 2.5,
        borderColor: '#93c5fd',
        padding: 3,
      }}>
        <Image
          source={kaihLogoAsset}
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: '#ffffff',
          }}
          resizeMode="contain"
        />

        <View style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          backgroundColor: '#2563eb',
          width: 20,
          height: 20,
          borderRadius: 10,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: '#ffffff',
          elevation: 3,
        }}>
          <Ionicons name="add" size={14} color="#ffffff" />
        </View>
      </View>
    </View>
  );
});

export default function TabLayout() {
  const { colors } = useTheme();

  // Helper check tab access
  const checkTabAccess = async (e: any) => {
    try {
      const userProfile = await getUserStudentProfile();
      const complete = isProfileComplete(userProfile);

      if (!complete) {
        e.preventDefault();
        Alert.alert(
          '⚠️ Profil Belum Lengkap',
          'Silakan lengkapi seluruh data identitas & akademik di menu Akun terlebih dahulu sebelum membuka fitur ini.'
        );
        router.replace('/(tabs)/profile');
      }
    } catch (err) {
      console.log('Tab check error:', err);
    }
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 70,
          paddingBottom: 12,
          paddingTop: 8,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 10,
          marginTop: 4,
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={24} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => checkTabAccess(e),
        })}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: '7 KAIH',
          tabBarIcon: ({ color }) => (
            <Ionicons name="document-text" size={24} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => checkTabAccess(e),
        })}
      />
      <Tabs.Screen
        name="dummy"
        options={{
          title: '',
          tabBarIcon: () => <GlowingAddButton />,
        }}
        listeners={({ navigation }) => ({
          tabPress: async (e) => {
            e.preventDefault();
            const userProfile = await getUserStudentProfile();
            const complete = isProfileComplete(userProfile);

            if (!complete) {
              Alert.alert(
                '⚠️ Profil Belum Lengkap',
                'Silakan lengkapi seluruh data identitas & akademik di menu Akun terlebih dahulu sebelum menginput aktivitas.'
              );
              router.replace('/(tabs)/profile');
            } else {
              router.push('/input');
            }
          },
        })}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Laporan',
          tabBarIcon: ({ color }) => (
            <Ionicons name="document-text-outline" size={24} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => checkTabAccess(e),
        })}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Akun',
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-circle" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
