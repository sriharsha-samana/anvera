import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from '../../../shared/errors';

export const validateBody = <T>(schema: ZodSchema<T>): RequestHandler => {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new AppError('Validation failed', 400, result.error.flatten()));
    }
    req.body = result.data;
    return next();
  };
};
