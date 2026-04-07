/**
 * SafeStep — SOS Emergency Button
 * Pulsing red emergency button with hold-to-confirm mechanism
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Shadows, Typography, Radius } from '../theme/tokens';

interface Props {
  onTrigger: () => void;
  isActive: boolean;
}

const HOLD_DURATION = 2000; // 2 seconds hold to confirm

export const SOSButton: React.FC<Props> = ({ onTrigger, isActive }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [isHolding, setIsHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pulsing ring animation
  React.useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const handlePressIn = () => {
    setIsHolding(true);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: HOLD_DURATION,
      useNativeDriver: false,
    }).start();

    holdTimer.current = setTimeout(() => {
      Alert.alert(
        '🚨 SOS Activated',
        'Emergency contacts notified. Stay calm.',
        [{ text: 'OK' }]
      );
      onTrigger();
      setIsHolding(false);
      progressAnim.setValue(0);
    }, HOLD_DURATION);
  };

  const handlePressOut = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setIsHolding(false);
    Animated.timing(progressAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* Pulse Ring */}
      <Animated.View
        style={[
          styles.pulseRing,
          { transform: [{ scale: pulseAnim }], opacity: isActive ? 1 : 0.6 },
        ]}
      />

      {/* Main Button */}
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.85}
        style={styles.button}
      >
        <LinearGradient
          colors={isActive ? ['#FF1744', '#B71C1C'] : ['#D50000', '#FF1744']}
          style={styles.gradient}
        >
          {/* Progress arc */}
          {isHolding && (
            <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
          )}
          <Text style={styles.sosText}>SOS</Text>
          <Text style={styles.sosSubtext}>
            {isHolding ? 'HOLD...' : isActive ? 'ACTIVE' : 'HOLD 2s'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ...Shadows */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 110,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  pulseRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(213,0,0,0.3)',
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    ...Shadows.danger,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 32,
  },
  sosText: {
    fontSize: Typography.md,
    fontWeight: Typography.black,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  sosSubtext: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
    marginTop: 1,
  },
});
