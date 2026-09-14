import { Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/src/components/brand/AppHeader';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ListRow } from '@/src/components/ui/ListRow';
import { Screen } from '@/src/components/ui/Screen';
import { useAuthStore } from '@/src/store/authStore';
import { colors, fonts, shadows } from '@/src/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const name = useAuthStore((s) => s.name);
  const email = useAuthStore((s) => s.email);
  const org = useAuthStore((s) => s.org);
  const logout = useAuthStore((s) => s.logout);
  const [busy, setBusy] = useState(false);

  return (
    <Screen scroll>
      <AppHeader title="Profile" />
      <Card style={{ marginTop: 4 }}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{(name || '?').slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.meta}>{email}</Text>
            <Text style={styles.meta}>{org}</Text>
          </View>
        </View>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <ListRow icon="settings" title="Settings" onPress={() => router.push('/settings' as Href)} />
        <ListRow icon="notifications" title="Notifications" onPress={() => router.push('/notifications')} />
        <ListRow icon="help-circle" title="Support" onPress={() => router.push('/support')} />
      </Card>

      <View style={{ marginTop: 24 }}>
        <Button
          title="Log out"
          icon="log-out-outline"
          variant="danger"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            await logout();
            router.replace('/login');
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.signalSoft,
    borderWidth: 1.5,
    borderColor: colors.signalBorder,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glow,
  },
  avatarTxt: { color: colors.signal, fontFamily: fonts.bold, fontSize: 20 },
  name: { color: colors.text, fontSize: 20, fontFamily: fonts.bold },
  meta: { color: colors.muted, marginTop: 4, fontFamily: fonts.regular, fontSize: 13 },
});
