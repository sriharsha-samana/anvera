import type { NextFunction, Request, Response } from 'express';
import { FamilyService } from '../../../application/services/FamilyService';
import { VersionService } from '../../../application/services/VersionService';

const versionService = new VersionService();
const familyService = new FamilyService();

const paramAsString = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? '') : (value ?? '');

export const listVersions = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const familyId = paramAsString(req.params.id);
    await familyService.ensureFamilyMembership(familyId, req.auth!.userId);
    const versions = await versionService.listVersions(familyId);
    res.json(versions);
  } catch (error) {
    next(error);
  }
};

export const rollbackVersion = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const familyId = paramAsString(req.params.id);
    const created = await versionService.rollbackToVersion(
      familyId,
      Number(paramAsString(req.params.versionNumber)),
      req.auth!.userId,
    );
    res.json(created);
  } catch (error) {
    next(error);
  }
};
