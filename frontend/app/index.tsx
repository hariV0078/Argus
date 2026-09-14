import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { BrandLockup } from '@/src/components/brand/BrandMark';
import { Loader } from '@/src/components/ui/Loader';
import { useAuthStore } from '@/src/store/authStore';
import { colors } from '@/src/theme';

export default function SplashScreen() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const loggedIn = useAuthStore((s) => s.loggedIn);

  if (!hydrated) {
    return (
      <View style={styles.wrap}>
        <BrandLockup />
        <View style={{ height: 36 }} />
        <Loader inline />
      </View>
    );
  }

  return <Redirect href={loggedIn ? '/(tabs)/home' : '/login'} />;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28 },
});
