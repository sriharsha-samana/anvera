import { prisma } from '../../infrastructure/db/prisma';
import { AppError } from '../../shared/errors';
import type { RelationshipClassification } from '../../shared/types';
import { AiExplanationService } from './AiExplanationService';
import { FamilyService } from './FamilyService';
import { RelationshipService } from './RelationshipService';

type AskInput = {
  familyId?: string;
  question: string;
  mePersonId?: string;
};

type AuthIdentity = {
  username: string;
  email?: string;
  phone?: string;
};

type PersonRef = {
  id: string;
  name: string;
  gender?: string | null;
  email?: string | null;
  phone?: string | null;
};

type AskResult = {
  family: {
    id: string;
    name: string;
  };
  answer: string;
  aiAvailable: boolean;
  resolved: {
    subject: PersonRef;
    object: PersonRef & { isMe: boolean };
  };
  relationship: RelationshipClassification & {
    pathsByName: string[][];
  };
  relatedPeople?: Array<{ id: string; name: string; relationLabel: string }>;
};

export class AiRelationshipQuestionService {
  private readonly familyService = new FamilyService();
  private readonly relationshipService = new RelationshipService();
  private readonly aiExplanationService = new AiExplanationService();

  public async ask(userId: string, identity: AuthIdentity, input: AskInput): Promise<AskResult> {
    const families = input.familyId
      ? await prisma.family.findMany({
          where: { id: input.familyId },
          select: { id: true, name: true },
        })
      : await prisma.family.findMany({
          where: { members: { some: { userId } } },
          select: { id: true, name: true },
        });

    if (families.length === 0) {
      throw new AppError('No accessible families found for AI assistant', 404);
    }

    if (input.familyId) {
      await this.familyService.ensureFamilyMembership(input.familyId, userId);
    }

    const contexts = await Promise.all(
      families.map(async (family) => {
        const persons = await prisma.person.findMany({
          where: { familyId: family.id },
          select: { id: true, name: true, gender: true, email: true, phone: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        });
        const relationships = await prisma.relationship.findMany({
          where: { familyId: family.id },
          select: {
            id: true,
            fromPersonId: true,
            toPersonId: true,
            type: true,
            familyId: true,
            metadataJson: true,
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });

        return {
          familyId: family.id,
          familyName: family.name,
          persons,
          relationships,
          score: this.scoreFamilyRelevance(input.question, persons),
        };
      }),
    );

    const prioritizedContexts = contexts.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.persons.length !== a.persons.length) return b.persons.length - a.persons.length;
      return a.familyName.localeCompare(b.familyName);
    });

    let lastRecoverableError: AppError | null = null;
    for (const context of prioritizedContexts) {
      try {
        return await this.answerWithinFamilyContext(context, identity, input);
      } catch (error) {
        if (error instanceof AppError && error.statusCode >= 400 && error.statusCode < 500) {
          lastRecoverableError = error;
          continue;
        }
        throw error;
      }
    }

