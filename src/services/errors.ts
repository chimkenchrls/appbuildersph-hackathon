export type ServiceErrorCode = 'model_unavailable' | 'invalid_output' | 'cancelled' | 'save_failed' | 'not_found' | 'invalid_input';

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
    invalid_output: 'The result could not be verified against your agreement. Please try again.',
    cancelled: 'Stopped. Your inputs have been kept.',
    save_failed: 'Could not save. Your changes are still here. Try saving again.',
    not_found: 'This record is unavailable in this project.',
    invalid_input: 'Check the highlighted fields and try again.',
  };
  return messages[error.code];
}

export function checkCancelled(signal: AbortSignal) {
  if (signal.aborted) throw new ServiceError('cancelled');
}
