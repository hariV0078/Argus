import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { BrandRow } from '@/src/components/brand/BrandMark';
import { useNotificationStore } from '@/src/store/notificationStore';
import { colors, shadows } from '@/src/theme';

export function AppHeader({ title, subtitle, notify }: { title: string; subtitle?: string; notify?: boolean }) {
  const router = useRouter();
  const unread = useNotificationStore((s) => s.items.filter((i) => !i.read).length);

  return (
    <View style={styles.wrap}>
      <BrandRow title={title} subtitle={subtitle} />
      {notify ? (
        <Pressable style={styles.bell} onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications" size={20} color={colors.signal} />
          {unread > 0 ? <View style={styles.dot} /> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  bell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.elevated2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  dot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.red,
    borderWidth: 1.5,
    borderColor: colors.elevated2,
  },
});
