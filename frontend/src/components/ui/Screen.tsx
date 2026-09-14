import { PropsWithChildren, useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/src/theme';

export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvt, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

export function Screen({
  children,
  scroll,
  style,
  padded = true,
}: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle; padded?: boolean }>) {
  const kb = useKeyboardHeight();
  const inner = <View style={[padded && styles.pad, style]}>{children}</View>;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.glow} pointerEvents="none" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.grow, { paddingBottom: 36 + (Platform.OS === 'android' ? kb : 0) }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}>
            {inner}
          </ScrollView>
        ) : (
          <View style={[styles.flex, { paddingBottom: Platform.OS === 'android' ? kb : 0 }]}>{inner}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  pad: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  grow: { flexGrow: 1 },
  glow: {
    position: 'absolute',
    top: -140,
    alignSelf: 'center',
    width: 420,
    height: 280,
    borderRadius: 210,
    backgroundColor: colors.signal,
    opacity: 0.07,
  },
});
