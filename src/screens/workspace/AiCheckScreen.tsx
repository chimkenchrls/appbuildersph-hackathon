import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';
import { colors } from '@/constants/theme';
import { parseAndValidateJson } from '@/llm/jsonParser';
import { buildBriefCraftPrompt } from '@/llm/prompts/briefCraftPrompt';
import { BriefCraftRawOutputSchema } from '@/types/schemas';

// Roadmap P1.2 feasibility check: real on-device inference, no network, no fixtures.
// The model is copied to the app's private folder as MODEL_FILE (see docs/decisions/).
const MODEL_FILE = 'model.gguf';
const N_CTX = 2048;

// Fictional demo conversation from ROADMAP.md section 10.
const DEMO_CONVERSATION = `Client: I need five responsive pages: Home, About, Services, Portfolio, and Contact, with a contact form.
Freelancer: The proposed fee is PHP 15,000, the timeline is two weeks, and two revision rounds are included.
Client: Approved. Let's proceed.`;

export default function AiCheckScreen() {
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const log = (line: string) => setLines((previous) => [...previous, line]);

  async function run() {
    setRunning(true);
    setLines([]);
    let context: { release(): Promise<void> } | null = null;
    try {
      const file = new File(Paths.document, MODEL_FILE);
      if (!file.exists) {
        log(`Model not found: ${MODEL_FILE} is missing from the app's private folder.`);
        return;
      }
      log(`Model file: ${(file.size / 1024 ** 3).toFixed(2)} GB`);

      const { initLlama } = await import('llama.rn');
      const loadStart = Date.now();
      log(`Loading (context ${N_CTX}, CPU only)...`);
      const llama = await initLlama({ model: file.uri, n_ctx: N_CTX, n_gpu_layers: 0, use_mlock: false });
      context = llama;
      log(`Loaded in ${((Date.now() - loadStart) / 1000).toFixed(1)} s`);

      const runStart = Date.now();
      let firstTokenMs: number | null = null;
      const result = await llama.completion(
        {
          messages: buildBriefCraftPrompt(DEMO_CONVERSATION),
          n_predict: 500,
          temperature: 0.1,
          enable_thinking: false,
        },
        () => {
          if (firstTokenMs === null) firstTokenMs = Date.now() - runStart;
        },
      );

      log(`First token: ${firstTokenMs === null ? 'n/a' : `${(firstTokenMs / 1000).toFixed(1)} s`}`);
      log(`Total: ${((Date.now() - runStart) / 1000).toFixed(1)} s`);
      log(`Speed: ${result.timings.predicted_per_second.toFixed(1)} tokens/s (prompt ${result.timings.prompt_per_second.toFixed(1)} tokens/s)`);
      try {
        const parsed = parseAndValidateJson(result.text, BriefCraftRawOutputSchema);
        log(`Valid scope JSON: yes (${parsed.deliverables.length} deliverables, budget ${parsed.budget.amount ?? 'null'})`);
      } catch (error) {
        log(`Valid scope JSON: NO (${error instanceof Error ? error.message : 'unknown error'})`);
      }
      log(`Output:\n${result.text}`);
    } catch (error) {
      log(`Failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await context?.release().catch(() => undefined);
      setRunning(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">
        On-device AI check
      </Text>
      <Text style={styles.note}>Developer test for roadmap P1.2. Not part of the product flow.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: running }}
        disabled={running}
        onPress={run}
        style={[styles.button, running && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>{running ? 'Running...' : 'Run on-device test'}</Text>
      </Pressable>
      <ScrollView style={styles.output}>
        {lines.map((line, index) => (
          <Text key={index} selectable style={styles.line}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, backgroundColor: colors.background },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '600' },
  note: { color: colors.textSecondary, marginTop: 4, marginBottom: 16 },
  button: { minHeight: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  buttonDisabled: { backgroundColor: colors.border },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  output: { marginTop: 16 },
  line: { color: colors.textPrimary, marginBottom: 6 },
});
