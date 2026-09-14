import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Animated, ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, fonts, radius, shadows } from '@/src/theme';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'outline';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', icon, disabled, loading, style }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const bg =
    variant === 'primary'
      ? colors.signal
      : variant === 'danger'
        ? colors.red
        : variant === 'outline'
          ? colors.signalSoft
          : 'transparent';
  const border =
    variant === 'outline' ? colors.signalBorder : variant === 'ghost' ? colors.border : 'transparent';
  const color = variant === 'primary' ? colors.navy : variant === 'danger' ? colors.white : colors.signal;

  const press = (down: boolean) =>
    Animated.spring(scale, { toValue: down ? 0.97 : 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => press(true)}
        onPressOut={() => press(false)}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: bg, borderColor: border },
          variant === 'primary' && !disabled ? shadows.glow : null,
          { opacity: disabled ? 0.4 : pressed ? 0.92 : 1 },
          style,
        ]}>
        {loading ? (
          <ActivityIndicator color={color} />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={18} color={color} style={{ marginRight: 8 }} /> : null}
            <Text style={[styles.txt, { color }]}>{title}</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderWidth: 1.4,
  },
  txt: { fontSize: 16, fontFamily: fonts.semibold },
});
