import { StyleSheet, Text } from 'react-native';
import { Card } from '@/src/components/ui/Card';
import { Screen } from '@/src/components/ui/Screen';
import { useAuthStore } from '@/src/store/authStore';
import { colors, fonts } from '@/src/theme';

export default function AccountSettings() {
  const name = useAuthStore((s) => s.name);
  const email = useAuthStore((s) => s.email);
  const org = useAuthStore((s) => s.org);
  return (
    <Screen scroll>
      <Card>
        <Text style={styles.k}>Name</Text>
        <Text style={styles.v}>{name}</Text>
        <Text style={styles.k}>Email</Text>
        <Text style={styles.v}>{email}</Text>
        <Text style={styles.k}>Organisation</Text>
        <Text style={styles.v}>{org}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  k: { color: colors.dim, fontSize: 12, fontFamily: fonts.semibold, marginTop: 10 },
  v: { color: colors.text, fontSize: 16, marginTop: 2, fontFamily: fonts.regular },
});
