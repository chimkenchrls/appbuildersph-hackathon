import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { MissingRecord } from '@/components/ui/StateViews';

/** Rendered by routes whose parameters are not valid identifiers. */
export default function MissingRecordScreen() {
  return (
    <Screen title="Saklaw">
      <MissingRecord message="This link does not match a saved record." actionLabel="Back to projects" onAction={() => router.replace('/')} />
    </Screen>
  );
}
