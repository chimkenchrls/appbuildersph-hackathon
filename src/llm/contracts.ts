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

export class LLMParseError extends Error {
  constructor(
    message: string,
    public readonly rawText: string,
  ) {
    super(message);
    this.name = 'LLMParseError';
  }
}
