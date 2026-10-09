import { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckRow } from '@/components/ui/CheckRow';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, spacing, type } from '@/constants/theme';
import { isFixtureAi, isFixtureData } from '@/services/active';
import { getFixtureControls, setFixtureControls, subscribeFixtureControls, type FixtureControls } from '@/services/fixtures/fixtureControls';

export const usesFixtures = isFixtureData || isFixtureAi;

/** Header label shown on every screen while either service is a fixture. */
export function FixtureBadge() {
  return usesFixtures ? <StatusBadge variant="demo" /> : null;
}

/** The full disclosure, shown once on the dashboard. */
export function FixtureNotice() {
  if (!usesFixtures) return null;
  return (
    <View style={styles.notice}>
      <StatusBadge variant="demo" />
      {isFixtureData ? <Text style={type.support}>Projects are kept in memory. Everything resets when the app restarts.</Text> : null}
      {isFixtureAi ? <Text style={type.support}>AI results are prepared sample text for the website example, not local inference.</Text> : null}
    </View>
  );
}

const switches: { key: keyof FixtureControls; label: string }[] = [
  { key: 'unavailable', label: 'Local AI unavailable' },
  { key: 'invalid', label: 'AI returns invalid output' },
  { key: 'slow', label: 'Slow generation (12 s)' },
  { key: 'saveFailure', label: 'Saving fails' },
];

/** Development-only switches for exercising failure states. Absent from release builds. */
export function FixtureControlsPanel() {
  const controls = useSyncExternalStore(subscribeFixtureControls, getFixtureControls, getFixtureControls);
  if (!__DEV__ || !usesFixtures) return null;
  return (
    <View style={styles.notice}>
      <Text accessibilityRole="header" style={type.label}>Development: force a failure state</Text>
      {switches.map(item => (
        <CheckRow key={item.key} label={item.label} checked={controls[item.key]} onToggle={() => setFixtureControls({ [item.key]: !controls[item.key] })} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
