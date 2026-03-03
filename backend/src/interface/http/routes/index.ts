import { Router } from 'express';
import { login, me, register } from '../controllers/AuthController';
import {
  addPerson,
  addRelationship,
  cloneFamily,
  createFamily,
  updateFamily,
  deleteFamily,
  deletePerson,
  deleteRelationship,
  listFamilies,
  listPersons,
  listRelationships,
  updatePerson,
  updateRelationship,
} from '../controllers/FamilyController';
import {
  approveProposal,
  listProposals,
  rejectProposal,
  submitProposal,
} from '../controllers/ProposalController';
import { listVersions, rollbackVersion } from '../controllers/VersionController';
import { getRelationship } from '../controllers/GraphController';
import { askRelationshipQuestion, explain } from '../controllers/AiController';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  addPersonSchema,
  addRelationshipSchema,
  aiExplainSchema,
  aiAskSchema,
  createFamilySchema,
  cloneFamilySchema,
  updateFamilySchema,
  loginSchema,
  registerSchema,
  proposalSchema,
  rejectProposalSchema,
  updatePersonSchema,
  updateRelationshipSchema,
} from '../schemas';

export const router = Router();

router.post('/auth/register', validateBody(registerSchema), register);
router.post('/auth/login', validateBody(loginSchema), login);

router.use(authMiddleware);
router.get('/auth/me', me);

router.get('/families', listFamilies);
router.post('/families', validateBody(createFamilySchema), createFamily);
router.post('/families/:id/clone', validateBody(cloneFamilySchema), cloneFamily);
router.put('/families/:id', validateBody(updateFamilySchema), updateFamily);
router.delete('/families/:id', deleteFamily);

router.get('/families/:id/persons', listPersons);
router.get('/families/:id/relationships', listRelationships);
router.post('/families/:id/persons', validateBody(addPersonSchema), addPerson);
router.put('/families/:id/persons/:personId', validateBody(updatePersonSchema), updatePerson);
router.delete('/families/:id/persons/:personId', deletePerson);

router.post('/families/:id/relationships', validateBody(addRelationshipSchema), addRelationship);
router.put(
  '/families/:id/relationships/:relationshipId',
  validateBody(updateRelationshipSchema),
  updateRelationship,
);
router.delete('/families/:id/relationships/:relationshipId', deleteRelationship);

router.post('/families/:id/proposals', validateBody(proposalSchema), submitProposal);
router.get('/families/:id/proposals', listProposals);
router.post('/proposals/:id/approve', approveProposal);
router.post('/proposals/:id/reject', validateBody(rejectProposalSchema), rejectProposal);

router.get('/families/:id/versions', listVersions);
router.post('/families/:id/rollback/:versionNumber', rollbackVersion);

router.get('/relationship', getRelationship);
router.post('/ai/explain', validateBody(aiExplainSchema), explain);
router.post('/ai/ask', validateBody(aiAskSchema), askRelationshipQuestion);
