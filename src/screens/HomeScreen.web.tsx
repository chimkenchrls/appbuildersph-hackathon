import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Kwagi } from '@/components/kwagi/Kwagi';
import { Mascot } from '@/components/kwagi/PageMascot';

// Temporary: set EXPO_PUBLIC_KWAGI_WEB_PREVIEW=1 to also show the app's full-body mascot here.
const SHOW_APP_MASCOT = process.env.EXPO_PUBLIC_KWAGI_WEB_PREVIEW === '1';

// Web shows the landing page; the mobile workspace lives in HomeScreen.tsx.
export function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.hero}>
        <Mascot
          directions="/mascots/kwagi-directions.webp"
          reactions="/mascots/kwagi-reactions.webp"
          size={220}
          label="owl"
        />
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>Saklaw</Text>
          <Text style={styles.tagline}>Clear agreements. Controlled revisions. Confident freelancing.</Text>
          <Text style={styles.body}>
            Saklaw helps freelancers turn client conversations into confirmed project scopes, check
            new requests against them, and prepare change proposals, all on their own phone.
          </Text>
          <Text style={styles.note}>The Android app is in development. There is no download yet.</Text>
        </View>
      </View>
      {SHOW_APP_MASCOT ? (
        <View style={styles.preview}>
          <Text style={styles.note}>App mascot preview</Text>
          <Kwagi size={180} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F8F8', justifyContent: 'center' },
  hero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 880,
    padding: 24,
    gap: 32,
  },
  copy: { flexGrow: 1, flexShrink: 1, flexBasis: 320, gap: 12 },
  title: { fontSize: 44, lineHeight: 52, fontWeight: '700', color: '#172B2A' },
  tagline: { fontSize: 22, lineHeight: 30, fontWeight: '600', color: '#0F766E' },
  body: { fontSize: 18, lineHeight: 28, color: '#172B2A' },
  note: { fontSize: 14, lineHeight: 20, color: '#4B6260' },
  preview: { alignItems: 'center', gap: 8, paddingBottom: 24 },
});
