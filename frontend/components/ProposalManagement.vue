<template>
  <v-card title="Proposal Management" class="mb-4">
    <v-card-text>
      <div class="mb-4">
        <div class="d-flex align-center justify-space-between mb-2">
          <p class="text-subtitle-1 mb-0">Proposals</p>
          <v-chip size="small" variant="tonal">{{ proposals.length }}</v-chip>
        </div>
        <v-alert v-if="proposals.length === 0" variant="tonal" type="info" density="compact">
          No proposals yet for this family.
        </v-alert>
        <ProposalCard v-for="proposal in proposals" :key="proposal.id" :proposal="proposal" @open="openProposalDetail" />
      </div>

      <ProposalDetailDrawer
        :model-value="detailDrawerOpen"
        :proposal="selectedDetailProposal"
        :show-actions="Boolean(isOwner && selectedDetailProposal?.status === 'PENDING')"
        @close="detailDrawerOpen = false"
        @approve="approveFromDrawer"
        @reject="rejectFromDrawer"
        @preview="openPreview"
      />

      <v-divider class="my-4" />

      <v-row>
        <v-col cols="12" md="5">
          <v-select v-model="type" :items="proposalTypes" label="Proposal Type" />
        </v-col>
      </v-row>

      <v-row v-if="type === 'ADD_PERSON'">
        <v-col cols="12">
          <div class="d-flex flex-wrap align-center ga-2">
            <v-btn color="primary" variant="outlined" prepend-icon="mdi-account-plus-outline" @click="addPersonDialog = true">
              Open Add Member Form
            </v-btn>
          </div>
          <p class="text-caption text-medium-emphasis mt-2 mb-0">
            Fill member details and submit directly from the dialog.
          </p>
        </v-col>
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
      <v-row v-else-if="type === 'EDIT_PERSON'">
        <v-col cols="12" md="5">
          <v-select
            v-model="editPersonId"
            :items="personOptions"
            item-title="label"
            item-value="value"
            label="Member to Edit"
          />
        </v-col>
        <v-col cols="12">
          <div class="text-caption text-medium-emphasis">
            Add one or more field updates. Unselected fields keep existing values.
          </div>
        </v-col>
        <template v-for="(row, index) in editPersonRows" :key="`edit-row-${index}`">
          <v-col cols="12" md="4">
            <v-select
              v-model="row.field"
              :items="availableEditPersonFields(index)"
              item-title="label"
              item-value="value"
              label="Field"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-select
              v-if="row.field === 'gender'"
              v-model="row.value"
              :items="genderOptions"
              label="Value"
              :hint="editPersonCurrentHint(row.field)"
              persistent-hint
            />
            <DateInputField
              v-else-if="row.field === 'dateOfBirth'"
              v-model="row.value"
              label="Value"
              :hint="editPersonCurrentHint(row.field)"
              persistent-hint
            />
            <v-text-field
              v-else
              v-model="row.value"
              label="Value"
              :placeholder="editPersonFieldPlaceholder(row.field)"
              :hint="editPersonCurrentHint(row.field)"
              persistent-hint
            />
          </v-col>
          <v-col cols="12" md="2" class="d-flex align-center">
            <v-btn
              variant="text"
              color="error"
              :disabled="editPersonRows.length === 1"
              @click="removeEditPersonRow(index)"
            >
              Remove
            </v-btn>
          </v-col>
        </template>
        <v-col cols="12">
          <v-btn variant="tonal" size="small" @click="addEditPersonRow">Add Field</v-btn>
        </v-col>
      </v-row>

      <v-row v-else-if="type === 'DELETE_PERSON'">
        <v-col cols="12" md="6">
          <v-select
            v-model="deletePersonId"
            :items="personOptions"
            item-title="label"
            item-value="value"
            label="Member to Delete"
          />
        </v-col>
      </v-row>

      <v-row v-else-if="type === 'DELETE_RELATIONSHIP'">
        <v-col cols="12" md="6">
          <v-select
            v-model="deleteRelationshipId"
            :items="relationshipOptions"
            item-title="label"
            item-value="value"
            label="Relationship to Delete"
          />
        </v-col>
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

      <v-btn v-if="type !== 'ADD_PERSON'" color="primary" class="mt-3" @click="submitProposal">Submit Proposal</v-btn>
      <v-alert v-if="formError" type="error" variant="tonal" class="mt-3">{{ formError }}</v-alert>

      <v-dialog v-model="addPersonDialog" max-width="880">
        <v-card class="surface-card" title="Add Member (Proposal)">
          <v-card-text>
            <v-row>
              <v-col cols="12" md="4"><v-text-field v-model="personGivenName" label="Given Name" /></v-col>
              <v-col cols="12" md="3"><v-text-field v-model="personFamilyName" label="Family Name" /></v-col>
              <v-col cols="12" md="2"><v-select v-model="personGender" :items="genderOptions" label="Gender" /></v-col>
              <v-col cols="12" md="3">
                <DateInputField
                  v-model="personDateOfBirth"
                  label="Date of Birth"
                  persistent-hint
                />
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
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn color="primary" @click="submitProposal">Submit Proposal</v-btn>
            <v-btn @click="addPersonDialog = false">Done</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

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
                  <template v-else-if="selectedProposalSummary.type === 'IMPORT_FROM_FAMILY'">
                    <div class="detail-row"><strong>Source Family:</strong> {{ selectedProposalSummary.importDetails.sourceFamilyName }}</div>
                    <div class="detail-row"><strong>Selected Members:</strong> {{ selectedProposalSummary.importDetails.selectedPersonCount }}</div>
                    <div class="detail-row"><strong>Matched Existing:</strong> {{ selectedProposalSummary.importDetails.matchedMembers.length }}</div>
                    <div class="detail-row"><strong>New Members:</strong> {{ selectedProposalSummary.importDetails.newMembers.length }}</div>
                    <div class="detail-row"><strong>New Relationships:</strong> {{ selectedProposalSummary.importDetails.relationshipAdds.length }}</div>
                    <div class="detail-row"><strong>Skipped Relationships:</strong> {{ selectedProposalSummary.importDetails.relationshipSkips.length }}</div>
                  </template>
                  <template v-else>
                    <div class="detail-row">
                      <strong>Change:</strong> {{ selectedProposalSummary.impacts[0] || selectedProposalSummary.typeLabel }}
                    </div>
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
type EditPersonPayload = {
  personId: string;
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
type DeletePersonPayload = { personId: string };
type DeleteRelationshipPayload = { relationshipId: string };
type EditPersonField =
  | 'givenName'
  | 'familyName'
  | 'gender'
  | 'dateOfBirth'
  | 'email'
  | 'phone'
  | 'placeOfBirth'
  | 'occupation'
  | 'notes';
type EditPersonRow = { field: EditPersonField | null; value: string };
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
type ParsedPreview = {
  diff?: PreviewDiff;
  impact?: PreviewImpact;
  importPreview?: ImportPreview;
  simulated?: {
    persons?: Person[];
    relationships?: RelationshipEdge[];
    proposedPersonIds?: string[];
    proposedRelationshipKeys?: string[];
  };
};
type ProposalSummary = {
  type:
    | 'ADD_PERSON'
    | 'ADD_RELATIONSHIP'
    | 'IMPORT_FROM_FAMILY'
    | 'EDIT_PERSON'
    | 'DELETE_PERSON'
    | 'EDIT_RELATIONSHIP'
    | 'DELETE_RELATIONSHIP';
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

const proposalTypes = [
  'ADD_PERSON',
  'ADD_RELATIONSHIP',
  'IMPORT_FROM_FAMILY',
  'EDIT_PERSON',
  'DELETE_PERSON',
  'DELETE_RELATIONSHIP',
] as const;
const relationshipTypes = ['PARENT', 'SPOUSE', 'SIBLING', 'INLAW'];
const genderOptions = ['male', 'female', 'other', 'unknown'] as const;

const type = ref<
  | 'ADD_PERSON'
  | 'ADD_RELATIONSHIP'
  | 'IMPORT_FROM_FAMILY'
  | 'EDIT_PERSON'
  | 'DELETE_PERSON'
  | 'DELETE_RELATIONSHIP'
>('ADD_PERSON');
const personGivenName = ref('');
const personFamilyName = ref('');
const personGender = ref<'male' | 'female' | 'other' | 'unknown'>('unknown');
const personDateOfBirth = ref('');
const addPersonDialog = ref(false);
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
const editPersonId = ref('');
const editPersonRows = ref<EditPersonRow[]>([{ field: null, value: '' }]);
const deletePersonId = ref('');
const deleteRelationshipId = ref('');
const importSourceFamilyId = ref('');
const importIncludeRelationships = ref(true);
const showPreview = ref(false);
const selectedProposalSummary = ref<ProposalSummary | null>(null);
const detailDrawerOpen = ref(false);
const selectedDetailProposal = ref<Proposal | null>(null);
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
const personById = computed(() => new Map(props.persons.map((person) => [person.id, person])));
const editPersonFieldOptions: Array<{ label: string; value: EditPersonField }> = [
  { label: 'Given Name', value: 'givenName' },
  { label: 'Family Name', value: 'familyName' },
  { label: 'Gender', value: 'gender' },
  { label: 'Date of Birth', value: 'dateOfBirth' },
  { label: 'Email', value: 'email' },
  { label: 'Phone', value: 'phone' },
  { label: 'Place of Birth', value: 'placeOfBirth' },
  { label: 'Occupation', value: 'occupation' },
  { label: 'Notes', value: 'notes' },
];
const relationshipOptions = computed(() =>
  props.relationships.map((relationship) => ({
    value: relationship.id,
    label: `${relationship.type}: ${personNameById.value.get(relationship.fromPersonId) ?? relationship.fromPersonId} -> ${personNameById.value.get(relationship.toPersonId) ?? relationship.toPersonId}`,
  })),
);
const relationshipById = computed(() => new Map(props.relationships.map((relationship) => [relationship.id, relationship])));
const importSourceFamilyOptions = computed(() =>
  props.families
    .filter((family) => family.id !== props.familyId)
    .map((family) => ({ title: family.name, value: family.id }))
    .sort((a, b) => a.title.localeCompare(b.title)),
);

const selectedEditPerson = computed(() => (editPersonId.value ? personById.value.get(editPersonId.value) : undefined));
const availableEditPersonFields = (rowIndex: number): Array<{ label: string; value: EditPersonField }> => {
  const used = new Set(
    editPersonRows.value
      .map((row, index) => (index === rowIndex ? null : row.field))
      .filter((value): value is EditPersonField => value !== null),
  );
  return editPersonFieldOptions.filter((option) => !used.has(option.value));
};
const editPersonFieldPlaceholder = (field: EditPersonField | null): string => {
  if (field === 'dateOfBirth') return 'YYYY-MM-DD';
  if (field === 'phone') return '+919876543210';
  if (field === 'email') return 'name@example.com';
  return 'Enter value';
};
const editPersonCurrentHint = (field: EditPersonField | null): string => {
  if (!field || !selectedEditPerson.value) return '';
  const current = selectedEditPerson.value;
  const metadata = parseJson<Record<string, unknown>>(current.metadataJson, {});
  const valueByField: Record<EditPersonField, string | null | undefined> = {
    givenName: current.givenName,
    familyName: current.familyName,
    gender: current.gender,
    dateOfBirth: current.dateOfBirth,
    email: current.email,
    phone: current.phone,
    placeOfBirth: typeof metadata.placeOfBirth === 'string' ? metadata.placeOfBirth : undefined,
    occupation: typeof metadata.occupation === 'string' ? metadata.occupation : undefined,
    notes: typeof metadata.notes === 'string' ? metadata.notes : undefined,
  };
  return `Current: ${valueByField[field] ?? '-'}`;
};
const addEditPersonRow = (): void => {
  if (editPersonRows.value.length >= editPersonFieldOptions.length) return;
  editPersonRows.value.push({ field: null, value: '' });
};
const removeEditPersonRow = (index: number): void => {
  if (editPersonRows.value.length === 1) return;
  editPersonRows.value.splice(index, 1);
};

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const normalizePhone = (value: string): string => value.replace(/[\s\-()]/g, '');
const isValidPhone = (value: string): boolean => /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));
const normalizeOptional = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

