export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LLMEngine {
  isAvailable(): Promise<boolean>;
  generate(messages: LLMMessage[], options?: GenerationOptions): Promise<string>;
}

export class LLMEngineUnavailableError extends Error {
  constructor(message = 'LM Studio or local model server is unreachable') {
    super(message);
    this.name = 'LLMEngineUnavailableError';
  }
}

export class LLMGenerationTimeoutError extends Error {
  constructor(message = 'Local generation timed out') {
    super(message);
    this.name = 'LLMGenerationTimeoutError';
  }
}

/** The prompt, plus room for an answer, does not fit the model's context window. */
export class LLMContextOverflowError extends Error {
  constructor(
    public readonly promptTokens: number,
    public readonly limitTokens: number,
    message = 'This input is too long for the on-device model.',
  ) {
    super(message);
    this.name = 'LLMContextOverflowError';
  }
}

export class LLMParseError extends Error {
  constructor(
    message: string,
    public readonly rawText: string,
  ) {
    super(message);
    this.name = 'LLMParseError';
  }
}
