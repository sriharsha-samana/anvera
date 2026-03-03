import { AppError } from '../../shared/errors';
import type { AiClient, ExplainInput, QuestionInput } from './AiClient';

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

export class OpenAICompatibleClient implements AiClient {
  private readonly endpoint: string;
  private readonly model: string;
  private readonly apiKey: string;
  private readonly extraHeaders: Record<string, string>;

  constructor(
    endpoint: string,
    model: string,
    apiKey: string,
    extraHeaders: Record<string, string> = {},
  ) {
    this.endpoint = endpoint;
    this.model = model;
    this.apiKey = apiKey;
    this.extraHeaders = extraHeaders;
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
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...this.extraHeaders,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new AppError('External LLM request failed', 503, { status: response.status });
      }

      const body = (await response.json()) as ChatCompletionResponse;
      const content = body.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new AppError('External LLM returned empty response', 503);
      }
      return content;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('External LLM unavailable', 503, error);
    }
  }
}

