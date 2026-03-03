import { AppError } from '../../shared/errors';
import type { AiClient, ExplainInput, QuestionInput } from './AiClient';

export class OllamaClient implements AiClient {
  private readonly endpoint: string;
  private readonly model: string;

  constructor(endpoint: string, model: string) {
    this.endpoint = endpoint;
    this.model = model;
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

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0,
          },
        }),
      });

      if (!response.ok) {
        throw new AppError('Ollama request failed', 503, { status: response.status });
      }

      const body = (await response.json()) as { response?: string };
      if (!body.response) {
        throw new AppError('Ollama returned empty response', 503);
      }

      return body.response;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Ollama unavailable', 503, error);
    }
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

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0,
          },
        }),
      });

      if (!response.ok) {
        throw new AppError('Ollama request failed', 503, { status: response.status });
      }

      const body = (await response.json()) as { response?: string };
      if (!body.response || body.response.trim().length === 0) {
        throw new AppError('Ollama returned empty response', 503);
      }

      return body.response.trim();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Ollama unavailable', 503, error);
    }
  }
}
