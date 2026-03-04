<template>
  <v-card title="Proposal Management" class="mb-4">
    <v-card-text>
      <v-row>
        <v-col cols="12" md="5">
          <v-select v-model="type" :items="proposalTypes" label="Proposal Type" />
        </v-col>
      </v-row>

      <v-row v-if="type === 'ADD_PERSON'">
        <v-col cols="12" md="4"><v-text-field v-model="personGivenName" label="Given Name" /></v-col>
        <v-col cols="12" md="3"><v-text-field v-model="personFamilyName" label="Family Name" /></v-col>
        <v-col cols="12" md="2"><v-select v-model="personGender" :items="genderOptions" label="Gender" /></v-col>
        <v-col cols="12" md="3">
          <v-text-field
            v-model="personDateOfBirth"
            label="Date of Birth"
            readonly
            placeholder="YYYY-MM-DD"
            @click="personDobMenu = true"
          />
          <v-dialog v-model="personDobMenu" max-width="360">
            <v-card title="Select Date of Birth">
              <v-card-text>
                <v-date-picker
                  :model-value="personDateOfBirth || null"
                  @update:model-value="onProposalDobPick"
                />
              </v-card-text>
              <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="personDobMenu = false">Close</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
        </v-col>
        <v-col cols="12" md="3"><v-text-field v-model="personPhone" label="Phone (+country code)" /></v-col>
        <v-col cols="12" md="4"><v-text-field v-model="personEmail" label="Email (required)" /></v-col>
        <v-col cols="12" md="4"><v-text-field v-model="personPlaceOfBirth" label="Place of Birth" /></v-col>
        <v-col cols="12" md="4"><v-text-field v-model="personOccupation" label="Occupation" /></v-col>
        <v-col cols="12">
          <v-file-input
            v-model="personPhotoFile"
            label="Profile Picture"
            accept="image/png,image/jpeg,image/webp,image/gif"
            prepend-icon="mdi-camera"
            show-size
            @update:model-value="onProposalProfilePhotoSelected"
          />
          <div v-if="personProfilePictureDataUrl" class="d-flex align-center ga-2 mt-2">
            <v-avatar size="52">
              <v-img :src="personProfilePictureDataUrl" alt="profile preview" />
            </v-avatar>
            <v-btn size="small" variant="text" color="error" @click="clearProposalProfilePhoto">Remove photo</v-btn>
          </div>
        </v-col>
        <v-col cols="12"><v-textarea v-model="personNotes" label="Notes" rows="2" auto-grow /></v-col>
      </v-row>

      <v-row v-else-if="type === 'ADD_RELATIONSHIP'">
        <v-col cols="12" md="4">
          <v-select
            v-model="fromPersonId"
            :items="personOptions"
            item-title="label"
            item-value="value"
            label="From Member"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            v-model="toPersonId"
            :items="personOptions"
            item-title="label"
            item-value="value"
            label="To Member"
          />
        </v-col>
        <v-col cols="12" md="4"><v-select v-model="relationshipType" :items="relationshipTypes" label="Relationship Type" /></v-col>
      </v-row>
      <v-row v-else>
        <v-col cols="12" md="8">
          <v-select
            v-model="importSourceFamilyId"
            :items="importSourceFamilyOptions"
            item-title="title"
            item-value="value"
            label="Source Family"
          />
        </v-col>
        <v-col cols="12" md="4" class="d-flex align-center">
          <v-checkbox
            v-model="importIncludeRelationships"
            label="Include relationships"
            color="primary"
            hide-details
          />
        </v-col>
      </v-row>

      <v-btn color="primary" @click="submitProposal">Submit Proposal</v-btn>
      <v-alert v-if="formError" type="error" variant="tonal" class="mt-3">{{ formError }}</v-alert>

      <v-dialog v-model="showPreview" max-width="1200">
        <v-card title="Proposal Preview">
          <v-card-text v-if="selectedProposalSummary">
            <div class="preview-top">
              <v-chip size="small" color="primary" variant="tonal">{{ selectedProposalSummary.typeLabel }}</v-chip>
              <v-chip size="small" variant="tonal">{{ selectedProposalSummary.status }}</v-chip>
              <span class="text-caption text-medium-emphasis">
                {{ new Date(selectedProposalSummary.createdAt).toLocaleString() }}
              </span>
            </div>

            <div class="preview-grid mt-3">
              <v-card variant="tonal" class="preview-summary-card">
                <v-card-title class="text-subtitle-1">What Will Change</v-card-title>
                <v-card-text>
                  <ul class="impact-list">
                    <li v-for="impact in selectedProposalSummary.impacts" :key="impact">{{ impact }}</li>
                  </ul>
                  <div class="d-flex flex-wrap ga-2 mt-2">
                    <v-chip size="small" color="orange-darken-2" variant="flat">
                      +{{ selectedProposalSummary.diff.addedPersons }} people
                    </v-chip>
                    <v-chip size="small" color="orange-darken-2" variant="flat">
                      +{{ selectedProposalSummary.diff.addedRelationships }} relationships
                    </v-chip>
                  </div>
                  <p v-if="selectedProposalSummary.impactLabel" class="text-caption mt-3 mb-0">
                    Relationship impact: <strong>{{ selectedProposalSummary.impactLabel }}</strong>
                  </p>
                </v-card-text>
              </v-card>

              <v-card variant="outlined" class="preview-summary-card">
                <v-card-title class="text-subtitle-1">Proposal Details</v-card-title>
                <v-card-text>
                  <template v-if="selectedProposalSummary.type === 'ADD_PERSON'">
                    <div class="detail-row"><strong>Name:</strong> {{ selectedProposalSummary.personDetails.name }}</div>
                    <div class="detail-row"><strong>Gender:</strong> {{ selectedProposalSummary.personDetails.gender }}</div>
                    <div class="detail-row"><strong>Email:</strong> {{ selectedProposalSummary.personDetails.email || '-' }}</div>
                    <div class="detail-row"><strong>Phone:</strong> {{ selectedProposalSummary.personDetails.phone || '-' }}</div>
                    <div class="detail-row">
                      <strong>Date Of Birth:</strong> {{ selectedProposalSummary.personDetails.dateOfBirth || '-' }}
                    </div>
                  </template>
                  <template v-else-if="selectedProposalSummary.type === 'ADD_RELATIONSHIP'">
                    <div class="detail-row"><strong>From:</strong> {{ selectedProposalSummary.relationshipDetails.fromName }}</div>
                    <div class="detail-row"><strong>To:</strong> {{ selectedProposalSummary.relationshipDetails.toName }}</div>
                    <div class="detail-row"><strong>Type:</strong> {{ selectedProposalSummary.relationshipDetails.type }}</div>
                  </template>
                  <template v-else>
                    <div class="detail-row"><strong>Source Family:</strong> {{ selectedProposalSummary.importDetails.sourceFamilyName }}</div>
                    <div class="detail-row"><strong>Selected Members:</strong> {{ selectedProposalSummary.importDetails.selectedPersonCount }}</div>
                    <div class="detail-row"><strong>Matched Existing:</strong> {{ selectedProposalSummary.importDetails.matchedMembers.length }}</div>
                    <div class="detail-row"><strong>New Members:</strong> {{ selectedProposalSummary.importDetails.newMembers.length }}</div>
                    <div class="detail-row"><strong>New Relationships:</strong> {{ selectedProposalSummary.importDetails.relationshipAdds.length }}</div>
                    <div class="detail-row"><strong>Skipped Relationships:</strong> {{ selectedProposalSummary.importDetails.relationshipSkips.length }}</div>
                  </template>
                </v-card-text>
              </v-card>
            </div>

            <v-card
              v-if="selectedProposalSummary.type === 'IMPORT_FROM_FAMILY'"
              variant="outlined"
              class="mt-3"
            >
              <v-card-title class="text-subtitle-1">Import Review</v-card-title>
              <v-card-text>
                <p v-if="selectedProposalSummary.importDetails.conflicts.length > 0" class="text-error mb-2">
                  {{ selectedProposalSummary.importDetails.conflicts.join('; ') }}
                </p>
                <div class="text-caption text-medium-emphasis mb-2">
                  Matched members map to existing profiles; new members will be created.
                </div>
                <div class="d-flex flex-wrap ga-2">
                  <v-chip
                    v-for="member in selectedProposalSummary.importDetails.newMembers.slice(0, 8)"
                    :key="`new-${member.sourcePersonId}`"
                    size="small"
                    color="primary"
                    variant="tonal"
                  >
                    + {{ member.name }}
                  </v-chip>
                  <v-chip
                    v-for="member in selectedProposalSummary.importDetails.matchedMembers.slice(0, 8)"
                    :key="`match-${member.sourcePersonId}`"
                    size="small"
                    color="success"
                    variant="tonal"
                  >
                    {{ member.sourceName }} -> {{ member.targetName }}
                  </v-chip>
                </div>
              </v-card-text>
            </v-card>

            <div class="mt-4">
              <p class="text-subtitle-2 mb-2">Graph If Applied</p>
              <GraphVisualization
                :persons="selectedProposalSummary.simulatedPersons"
                :relationships="selectedProposalSummary.simulatedRelationships"
                :focus-person-id="selectedProposalSummary.focusPersonId"
                :proposed-person-ids="selectedProposalSummary.proposedPersonIds"
                :proposed-relationship-keys="selectedProposalSummary.proposedRelationshipKeys"
              />
            </div>
          </v-card-text>
          <v-card-text v-else>
            Could not parse proposal preview data.
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn @click="closePreview">Close</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-divider class="my-4" />

      <v-list>
        <v-list-item v-for="proposal in proposals" :key="proposal.id">
          <template #title>
            {{ proposal.type }} - {{ proposal.status }}
          </template>
          <template #subtitle>
            <span v-if="proposal.overriddenByVersionNumber">Overridden in v{{ proposal.overriddenByVersionNumber }}</span>
            <span v-else>Created {{ new Date(proposal.createdAt).toLocaleString() }}</span>
          </template>
          <template #append>
            <div class="proposal-actions">
              <v-btn
                v-if="isOwner && proposal.status === 'PENDING'"
                size="small"
                color="success"
                @click="$emit('approve', proposal.id)"
              >
                Approve
              </v-btn>
              <v-btn
                v-if="isOwner && proposal.status === 'PENDING'"
                size="small"
                color="error"
                @click="$emit('reject', proposal.id)"
              >
                Reject
              </v-btn>
              <v-btn size="small" @click="openPreview(proposal)">Preview</v-btn>
            </div>
          </template>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { Family, Person, Proposal } from '@/types/api';

