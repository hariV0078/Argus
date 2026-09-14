import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandLockup } from '@/src/components/brand/BrandMark';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Field } from '@/src/components/ui/Field';
import { Screen, useKeyboardHeight } from '@/src/components/ui/Screen';
import { useAuthStore } from '@/src/store/authStore';
import { useJobStore } from '@/src/store/jobStore';
import { colors, fonts } from '@/src/theme';

export default function LoginScreen() {
  const router = useRouter();
  const loggedIn = useAuthStore((s) => s.loggedIn);
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const refreshJobs = useJobStore((s) => s.refreshJobs);
  const kb = useKeyboardHeight();
  const compact = kb > 0;

  const [email, setEmail] = useState('ashwinram28102005@ntro.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loggedIn) return <Redirect href="/(tabs)/home" />;

  const onSubmit = async () => {
    setBusy(true);
    const ok = await login(email, password);
    if (ok) {
      await refreshJobs();
      router.replace('/(tabs)/home');
      return;
    }
    setBusy(false);
  };

  return (
    <Screen scroll>
      <View style={[styles.hero, compact && styles.heroCompact]}>
        <BrandLockup compact={compact} />
        {!compact ? <Text style={styles.tagline}>Single-pass drone reconstruction</Text> : null}
      </View>

      <Card>
        <Field
          label="Email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="next"
          value={email}
          onChangeText={(t) => {
            clearError();
            setEmail(t);
          }}
        />
        <Field
          label="Password"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          value={password}
          onChangeText={(t) => {
            clearError();
            setPassword(t);
          }}
          placeholder="Password"
          right={
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10} style={{ padding: 8 }}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color={colors.ink} />
            </Pressable>
          }
        />

        {error ? (
          <View style={styles.errRow}>
            <Ionicons name="alert-circle" size={16} color={colors.red} />
            <Text style={styles.err}>{error}</Text>
          </View>
        ) : null}

        <Button
          title="Sign in"
          icon="log-in-outline"
          onPress={onSubmit}
          loading={busy}
          disabled={!email || !password}
          style={{ marginTop: 20 }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: 24, paddingTop: 24 },
  heroCompact: { paddingTop: 0, marginBottom: 12 },
  tagline: { color: colors.muted, marginTop: 10, fontFamily: fonts.medium, fontSize: 13 },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  err: { color: colors.red, fontFamily: fonts.semibold, flexShrink: 1 },
});
