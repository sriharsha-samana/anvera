import { AppError } from '../../shared/errors';
import type { AiClient } from '../../infrastructure/ai/AiClient';
import { GeminiClient } from '../../infrastructure/ai/GeminiClient';
import { OllamaClient } from '../../infrastructure/ai/OllamaClient';
import { OpenAICompatibleClient } from '../../infrastructure/ai/OpenAICompatibleClient';
import type { RelationshipClassification } from '../../shared/types';

export class AiExplanationService {
  private readonly client: AiClient;

  constructor() {
    this.client = this.buildClient();
  }

  public async explain(input: {
    classification: string;
    paths: string[][];
    commonAncestorId?: string;
  }): Promise<{ explanation: string }> {
    const explanation = await this.client.explainRelationship(input);
    return { explanation };
  }

  public async explainQuestion(input: {
    question: string;
    subjectName: string;
    objectName: string;
    isObjectMe: boolean;
    relationship: RelationshipClassification;
    pathsByName: string[][];
    commonAncestorName: string | null;
  }): Promise<string> {
    return this.client.answerRelationshipQuestion(input);
  }

  private buildClient(): AiClient {
    const provider = (process.env.AI_PROVIDER ?? 'ollama').toLowerCase();

    if (provider === 'ollama') {
      return new OllamaClient(
        process.env.OLLAMA_URL ?? 'http://localhost:11434/api/generate',
        process.env.OLLAMA_MODEL ?? 'llama3.2:3b',
      );
    }

    if (provider === 'openai_compatible' || provider === 'groq' || provider === 'openrouter') {
      const apiKey = process.env.LLM_API_KEY;
      if (!apiKey) {
        throw new AppError('LLM_API_KEY is required for external provider', 500);
      }

      const endpoint =
        process.env.LLM_BASE_URL ??
        (provider === 'groq'
          ? 'https://api.groq.com/openai/v1/chat/completions'
          : 'https://openrouter.ai/api/v1/chat/completions');
      const model =
        process.env.LLM_MODEL ??
        (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'openrouter/auto');
      const appName = process.env.OPENROUTER_APP_NAME ?? 'family-graph-enterprise-platform';
      const appUrl = process.env.OPENROUTER_APP_URL ?? 'http://localhost:3000';

      const extraHeaders: Record<string, string> = {};
      if (provider === 'openrouter') {
        extraHeaders['HTTP-Referer'] = appUrl;
        extraHeaders['X-Title'] = appName;
      }

      return new OpenAICompatibleClient(endpoint, model, apiKey, extraHeaders);
    }

    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new AppError('GEMINI_API_KEY is required for Gemini provider', 500);
      }
      const endpoint =
        process.env.GEMINI_ENDPOINT ??
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
      return new GeminiClient(endpoint, apiKey);
    }

    throw new AppError(`Unsupported AI_PROVIDER: ${provider}`, 500);
  }
}