type RelationshipType = 'PARENT' | 'SPOUSE' | 'SIBLING' | 'INLAW';
type RelationshipEdge = { id: string; fromPersonId: string; toPersonId: string; type: RelationshipType };
type AddPersonPayload = {
  name?: string;
  givenName?: string;
  familyName?: string;
  gender?: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
  placeOfBirth?: string;
  occupation?: string;
  notes?: string;
  profilePictureDataUrl?: string;
  profilePictureUrl?: string;
};
type AddRelationshipPayload = { fromPersonId: string; toPersonId: string; type: RelationshipType };
type ImportFromFamilyPayload = { sourceFamilyId: string; selectedPersonIds?: string[]; includeRelationships?: boolean };
type PreviewDiff = { addedPersons?: number; addedRelationships?: number; impacts?: string[] };
type PreviewImpact = { label?: string } | null;
type ImportPreview = {
  sourceFamilyId?: string;
  sourceFamilyName?: string;
  selectedPersonCount?: number;
  includeRelationships?: boolean;
  conflicts?: string[];
  matchedMembers?: Array<{ sourcePersonId: string; sourceName: string; targetPersonId: string; targetName: string; reason?: string | null }>;
  newMembers?: Array<{ sourcePersonId: string; name: string; email?: string | null; phone?: string | null }>;
  relationshipAdds?: Array<{ fromPersonId: string; toPersonId: string; type: RelationshipType }>;
  relationshipSkips?: Array<{ fromPersonId: string; toPersonId: string; type: RelationshipType; reason?: string }>;
  simulated?: {
    persons?: Person[];
    relationships?: RelationshipEdge[];
    proposedPersonIds?: string[];
    proposedRelationshipKeys?: string[];
  };
};
type ParsedPreview = { diff?: PreviewDiff; impact?: PreviewImpact; importPreview?: ImportPreview };
type ProposalSummary = {
  type: 'ADD_PERSON' | 'ADD_RELATIONSHIP' | 'IMPORT_FROM_FAMILY';
  typeLabel: string;
  status: string;
  createdAt: string;
  diff: { addedPersons: number; addedRelationships: number };
  impacts: string[];
  impactLabel: string | null;
  simulatedPersons: Person[];
  simulatedRelationships: RelationshipEdge[];
  proposedPersonIds: string[];
  proposedRelationshipKeys: string[];
  focusPersonId?: string;
  personDetails: { name: string; gender: string; email: string; phone: string; dateOfBirth: string };
  relationshipDetails: { fromName: string; toName: string; type: string };
  importDetails: {
    sourceFamilyName: string;
    selectedPersonCount: number;
    conflicts: string[];
    matchedMembers: Array<{ sourcePersonId: string; sourceName: string; targetName: string }>;
    newMembers: Array<{ sourcePersonId: string; name: string }>;
    relationshipAdds: Array<{ fromName: string; toName: string; type: string }>;
    relationshipSkips: Array<{ fromName: string; toName: string; type: string; reason: string }>;
  };
};

