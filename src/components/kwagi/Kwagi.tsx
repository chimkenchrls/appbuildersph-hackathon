import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { useReduceMotion } from '@/hooks/useReduceMotion';

import {
  KWAGI_ASPECT_RATIO,
  KWAGI_WING_PIVOT,
  KwagiBody,
  KwagiHead,
  KwagiOpenEyes,
  KwagiWavingWing,
} from './KwagiArt';

type KwagiProps = {
  /** Width in logical pixels. Height follows the drawing's aspect ratio. */
  size?: number;
  /** Wave once when Kwagi first appears. */
  waveOnMount?: boolean;
  /** Wave when pressed. Turn off where the owner decides when he waves. */
  waveOnPress?: boolean;
  /** He waves each time this number changes to a new non-zero value. */
  waveSignal?: number;
  /** Called when Kwagi is pressed. */
  onPress?: () => void;
};

// Transform and opacity run on the native driver; react-native-web has no native driver.
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const BLINK_MIN_GAP_MS = 3000;
const BLINK_MAX_GAP_MS = 6000;
const BLINK_CLOSED_MS = 110;

// Wing angles in degrees, measured from the resting position.
// The wing is short, so it waves out to the side where the head does not hide it.
const WAVE_UP = -115;
const WAVE_OUT = -80;

export function Kwagi({ size = 200, waveOnMount = true, waveOnPress = true, waveSignal = 0, onPress }: KwagiProps) {
  const reduceMotion = useReduceMotion();
  // useState, not react-native's useAnimatedValue: react-native-web does not export that hook.
  const [eyesOpen] = useState(() => new Animated.Value(1));
  const [wingAngle] = useState(() => new Animated.Value(0));
  const waving = useRef(false);

  useEffect(() => {
    if (reduceMotion) {
      eyesOpen.setValue(1);
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const scheduleBlink = () => {
      const gap = BLINK_MIN_GAP_MS + Math.random() * (BLINK_MAX_GAP_MS - BLINK_MIN_GAP_MS);
      timer = setTimeout(() => {
        Animated.sequence([
          Animated.timing(eyesOpen, { toValue: 0, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.delay(BLINK_CLOSED_MS),
          Animated.timing(eyesOpen, { toValue: 1, duration: 70, useNativeDriver: USE_NATIVE_DRIVER }),
        ]).start(() => {
          if (!cancelled) scheduleBlink();
        });
      }, gap);
    };

    scheduleBlink();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      eyesOpen.stopAnimation();
    };
  }, [eyesOpen, reduceMotion]);

  const wave = useCallback(() => {
    if (reduceMotion || waving.current) return;
    waving.current = true;

    const swing = (toValue: number, duration: number) =>
      Animated.timing(wingAngle, {
        toValue,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      });

    Animated.sequence([
      Animated.timing(wingAngle, {
        toValue: WAVE_UP,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      swing(WAVE_OUT, 170),
      swing(WAVE_UP, 170),
      swing(WAVE_OUT, 170),
      swing(WAVE_UP, 170),
      Animated.timing(wingAngle, {
        toValue: 0,
        duration: 380,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(() => {
      waving.current = false;
    });
  }, [reduceMotion, wingAngle]);

  useEffect(() => {
    if (!waveOnMount || reduceMotion) return;
    const timer = setTimeout(wave, 400);
    return () => clearTimeout(timer);
  }, [reduceMotion, wave, waveOnMount]);

  useEffect(() => {
    if (waveSignal) wave();
  }, [wave, waveSignal]);

  useEffect(() => {
    if (!reduceMotion) return;
    wingAngle.stopAnimation();
    wingAngle.setValue(0);
    waving.current = false;
  }, [reduceMotion, wingAngle]);

  const rotate = wingAngle.interpolate({ inputRange: [-180, 0], outputRange: ['-180deg', '0deg'] });

  return (
    // Decorative: the text beside Kwagi carries the meaning, so screen readers skip him.
    <Pressable
      onPress={() => {
        if (waveOnPress) wave();
        onPress?.();
      }}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, aspectRatio: KWAGI_ASPECT_RATIO }}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <KwagiBody />
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.wing, { transform: [{ rotate }] }]} pointerEvents="none">
        <KwagiWavingWing />
      </Animated.View>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <KwagiHead />
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: eyesOpen }]} pointerEvents="none">
        <KwagiOpenEyes />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wing: {
    transformOrigin: `${KWAGI_WING_PIVOT.x * 100}% ${KWAGI_WING_PIVOT.y * 100}%`,
  },
});
