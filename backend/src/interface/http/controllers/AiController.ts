import type { NextFunction, Request, Response } from 'express';
import { AiExplanationService } from '../../../application/services/AiExplanationService';
import { AiRelationshipQuestionService } from '../../../application/services/AiRelationshipQuestionService';

const aiService = new AiExplanationService();
const aiQuestionService = new AiRelationshipQuestionService();

export const explain = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await aiService.explain(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const askRelationshipQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await aiQuestionService.ask(
      req.auth!.userId,
      {
        username: req.auth!.username,
        email: req.auth!.email ?? undefined,
        phone: req.auth!.phone ?? undefined,
      },
      req.body,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};