const props = withDefaults(
  defineProps<{ familyId: string; proposals: Proposal[]; isOwner: boolean; persons?: Person[]; relationships?: RelationshipEdge[]; families?: Family[] }>(),
  { persons: () => [], relationships: () => [], families: () => [] },
);
const emit = defineEmits<{ approve: [proposalId: string]; reject: [proposalId: string]; submit: [payload: unknown] }>();

const proposalTypes = ['ADD_PERSON', 'ADD_RELATIONSHIP', 'IMPORT_FROM_FAMILY'] as const;
const relationshipTypes = ['PARENT', 'SPOUSE', 'SIBLING', 'INLAW'];
const genderOptions = ['male', 'female', 'other', 'unknown'] as const;

const type = ref<'ADD_PERSON' | 'ADD_RELATIONSHIP' | 'IMPORT_FROM_FAMILY'>('ADD_PERSON');
const personGivenName = ref('');
const personFamilyName = ref('');
const personGender = ref<'male' | 'female' | 'other' | 'unknown'>('unknown');
const personDateOfBirth = ref('');
const personDobMenu = ref(false);
const personEmail = ref('');
const personPhone = ref('');
const personPlaceOfBirth = ref('');
const personOccupation = ref('');
const personNotes = ref('');
const personPhotoFile = ref<File | File[] | null>(null);
const personProfilePictureDataUrl = ref('');
const fromPersonId = ref('');
const toPersonId = ref('');
const relationshipType = ref<'PARENT' | 'SPOUSE' | 'SIBLING' | 'INLAW'>('PARENT');
const importSourceFamilyId = ref('');
const importIncludeRelationships = ref(true);
const showPreview = ref(false);
const selectedProposalSummary = ref<ProposalSummary | null>(null);
const formError = ref('');
const personOptions = computed(() =>
  props.persons
    .map((person) => ({
      label: person.name,
      value: person.id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label)),
);
const personNameById = computed(() => new Map(props.persons.map((person) => [person.id, person.name])));
const importSourceFamilyOptions = computed(() =>
  props.families
    .filter((family) => family.id !== props.familyId)
    .map((family) => ({ title: family.name, value: family.id }))
    .sort((a, b) => a.title.localeCompare(b.title)),
);

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const normalizePhone = (value: string): string => value.replace(/[\s\-()]/g, '');
const isValidPhone = (value: string): boolean => /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));
const normalizeOptional = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};
const toLocalYmd = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const formatDateValue = (raw: unknown): string => {
  if (!raw) return '';
  if (Array.isArray(raw)) return formatDateValue(raw[0]);
  if (typeof raw === 'string') return raw.slice(0, 10);
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return toLocalYmd(raw);
  return '';
};
const isFutureDate = (value: string): boolean => {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return true;
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return date.getTime() > todayUtc.getTime();
};
const fileToDataUrl = async (file: File): Promise<string> =>
  await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read selected image'));
    reader.readAsDataURL(file);
  });
