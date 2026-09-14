import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius } from '@/src/theme';

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const width = useRef(new Animated.Value(pct)).current;

  useEffect(() => {
    Animated.timing(width, { toValue: pct, duration: 420, useNativeDriver: false }).start();
  }, [pct, width]);

  return (
    <View style={styles.track}>
      <Animated.View
        style={[
          styles.fill,
          { width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    backgroundColor: colors.elevated,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.signal,
    borderRadius: radius.pill,
    shadowColor: colors.signal,
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});
