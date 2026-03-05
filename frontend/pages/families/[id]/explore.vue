<template>
  <div>
    <div class="d-flex flex-wrap align-center justify-space-between mb-4">
      <div>
        <h1 class="page-title">Relationship Explorer</h1>
        <p class="page-subtitle">Choose two family members to see their connection in plain language.</p>
      </div>
      <v-btn variant="outlined" @click="goOverview">Back to Overview</v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <v-row>
      <v-col cols="12" md="5">
        <RelationshipQueryForm
          :person-a="personA"
          :person-b="personB"
          :person-options="personOptions"
          @update:person-a="personA = $event"
          @update:person-b="personB = $event"
          @swap="swapPeople"
        />
      </v-col>

      <v-col cols="12" md="7">
        <RelationshipResultCard
          :english-label="resolvedRelationshipLabel"
          :english-summary="englishSummary"
          :telugu-summary="teluguSummary"
          :blood-tag="bloodTag"
          :lineage-tag="lineageTag"
          :age-tag="ageTag"
          :multiple-paths="Boolean(result?.multiplePaths)"
          :language="resultLanguage"
          @update:language="resultLanguage = $event"
        />
      </v-col>

      <v-col cols="12" md="8">
        <PathViewer :paths="pathNames" />
      </v-col>
      <v-col cols="12" md="4">
        <RelationshipExplainPanel
          :explanation="aiExplanation"
          :loading="explainLoading"
          :disabled="!result"
          :error="explainError"
          @explain="explain"
        />
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { useAppContextStore } from '@/stores/appContext';
import { useAuthStore } from '@/stores/auth';
import type { Person } from '@/types/api';

definePageMeta({ layout: 'app' });

type RelationshipResult = {
  label: string;
  degree?: number;
  removal?: number;
  commonAncestorId?: string;
  paths: string[][];
  multiplePaths: boolean;
  cycleDetected: boolean;
};
type RelationshipEdge = { id: string; fromPersonId: string; toPersonId: string; type: string };

const route = useRoute();
const router = useRouter();
const { client } = useApi();
const appContext = useAppContextStore();
const auth = useAuthStore();

appContext.restore();
auth.restore();

const familyId = route.params.id as string;
const personA = ref<string | null>(appContext.selfByFamily[familyId] ?? null);
const personB = ref<string | null>(null);
const result = ref<RelationshipResult | null>(null);
const pathNames = ref<string[][]>([]);
const error = ref('');
const aiExplanation = ref('');
const explainLoading = ref(false);
const explainError = ref('');
const resultLanguage = ref<'english' | 'telugu' | 'both'>('both');
const relationSubjectId = computed(() => personB.value);
const relationTargetId = computed(() => personA.value);

const teluguByEnglish: Record<string, string> = {
  Self: 'నేనే',
  Parent: 'తల్లి/తండ్రి',
  Father: 'తండ్రి',
  Mother: 'తల్లి',
  Child: 'కుమారుడు/కుమార్తె',
  Son: 'కుమారుడు',
  Daughter: 'కుమార్తె',
  Sibling: 'అన్న/తమ్ముడు/అక్క/చెల్లి',
  Brother: 'అన్న/తమ్ముడు',
  Sister: 'అక్క/చెల్లి',
  'Older Brother': 'అన్న',
  'Younger Brother': 'తమ్ముడు',
  'Older Sister': 'అక్క',
  'Younger Sister': 'చెల్లి',
  Spouse: 'భర్త/భార్య',
  Husband: 'భర్త',
  Wife: 'భార్య',
  Grandparent: 'తాతయ్య/అమ్మమ్మ/నానమ్మ',
  Grandfather: 'తాతయ్య',
  Grandmother: 'అమ్మమ్మ/నానమ్మ',
  Grandchild: 'మనవడు/మనవరాలు',
  Grandson: 'మనవడు',
  Granddaughter: 'మనవరాలు',
  Uncle: 'మామయ్య/బాబాయి',
  Aunt: 'అత్త/పిన్ని',
  Nephew: 'మనల్లుడు',
  Niece: 'మనవరాలు (సోదర సంబంధం)',
  Cousin: 'కజిన్',
  'In-law': 'మరదలు/మామగారు/అత్తగారు (సంబంధం)',
  'Father-in-law': 'మామగారు',
  'Mother-in-law': 'అత్తగారు',
  'Son-in-law': 'అల్లుడు',
  'Daughter-in-law': 'కోడలు',
  'Brother-in-law': 'బావ',
  'Sister-in-law': 'మరదలు',
  'Child-in-law': 'అల్లుడు/కోడలు',
  'Parent-in-law': 'మామగారు/అత్తగారు',
  'Sibling-in-law': 'బావ/వదిన/మరదలు',
  Relative: 'బంధువు',
};

