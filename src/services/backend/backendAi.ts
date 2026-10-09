import { LLMContextOverflowError, LLMEngineUnavailableError, LLMGenerationTimeoutError, LLMParseError } from '@/llm/contracts';
import { parseAndValidateJson } from '@/llm/jsonParser';
import { buildChangeDeskPrompt } from '@/llm/prompts/changeDeskPrompt';
import { buildScopeGuardPrompt } from '@/llm/prompts/scopeGuardPrompt';
import { composeProposalMessage } from '@/safety/proposalMessage';
import type { SaklawAi } from '@/services/contracts';
import { checkCancelled, ServiceError } from '@/services/errors';
import { ChangeDeskRawOutputSchema, ScopeGuardRawOutputSchema } from '@/types/schemas';
import type { AiStatus } from '@/types/workspace';
import { toExtractedScope, toWorkspaceFindings } from './mappers';
import type { BackendPorts } from './ports';

const AVAILABILITY_POLL_MS = 15000;

/**
 * SaklawAi over the backend's engine, prompts and parser. Nothing here writes to storage:
 * the workflows validate a result and the data adapter saves it.
 */
export function createBackendAi(getPorts: () => Promise<BackendPorts>): SaklawAi {
  let available: boolean | null = null;
  let running = 0;
  let poll: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());

  const getStatus = (): AiStatus => (running > 0 ? 'busy' : available === null ? 'loading' : available ? 'ready' : 'unavailable');
  const setAvailable = (value: boolean) => {
    if (available !== value) { available = value; emit(); }
  };
  let missedChecks = 0;
  const checkAvailability = async () => {
    if (running > 0) return;
    let reachable = false;
    try {
      reachable = await (await getPorts()).engine.isAvailable();
    } catch {
      reachable = false;
    }
    missedChecks = reachable ? 0 : missedChecks + 1;
    // One slow reply on weak Wi-Fi is not an outage: report unavailable after two misses in a row.
    if (reachable || missedChecks >= 2 || available === null) setAvailable(reachable);
  };

  function toAiError(error: unknown): ServiceError {
    if (error instanceof ServiceError) return error;
    if (error instanceof LLMContextOverflowError) return new ServiceError('input_too_long', error.message);
    if (error instanceof LLMGenerationTimeoutError) return new ServiceError('generation_timeout', error.message);
    if (error instanceof LLMEngineUnavailableError) { setAvailable(false); return new ServiceError('model_unavailable', error.message); }
    if (error instanceof LLMParseError) return new ServiceError('invalid_output', error.message);
    return new ServiceError('invalid_output', error instanceof Error ? error.message : undefined);
  }

  /**
   * Runs one generation. The engine cannot be aborted, so Stop rejects the caller at once
   * while the engine stays busy until its request really ends; a second run is refused
   * until then.
   */
  async function generate<T>(signal: AbortSignal, work: (ports: BackendPorts) => Promise<T>): Promise<T> {
    checkCancelled(signal);
    if (running > 0) throw new ServiceError('model_unavailable');
    let ports: BackendPorts;
    try { ports = await getPorts(); } catch (error) { throw toAiError(error); }
    checkCancelled(signal);
    // Another caller may have acquired the engine while initialization was awaited.
    if (running > 0) throw new ServiceError('model_unavailable');
    running += 1; emit();
    const task = work(ports);
    void task.then(() => setAvailable(true), () => {}).finally(() => { running -= 1; emit(); });
    try {
      return await new Promise<T>((resolve, reject) => {
        const stop = () => reject(new ServiceError('cancelled'));
        signal.addEventListener('abort', stop, { once: true });
        task.then(resolve, reject).finally(() => signal.removeEventListener('abort', stop));
      });
    } catch (error) {
      throw toAiError(error);
    }
  }

  return {
    getStatus,

    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        void checkAvailability();
        poll = setInterval(() => void checkAvailability(), AVAILABILITY_POLL_MS);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && poll) { clearInterval(poll); poll = null; }
      };
    },

    extractScope: (sourceText, signal) =>
      generate(signal, async ports => toExtractedScope(await ports.briefCraft.extractBrief(sourceText))),

    analyzeRequest: (agreement, requestText, signal) =>
      generate(signal, async ports => {
        const stored = await ports.agreements.getById(agreement.id);
        if (!stored) throw new ServiceError('not_found');
        const raw = await ports.engine.generate(buildScopeGuardPrompt(stored, requestText), { temperature: 0.1, maxTokens: 1500 });
        const parsed = parseAndValidateJson(raw, ScopeGuardRawOutputSchema);
        // Evidence ids are passed through unfiltered: the workflow rejects any that do not resolve.
        return toWorkspaceFindings(
          parsed.findings.map(finding => ({
            item: finding.item,
            classification: finding.classification,
            explanation: finding.explanation,
            evidenceRequirementIds: finding.evidence_requirement_ids,
          })),
          parsed.clarification_questions,
        );
      }),

    draftProposalMessage: (input, signal) =>
      generate(signal, async ports => {
        const stored = await ports.agreements.getById(input.agreement.id);
        const messages = buildChangeDeskPrompt({
          agreementTitle: stored?.title ?? `Agreement v${input.agreement.version}`,
          selectedItems: input.deliverables,
        });
        const raw = await ports.engine.generate(messages, { temperature: 0.4, maxTokens: 1000 });
        const narrative = parseAndValidateJson(raw, ChangeDeskRawOutputSchema).draft_message;
        return composeProposalMessage(narrative, {
          deliverables: input.deliverables,
          feeAmount: input.feeAmount,
          currency: input.currency,
          extraWorkingDays: input.extraWorkingDays,
        });
      }),
  };
}
