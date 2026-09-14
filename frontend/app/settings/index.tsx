import { Href, useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { Card } from '@/src/components/ui/Card';
import { ListRow } from '@/src/components/ui/ListRow';
import { colors } from '@/src/theme';

export default function SettingsIndex() {
  const router = useRouter();
  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Card>
        <ListRow icon="server" title="Server" subtitle="Backend URL and UTM EPSG" onPress={() => router.push('/settings/server' as Href)} />
        <ListRow icon="person" title="Account" onPress={() => router.push('/settings/account')} />
        <ListRow icon="options" title="Processing defaults" onPress={() => router.push('/settings/defaults')} />
        <ListRow icon="folder" title="Storage" onPress={() => router.push('/settings/storage')} />
        <ListRow icon="information-circle" title="About" onPress={() => router.push('/settings/about')} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
});
