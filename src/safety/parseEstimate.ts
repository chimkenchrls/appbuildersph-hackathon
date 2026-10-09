import { ServiceError } from '@/services/errors';

export function parseEstimate(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) throw new ServiceError('invalid_input');
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value > 1_000_000_000_000) throw new ServiceError('invalid_input');
  return value;
}

export function parseWorkingDays(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) throw new ServiceError('invalid_input');
  const value = parseEstimate(trimmed);
  if (!Number.isSafeInteger(value)) throw new ServiceError('invalid_input');
  return value;
}
