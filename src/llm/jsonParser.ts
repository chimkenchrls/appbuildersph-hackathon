import { z } from 'zod';
import { LLMParseError } from './contracts';

export function parseAndValidateJson<T>(raw: string, schema: z.ZodType<T>): T {
  let cleaned = raw.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
    cleaned = cleaned.replace(/\n?```\s*$/i, '');
    cleaned = cleaned.trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback: extract the outermost balanced JSON object or array
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const extracted = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        parsed = JSON.parse(extracted);
      } catch (extractError) {
        throw new LLMParseError(
          `Failed to parse model output as JSON: ${(extractError as Error).message}`,
          raw,
        );
      }
    } else {
      throw new LLMParseError('No JSON object found in model output', raw);
    }
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const errorDetails = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new LLMParseError(`Model output failed schema validation: ${errorDetails}`, raw);
  }

  return result.data;
}
