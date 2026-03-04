import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../../shared/errors';

type AuthPayload = {
  userId: string;
  username: string;
  email?: string | null;
  phone?: string | null;
};

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthPayload;
  }
}

export const authMiddleware: RequestHandler = (req, _res, next) => {
  const authorization = req.header('authorization');
  if (!authorization) {
    return next(new UnauthorizedError('Missing authorization header'));
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new UnauthorizedError('Invalid authorization header format'));
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next(new UnauthorizedError('JWT secret missing'));
  }

  try {
    const payload = jwt.verify(token, secret) as AuthPayload;
    req.auth = payload;
    return next();
  } catch {
    return next(new UnauthorizedError('Invalid token'));
  }
};