const extractFirstFile = (value: File | File[] | null): File | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};
const onProposalDobPick = (value: unknown): void => {
  personDateOfBirth.value = formatDateValue(value);
};
const onProposalProfilePhotoSelected = async (): Promise<void> => {
  const file = extractFirstFile(personPhotoFile.value);
  if (!file) {
    personProfilePictureDataUrl.value = '';
    return;
  }
  if (file.size > 1024 * 1024) {
    formError.value = 'Profile picture must be 1MB or smaller.';
    personPhotoFile.value = null;
    personProfilePictureDataUrl.value = '';
    return;
  }
  formError.value = '';
  personProfilePictureDataUrl.value = await fileToDataUrl(file);
};
const clearProposalProfilePhoto = (): void => {
  personPhotoFile.value = null;
  personProfilePictureDataUrl.value = '';
};

const submitProposal = (): void => {
  formError.value = '';
  if (type.value === 'ADD_PERSON') {
    if (personGivenName.value.trim().length < 2) {
      formError.value = 'Given name must be at least 2 characters.';
      return;
    }
    if (personFamilyName.value.trim().length < 2) {
      formError.value = 'Family name must be at least 2 characters.';
      return;
    }
    if (!isValidEmail(personEmail.value.trim())) {
      formError.value = 'Email is required and must be valid.';
      return;
    }
    if (personPhone.value.trim() && !isValidPhone(personPhone.value.trim())) {
      formError.value = 'Phone must include country code, e.g. +919876543210.';
      return;
    }
    if (personDateOfBirth.value && isFutureDate(personDateOfBirth.value)) {
      formError.value = 'Date of birth cannot be in the future.';
      return;
    }
    emit('submit', {
      type: 'ADD_PERSON',
      data: {
        givenName: personGivenName.value.trim(),
        familyName: personFamilyName.value.trim(),
        name: `${personGivenName.value.trim()} ${personFamilyName.value.trim()}`.trim(),
        gender: personGender.value,
        dateOfBirth: normalizeOptional(personDateOfBirth.value),
        email: personEmail.value.trim().toLowerCase(),
        phone: normalizeOptional(normalizePhone(personPhone.value)),
        placeOfBirth: normalizeOptional(personPlaceOfBirth.value),
        occupation: normalizeOptional(personOccupation.value),
        notes: normalizeOptional(personNotes.value),
        profilePictureDataUrl: normalizeOptional(personProfilePictureDataUrl.value),
      },
    });
    return;
  }

  if (type.value === 'ADD_RELATIONSHIP') {
    if (!fromPersonId.value.trim() || !toPersonId.value.trim()) {
      formError.value = 'Please select both From Member and To Member.';
      return;
    }
    if (fromPersonId.value.trim() === toPersonId.value.trim()) {
      formError.value = 'From Member and To Member must be different people.';
      return;
    }

    emit('submit', {
      type: 'ADD_RELATIONSHIP',
      data: {
        fromPersonId: fromPersonId.value.trim(),
        toPersonId: toPersonId.value.trim(),
        type: relationshipType.value,
      },
    });
    return;
  }

  if (!importSourceFamilyId.value.trim()) {
    formError.value = 'Please select a source family.';
    return;
  }

  emit('submit', {
    type: 'IMPORT_FROM_FAMILY',
    data: {
      sourceFamilyId: importSourceFamilyId.value.trim(),
      includeRelationships: importIncludeRelationships.value,
    } satisfies ImportFromFamilyPayload,
  });
};

