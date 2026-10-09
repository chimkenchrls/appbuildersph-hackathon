import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Kwagi } from '@/components/kwagi/Kwagi';

// Native screen. Web loads HomeScreen.web.tsx (the landing page) instead.
export function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Kwagi size={180} />
        <Text accessibilityRole="header" style={styles.title}>Diligent Dev</Text>
        <Text style={styles.body}>Your hackathon starts here.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f6fa' },
  content: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 32, fontWeight: '700', color: '#182135' },
  body: { fontSize: 18, lineHeight: 28, color: '#49556b' },
});