const openProposalDetail = (proposal: Proposal): void => {
  selectedDetailProposal.value = proposal;
  detailDrawerOpen.value = true;
};

const approveFromDrawer = (proposalId: string): void => {
  detailDrawerOpen.value = false;
  selectedDetailProposal.value = null;
  emit('approve', proposalId);
};

const rejectFromDrawer = (proposalId: string): void => {
  detailDrawerOpen.value = false;
  selectedDetailProposal.value = null;
  emit('reject', proposalId);
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
    addPersonDialog.value = false;
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

  if (type.value === 'EDIT_PERSON') {
    if (!editPersonId.value.trim()) {
      formError.value = 'Please select a member to edit.';
      return;
    }
    const updates: Omit<EditPersonPayload, 'personId'> = {};
    for (const row of editPersonRows.value) {
      if (!row.field) continue;
      const value = row.value.trim();
      if (!value) {
        formError.value = `Please provide a value for ${row.field}.`;
        return;
      }
      if (row.field === 'email') {
        if (!isValidEmail(value)) {
          formError.value = 'Email must be valid.';
          return;
        }
        updates.email = value.toLowerCase();
        continue;
      }
      if (row.field === 'phone') {
        if (!isValidPhone(value)) {
          formError.value = 'Phone must include country code, e.g. +919876543210.';
          return;
        }
        updates.phone = normalizePhone(value);
        continue;
      }
      if (row.field === 'dateOfBirth') {
        if (isFutureDate(value)) {
          formError.value = 'Date of birth cannot be in the future.';
          return;
        }
        updates.dateOfBirth = value;
        continue;
      }
      if (row.field === 'gender') {
        if (!genderOptions.includes(value as (typeof genderOptions)[number])) {
          formError.value = 'Please select a valid gender.';
          return;
        }
        updates.gender = value;
        continue;
      }
      if ((row.field === 'givenName' || row.field === 'familyName') && value.length < 2) {
        formError.value = `${row.field} must be at least 2 characters.`;
        return;
      }
      if (row.field === 'givenName') updates.givenName = value;
      if (row.field === 'familyName') updates.familyName = value;
      if (row.field === 'placeOfBirth') updates.placeOfBirth = value;
      if (row.field === 'occupation') updates.occupation = value;
      if (row.field === 'notes') updates.notes = value;
    }
    if (Object.keys(updates).length === 0) {
      formError.value = 'Select at least one field to update.';
      return;
    }
    emit('submit', {
      type: 'EDIT_PERSON',
      data: {
        personId: editPersonId.value.trim(),
        ...updates,
      } satisfies EditPersonPayload,
    });
    return;
  }

  if (type.value === 'DELETE_PERSON') {
    if (!deletePersonId.value.trim()) {
      formError.value = 'Please select a member to delete.';
      return;
    }
    emit('submit', {
      type: 'DELETE_PERSON',
      data: { personId: deletePersonId.value.trim() } satisfies DeletePersonPayload,
    });
    return;
  }

  if (type.value === 'DELETE_RELATIONSHIP') {
    if (!deleteRelationshipId.value.trim()) {
      formError.value = 'Please select a relationship to delete.';
      return;
    }
    emit('submit', {
      type: 'DELETE_RELATIONSHIP',
      data: { relationshipId: deleteRelationshipId.value.trim() } satisfies DeleteRelationshipPayload,
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

const buildGenericMutationSummary = (
  proposal: Proposal,
  parsedPreview: ParsedPreview,
  typeLabel: string,
): ProposalSummary => {
  const diff = parsedPreview.diff ?? {};
  const simulatedPersons = parsedPreview.simulated?.persons ?? props.persons;
  const simulatedRelationships = parsedPreview.simulated?.relationships ?? props.relationships;
  return {
    type: proposal.type,
    typeLabel,
    status: proposal.status,
    createdAt: proposal.createdAt,
    diff: { addedPersons: diff.addedPersons ?? 0, addedRelationships: diff.addedRelationships ?? 0 },
    impacts: diff.impacts?.length ? diff.impacts : [typeLabel],
    impactLabel: parsedPreview.impact?.label ?? null,
    simulatedPersons: [...simulatedPersons],
    simulatedRelationships: [...simulatedRelationships],
    proposedPersonIds: parsedPreview.simulated?.proposedPersonIds ?? [],
    proposedRelationshipKeys: parsedPreview.simulated?.proposedRelationshipKeys ?? [],
    focusPersonId: parsedPreview.simulated?.proposedPersonIds?.[0],
    personDetails: { name: '-', gender: '-', email: '-', phone: '-', dateOfBirth: '-' },
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
  } else if (proposal.type === 'IMPORT_FROM_FAMILY') {
    selectedProposalSummary.value = buildImportSummary(
      proposal,
      payload as ImportFromFamilyPayload,
      parsedPreview,
    );
  } else if (proposal.type === 'EDIT_PERSON') {
    selectedProposalSummary.value = buildGenericMutationSummary(proposal, parsedPreview, 'Edit Member');
  } else if (proposal.type === 'DELETE_PERSON') {
    selectedProposalSummary.value = buildGenericMutationSummary(proposal, parsedPreview, 'Delete Member');
  } else if (proposal.type === 'EDIT_RELATIONSHIP') {
    selectedProposalSummary.value = buildGenericMutationSummary(proposal, parsedPreview, 'Edit Relationship');
  } else {
    selectedProposalSummary.value = buildGenericMutationSummary(proposal, parsedPreview, 'Delete Relationship');
  }
  showPreview.value = true;
};

const closePreview = (): void => {
  showPreview.value = false;
  selectedProposalSummary.value = null;
};

watch(editPersonId, () => {
  editPersonRows.value = [{ field: null, value: '' }];
});

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

@media (max-width: 680px) {
  .preview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