const parseJson = <T,>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const normalizeRelationshipKey = (type: RelationshipType, fromPersonId: string, toPersonId: string): string => {
  if (type === 'SPOUSE' || type === 'SIBLING' || type === 'INLAW') {
    const [a, b] = [fromPersonId, toPersonId].sort((x, y) => x.localeCompare(y));
    return `${type}:${a}:${b}`;
  }
  return `${type}:${fromPersonId}:${toPersonId}`;
};

const buildAddPersonSummary = (proposal: Proposal, payload: AddPersonPayload, parsedPreview: ParsedPreview): ProposalSummary => {
  const given = payload.givenName?.trim() ?? '';
  const family = payload.familyName?.trim() ?? '';
  const name = payload.name?.trim() || `${given} ${family}`.trim() || 'New member';
  const personId = `proposal:${proposal.id}:person`;
  const metadata = {
    placeOfBirth: payload.placeOfBirth ?? '',
    occupation: payload.occupation ?? '',
    notes: payload.notes ?? '',
    profilePictureDataUrl: payload.profilePictureDataUrl ?? '',
  };
  const newPerson: Person = {
    id: personId,
    familyId: props.familyId,
    name,
    givenName: given || null,
    familyName: family || null,
    gender: payload.gender ?? 'unknown',
    dateOfBirth: payload.dateOfBirth ?? null,
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    profilePictureUrl: payload.profilePictureDataUrl ?? payload.profilePictureUrl ?? null,
    metadataJson: JSON.stringify(metadata),
  };
  const diff = parsedPreview.diff ?? {};
  return {
    type: 'ADD_PERSON',
    typeLabel: 'Add Member',
    status: proposal.status,
    createdAt: proposal.createdAt,
    diff: { addedPersons: diff.addedPersons ?? 1, addedRelationships: diff.addedRelationships ?? 0 },
    impacts: diff.impacts?.length ? diff.impacts : [`Adds member ${name}`],
    impactLabel: parsedPreview.impact?.label ?? null,
    simulatedPersons: [...props.persons, newPerson],
    simulatedRelationships: [...props.relationships],
    proposedPersonIds: [personId],
    proposedRelationshipKeys: [],
    focusPersonId: undefined,
    personDetails: {
      name,
      gender: payload.gender ?? 'unknown',
      email: payload.email ?? '',
      phone: payload.phone ?? '',
      dateOfBirth: payload.dateOfBirth ?? '',
    },
    relationshipDetails: { fromName: '-', toName: '-', type: '-' },
    importDetails: {
      sourceFamilyName: '-',
      selectedPersonCount: 0,
      conflicts: [],
      matchedMembers: [],
      newMembers: [],
      relationshipAdds: [],
      relationshipSkips: [],
    },
  };
};

