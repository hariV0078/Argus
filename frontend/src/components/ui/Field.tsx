import { ReactNode, useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, fonts, radius, shadows } from '@/src/theme';

export function Field({
  label,
  right,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { label: string; right?: ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focused && styles.boxFocused]}>
        <TextInput
          placeholderTextColor="#7A8790"
          style={styles.input}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.signal, marginBottom: 6 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.field,
    borderColor: colors.signal,
    borderWidth: 1.4,
    borderRadius: radius.sm,
    minHeight: 52,
    paddingRight: 8,
  },
  boxFocused: {
    borderColor: colors.brass,
    ...shadows.glow,
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 16,
    paddingHorizontal: 14,
    minHeight: 52,
  },
});
