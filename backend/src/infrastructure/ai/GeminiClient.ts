import { AppError } from '../../shared/errors';
import type { AiClient, ExplainInput, QuestionInput } from './AiClient';

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

export class GeminiClient implements AiClient {
  private readonly endpoint: string;
  private readonly apiKey: string;

  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }

  public async explainRelationship(input: ExplainInput): Promise<string> {
    const prompt = [
      'You are a deterministic family relationship explanation engine.',
      'Do not infer data not provided.',
      `Relationship: ${input.classification}`,
      `Common ancestor: ${input.commonAncestorId ?? 'none'}`,
      `Paths: ${JSON.stringify(input.paths)}`,
      'Provide concise explanation with certainty notes.',
    ].join('\n');
    return this.generate(prompt);
  }

  public async answerRelationshipQuestion(input: QuestionInput): Promise<string> {
    const prompt = [
      'You are a strict family-relationship assistant.',
      'Answer from provided graph result only; never invent facts.',
      `Question: ${input.question}`,
      `Subject person: ${input.subjectName}`,
      `Reference person: ${input.objectName}`,
      `ReferenceIsRequester: ${input.isObjectMe ? 'yes' : 'no'}`,
      `Computed relationship label: ${input.relationship.label}`,
      `Degree: ${input.relationship.degree ?? 'n/a'}`,
      `Removal: ${input.relationship.removal ?? 'n/a'}`,
      `Multiple paths: ${input.relationship.multiplePaths ? 'yes' : 'no'}`,
      `Cycle detected: ${input.relationship.cycleDetected ? 'yes' : 'no'}`,
      `Common ancestor: ${input.commonAncestorName ?? 'none'}`,
      `Shortest paths by names: ${JSON.stringify(input.pathsByName)}`,
      'Respond in 2-4 concise sentences.',
      'Sentence 1 must directly answer who subject is to reference.',
      'Mention uncertainty only if cycles or multiple paths are present.',
      'Do not output JSON.',
    ].join('\n');
    return this.generate(prompt);
  }

  private async generate(prompt: string): Promise<string> {
    try {
      const joiner = this.endpoint.includes('?') ? '&' : '?';
      const endpointWithKey = `${this.endpoint}${joiner}key=${encodeURIComponent(this.apiKey)}`;
      const response = await fetch(endpointWithKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0,
          },
        }),
      });

      if (!response.ok) {
        throw new AppError('Gemini request failed', 503, { status: response.status });
      }

      const body = (await response.json()) as GeminiResponse;
      const text = body.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('')
        .trim();
      if (!text) {
        throw new AppError('Gemini returned empty response', 503);
      }
      return text;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Gemini unavailable', 503, error);
    }
  }
}
