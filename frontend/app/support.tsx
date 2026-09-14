import { Linking, StyleSheet, Text } from 'react-native';
import { Stack } from 'expo-router';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Screen } from '@/src/components/ui/Screen';
import { colors, fonts } from '@/src/theme';

export default function SupportScreen() {
  return (
    <Screen scroll>
      <Stack.Screen
        options={{ title: 'Support', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.signal }}
      />
      <Card>
        <Text style={styles.k}>Email</Text>
        <Text style={styles.v}>ops@argus.ai</Text>
      </Card>
      <Button
        title="Send email"
        style={{ marginTop: 18 }}
        onPress={() => Linking.openURL('mailto:ops@argus.ai?subject=Argus%20support')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  k: { color: colors.dim, fontSize: 12, fontFamily: fonts.semibold },
  v: { color: colors.text, marginTop: 4, fontFamily: fonts.regular },
});
