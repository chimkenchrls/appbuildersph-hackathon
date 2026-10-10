import { LLMContextOverflowError, LLMGenerationTimeoutError, LLMParseError } from '@/llm/contracts';

export type ServiceErrorCode = 'model_unavailable' | 'generation_timeout' | 'input_too_long' | 'invalid_output' | 'cancelled' | 'save_failed' | 'not_found' | 'invalid_input' | 'data_integrity' | 'conflict';

export class ServiceError extends Error {
  constructor(public readonly code: ServiceErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ServiceError';
  }
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof ServiceError)) return 'Something went wrong. Your edits are still here. Please try again.';
  const messages: Record<ServiceErrorCode, string> = {
    model_unavailable: 'Local AI is unavailable. You can keep working manually.',
    generation_timeout: 'Local AI took too long to respond. Your inputs are kept. Try a shorter conversation or a smaller model.',
    input_too_long: 'This is too long for the on-device model. Shorten the conversation or request and try again. Your inputs are kept.',
    invalid_output: 'The result could not be verified against your agreement. Please try again.',
    cancelled: 'Stopped. Your inputs have been kept.',
    save_failed: 'Could not save. Your changes are still here. Try saving again.',
    not_found: 'This record is unavailable in this project.',
    data_integrity: 'Saved data could not be verified. Your data has been kept; restore a verified backup or report this issue.',
    conflict: 'Saved data changed or this action was already completed. Reopen the project and review the latest agreement before trying again.',
    invalid_input: 'Check the highlighted fields and try again.',
  };
  return messages[error.code];
}

/**
 * The message to show for a failed action. A ServiceError has its own wording; any other Error
 * from this app's handlers already carries a message written for the user. Anything else gets
 * the generic text.
 */
export function userMessage(error: unknown): string {
  if (error instanceof ServiceError) return errorMessage(error);
  if (error instanceof Error && error.message.trim()) return error.message;
  return errorMessage(error);
}

export function checkCancelled(signal: AbortSignal) {
  if (signal.aborted) throw new ServiceError('cancelled');
}

/**
 * Turns a failed extraction into the message the user sees. A model failure is reported as
 * itself: it is never replaced by a rule-based draft that looks like a model result.
 */
export function extractionFailure(reason: unknown): Error {
  if (reason instanceof ServiceError) return new Error(errorMessage(reason));
  if (reason instanceof LLMContextOverflowError) return new Error(errorMessage(new ServiceError('input_too_long')));
  if (reason instanceof LLMGenerationTimeoutError) return new Error(errorMessage(new ServiceError('generation_timeout')));
  if (reason instanceof LLMParseError) return new Error(errorMessage(new ServiceError('invalid_output')));
  return reason instanceof Error ? reason : new Error('Something went wrong. Your edits are still here. Please try again.');
}
