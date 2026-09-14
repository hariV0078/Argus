import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, radius, shadows } from '@/src/theme';

type Props = ViewProps & { variant?: 'default' | 'flat' | 'accent' };

export function Card({ style, children, variant = 'default', ...rest }: Props) {
  return (
    <View
      style={[
        styles.card,
        variant === 'accent' && styles.accent,
        variant === 'flat' && styles.flat,
        style,
      ]}
      {...rest}>
      {variant === 'accent' ? <View style={styles.accentBar} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
    ...shadows.card,
  },
  flat: {
    backgroundColor: colors.surfaceAlt,
    shadowOpacity: 0,
    elevation: 0,
  },
  accent: {
    borderColor: colors.signalBorder,
    paddingLeft: 18,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.signal,
  },
});