    if (lastRecoverableError) throw lastRecoverableError;
    throw new AppError('Could not answer this question with available family data', 400);
  }

  private scoreFamilyRelevance(question: string, persons: PersonRef[]): number {
    if (persons.length === 0) return 0;
    const normalizedQuestion = this.normalizeText(question);
    if (!normalizedQuestion) return 0;
    let score = 0;
    for (const person of persons) {
      const normalizedName = this.normalizeText(person.name);
      if (!normalizedName) continue;
      if (normalizedQuestion.includes(normalizedName)) score += 8;
      const tokens = normalizedName.split(' ').filter((token) => token.length >= 2);
      for (const token of tokens) {
        if (normalizedQuestion.includes(token)) score += 2;
      }
    }
    return score;
  }

  private async answerWithinFamilyContext(
    context: {
      familyId: string;
      familyName: string;
      persons: PersonRef[];
      relationships: Array<{ id: string; fromPersonId: string; toPersonId: string; type: string }>;
    },
    identity: AuthIdentity,
    input: AskInput,
  ): Promise<AskResult> {
    const { familyId, familyName, persons, relationships } = context;
    if (persons.length < 2) {
      throw new AppError('At least two persons are required to answer relationship questions', 400);
    }

    const selfRoleQuery = this.resolveSelfRoleQuery(
      input.question,
      persons,
      identity,
      input.mePersonId,
    );
    if (selfRoleQuery) {
      const matches = selfRoleQuery.resolve(relationships, persons);
      if (matches.length === 0) {
        throw new AppError(
          `No ${selfRoleQuery.label.toLowerCase()} found for ${selfRoleQuery.me.name} in this family graph`,
          400,
        );
      }

      const first = matches[0];
      const summary =
        matches.length === 1
          ? `${first.name} is your ${selfRoleQuery.label.toLowerCase()}.`
          : `Your ${selfRoleQuery.label.toLowerCase()} are ${matches.map((m) => m.name).join(', ')}.`;

      return {
        family: { id: familyId, name: familyName },
        answer: summary,
        aiAvailable: true,
        resolved: {
          subject: { id: first.id, name: first.name },
          object: { id: selfRoleQuery.me.id, name: selfRoleQuery.me.name, isMe: true },
        },
        relationship: {
          label: selfRoleQuery.label,
          paths: [],
          multiplePaths: false,
          cycleDetected: false,
          pathsByName: [],
        },
        relatedPeople: matches.map((m) => ({
          id: m.id,
          name: m.name,
          relationLabel: selfRoleQuery.label,
        })),
      };
    }

    const resolved = this.resolveParticipants(input.question, persons, identity, input.mePersonId);
    const relationship = await this.relationshipService.getRelationship(
      familyId,
      resolved.subject.id,
      resolved.object.id,
    );

    const nameById = new Map(persons.map((p) => [p.id, p.name]));
    const pathsByName = relationship.paths.map((path) => path.map((id) => nameById.get(id) ?? id));
    const commonAncestorName = relationship.commonAncestorId
      ? (nameById.get(relationship.commonAncestorId) ?? null)
      : null;

    let answer: string;
    let aiAvailable = true;
    try {
      answer = await this.aiExplanationService.explainQuestion({
        question: input.question,
        subjectName: resolved.subject.name,
        objectName: resolved.object.name,
        isObjectMe: resolved.object.isMe,
        relationship,
        pathsByName,
        commonAncestorName,
      });
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 503) {
        aiAvailable = false;
        answer = this.buildFallbackAnswer(
          resolved.subject.name,
          resolved.object.name,
          resolved.object.isMe,
          relationship,
        );
      } else {
        throw error;
      }
    }

    return {
      family: { id: familyId, name: familyName },
      answer,
      aiAvailable,
      resolved: {
        subject: { id: resolved.subject.id, name: resolved.subject.name },
        object: { id: resolved.object.id, name: resolved.object.name, isMe: resolved.object.isMe },
      },
      relationship: {
        ...relationship,
        pathsByName,
      },
      relatedPeople: [
        { id: resolved.subject.id, name: resolved.subject.name, relationLabel: relationship.label },
      ],
    };
  }

  private resolveParticipants(
    question: string,
    persons: PersonRef[],
    identity: AuthIdentity,
    mePersonId?: string,
  ): {
    subject: PersonRef;
    object: PersonRef & { isMe: boolean };
  } {
    const q = question.trim();
    if (!q) {
      throw new AppError('Question cannot be empty', 400);
    }

    const me = this.resolveMe(persons, identity, mePersonId);

    const explicit = q.match(/who\s+is\s+(.+?)\s+to\s+(.+?)\??$/i);
    if (explicit) {
      const subject = this.resolveByPhrase(explicit[1], persons, true);
      const secondPhrase = explicit[2].trim();
      const refersToMe = /\bme\b|\bmy\b|\bmyself\b/i.test(secondPhrase);
      const object = refersToMe ? me : this.resolveByPhrase(secondPhrase, persons, true);
      if (subject.id === object.id) {
        throw new AppError('Question resolved to the same person on both sides', 400);
      }
      return {
        subject,
        object: { ...object, isMe: object.id === me.id },
      };
    }

    const mentions = this.rankMentions(q, persons);
    const hasMeReference = /\bto me\b|\bmy\b|\bmyself\b/i.test(q);
    if (hasMeReference) {
      const target = mentions.find((m) => m.person.id !== me.id)?.person;
      if (!target) {
        throw new AppError(
          'Could not find target person in question. Mention a family member name.',
          400,
        );
      }
      return {
        subject: target,
        object: { ...me, isMe: true },
      };
    }

    const distinctMentions = mentions
      .map((m) => m.person)
      .filter((p, index, arr) => arr.findIndex((x) => x.id === p.id) === index);

    if (distinctMentions.length >= 2) {
      const [subject, object] = distinctMentions;
      if (subject.id === object.id) {
        throw new AppError('Question resolved to the same person on both sides', 400);
      }
      return {
        subject,
        object: { ...object, isMe: object.id === me.id },
      };
    }

    if (distinctMentions.length === 1) {
      const subject = distinctMentions[0];
      if (subject.id === me.id) {
        throw new AppError('Please mention another person to compare with "me"', 400);
      }
      return {
        subject,
        object: { ...me, isMe: true },
      };
    }

    throw new AppError(
      'Could not map question to family members. Try: "Who is Ramesh to me?"',
      400,
    );
  }

  private resolveSelfRoleQuery(
    question: string,
    persons: PersonRef[],
    identity: AuthIdentity,
    mePersonId?: string,
  ): {
    label: string;
    me: PersonRef;
    resolve: (
      relationships: Array<{ fromPersonId: string; toPersonId: string; type: string }>,
      people: PersonRef[],
    ) => PersonRef[];
  } | null {
    const me = this.resolveMe(persons, identity, mePersonId);
    const normalized = this.normalizeText(question);
    const matcher = normalized.match(/^who (?:is|are) my (.+)$/);
    if (!matcher) return null;

    const term = matcher[1].trim();
    const singular = term.endsWith('s') ? term.slice(0, -1) : term;
    const isMale = (p: PersonRef) => (p.gender ?? '').toLowerCase() === 'male';
    const isFemale = (p: PersonRef) => (p.gender ?? '').toLowerCase() === 'female';

    const parentsOf = (
      id: string,
      relationships: Array<{ fromPersonId: string; toPersonId: string; type: string }>,
    ) =>
      relationships
        .filter((r) => r.type === 'PARENT' && r.toPersonId === id)
        .map((r) => r.fromPersonId);
    const childrenOf = (
      id: string,
      relationships: Array<{ fromPersonId: string; toPersonId: string; type: string }>,
    ) =>
      relationships
        .filter((r) => r.type === 'PARENT' && r.fromPersonId === id)
        .map((r) => r.toPersonId);
    const spousesOf = (
      id: string,
      relationships: Array<{ fromPersonId: string; toPersonId: string; type: string }>,
    ) =>
      relationships
        .filter((r) => r.type === 'SPOUSE' && (r.fromPersonId === id || r.toPersonId === id))
        .map((r) => (r.fromPersonId === id ? r.toPersonId : r.fromPersonId));

    const resolveByIds = (ids: string[], filter?: (p: PersonRef) => boolean): PersonRef[] => {
      const set = new Set(ids);
      return persons.filter((p) => set.has(p.id) && (!filter || filter(p)));
    };

    const siblingsOf = (
      id: string,
      relationships: Array<{ fromPersonId: string; toPersonId: string; type: string }>,
    ) => {
      const parentIds = parentsOf(id, relationships);
      const sibIds = new Set<string>();
      for (const parentId of parentIds) {
        for (const childId of childrenOf(parentId, relationships)) {
          if (childId !== id) sibIds.add(childId);
        }
      }
      for (const rel of relationships) {
        if (rel.type !== 'SIBLING') continue;
        if (rel.fromPersonId === id) sibIds.add(rel.toPersonId);
        if (rel.toPersonId === id) sibIds.add(rel.fromPersonId);
      }
      return [...sibIds];
    };

    if (singular === 'mother') {
      return {
        label: 'Mother',
        me,
        resolve: (relationships) => resolveByIds(parentsOf(me.id, relationships), isFemale),
      };
    }
    if (singular === 'father') {
      return {
        label: 'Father',
        me,
        resolve: (relationships) => resolveByIds(parentsOf(me.id, relationships), isMale),
      };
    }
    if (singular === 'parent') {
      return {
        label: 'Parent',
        me,
        resolve: (relationships) => resolveByIds(parentsOf(me.id, relationships)),
      };
    }
    if (singular === 'spouse' || singular === 'husband' || singular === 'wife') {
      return {
        label: 'Spouse',
        me,
        resolve: (relationships) => resolveByIds(spousesOf(me.id, relationships)),
      };
    }
    if (singular === 'brother') {
      return {
        label: 'Brother',
        me,
        resolve: (relationships) => resolveByIds(siblingsOf(me.id, relationships), isMale),
      };
    }
    if (singular === 'sister') {
      return {
        label: 'Sister',
        me,
        resolve: (relationships) => resolveByIds(siblingsOf(me.id, relationships), isFemale),
      };
    }
    if (singular === 'sibling') {
      return {
        label: 'Sibling',
        me,
        resolve: (relationships) => resolveByIds(siblingsOf(me.id, relationships)),
      };
    }
    if (singular === 'child' || singular === 'son' || singular === 'daughter') {
      const filter = singular === 'son' ? isMale : singular === 'daughter' ? isFemale : undefined;
      return {
        label: singular === 'child' ? 'Child' : singular === 'son' ? 'Son' : 'Daughter',
        me,
        resolve: (relationships) => resolveByIds(childrenOf(me.id, relationships), filter),
      };
    }
    if (singular === 'grandparent' || singular === 'grandfather' || singular === 'grandmother') {
      const filter =
        singular === 'grandfather' ? isMale : singular === 'grandmother' ? isFemale : undefined;
      return {
        label:
          singular === 'grandparent'
            ? 'Grandparent'
            : singular === 'grandfather'
              ? 'Grandfather'
              : 'Grandmother',
        me,
        resolve: (relationships) => {
          const gpIds = new Set<string>();
          for (const p of parentsOf(me.id, relationships)) {
            for (const gp of parentsOf(p, relationships)) gpIds.add(gp);
          }
          return resolveByIds([...gpIds], filter);
        },
      };
    }
    if (singular === 'grandchild') {
      return {
        label: 'Grandchild',
        me,
        resolve: (relationships) => {
          const gcIds = new Set<string>();
          for (const c of childrenOf(me.id, relationships)) {
            for (const gc of childrenOf(c, relationships)) gcIds.add(gc);
          }
          return resolveByIds([...gcIds]);
        },
      };
    }

    return null;
  }

  private resolveMe(persons: PersonRef[], identity: AuthIdentity, mePersonId?: string): PersonRef {
    if (mePersonId) {
      const match = persons.find((p) => p.id === mePersonId);
      if (!match) {
        throw new AppError('Selected "me" person is not part of this family', 400);
      }
      return match;
    }

    if (identity.email) {
      const email = identity.email.toLocaleLowerCase();
      const emailMatch = persons.find((p) => (p.email ?? '').toLocaleLowerCase() === email);
      if (emailMatch) {
        return emailMatch;
      }
    }

    if (identity.phone) {
      const normalizedPhone = identity.phone.replace(/[\s\-()]/g, '');
      const phoneMatch = persons.find(
        (p) => (p.phone ?? '').replace(/[\s\-()]/g, '') === normalizedPhone,
      );
      if (phoneMatch) {
        return phoneMatch;
      }
    }

    const usernameLower = identity.username.toLocaleLowerCase();
    const nameMatches = persons.filter((p) => p.name.toLocaleLowerCase() === usernameLower);
    if (nameMatches.length === 1) {
      return nameMatches[0];
    }

    throw new AppError('Please select "I am" person before asking "to me" questions', 400);
  }

  private resolveByPhrase(phrase: string, persons: PersonRef[], strict = false): PersonRef {
    const normalizedPhrase = this.normalizeText(phrase);
    const compactPhrase = normalizedPhrase.replace(/\s+/g, ' ').trim();
    const phraseWords = compactPhrase.split(' ').filter((w) => w.length >= 2);

    const exactFullName = persons.find((p) => this.normalizeText(p.name) === compactPhrase);
    if (exactFullName) return exactFullName;

    if (strict && phraseWords.length > 0) {
      const directTokenMatches = persons.filter((p) => {
        const tokens = this.normalizeText(p.name).split(' ');
        if (phraseWords.length === 1) {
          return tokens.includes(phraseWords[0]);
        }
        return this.normalizeText(p.name).includes(compactPhrase);
      });
      if (directTokenMatches.length === 1) {
        return directTokenMatches[0];
      }
      if (directTokenMatches.length > 1) {
        throw new AppError(`Multiple people matched "${phrase.trim()}". Use full name.`, 400, {
          suggestions: directTokenMatches.map((p) => p.name),
        });
      }
      throw this.buildUnmatchedNameError(phrase, persons);
    }

    const ranked = this.rankMentions(phrase, persons);
    if (ranked.length === 0) {
      throw this.buildUnmatchedNameError(phrase, persons);
    }
    if (ranked[0].score < 6) {
      throw this.buildUnmatchedNameError(phrase, persons);
    }
    return ranked[0].person;
  }

  private rankMentions(
    text: string,
    persons: PersonRef[],
  ): Array<{ person: PersonRef; score: number }> {
    const normalized = this.normalizeText(text);
    const stopWords = new Set(['who', 'what', 'is', 'to', 'me', 'my', 'myself', 'the', 'a', 'an']);
    const words = normalized.split(/\s+/).filter((w) => w.length >= 3 && !stopWords.has(w));

    const scored = persons
      .map((person) => {
        const personName = person.name.toLocaleLowerCase();
        const tokens = personName.split(/\s+/).filter((t) => t.length >= 2);
        let score = 0;

        if (normalized.includes(personName)) score += 10;
        if (words.some((w) => tokens.includes(w))) score += 4;
        if (words.some((w) => personName.startsWith(w))) score += 2;
        if (tokens.length > 0 && words.includes(tokens[0])) score += 1;

        return { person, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const lenDiff = b.person.name.length - a.person.name.length;
        if (lenDiff !== 0) return lenDiff;
        return a.person.id.localeCompare(b.person.id);
      });

    return scored;
  }

  private normalizeText(value: string): string {
    return value
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildUnmatchedNameError(phrase: string, persons: PersonRef[]): AppError {
    return new AppError(`Could not match "${phrase.trim()}" to a family member`, 400, {
      suggestions: this.suggestNames(phrase, persons),
    });
  }

  private suggestNames(phrase: string, persons: PersonRef[]): string[] {
    const q = this.normalizeText(phrase);
    if (!q) return [];

    const qWords = q.split(' ').filter((w) => w.length >= 2);
    const isSingleWord = qWords.length <= 1;

    const scored = persons
      .map((person) => {
        const normalizedName = this.normalizeText(person.name);
        const tokens = normalizedName.split(' ').filter((t) => t.length >= 2);
        let distance = Number.MAX_SAFE_INTEGER;

        if (isSingleWord && qWords.length === 1) {
          const tokenDistances = tokens.map((t) => this.levenshtein(qWords[0], t));
          distance =
            tokenDistances.length > 0
              ? Math.min(...tokenDistances)
              : this.levenshtein(qWords[0], normalizedName);
        } else {
          distance = this.levenshtein(q, normalizedName);
        }

        const startsWith =
          normalizedName.startsWith(q) || tokens.some((t) => t.startsWith(qWords[0] ?? q));
        const contains = normalizedName.includes(q);
        const rankingScore = distance - (startsWith ? 1 : 0) - (contains ? 1 : 0);

        return { name: person.name, distance, rankingScore };
      })
      .sort((a, b) => {
        if (a.rankingScore !== b.rankingScore) return a.rankingScore - b.rankingScore;
        return a.name.localeCompare(b.name);
      });

    const maxDistance = Math.max(3, Math.ceil((q.length || 1) * 0.6));
    const filtered = scored.filter((item) => item.distance <= maxDistance).slice(0, 3);

    if (filtered.length > 0) {
      return filtered.map((item) => item.name);
    }

    return scored.slice(0, 3).map((item) => item.name);
  }

  private levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const prev = new Array<number>(b.length + 1);
    const curr = new Array<number>(b.length + 1);
    for (let j = 0; j <= b.length; j += 1) prev[j] = j;

    for (let i = 1; i <= a.length; i += 1) {
      curr[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
    }

    return prev[b.length];
  }

  private buildFallbackAnswer(
    subjectName: string,
    objectName: string,
    isObjectMe: boolean,
    relationship: RelationshipClassification,
  ): string {
    const base = isObjectMe
      ? `${subjectName} is ${this.humanize(relationship)} to you.`
      : `${subjectName} is ${this.humanize(relationship)} to ${objectName}.`;

    const details: string[] = [];
    if (relationship.multiplePaths) details.push('Multiple shortest relationship paths exist.');
    if (relationship.cycleDetected)
      details.push('A parental cycle exists in the graph, so verify data quality.');
    return details.length > 0 ? `${base} ${details.join(' ')}` : base;
  }

  private humanize(relationship: RelationshipClassification): string {
    if (relationship.label !== 'Cousin') return relationship.label.toLocaleLowerCase();
    const degree = relationship.degree ?? 1;
    const removal = relationship.removal ?? 0;
    if (removal === 0) return `${degree} degree cousin`;
    return `${degree} degree cousin ${removal} removed`;
  }
}