const buildAddRelationshipSummary = (
  proposal: Proposal,
  payload: AddRelationshipPayload,
  parsedPreview: ParsedPreview,
): ProposalSummary => {
  const fromId = payload.fromPersonId ?? '';
  const toId = payload.toPersonId ?? '';
  const relType = payload.type ?? 'PARENT';
  const fromName = personNameById.value.get(fromId) ?? (fromId || 'Unknown');
  const toName = personNameById.value.get(toId) ?? (toId || 'Unknown');
  const simulatedRelationship: RelationshipEdge = {
    id: `proposal:${proposal.id}:relationship`,
    fromPersonId: fromId,
    toPersonId: toId,
    type: relType,
  };
  const diff = parsedPreview.diff ?? {};
  return {
    type: 'ADD_RELATIONSHIP',
    typeLabel: 'Add Relationship',
    status: proposal.status,
    createdAt: proposal.createdAt,
    diff: { addedPersons: diff.addedPersons ?? 0, addedRelationships: diff.addedRelationships ?? 1 },
    impacts: diff.impacts?.length ? diff.impacts : [`Adds ${relType} relationship between ${fromName} and ${toName}`],
    impactLabel: parsedPreview.impact?.label ?? null,
    simulatedPersons: [...props.persons],
    simulatedRelationships: [...props.relationships, simulatedRelationship],
    proposedPersonIds: [fromId, toId].filter(Boolean),
    proposedRelationshipKeys: fromId && toId ? [normalizeRelationshipKey(relType, fromId, toId)] : [],
    focusPersonId: undefined,
    personDetails: { name: '-', gender: '-', email: '-', phone: '-', dateOfBirth: '-' },
    relationshipDetails: { fromName, toName, type: relType },
    importDetails: {
      sourceFamilyName: '-',
      selectedPersonCount: 0,
      conflicts: [],
      matchedMembers: [],
      newMembers: [],
      relationshipAdds: [],
      relationshipSkips: [],
    },
  };
};

