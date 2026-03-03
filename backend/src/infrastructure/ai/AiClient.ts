import type { RelationshipClassification } from '../../shared/types';

export type ExplainInput = {
  classification: string;
  paths: string[][];
  commonAncestorId?: string;
};

export type QuestionInput = {
  question: string;
  subjectName: string;
  objectName: string;
  isObjectMe: boolean;
  relationship: RelationshipClassification;
  pathsByName: string[][];
  commonAncestorName: string | null;
};

export interface AiClient {
  explainRelationship(input: ExplainInput): Promise<string>;
  answerRelationshipQuestion(input: QuestionInput): Promise<string>;
}

