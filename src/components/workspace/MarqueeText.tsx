import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

interface MarqueeTextProps {
  /** The text content to display */
  text: string;
  /** Text style */
  style?: StyleProp<TextStyle>;
  /** Container style */
  containerStyle?: StyleProp<ViewStyle>;
  /** Scrolling speed in pixels per second. Default 32 */
  speed?: number;
  /** Pause duration at the beginning and end in milliseconds. Default 1400 */
  pauseDuration?: number;
  /** Whether the marquee animation is enabled. Default true */
  enabled?: boolean;
  /** Animation mode: 'bounce' (pans back and forth with pause) or 'loop' (continuous loop) */
  mode?: 'bounce' | 'loop';
}

/**
 * MarqueeText
 *
 * High-performance horizontal scrolling text component for overflowing content.
 * Automatically measures container and text width:
 * - If text fits: remains static (zero overhead, no motion).
 * - If text overflows: smoothly scrolls horizontally with natural pause intervals.
 * Driven entirely via native driver for 60fps performance without JS thread blocking.
 */
export function MarqueeText({
  text,
  style,
  containerStyle,
  speed = 32,
  pauseDuration = 1400,
  enabled = true,
  mode = 'bounce',
}: MarqueeTextProps) {
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [textWidth, setTextWidth] = useState<number>(0);
  const [translateX] = useState(() => new Animated.Value(0));
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const overflow = Math.max(0, textWidth - containerWidth);
  const shouldAnimate = enabled && overflow > 3;

  useEffect(() => {
    if (!shouldAnimate) {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      translateX.setValue(0);
      return;
    }

    translateX.setValue(0);
    const scrollDuration = Math.max(800, (overflow / speed) * 1000);

    let animation: Animated.CompositeAnimation;

    if (mode === 'bounce') {
      // Pan forward -> Pause -> Pan back -> Pause
      animation = Animated.loop(
        Animated.sequence([
          Animated.delay(pauseDuration),
          Animated.timing(translateX, {
            toValue: -overflow,
            duration: scrollDuration,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.delay(pauseDuration),
          Animated.timing(translateX, {
            toValue: 0,
            duration: scrollDuration,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      );
    } else {
      // Continuous loop
      animation = Animated.loop(
        Animated.sequence([
          Animated.delay(pauseDuration),
          Animated.timing(translateX, {
            toValue: -overflow,
            duration: scrollDuration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.delay(pauseDuration),
          Animated.timing(translateX, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
    }

    animationRef.current = animation;
    animation.start();

    return () => {
      animation.stop();
      animationRef.current = null;
    };
  }, [shouldAnimate, overflow, speed, pauseDuration, mode, translateX]);

  return (
    <View
      style={[styles.container, containerStyle]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={{
          transform: [{ translateX }],
          flexDirection: 'row',
        }}
      >
        <Text
          numberOfLines={1}
          style={style}
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        >
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
  },
});
