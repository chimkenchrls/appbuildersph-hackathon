import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { colors, radii } from '@/constants/theme';

interface CardWatermarkSvgProps {
  color?: string;
  opacity?: number;
  position?: 'top-right' | 'bottom-right';
}

export function CardWatermarkSvg({
  color = colors.primaryMuted,
  opacity = 0.09,
  position = 'top-right',
}: CardWatermarkSvgProps) {
  return (
    <View
      style={[
        styles.container,
        position === 'top-right' ? styles.topRight : styles.bottomRight,
      ]}
      pointerEvents="none"
    >
      <Svg width={120} height={120} viewBox="0 0 120 120" fill="none">
        <G stroke={color} strokeWidth={1.2} strokeOpacity={opacity}>
          {/* Concentric arcs radiating subtly from the corner */}
          <Circle cx={120} cy={0} r={35} />
          <Circle cx={120} cy={0} r={60} />
          <Circle cx={120} cy={0} r={85} strokeDasharray="3 4" />
          <Circle cx={120} cy={0} r={110} />
          {/* Fine 45-degree angle hatching */}
          <Path d="M 60 0 L 120 60" />
          <Path d="M 85 0 L 120 35" />
          {/* Subtle tilted diamond watermark seal */}
          <Rect
            x={82}
            y={22}
            width={24}
            height={24}
            rx={4}
            transform="rotate(45 94 34)"
          />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 120,
    height: 120,
    overflow: 'hidden',
    zIndex: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopRightRadius: radii.card,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomRightRadius: radii.card,
  },
});
