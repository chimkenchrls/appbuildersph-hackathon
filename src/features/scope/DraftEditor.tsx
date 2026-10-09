import { StyleSheet, Text, View } from 'react-native';
import { ItemListEditor } from '@/components/ui/ItemListEditor';
import { TextField } from '@/components/ui/TextField';
import { spacing, type } from '@/constants/theme';
import { AiSuggestionBanner } from '@/features/ai/AiSuggestionBanner';
import { limits } from '@/safety/validation';
import type { ScopeDraft } from '@/types/workspace';

type Props = {
  draft: ScopeDraft;
  budgetText: string;
  budgetError: string;
  onChange: (change: (draft: ScopeDraft) => ScopeDraft) => void;
  onBudget: (text: string) => void;
  onBlur: () => void;
  editable: boolean;
};

const notSpecified = 'Leave blank if not specified.';

/** Editable scope draft: deliverables, exclusions and terms. Blank terms stay unspecified. */
export function DraftEditor({ draft, budgetText, budgetError, onChange, onBudget, onBlur, editable }: Props) {
  const setTerm = (key: 'timeline' | 'revisionTerms', text: string) =>
    onChange(d => ({ ...d, terms: { ...d.terms, [key]: text === '' ? null : text } }));
  return (
    <View style={styles.editor}>
      <ItemListEditor
        title="Deliverables"
        itemLabel="Deliverable"
        items={draft.deliverables}
        onChange={deliverables => onChange(d => ({ ...d, deliverables }))}
        onBlur={onBlur}
        editable={editable}
        emptyText="No deliverables yet."
        maxLength={limits.item}
      />
      <ItemListEditor
        title="Exclusions"
        itemLabel="Exclusion"
        items={draft.exclusions}
        onChange={exclusions => onChange(d => ({ ...d, exclusions }))}
        onBlur={onBlur}
        editable={editable}
        emptyText="No exclusions recorded. Add one only if the conversation states it."
        maxLength={limits.item}
      />
      <View style={styles.section}>
        <Text accessibilityRole="header" style={type.subheading}>Terms</Text>
        <TextField
          label={`Budget (${draft.terms.currency})`}
          value={budgetText}
          onChangeText={onBudget}
          onBlur={onBlur}
          editable={editable}
          keyboardType="decimal-pad"
          helper={notSpecified}
          error={budgetError || undefined}
          maxLength={16}
        />
        <TextField
          label="Timeline"
          value={draft.terms.timeline ?? ''}
          onChangeText={text => setTerm('timeline', text)}
          onBlur={onBlur}
          editable={editable}
          helper={notSpecified}
          maxLength={limits.item}
        />
        <TextField
          label="Revision terms"
          value={draft.terms.revisionTerms ?? ''}
          onChangeText={text => setTerm('revisionTerms', text)}
          onBlur={onBlur}
          editable={editable}
          helper={notSpecified}
          maxLength={limits.item}
        />
      </View>
      {draft.origin === 'extracted' && draft.missingInformation.length > 0 ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={type.subheading}>Missing information</Text>
          <AiSuggestionBanner text="AI suggestion. These details were not found in the conversation.">
            {draft.missingInformation.map((text, index) => (
              <Text key={index} style={type.body}>{`• ${text}`}</Text>
            ))}
          </AiSuggestionBanner>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: spacing.xl },
  section: { gap: spacing.md },
});
