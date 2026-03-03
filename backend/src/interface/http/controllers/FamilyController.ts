import type { NextFunction, Request, Response } from 'express';
import { FamilyService } from '../../../application/services/FamilyService';

const familyService = new FamilyService();

const paramAsString = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? '' : (value ?? '');

export const listFamilies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const families = await familyService.listFamilies(req.auth!.userId);
    res.json(families);
  } catch (error) {
    next(error);
  }
};

export const createFamily = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name } = req.body as { name: string };
    const family = await familyService.createFamily(name, req.auth!.userId);
    res.status(201).json(family);
  } catch (error) {
    next(error);
  }
};

export const updateFamily = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const familyId = paramAsString(req.params.id);
    const { name } = req.body as { name: string };
    const family = await familyService.updateFamilyName(familyId, req.auth!.userId, name);
    res.json(family);
  } catch (error) {
    next(error);
  }
};

export const deleteFamily = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const familyId = paramAsString(req.params.id);
    await familyService.deleteFamily(familyId, req.auth!.userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const cloneFamily = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const familyId = paramAsString(req.params.id);
    const { name } = (req.body ?? {}) as { name?: string };
    const clonedFamily = await familyService.cloneFamily(familyId, req.auth!.userId, name);
    res.status(201).json(clonedFamily);
  } catch (error) {
    next(error);
  }
};

export const listPersons = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const familyId = paramAsString(req.params.id);
    const persons = await familyService.listPersons(familyId, req.auth!.userId);
    res.json(persons);
  } catch (error) {
    next(error);
  }
};

export const listRelationships = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const familyId = paramAsString(req.params.id);
    const relationships = await familyService.listRelationships(familyId, req.auth!.userId);
    res.json(relationships);
  } catch (error) {
    next(error);
  }
};

export const addPerson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const familyId = paramAsString(req.params.id);
    const person = await familyService.addPerson(familyId, req.auth!.userId, req.body);
    res.status(201).json(person);
  } catch (error) {
    next(error);
  }
};

export const addRelationship = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const familyId = paramAsString(req.params.id);
    const relationship = await familyService.addRelationship(familyId, req.auth!.userId, req.body);
    res.status(201).json(relationship);
  } catch (error) {
    next(error);
  }
};

export const updatePerson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const familyId = paramAsString(req.params.id);
    const personId = paramAsString(req.params.personId);
    const person = await familyService.updatePerson(familyId, personId, req.auth!.userId, req.body);
    res.json(person);
  } catch (error) {
    next(error);
  }
};

export const deletePerson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const familyId = paramAsString(req.params.id);
    const personId = paramAsString(req.params.personId);
    await familyService.deletePerson(familyId, personId, req.auth!.userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const updateRelationship = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const familyId = paramAsString(req.params.id);
    const relationshipId = paramAsString(req.params.relationshipId);
    const relationship = await familyService.updateRelationship(familyId, relationshipId, req.auth!.userId, req.body);
    res.json(relationship);
  } catch (error) {
    next(error);
  }
};

export const deleteRelationship = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const familyId = paramAsString(req.params.id);
    const relationshipId = paramAsString(req.params.relationshipId);
    await familyService.deleteRelationship(familyId, relationshipId, req.auth!.userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
