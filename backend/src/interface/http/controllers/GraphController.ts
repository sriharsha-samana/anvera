import type { NextFunction, Request, Response } from 'express';
import { FamilyService } from '../../../application/services/FamilyService';
import { RelationshipService } from '../../../application/services/RelationshipService';

const relationshipService = new RelationshipService();
const familyService = new FamilyService();

export const getRelationship = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const familyId = String(req.query.familyId ?? '');
    const personA = String(req.query.personA ?? '');
    const personB = String(req.query.personB ?? '');
    await familyService.ensureFamilyMembership(familyId, req.auth!.userId);
    const result = await relationshipService.getRelationship(familyId, personA, personB);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
