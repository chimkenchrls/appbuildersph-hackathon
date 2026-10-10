import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '@/constants/theme';

export interface SlideTransitionProps {
  activeKey: string;
  direction?: 'forward' | 'backward';
  duration?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

interface ScreenHistoryState {
  key: string;
  child: React.ReactNode;
  prevChild: React.ReactNode | null;
  prevKey: string | null;
  direction: 'forward' | 'backward';
}

/**
 * SlideTransition provides a hardware-accelerated, native-grade horizontal
 * slide transition when switching between pages or screens.
 *
 * Forward transition:
 * - Entering view slides in from the right edge on top (zIndex: 2) with elevation shadow.
 * - Exiting view shifts slightly to the left with subtle parallax and dimming (zIndex: 1).
 *
 * Backward transition:
 * - Exiting view on top (zIndex: 2) slides away to the right with elevation shadow.
 * - Entering view underneath (zIndex: 1) shifts back from left and brightens to full opacity.
 */
export function SlideTransition({
  activeKey,
  direction = 'forward',
  duration = 260,
  children,
  style,
  disabled = false,
}: SlideTransitionProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState<number>(windowWidth || 360);

  // Animated value held in lazy state to avoid ref access during render
  const [animValue] = useState(() => new Animated.Value(1));
  const activeAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Screen history held in state to adjust safely during render without refs
  const [history, setHistory] = useState<ScreenHistoryState>({
    key: activeKey,
    child: children,
    prevChild: null,
    prevKey: null,
    direction,
  });

  // Adjust state during render when activeKey or children change
  if (!disabled && activeKey !== history.key) {
    setHistory({
      key: activeKey,
      child: children,
      prevChild: history.child,
      prevKey: history.key,
      direction,
    });
  } else if (!disabled && children !== history.child && history.prevChild === null) {
    setHistory({
      key: activeKey,
      child: children,
      prevChild: null,
      prevKey: null,
      direction: history.direction,
    });
  }

  // Handle onLayout to ensure exact container width (supports tablets and responsive layouts)
  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0 && Math.abs(width - containerWidth) > 1) {
      setContainerWidth(width);
    }
  };

  // Run transition animation whenever prevChild is present
  useEffect(() => {
    if (history.prevChild !== null) {
      if (activeAnimationRef.current) {
        activeAnimationRef.current.stop();
      }

      animValue.setValue(0);

      const animation = Animated.timing(animValue, {
        toValue: 1,
        duration,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: Platform.OS !== 'web',
      });

      activeAnimationRef.current = animation;

      animation.start((result) => {
        activeAnimationRef.current = null;
        if (result.finished) {
          setHistory((prev) => ({
            ...prev,
            prevChild: null,
            prevKey: null,
          }));
        }
      });

      return () => {
        animation.stop();
      };
    }
  }, [history.prevChild, duration, animValue]);

  // If animations are disabled or not transitioning, render normal view
  if (disabled || history.prevChild === null) {
    return (
      <View style={[styles.container, style]} onLayout={handleLayout}>
        {children}
      </View>
    );
  }

  const effectiveWidth = containerWidth > 0 ? containerWidth : (windowWidth || 360);
  const isForward = history.direction === 'forward';

  const exitingTranslateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isForward ? -effectiveWidth * 0.28 : effectiveWidth],
  });

  const exitingOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, isForward ? 0.6 : 0.85],
  });

  const enteringTranslateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [isForward ? effectiveWidth : -effectiveWidth * 0.28, 0],
  });

  const enteringOpacity = animValue.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [isForward ? 0.95 : 0.6, isForward ? 1 : 0.9, 1],
  });

  const enteringZIndex = isForward ? 2 : 1;
  const exitingZIndex = isForward ? 1 : 2;

  const enteringHasShadow = isForward;
  const exitingHasShadow = !isForward;

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      {/* Exiting View */}
      <Animated.View
        key={`exiting-${history.prevKey || 'prev'}`}
        style={[
          styles.layer,
          {
            zIndex: exitingZIndex,
            transform: [{ translateX: exitingTranslateX }],
            opacity: exitingOpacity,
          },
          exitingHasShadow ? styles.cardShadow : null,
        ]}
        pointerEvents="none"
      >
        {history.prevChild}
      </Animated.View>

      {/* Entering View */}
      <Animated.View
        key={`entering-${activeKey}`}
        style={[
          styles.layer,
          {
            zIndex: enteringZIndex,
            transform: [{ translateX: enteringTranslateX }],
            opacity: enteringOpacity,
          },
          enteringHasShadow ? styles.cardShadow : null,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.background,
    position: 'relative',
  },
  layer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
  },
  cardShadow: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(0, 0, 0, 0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: -3, height: 0 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      default: {
        boxShadow: '-3px 0 10px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
});
