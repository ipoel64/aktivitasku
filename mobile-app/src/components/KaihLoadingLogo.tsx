import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image, Modal } from 'react-native';
import budiUtomoLogoAsset from '../../assets/budi_utomo_logo.png';
import kaihLogoAsset from '../../assets/kaih_logo.png';

interface KaihAnimatedLogoProps {
  size?: number;
  message?: string;
  showText?: boolean;
  useKaihLogo?: boolean;
  customLogo?: any;
}

export const KaihAnimatedLogo: React.FC<KaihAnimatedLogoProps> = ({
  size = 75,
  message = '',
  showText = false,
  useKaihLogo = false,
  customLogo,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Breathing / Pulse animation
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Glow ring pulse
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.85,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.25,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    // Smooth continuous rotation for outer ring
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    pulseLoop.start();
    glowLoop.start();
    rotateLoop.start();

    return () => {
      pulseLoop.stop();
      glowLoop.stop();
      rotateLoop.stop();
    };
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const outerSize = size + 24;
  const ringSize = size + 14;

  const logoSource = customLogo || (useKaihLogo ? kaihLogoAsset : budiUtomoLogoAsset);

  return (
    <View style={styles.centerContainer}>
      <View style={{ width: outerSize, height: outerSize, justifyContent: 'center', alignItems: 'center' }}>
        {/* Rotating accent ring */}
        <Animated.View
          style={{
            position: 'absolute',
            width: outerSize,
            height: outerSize,
            borderRadius: outerSize / 2,
            borderWidth: 2,
            borderColor: 'rgba(59, 130, 246, 0.4)',
            opacity: 0.7,
            transform: [{ rotate: spin }],
          }}
        />

        {/* Pulsing blue glow ring */}
        <Animated.View
          style={{
            position: 'absolute',
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            backgroundColor: 'rgba(59, 130, 246, 0.25)',
            opacity: glowAnim,
            transform: [{ scale: pulseAnim }],
          }}
        />

        {/* Center Logo Container with Shadow */}
        <Animated.View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: '#ffffff',
            justifyContent: 'center',
            alignItems: 'center',
            elevation: 8,
            shadowColor: '#2563eb',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 8,
            borderWidth: 2,
            borderColor: '#60a5fa',
            transform: [{ scale: pulseAnim }],
          }}
        >
          <Image
            source={logoSource}
            style={{ width: size - 8, height: size - 8, borderRadius: (size - 8) / 2 }}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {showText && message ? (
        <Animated.Text style={styles.loadingText}>
          {message}
        </Animated.Text>
      ) : null}
    </View>
  );
};

export const KaihLoadingScreen: React.FC<{ message?: string; backgroundColor?: string }> = ({
  message = '',
  backgroundColor = '#f3f6fc',
}) => {
  return (
    <View style={[styles.fullScreen, { backgroundColor }]}>
      <KaihAnimatedLogo size={85} showText={false} />
    </View>
  );
};

export const KaihStatusModal: React.FC<{
  visible: boolean;
  message?: string;
  type?: 'loading' | 'success';
  onDismiss?: () => void;
}> = ({ visible, message = '', type = 'loading', onDismiss }) => {
  useEffect(() => {
    if (visible && type === 'success') {
      const timer = setTimeout(() => {
        if (onDismiss) onDismiss();
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [visible, type]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <KaihAnimatedLogo size={75} showText={false} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 18,
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
