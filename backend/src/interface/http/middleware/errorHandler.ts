import type { ErrorRequestHandler } from 'express';
import { AppError } from '../../../shared/errors';
import { logger } from '../../../infrastructure/logging/logger';

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  void next;
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
      details: error.details,
    });
  }

  logger.error('Unhandled error', { error });
  return res.status(500).json({ message: 'Internal server error' });
};
