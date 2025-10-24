export interface GeminiGenerateJsonRequest {
  systemInstruction: string;
  userContent: string;
}

export interface GeminiGenerateJsonOptions {
  timeoutMs?: number;
  thinkingBudget?: number;
}

export interface GeminiJsonClient {
  generateJson(
    request: GeminiGenerateJsonRequest,
    options?: GeminiGenerateJsonOptions
  ): Promise<string>;
}