const peopleQuery = useQuery({
  queryKey: ['explore-persons', familyId],
  queryFn: () => client.get<Person[]>(`/families/${familyId}/persons`),
});
const relationshipQuery = useQuery({
  queryKey: ['explore-relationships', familyId],
  queryFn: () => client.get<RelationshipEdge[]>(`/families/${familyId}/relationships`),
});

const people = computed(() => peopleQuery.data.value ?? []);
const relationships = computed(() => relationshipQuery.data.value ?? []);
const personOptions = computed(() =>
  people.value.map((person) => ({ title: person.name, value: person.id })).sort((a, b) => a.title.localeCompare(b.title)),
);
const personNameById = computed(() => new Map(people.value.map((person) => [person.id, person.name])));
const personById = computed(() => new Map(people.value.map((person) => [person.id, person])));
const relationshipTypeBetween = (a: string, b: string): string | null => {
  const forward = relationships.value.find((r) => r.fromPersonId === a && r.toPersonId === b);
  if (forward) return forward.type;
  const reverse = relationships.value.find((r) => r.fromPersonId === b && r.toPersonId === a);
  return reverse?.type ?? null;
};

const relationFromTo = (fromId: string, toId: string): 'PARENT' | 'CHILD' | 'SPOUSE' | 'SIBLING' | 'INLAW' | null => {
  const direct = relationships.value.find((r) => r.fromPersonId === fromId && r.toPersonId === toId);
  const reverse = relationships.value.find((r) => r.fromPersonId === toId && r.toPersonId === fromId);

  if (direct?.type === 'PARENT') return 'PARENT';
  if (reverse?.type === 'PARENT') return 'CHILD';
  if (direct?.type === 'SPOUSE' || reverse?.type === 'SPOUSE') return 'SPOUSE';
  if (direct?.type === 'SIBLING' || reverse?.type === 'SIBLING') return 'SIBLING';
  if (direct?.type === 'INLAW' || reverse?.type === 'INLAW') return 'INLAW';
  return null;
};

watch(
  people,
  (entries) => {
    if (!entries.length) return;
    if (personA.value) return;

    const authEmail = auth.email?.trim().toLowerCase();
    if (authEmail) {
      const me = entries.find((person) => (person.email ?? '').trim().toLowerCase() === authEmail);
      if (me) {
        personA.value = me.id;
        appContext.setSelfPerson(familyId, me.id);
      }
    }
  },
  { immediate: true },
);

