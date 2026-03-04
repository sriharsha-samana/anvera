import type { NextFunction, Request, Response } from 'express';
import type { ProposalType } from '@prisma/client';
import { FamilyService } from '../../../application/services/FamilyService';
import { ProposalWorkflowService } from '../../../application/services/ProposalWorkflowService';
import type { AddPersonPayload, AddRelationshipPayload } from '../../../shared/types';

const proposalService = new ProposalWorkflowService();
const familyService = new FamilyService();

const paramAsString = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? '' : (value ?? '');

type ProposalRequestBody = {
  type: ProposalType;
  data: AddPersonPayload | AddRelationshipPayload;
};

export const submitProposal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const familyId = paramAsString(req.params.id);
    const { role } = await familyService.ensureFamilyMembership(familyId, req.auth!.userId);
    const body = req.body as ProposalRequestBody;
    const proposal = await proposalService.submitProposal(
      familyId,
      req.auth!.userId,
      role,
      body.type,
      body.data,
    );
    res.status(201).json(proposal);
  } catch (error) {
    next(error);
  }
};

export const listProposals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const familyId = paramAsString(req.params.id);
    await familyService.ensureFamilyMembership(familyId, req.auth!.userId);
    const proposals = await proposalService.listProposals(familyId);
    res.json(proposals);
  } catch (error) {
    next(error);
  }
};

export const approveProposal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const proposal = await proposalService.approveProposal(paramAsString(req.params.id), req.auth!.userId);
    res.json(proposal);
  } catch (error) {
    next(error);
  }
};

export const rejectProposal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const proposal = await proposalService.rejectProposal(
      paramAsString(req.params.id),
      req.auth!.userId,
      req.body.reason as string,
    );
    res.json(proposal);
  } catch (error) {
    next(error);
  }
};
