import { StyleSheet, Text, View } from 'react-native';
import { colors, layout, spacing, type } from '@/constants/theme';

/**
 * Web placeholder until the landing page is designed. It loads no mobile
 * services, and it offers no download link because no release exists yet.
 */
export default function RootScreen() {
  return (
    <View style={styles.page}>
      <View style={styles.column}>
        <Text accessibilityRole="header" style={type.title}>Saklaw</Text>
        <Text style={type.subheading}>Clear agreements. Controlled revisions. Confident freelancing.</Text>
        <Text style={type.body}>
          Saklaw is an Android app that helps freelancers turn client conversations into a confirmed scope,
          compare new requests with it, and prepare change proposals.
        </Text>
        <Text style={type.support}>The Android app is in development. A download will be listed here when a release is available.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: layout.gutter, backgroundColor: colors.background },
  column: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', gap: spacing.lg },
});