const computeRelationship = async (): Promise<void> => {
  if (!personA.value || !personB.value || personA.value === personB.value) {
    result.value = null;
    pathNames.value = [];
    error.value = '';
    aiExplanation.value = '';
    explainError.value = '';
    return;
  }
  try {
    error.value = '';
    aiExplanation.value = '';
    explainError.value = '';
    const response = await client.get<RelationshipResult>(
      `/relationship?familyId=${familyId}&personA=${personB.value}&personB=${personA.value}`,
    );
    result.value = response;
    pathNames.value = (response.paths ?? []).map((path) => path.map((id) => personNameById.value.get(id) ?? id));
  } catch (err: unknown) {
    result.value = null;
    pathNames.value = [];
    error.value =
      (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
      'Could not compute relationship.';
  }
};

watch([personA, personB], () => {
  void computeRelationship();
});

const explain = async (): Promise<void> => {
  if (!result.value) return;
  try {
    explainLoading.value = true;
    explainError.value = '';
    const response = await client.post<{ explanation: string }>('/ai/explain', {
      classification: result.value.label,
      paths: pathNames.value,
      commonAncestorId: result.value.commonAncestorId,
    });
    aiExplanation.value = response.explanation;
  } catch (err: unknown) {
    explainError.value =
      (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
      'Could not generate explanation.';
  } finally {
    explainLoading.value = false;
  }
};

const normalizeDate = (value?: string | null): number | null => {
  if (!value) return null;
  const timestamp = new Date(`${value.slice(0, 10)}T00:00:00.000Z`).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

const toGender = (value?: string | null): 'male' | 'female' | 'other' | 'unknown' => {
  const normalized = (value ?? '').toLowerCase();
  if (normalized === 'male' || normalized === 'female' || normalized === 'other' || normalized === 'unknown') {
    return normalized;
  }
  return 'unknown';
};

const ageOrderBetween = (olderCandidateId: string, youngerCandidateId: string): 'older' | 'younger' | 'unknown' => {
  const olderCandidate = personById.value.get(olderCandidateId);
  const youngerCandidate = personById.value.get(youngerCandidateId);
  const a = normalizeDate(olderCandidate?.dateOfBirth);
  const b = normalizeDate(youngerCandidate?.dateOfBirth);
  if (a === null || b === null) return 'unknown';
  if (a < b) return 'older';
  if (a > b) return 'younger';
  return 'unknown';
};

const parentOf = (childId: string): string[] =>
  relationships.value
    .filter((relationship) => relationship.type === 'PARENT' && relationship.toPersonId === childId)
    .map((relationship) => relationship.fromPersonId);

const hasParentFromTo = (parentId: string, childId: string): boolean =>
  relationships.value.some(
    (relationship) => relationship.type === 'PARENT' && relationship.fromPersonId === parentId && relationship.toPersonId === childId,
  );

const spousesOf = (personId: string): Set<string> => {
  const out = new Set<string>();
  for (const relationship of relationships.value) {
    if (relationship.type !== 'SPOUSE') continue;
    if (relationship.fromPersonId === personId) out.add(relationship.toPersonId);
    if (relationship.toPersonId === personId) out.add(relationship.fromPersonId);
  }
  return out;
};

const areSiblingLike = (personX: string, personY: string): boolean => {
  if (personX === personY) return false;
  const directSibling = relationships.value.some(
    (relationship) =>
      relationship.type === 'SIBLING' &&
      ((relationship.fromPersonId === personX && relationship.toPersonId === personY) ||
        (relationship.fromPersonId === personY && relationship.toPersonId === personX)),
  );
  if (directSibling) return true;

  const xParents = new Set(parentOf(personX));
  const yParents = parentOf(personY);
  return yParents.some((parentId) => xParents.has(parentId));
};

const findUncleAuntContext = (
  uncleAuntId: string,
  childId: string,
): { side: 'paternal' | 'maternal' | 'unknown'; ageOrder: 'older' | 'younger' | 'unknown' } => {
  const candidateParents = parentOf(childId);
  for (const candidateParentId of candidateParents) {
    if (!areSiblingLike(uncleAuntId, candidateParentId)) continue;
    const candidateParent = personById.value.get(candidateParentId);
    const side = toGender(candidateParent?.gender) === 'male' ? 'paternal' : toGender(candidateParent?.gender) === 'female' ? 'maternal' : 'unknown';
    return {
      side,
      ageOrder: ageOrderBetween(uncleAuntId, candidateParentId),
    };
  }

  // Fallback for multi-hop graphs: use a shortest-path segment where a node is parent of Person 2
  const paths = result.value?.paths ?? [];
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i += 1) {
      const from = path[i];
      const to = path[i + 1];
      if (!hasParentFromTo(from, to)) continue;
      if (to !== childId) continue;
      if (!areSiblingLike(uncleAuntId, from)) continue;
      const parentNode = personById.value.get(from);
      const side = toGender(parentNode?.gender) === 'male' ? 'paternal' : toGender(parentNode?.gender) === 'female' ? 'maternal' : 'unknown';
      return {
        side,
        ageOrder: ageOrderBetween(uncleAuntId, from),
      };
    }
  }

  return { side: 'unknown', ageOrder: 'unknown' };
};

const findGrandparentSide = (
  grandparentId: string,
  grandchildId: string,
): 'paternal' | 'maternal' | 'unknown' => {
  const paths = result.value?.paths ?? [];
  for (const path of paths) {
    if (path.length < 3) continue;
    if (path[0] !== grandparentId) continue;
    if (path[path.length - 1] !== grandchildId) continue;

    // Expected shortest chain: grandparent -> parent -> child
    const parentId = path[1];
    if (!hasParentFromTo(grandparentId, parentId)) continue;
    const parent = personById.value.get(parentId);
    const parentGender = toGender(parent?.gender);
    if (parentGender === 'male') return 'paternal';
    if (parentGender === 'female') return 'maternal';
  }
  return 'unknown';
};

const resolveByGenderAndAge = (label: string): string => {
  const person1 = relationSubjectId.value ? personById.value.get(relationSubjectId.value) : null;
  const person2 = relationTargetId.value ? personById.value.get(relationTargetId.value) : null;
  const g = (person1?.gender ?? '').toLowerCase();
  const g2 = (person2?.gender ?? '').toLowerCase();
  const d1 = normalizeDate(person1?.dateOfBirth);
  const d2 = normalizeDate(person2?.dateOfBirth);
  const isOlder = d1 !== null && d2 !== null ? d1 < d2 : null;
  // Summary sentence is always "Person 1 is X to Person 2".
  // So pick gendered in-law term by Person 1 (subject), not Person 2.
  const inLawSiblingBySubjectGender = (): string => {
    if (g === 'male') return 'Brother-in-law';
    if (g === 'female') return 'Sister-in-law';
    if (g2 === 'female') return 'Brother-in-law';
    if (g2 === 'male') return 'Sister-in-law';
    return 'Sibling-in-law';
  };

  if (label === 'Uncle/Aunt') return g === 'male' ? 'Uncle' : g === 'female' ? 'Aunt' : 'Uncle/Aunt';
  if (label === 'Niece/Nephew') return g === 'male' ? 'Nephew' : g === 'female' ? 'Niece' : 'Niece/Nephew';
  if (label === 'Parent') return g === 'male' ? 'Father' : g === 'female' ? 'Mother' : 'Parent';
  if (label === 'Child') return g === 'male' ? 'Son' : g === 'female' ? 'Daughter' : 'Child';
  if (label === 'Spouse') return g === 'male' ? 'Husband' : g === 'female' ? 'Wife' : 'Spouse';
  if (label === 'Grandparent') return g === 'male' ? 'Grandfather' : g === 'female' ? 'Grandmother' : 'Grandparent';
  if (label === 'Grandchild') return g === 'male' ? 'Grandson' : g === 'female' ? 'Granddaughter' : 'Grandchild';
  if (label === 'Sibling') {
    if (g === 'male' && isOlder === true) return 'Older Brother';
    if (g === 'male' && isOlder === false) return 'Younger Brother';
    if (g === 'female' && isOlder === true) return 'Older Sister';
    if (g === 'female' && isOlder === false) return 'Younger Sister';
    if (g === 'male') return 'Brother';
    if (g === 'female') return 'Sister';
    return 'Sibling';
  }
  if (label === 'In-law') {
    const subjectId = relationSubjectId.value;
    const targetId = relationTargetId.value;
    if (subjectId && targetId) {
      const targetSpouses = [...spousesOf(targetId)];
      const paths = result.value?.paths ?? [];

      // Strong structural check from computed shortest paths:
      // subject -> spouse(target) <-/-> target
      // This catches parent/child in-law cases even when direct helper heuristics miss.
      for (const path of paths) {
        if (path.length !== 3) continue;
        const [candidateSubject, middle, candidateTarget] = path;
        if (candidateSubject !== subjectId || candidateTarget !== targetId) continue;
        if (!spousesOf(targetId).has(middle)) continue;

        if (hasParentFromTo(subjectId, middle)) {
          return g === 'male' ? 'Father-in-law' : g === 'female' ? 'Mother-in-law' : 'Parent-in-law';
        }
        if (hasParentFromTo(middle, subjectId)) {
          return g === 'male' ? 'Son-in-law' : g === 'female' ? 'Daughter-in-law' : 'Child-in-law';
        }
        if (areSiblingLike(subjectId, middle)) {
          return inLawSiblingBySubjectGender();
        }
      }

      // subject is parent of target's spouse => father/mother-in-law
      if (targetSpouses.some((spouseId) => hasParentFromTo(subjectId, spouseId))) {
        return g === 'male' ? 'Father-in-law' : g === 'female' ? 'Mother-in-law' : 'Parent-in-law';
      }

      // subject is child of target's spouse => son/daughter-in-law
      if (targetSpouses.some((spouseId) => hasParentFromTo(spouseId, subjectId))) {
        return g === 'male' ? 'Son-in-law' : g === 'female' ? 'Daughter-in-law' : 'Child-in-law';
      }

      // subject is sibling of target's spouse => brother/sister-in-law
      if (targetSpouses.some((spouseId) => areSiblingLike(subjectId, spouseId))) {
        return inLawSiblingBySubjectGender();
      }

      // subject is spouse of target's sibling => brother/sister-in-law
      const targetSiblings = people.value
        .map((person) => person.id)
        .filter((id) => id !== targetId && areSiblingLike(id, targetId));
      if (targetSiblings.some((siblingId) => spousesOf(siblingId).has(subjectId))) {
        return inLawSiblingBySubjectGender();
      }

      // subject is spouse of spouse's sibling => brother/sister-in-law
      for (const spouseId of targetSpouses) {
        const spouseSiblings = people.value
          .map((person) => person.id)
          .filter((id) => id !== spouseId && areSiblingLike(id, spouseId));
        if (spouseSiblings.some((siblingId) => spousesOf(siblingId).has(subjectId))) {
          return inLawSiblingBySubjectGender();
        }
      }
    }

    const path = result.value?.paths?.[0] ?? [];
    if (path.length >= 2 && relationFromTo(path[0], path[1]) === 'SPOUSE') {
      const spouseToNext = path.length >= 3 ? relationFromTo(path[1], path[2]) : null;
      const nextToNext = path.length >= 4 ? relationFromTo(path[2], path[3]) : null;

      // A -> spouse -> spouse-parent (direct in-law parent relation)
      if (path.length === 3 && spouseToNext === 'CHILD') {
        return g === 'male' ? 'Son-in-law' : g === 'female' ? 'Daughter-in-law' : 'Child-in-law';
      }

      // A -> spouse -> spouse-sibling (direct sibling-in-law relation)
      if (path.length === 3 && spouseToNext === 'SIBLING') {
        return inLawSiblingBySubjectGender();
      }

      // A -> spouse -> spouse-parent -> spouse-sibling (common practical case)
      if (path.length >= 4 && spouseToNext === 'CHILD' && nextToNext === 'PARENT' && path[3] !== path[1]) {
        return inLawSiblingBySubjectGender();
      }

      // A -> spouse -> spouse-child -> spouse-of-child
      if (path.length >= 4 && spouseToNext === 'PARENT' && nextToNext === 'SPOUSE') {
        return g === 'male' ? 'Father-in-law' : g === 'female' ? 'Mother-in-law' : 'Parent-in-law';
      }
    }
    return inLawSiblingBySubjectGender();
  }
  return label;
};

const teluguSiblingTermByGenderAge = (
  gender: 'male' | 'female' | 'other' | 'unknown',
  ageOrder: 'older' | 'younger' | 'unknown',
): string => {
  if (gender === 'male') {
    if (ageOrder === 'older') return 'అన్న';
    if (ageOrder === 'younger') return 'తమ్ముడు';
    return 'అన్న/తమ్ముడు';
  }
  if (gender === 'female') {
    if (ageOrder === 'older') return 'అక్క';
    if (ageOrder === 'younger') return 'చెల్లి';
    return 'అక్క/చెల్లి';
  }
  return 'తోబుట్టువు';
};

const inLawContextForTelugu = (
  subjectId: string,
  targetId: string,
): 'spouse-side-sibling-branch' | 'target-sibling-spouse' | 'parent-in-law' | 'child-in-law' | 'unknown' => {
  const targetSpouses = [...spousesOf(targetId)];

  if (targetSpouses.some((spouseId) => hasParentFromTo(subjectId, spouseId))) return 'parent-in-law';
  if (targetSpouses.some((spouseId) => hasParentFromTo(spouseId, subjectId))) return 'child-in-law';
  if (targetSpouses.some((spouseId) => areSiblingLike(subjectId, spouseId))) return 'spouse-side-sibling-branch';

  for (const spouseId of targetSpouses) {
    const spouseSiblings = people.value
      .map((person) => person.id)
      .filter((id) => id !== spouseId && areSiblingLike(id, spouseId));
    if (spouseSiblings.some((siblingId) => spousesOf(siblingId).has(subjectId))) {
      return 'spouse-side-sibling-branch';
    }
  }

  const targetSiblings = people.value
    .map((person) => person.id)
    .filter((id) => id !== targetId && areSiblingLike(id, targetId));
  if (targetSiblings.some((siblingId) => spousesOf(siblingId).has(subjectId))) return 'target-sibling-spouse';

  return 'unknown';
};

const resolvedRelationshipLabel = computed(() => {
  const label = result.value?.label ?? '';
  if (!label) return '—';
  return resolveByGenderAndAge(label);
});

const resolvedTeluguLabel = computed(() => {
  const label = resolvedRelationshipLabel.value;
  if (!result.value || !relationSubjectId.value || !relationTargetId.value) return teluguByEnglish[label] ?? label;

  const p1Id = relationSubjectId.value;
  const p2Id = relationTargetId.value;
  const p1 = personById.value.get(p1Id);
  const p1Gender = toGender(p1?.gender);
  const path = result.value.paths?.[0] ?? [];

  if (label === 'Uncle' || label === 'Aunt') {
    const context = findUncleAuntContext(p1Id, p2Id);

    if (p1Gender === 'male') {
      if (context.side === 'paternal') {
        if (context.ageOrder === 'older') return 'పెద్దనాన్న';
        if (context.ageOrder === 'younger') return 'చిన్నాన్న';
        return 'బాబాయి';
      }
      if (context.side === 'maternal') return 'మామయ్య';
      return 'మామయ్య/బాబాయి';
    }

    if (p1Gender === 'female') {
      if (context.side === 'paternal') return 'అత్త';
      if (context.side === 'maternal') return 'పిన్ని';
      return 'అత్త/పిన్ని';
    }

    return 'మామయ్య/బాబాయి/అత్త/పిన్ని';
  }

  if (label === 'Niece' || label === 'Nephew') {
    const context = findUncleAuntContext(p2Id, p1Id);
    if (context.side === 'paternal') {
      if (p1Gender === 'male') return 'కొడుకు';
      if (p1Gender === 'female') return 'కూతురు';
      return 'కొడుకు/కూతురు';
    }
    if (context.side === 'maternal') {
      if (p1Gender === 'male') return 'మేనల్లుడు';
      if (p1Gender === 'female') return 'మేనకోడలు';
      return 'మేనల్లుడు/మేనకోడలు';
    }
    if (p1Gender === 'male') return 'మేనల్లుడు';
    if (p1Gender === 'female') return 'మేనకోడలు';
    return 'మేనల్లుడు/మేనకోడలు';
  }

  if (label === 'Niece/Nephew') {
    const p1GenderLocal = toGender(personById.value.get(p1Id)?.gender);
    const context = findUncleAuntContext(p2Id, p1Id);
    if (context.side === 'paternal') {
      if (p1GenderLocal === 'male') return 'కొడుకు';
      if (p1GenderLocal === 'female') return 'కూతురు';
      return 'కొడుకు/కూతురు';
    }
    if (context.side === 'maternal') {
      if (p1GenderLocal === 'male') return 'మేనల్లుడు';
      if (p1GenderLocal === 'female') return 'మేనకోడలు';
      return 'మేనల్లుడు/మేనకోడలు';
    }
    if (p1GenderLocal === 'male') return 'మేనల్లుడు';
    if (p1GenderLocal === 'female') return 'మేనకోడలు';
    return 'మేనల్లుడు/మేనకోడలు';
  }

  if (label === 'Grandmother') {
    const side = findGrandparentSide(p1Id, p2Id);
    if (side === 'paternal') return 'నానమ్మ';
    if (side === 'maternal') return 'అమ్మమ్మ';
    return 'అమ్మమ్మ/నానమ్మ';
  }

  if (label === 'Grandfather') {
    return 'తాతయ్య';
  }

  if (label === 'Grandparent') {
    const side = findGrandparentSide(p1Id, p2Id);
    if (p1Gender === 'female') {
      if (side === 'paternal') return 'నానమ్మ';
      if (side === 'maternal') return 'అమ్మమ్మ';
      return 'అమ్మమ్మ/నానమ్మ';
    }
    if (p1Gender === 'male') return 'తాతయ్య';
    return 'తాతయ్య/అమ్మమ్మ/నానమ్మ';
  }

  if (label === 'Sibling-in-law') {
    const context = inLawContextForTelugu(p1Id, p2Id);
    if (context === 'spouse-side-sibling-branch') {
      return teluguSiblingTermByGenderAge(p1Gender, ageOrderBetween(p1Id, p2Id));
    }
    if (p1Gender === 'male') return 'బావ';
    if (p1Gender === 'female') return ageOrderBetween(p1Id, p2Id) === 'older' ? 'వదిన' : 'మరదలు';
    return 'బావ/వదిన/మరదలు';
  }

  if (label === 'Brother-in-law' || label === 'Sister-in-law') {
    const context = inLawContextForTelugu(p1Id, p2Id);
    if (context === 'spouse-side-sibling-branch') {
      return teluguSiblingTermByGenderAge(p1Gender, ageOrderBetween(p1Id, p2Id));
    }
    if (label === 'Brother-in-law') return 'బావ';
    return ageOrderBetween(p1Id, p2Id) === 'older' ? 'వదిన' : 'మరదలు';
  }

  return teluguByEnglish[label] ?? label;
});

const englishSummary = computed(() => {
  if (!result.value || !relationSubjectId.value || !relationTargetId.value) return 'Select two people to view summary.';
  const p1 = personNameById.value.get(relationSubjectId.value) ?? 'Person 2';
  const p2 = personNameById.value.get(relationTargetId.value) ?? 'Person 1';
  return `${p1} is ${resolvedRelationshipLabel.value} to ${p2}.`;
});

const teluguSummary = computed(() => {
  if (!result.value || !relationSubjectId.value || !relationTargetId.value)
    return 'సంబంధ సారాంశం చూడటానికి ఇద్దరిని ఎంచుకోండి.';
  const p1 = personNameById.value.get(relationSubjectId.value) ?? 'Person 2';
  const p2 = personNameById.value.get(relationTargetId.value) ?? 'Person 1';
  const relationTelugu = resolvedTeluguLabel.value;
  return `${p1} ${p2}కు ${relationTelugu}.`;
});

const bloodTag = computed(() => {
  const label = resolvedRelationshipLabel.value;
  return label.toLowerCase().includes('in-law') || ['Spouse', 'Husband', 'Wife'].includes(label)
    ? 'Relation type: By marriage'
    : 'Relation type: By blood';
});

const lineageTag = computed(() => {
  const label = resolvedRelationshipLabel.value;
  if (['Parent', 'Grandparent', 'Uncle', 'Aunt'].includes(label)) return 'Family side: Maternal/Paternal (depends)';
  return 'Family side: Mixed/Not specific';
});

const ageTag = computed(() => {
  const label = resolvedRelationshipLabel.value;
  if (['Parent', 'Grandparent', 'Uncle', 'Aunt'].includes(label)) return 'Age direction: Older generation';
  if (['Child', 'Grandchild', 'Nephew', 'Niece'].includes(label)) return 'Age direction: Younger generation';
  return 'Age direction: Not clearly determined';
});

const swapPeople = (): void => {
  const a = personA.value;
  personA.value = personB.value;
  personB.value = a;
};

const goOverview = async (): Promise<void> => {
  await router.push(`/families/${familyId}`);
};
</script>
