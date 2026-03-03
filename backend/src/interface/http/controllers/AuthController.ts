import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../../application/services/AuthService';

const authService = new AuthService();

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      password,
      givenName,
      familyName,
      gender,
      dateOfBirth,
      email,
      phone,
      placeOfBirth,
      occupation,
      notes,
      profilePictureUrl,
      profilePictureDataUrl,
    } = req.body as {
      password: string;
      givenName: string;
      familyName: string;
      gender: 'male' | 'female' | 'other' | 'unknown';
      dateOfBirth?: string;
      email: string;
      phone?: string;
      placeOfBirth?: string;
      occupation?: string;
      notes?: string;
      profilePictureUrl?: string;
      profilePictureDataUrl?: string;
    };
    const result = await authService.register({
      password,
      givenName,
      familyName,
      gender,
      dateOfBirth,
      email,
      phone,
      placeOfBirth,
      occupation,
      notes,
      profilePictureUrl,
      profilePictureDataUrl,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.me(req.auth!.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { identifier, password } = req.body as { identifier: string; password: string };
    const result = await authService.login(identifier, password);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
