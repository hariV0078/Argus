import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { formatDate } from '@/src/lib/format';
import { useNotificationStore } from '@/src/store/notificationStore';
import { colors } from '@/src/theme';

export default function NotificationsScreen() {
  const router = useRouter();
  const items = useNotificationStore((s) => s.items);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const markRead = useNotificationStore((s) => s.markRead);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Stack.Screen options={{ title: 'Notifications', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.signal }} />
      <Button title="Mark all read" variant="outline" onPress={markAllRead} />
      {items.length === 0 ? <Text style={styles.body}>No notifications</Text> : null}
      {items.map((n) => (
        <Pressable
          key={n.id}
          onPress={() => {
            markRead(n.id);
            if (n.jobId) {
              if (n.title.toLowerCase().includes('fail')) router.push(`/model/${n.jobId}`);
              else router.push(`/model/${n.jobId}`);
            }
          }}>
          <Card style={{ marginTop: 12, opacity: n.read ? 0.7 : 1 }}>
            <View style={styles.row}>
              <Ionicons name={n.read ? 'notifications-outline' : 'notifications'} size={18} color={n.read ? colors.dim : colors.blue} />
              <Text style={styles.title}>{n.title}</Text>
            </View>
            <Text style={styles.body}>{n.body}</Text>
            <Text style={styles.date}>{formatDate(n.createdAt)}</Text>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontWeight: '800', fontSize: 16, flex: 1 },
  body: { color: colors.muted, marginTop: 8 },
  date: { color: colors.dim, marginTop: 8, fontSize: 12 },
});