const buildImportSummary = (
  proposal: Proposal,
  payload: ImportFromFamilyPayload,
  parsedPreview: ParsedPreview,
): ProposalSummary => {
  const diff = parsedPreview.diff ?? {};
  const importPreview = parsedPreview.importPreview ?? {};
  const simulatedPersons = importPreview.simulated?.persons ?? props.persons;
  const simulatedRelationships = importPreview.simulated?.relationships ?? props.relationships;
  const proposedPersonIds = importPreview.simulated?.proposedPersonIds ?? [];
  const proposedRelationshipKeys = importPreview.simulated?.proposedRelationshipKeys ?? [];

  const resolveName = (personId: string): string =>
    simulatedPersons.find((person) => person.id === personId)?.name ??
    personNameById.value.get(personId) ??
    personId;

  return {
    type: 'IMPORT_FROM_FAMILY',
    typeLabel: 'Import Members & Relationships',
    status: proposal.status,
    createdAt: proposal.createdAt,
    diff: { addedPersons: diff.addedPersons ?? 0, addedRelationships: diff.addedRelationships ?? 0 },
    impacts: diff.impacts?.length
      ? diff.impacts
      : [`Import from family ${importPreview.sourceFamilyName ?? payload.sourceFamilyId}`],
    impactLabel: null,
    simulatedPersons: [...simulatedPersons],
    simulatedRelationships: [...simulatedRelationships],
    proposedPersonIds: [...proposedPersonIds],
    proposedRelationshipKeys: [...proposedRelationshipKeys],
    focusPersonId: proposedPersonIds[0],
    personDetails: { name: '-', gender: '-', email: '-', phone: '-', dateOfBirth: '-' },
    relationshipDetails: { fromName: '-', toName: '-', type: '-' },
    importDetails: {
      sourceFamilyName: importPreview.sourceFamilyName ?? payload.sourceFamilyId,
      selectedPersonCount: importPreview.selectedPersonCount ?? proposedPersonIds.length,
      conflicts: importPreview.conflicts ?? [],
      matchedMembers: (importPreview.matchedMembers ?? []).map((entry) => ({
        sourcePersonId: entry.sourcePersonId,
        sourceName: entry.sourceName,
        targetName: entry.targetName,
      })),
      newMembers: (importPreview.newMembers ?? []).map((entry) => ({
        sourcePersonId: entry.sourcePersonId,
        name: entry.name,
      })),
      relationshipAdds: (importPreview.relationshipAdds ?? []).map((entry) => ({
        fromName: resolveName(entry.fromPersonId),
        toName: resolveName(entry.toPersonId),
        type: entry.type,
      })),
      relationshipSkips: (importPreview.relationshipSkips ?? []).map((entry) => ({
        fromName: resolveName(entry.fromPersonId),
        toName: resolveName(entry.toPersonId),
        type: entry.type,
        reason: entry.reason ?? 'Skipped',
      })),
    },
  };
};

const openPreview = (proposal: Proposal): void => {
  const payload = parseJson<AddPersonPayload | AddRelationshipPayload | ImportFromFamilyPayload>(
    proposal.payloadJson,
    {} as AddPersonPayload,
  );
  const parsedPreview = parseJson<ParsedPreview>(proposal.previewJson, {});
  if (proposal.type === 'ADD_PERSON') {
    selectedProposalSummary.value = buildAddPersonSummary(proposal, payload as AddPersonPayload, parsedPreview);
  } else if (proposal.type === 'ADD_RELATIONSHIP') {
    selectedProposalSummary.value = buildAddRelationshipSummary(
      proposal,
      payload as AddRelationshipPayload,
      parsedPreview,
    );
  } else {
    selectedProposalSummary.value = buildImportSummary(
      proposal,
      payload as ImportFromFamilyPayload,
      parsedPreview,
    );
  }
  showPreview.value = true;
};

const closePreview = (): void => {
  showPreview.value = false;
  selectedProposalSummary.value = null;
};

void props;
</script>

<style scoped>
.preview-top {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.preview-summary-card {
  height: 100%;
}

.impact-list {
  margin: 0;
  padding-left: 18px;
}

.detail-row {
  font-size: 14px;
  margin-top: 6px;
  color: #1f2937;
}

.proposal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

@media (max-width: 680px) {
  .preview-grid {
    grid-template-columns: 1fr;
  }

  .proposal-actions {
    width: 100%;
    justify-content: stretch;
  }

  .proposal-actions :deep(.v-btn) {
    flex: 1 1 100%;
  }
}
</style>
