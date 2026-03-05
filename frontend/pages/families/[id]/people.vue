<template>
  <div>
    <div class="d-flex flex-wrap align-center justify-space-between mb-4">
      <div>
        <h1 class="page-title">People Directory</h1>
        <p class="page-subtitle">Manage members and relationships in one place.</p>
      </div>
      <v-btn variant="outlined" @click="goOverview">Back to Overview</v-btn>
    </div>

    <v-alert v-if="operationError" type="error" variant="tonal" class="mb-4">{{ operationError }}</v-alert>
    <v-alert v-if="!isFamilyOwner" type="info" variant="tonal" class="mb-4">
      Member mode: direct edits are disabled. Use Proposals to request changes.
    </v-alert>

    <v-card class="surface-card mb-4" title="Data Quality Review" variant="flat">
      <v-card-text>
        <v-row>
          <v-col cols="12" sm="6" md="3">
            <v-card variant="outlined">
              <v-card-text>
                <div class="text-caption text-medium-emphasis">Missing Contact</div>
                <div class="text-h5 font-weight-bold">{{ missingContactCount }}</div>
                <div class="text-caption mb-2">Members without email and phone.</div>
                <v-btn size="small" variant="text" color="primary" @click="applyPeopleReviewFilter('missing_contact')">Review & Fix</v-btn>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card variant="outlined">
              <v-card-text>
                <div class="text-caption text-medium-emphasis">Missing DOB</div>
                <div class="text-h5 font-weight-bold">{{ missingDobCount }}</div>
                <div class="text-caption mb-2">Members without date of birth.</div>
                <v-btn size="small" variant="text" color="primary" @click="applyPeopleReviewFilter('missing_dob')">Review & Fix</v-btn>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card variant="outlined">
              <v-card-text>
                <div class="text-caption text-medium-emphasis">Isolated Members</div>
                <div class="text-h5 font-weight-bold">{{ isolatedMemberCount }}</div>
                <div class="text-caption mb-2">No relationships connected yet.</div>
                <v-btn size="small" variant="text" color="primary" @click="applyPeopleReviewFilter('isolated')">Review & Fix</v-btn>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card variant="outlined">
              <v-card-text>
                <div class="text-caption text-medium-emphasis">Duplicate Contact Risk</div>
                <div class="text-h5 font-weight-bold">{{ duplicateContactCount }}</div>
                <div class="text-caption mb-2">Shared email or phone across members.</div>
                <v-btn size="small" variant="text" color="primary" @click="applyPeopleReviewFilter('duplicate_contact')">Review & Fix</v-btn>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-card class="surface-card mb-4" title="People" variant="flat">
      <v-card-text>
        <div class="d-flex flex-wrap align-center justify-space-between mb-3 ga-2">
          <div class="d-flex flex-wrap ga-2 align-center">
            <v-select
              v-model="peopleReviewFilter"
              :items="peopleReviewFilterOptions"
              item-title="title"
              item-value="value"
              label="Review"
              density="comfortable"
              hide-details
              style="max-width: 220px"
            />
            <v-select
              v-model="peopleGroupBy"
              :items="peopleGroupByOptions"
              item-title="title"
              item-value="value"
              label="Group by"
              density="comfortable"
              hide-details
              style="max-width: 220px"
            />
            <v-text-field
              v-model="peopleSearch"
              label="Search people"
              density="comfortable"
              prepend-inner-icon="mdi-magnify"
              hide-details
              style="max-width: 320px"
            />
          </div>
          <div class="d-flex ga-2">
            <v-btn variant="outlined" prepend-icon="mdi-microsoft-excel" :disabled="peopleRows.length === 0" @click="exportPeopleExcel">
              Export Excel
            </v-btn>
            <v-btn v-if="isFamilyOwner" color="primary" @click="goAddPerson">Add Member</v-btn>
            <v-btn v-else color="primary" variant="outlined" @click="goProposals">Propose Change</v-btn>
          </div>
        </div>

        <v-data-table
          :headers="peopleHeaders"
          :items="filteredPeopleRows"
          :search="peopleSearch"
          :items-per-page="10"
          :sort-by="[{ key: 'name', order: 'asc' }]"
          :group-by="peopleGroupBy === 'none' ? [] : [{ key: peopleGroupBy, order: 'asc' }]"
          density="comfortable"
        >
          <template #item.name="{ item }">
            <MemberIdentity
              v-if="item?.id"
              :person-id="item.id"
              :name="item.name"
              :avatar-url="item.avatarUrl"
              size="sm"
              clickable
              @select="openPerson"
            />
            <span v-else class="text-medium-emphasis">-</span>
          </template>
          <template #item.quality="{ item }">
            <div class="d-flex flex-wrap ga-1">
              <v-chip v-for="issue in item.qualityIssues" :key="`${item.id}-${issue}`" size="x-small" color="warning" variant="tonal">
                {{ issue }}
              </v-chip>
              <span v-if="item.qualityIssues.length === 0" class="text-medium-emphasis text-caption">Good</span>
            </div>
          </template>
          <template #item.actions="{ item }">
            <div v-if="item?.id" class="text-right">
              <v-btn size="small" variant="text" :disabled="!isFamilyOwner" @click.stop="startEditPersonById(item.id)">Edit</v-btn>
              <v-btn size="small" color="error" variant="text" :disabled="!isFamilyOwner" @click.stop="removePerson(item.id)">Delete</v-btn>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <v-card class="surface-card mb-4" title="Relationships" variant="flat">
      <v-card-text>
        <div class="d-flex flex-wrap ga-2 align-center justify-space-between mb-3">
          <div class="d-flex flex-wrap ga-2 align-center">
            <v-select
              v-model="relationshipsGroupBy"
              :items="relationshipsGroupByOptions"
              item-title="title"
              item-value="value"
              label="Group by"
              density="comfortable"
              hide-details
              style="max-width: 220px"
            />
            <v-text-field
              v-model="relationshipsSearch"
              label="Search relationships"
              density="comfortable"
              prepend-inner-icon="mdi-magnify"
              hide-details
              style="max-width: 360px"
            />
          </div>
          <div class="d-flex ga-2">
            <v-btn
              variant="outlined"
              prepend-icon="mdi-microsoft-excel"
              :disabled="relationshipRows.length === 0"
              @click="exportRelationshipsExcel"
            >
              Export Excel
            </v-btn>
            <v-btn v-if="isFamilyOwner" color="primary" @click="addRelationshipDialog = true">Add Relationship</v-btn>
            <v-btn v-else color="primary" variant="outlined" @click="goProposals">Propose Change</v-btn>
          </div>
        </div>

        <v-data-table
          :headers="relationshipHeaders"
          :items="relationshipRows"
          :search="relationshipsSearch"
          :items-per-page="10"
          :sort-by="[{ key: 'from', order: 'asc' }]"
          :group-by="relationshipsGroupBy === 'none' ? [] : [{ key: relationshipsGroupBy, order: 'asc' }]"
          density="comfortable"
        >
          <template #item.from="{ item }">
            <MemberIdentity
              v-if="item?.fromPersonId"
              :person-id="item.fromPersonId"
              :name="item.from"
              :avatar-url="item.fromAvatarUrl"
              size="sm"
              clickable
              @select="openPerson"
            />
          </template>
          <template #item.to="{ item }">
            <MemberIdentity
              v-if="item?.toPersonId"
              :person-id="item.toPersonId"
              :name="item.to"
              :avatar-url="item.toAvatarUrl"
              size="sm"
              clickable
              @select="openPerson"
            />
          </template>
          <template #item.type="{ item }">
            <v-chip size="small" variant="tonal">{{ item.type }}</v-chip>
          </template>
          <template #item.actions="{ item }">
            <div class="text-right">
              <v-btn size="small" variant="text" :disabled="!isFamilyOwner" @click="startEditRelationship(item.id)">Edit</v-btn>
              <v-btn size="small" color="error" variant="text" :disabled="!isFamilyOwner" @click="removeRelationship(item.id)">Delete</v-btn>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <v-dialog v-model="addRelationshipDialog" max-width="700">
      <v-card class="surface-card" title="Add Relationship">
        <v-card-text>
          <v-row>
            <v-col cols="12" md="5"><v-select v-model="newRelationshipFrom" :items="personOptions" item-title="label" item-value="value" label="From" /></v-col>
            <v-col cols="12" md="5"><v-select v-model="newRelationshipTo" :items="personOptions" item-title="label" item-value="value" label="To" /></v-col>
            <v-col cols="12" md="2"><v-select v-model="newRelationshipType" :items="relationshipTypes" label="Type" /></v-col>
          </v-row>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn @click="addRelationshipDialog = false">Cancel</v-btn><v-btn color="primary" @click="addRelationship">Add</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="editRelationshipDialog" max-width="700">
      <v-card class="surface-card" title="Edit Relationship">
        <v-card-text>
          <v-row>
            <v-col cols="12" md="5"><v-select v-model="editRelationshipFrom" :items="personOptions" item-title="label" item-value="value" label="From" /></v-col>
            <v-col cols="12" md="5"><v-select v-model="editRelationshipTo" :items="personOptions" item-title="label" item-value="value" label="To" /></v-col>
            <v-col cols="12" md="2"><v-select v-model="editRelationshipType" :items="relationshipTypes" label="Type" /></v-col>
          </v-row>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn @click="editRelationshipDialog = false">Cancel</v-btn><v-btn color="primary" @click="saveRelationshipEdit">Save</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="editPersonDialog" max-width="700">
      <v-card class="surface-card" title="Edit Member">
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6"><v-text-field v-model="editPersonGivenName" label="Given Name" /></v-col>
            <v-col cols="12" md="6"><v-text-field v-model="editPersonFamilyName" label="Family Name" /></v-col>
            <v-col cols="12" md="4"><v-select v-model="editPersonGender" :items="genderOptions" label="Gender" /></v-col>
            <v-col cols="12" md="8"><v-text-field v-model="editPersonEmail" label="Email" /></v-col>
            <v-col cols="12" md="6"><v-text-field v-model="editPersonPhone" label="Phone" /></v-col>
            <v-col cols="12" md="6">
              <DateInputField
                v-model="editPersonDateOfBirth"
                label="Date of Birth"
                persistent-hint
              />
            </v-col>
            <v-col cols="12"><v-text-field v-model="editPersonPlaceOfBirth" label="Place of Birth" /></v-col>
            <v-col cols="12"><v-text-field v-model="editPersonOccupation" label="Occupation" /></v-col>
            <v-col cols="12"><v-textarea v-model="editPersonNotes" label="Notes" rows="2" /></v-col>
          </v-row>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn @click="editPersonDialog = false">Cancel</v-btn><v-btn color="primary" @click="savePersonEdit">Save</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import * as XLSX from 'xlsx';
import { useUiStore } from '@/stores/ui';
import type { Family, Person } from '@/types/api';

definePageMeta({ layout: 'app' });

type RelationshipRow = {
  id: string;
  fromPersonId: string;
  toPersonId: string;
  type: 'PARENT' | 'SPOUSE' | 'SIBLING' | 'INLAW';
};

const route = useRoute();
const router = useRouter();
const familyId = route.params.id as string;
const { client, authStore } = useApi();
const ui = useUiStore();
authStore.restore();

const operationError = ref('');
const peopleSearch = ref('');
const relationshipsSearch = ref('');
const peopleGroupBy = ref<'none' | 'gender' | 'emailDomain' | 'familyName'>('none');
const peopleReviewFilter = ref<'all' | 'missing_contact' | 'missing_dob' | 'isolated' | 'duplicate_contact'>('all');
const relationshipsGroupBy = ref<'none' | 'type' | 'from' | 'to'>('none');

const addRelationshipDialog = ref(false);
const newRelationshipFrom = ref('');
const newRelationshipTo = ref('');
const newRelationshipType = ref<'PARENT' | 'SPOUSE' | 'SIBLING' | 'INLAW'>('PARENT');

const editRelationshipDialog = ref(false);
const editRelationshipId = ref<string | null>(null);
const editRelationshipFrom = ref('');
const editRelationshipTo = ref('');
const editRelationshipType = ref<'PARENT' | 'SPOUSE' | 'SIBLING' | 'INLAW'>('PARENT');

const editPersonDialog = ref(false);
const editPersonId = ref<string | null>(null);
const editPersonGivenName = ref('');
const editPersonFamilyName = ref('');
const editPersonGender = ref<'male' | 'female' | 'other' | 'unknown'>('unknown');
const editPersonDateOfBirth = ref('');
const editPersonEmail = ref('');
const editPersonPhone = ref('');
const editPersonPlaceOfBirth = ref('');
const editPersonOccupation = ref('');
const editPersonNotes = ref('');

const relationshipTypes: Array<'PARENT' | 'SPOUSE' | 'SIBLING' | 'INLAW'> = ['PARENT', 'SPOUSE', 'SIBLING', 'INLAW'];
const genderOptions: Array<'male' | 'female' | 'other' | 'unknown'> = ['male', 'female', 'other', 'unknown'];

const { data: peopleData, refetch: refetchPeople } = useQuery({
  queryKey: ['people-page-persons', familyId],
  queryFn: () => client.get<Person[]>(`/families/${familyId}/persons`),
});
const { data: relationshipsData, refetch: refetchRelationships } = useQuery({
  queryKey: ['people-page-relationships', familyId],
  queryFn: () => client.get<RelationshipRow[]>(`/families/${familyId}/relationships`),
});
const { data: familiesData } = useQuery({
  queryKey: ['families'],
  queryFn: () => client.get<Family[]>('/families'),
});

const persons = computed(() => peopleData.value ?? []);
const relationships = computed(() => relationshipsData.value ?? []);
const activeFamily = computed(() => (familiesData.value ?? []).find((f) => f.id === familyId) ?? null);
const isFamilyOwner = computed(() => {
  if (!activeFamily.value || !authStore.userId) return false;
  return activeFamily.value.ownerId === authStore.userId;
});

const personOptions = computed(() => persons.value.map((p) => ({ label: p.name, value: p.id })));
const personMap = computed(() => new Map(persons.value.map((p) => [p.id, p])));

const parseMetadata = (raw: string | null | undefined): Record<string, unknown> => {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const getProfilePictureUrl = (person: Person): string | null => {
  const direct = person.profilePictureUrl?.trim();
  if (direct) return direct;
  const metadata = parseMetadata(person.metadataJson);
  const fromData = typeof metadata.profilePictureDataUrl === 'string' ? metadata.profilePictureDataUrl.trim() : '';
  return fromData || null;
};

const peopleHeaders = [
  { title: 'Member', key: 'name', sortable: true },
  { title: 'Quality', key: 'quality', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
];

const relationshipHeaders = [
  { title: 'From', key: 'from', sortable: true },
  { title: 'To', key: 'to', sortable: true },
  { title: 'Type', key: 'type', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
];

const peopleGroupByOptions = [
  { title: 'None', value: 'none' as const },
  { title: 'Gender', value: 'gender' as const },
  { title: 'Email Domain', value: 'emailDomain' as const },
  { title: 'Family Name', value: 'familyName' as const },
];

const peopleReviewFilterOptions = [
  { title: 'All members', value: 'all' as const },
  { title: 'Missing contact', value: 'missing_contact' as const },
  { title: 'Missing DOB', value: 'missing_dob' as const },
  { title: 'Isolated members', value: 'isolated' as const },
  { title: 'Duplicate contact risk', value: 'duplicate_contact' as const },
];

const relationshipsGroupByOptions = [
  { title: 'None', value: 'none' as const },
  { title: 'Type', value: 'type' as const },
  { title: 'From', value: 'from' as const },
  { title: 'To', value: 'to' as const },
];

const connectedPersonIds = computed(() => {
  const ids = new Set<string>();
  for (const relationship of relationships.value) {
    ids.add(relationship.fromPersonId);
    ids.add(relationship.toPersonId);
  }
  return ids;
});

const duplicateEmailSet = computed(() => {
  const countByEmail = new Map<string, number>();
  for (const person of persons.value) {
    const email = (person.email ?? '').trim().toLowerCase();
    if (!email) continue;
    countByEmail.set(email, (countByEmail.get(email) ?? 0) + 1);
  }
  const duplicates = new Set<string>();
  for (const person of persons.value) {
    const email = (person.email ?? '').trim().toLowerCase();
    if (email && (countByEmail.get(email) ?? 0) > 1) duplicates.add(person.id);
  }
  return duplicates;
});

const duplicatePhoneSet = computed(() => {
  const countByPhone = new Map<string, number>();
  for (const person of persons.value) {
    const phone = normalizePhone(person.phone ?? '');
    if (!phone) continue;
    countByPhone.set(phone, (countByPhone.get(phone) ?? 0) + 1);
  }
  const duplicates = new Set<string>();
  for (const person of persons.value) {
    const phone = normalizePhone(person.phone ?? '');
    if (phone && (countByPhone.get(phone) ?? 0) > 1) duplicates.add(person.id);
  }
  return duplicates;
});

const peopleRows = computed(() =>
  persons.value.map((person) => {
    const missingContact = !(person.email?.trim() || person.phone?.trim());
    const missingDob = !person.dateOfBirth?.trim();
    const isolated = !connectedPersonIds.value.has(person.id);
    const duplicateContact = duplicateEmailSet.value.has(person.id) || duplicatePhoneSet.value.has(person.id);
    const qualityIssues: string[] = [];
    if (missingContact) qualityIssues.push('Missing contact');
    if (missingDob) qualityIssues.push('Missing DOB');
    if (isolated) qualityIssues.push('Isolated');
    if (duplicateContact) qualityIssues.push('Duplicate contact');

    return {
      id: person.id,
      name: person.name,
      avatarUrl: getProfilePictureUrl(person),
      gender: person.gender || 'unknown',
      emailDomain: (person.email?.split('@')[1] ?? 'unknown').toLowerCase(),
      familyName: person.familyName?.trim() || 'Unknown',
      qualityIssues,
      missingContact,
      missingDob,
      isolated,
      duplicateContact,
    };
  }),
);

const filteredPeopleRows = computed(() => {
  if (peopleReviewFilter.value === 'all') return peopleRows.value;
  if (peopleReviewFilter.value === 'missing_contact') return peopleRows.value.filter((row) => row.missingContact);
  if (peopleReviewFilter.value === 'missing_dob') return peopleRows.value.filter((row) => row.missingDob);
  if (peopleReviewFilter.value === 'isolated') return peopleRows.value.filter((row) => row.isolated);
  return peopleRows.value.filter((row) => row.duplicateContact);
});

const missingContactCount = computed(() => peopleRows.value.filter((row) => row.missingContact).length);
const missingDobCount = computed(() => peopleRows.value.filter((row) => row.missingDob).length);
const isolatedMemberCount = computed(() => peopleRows.value.filter((row) => row.isolated).length);
const duplicateContactCount = computed(() => peopleRows.value.filter((row) => row.duplicateContact).length);

const relationshipRows = computed(() =>
  relationships.value.map((rel) => {
    const from = personMap.value.get(rel.fromPersonId);
    const to = personMap.value.get(rel.toPersonId);
    return {
      id: rel.id,
      fromPersonId: rel.fromPersonId,
      toPersonId: rel.toPersonId,
      from: from?.name ?? 'Unknown member',
      to: to?.name ?? 'Unknown member',
      fromAvatarUrl: from ? getProfilePictureUrl(from) : null,
      toAvatarUrl: to ? getProfilePictureUrl(to) : null,
      type: rel.type,
    };
  }),
);

const normalizePhone = (value: string): string => value.replace(/[\s\-()]/g, '');
const normalizeOptional = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};
const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const openPerson = (personId: string): void => {
  ui.openPerson(personId);
};

const applyPeopleReviewFilter = (filter: 'all' | 'missing_contact' | 'missing_dob' | 'isolated' | 'duplicate_contact'): void => {
  peopleReviewFilter.value = filter;
  peopleSearch.value = '';
};

const goOverview = async (): Promise<void> => {
  await router.push(`/families/${familyId}`);
};

const goProposals = async (): Promise<void> => {
  await router.push(`/families/${familyId}/proposals`);
};

const goAddPerson = async (): Promise<void> => {
  await router.push(`/families/${familyId}/persons/new`);
};

const addRelationship = async (): Promise<void> => {
  try {
    operationError.value = '';
    await client.post(`/families/${familyId}/relationships`, {
      fromPersonId: newRelationshipFrom.value,
      toPersonId: newRelationshipTo.value,
      type: newRelationshipType.value,
    });
    addRelationshipDialog.value = false;
    newRelationshipFrom.value = '';
    newRelationshipTo.value = '';
    await refetchRelationships();
  } catch (error: unknown) {
    operationError.value =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not add relationship.';
  }
};

const startEditRelationship = (relationshipId: string): void => {
  const rel = relationships.value.find((r) => r.id === relationshipId);
  if (!rel) return;
  editRelationshipId.value = rel.id;
  editRelationshipFrom.value = rel.fromPersonId;
  editRelationshipTo.value = rel.toPersonId;
  editRelationshipType.value = rel.type;
  editRelationshipDialog.value = true;
};

const saveRelationshipEdit = async (): Promise<void> => {
  if (!editRelationshipId.value) return;
  try {
    operationError.value = '';
    await client.put(`/families/${familyId}/relationships/${editRelationshipId.value}`, {
      fromPersonId: editRelationshipFrom.value,
      toPersonId: editRelationshipTo.value,
      type: editRelationshipType.value,
    });
    editRelationshipDialog.value = false;
    await refetchRelationships();
  } catch (error: unknown) {
    operationError.value =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not update relationship.';
  }
};

const removeRelationship = async (relationshipId: string): Promise<void> => {
  if (!confirm('Delete this relationship?')) return;
  try {
    operationError.value = '';
    await client.delete(`/families/${familyId}/relationships/${relationshipId}`);
    await refetchRelationships();
  } catch (error: unknown) {
    operationError.value =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not delete relationship.';
  }
};

const startEditPersonById = (personId: string): void => {
  const person = persons.value.find((entry) => entry.id === personId);
  if (!person) return;
  const metadata = parseMetadata(person.metadataJson);
  editPersonId.value = person.id;
  editPersonGivenName.value = person.givenName ?? '';
  editPersonFamilyName.value = person.familyName ?? '';
  editPersonGender.value =
    person.gender === 'male' || person.gender === 'female' || person.gender === 'other' || person.gender === 'unknown'
      ? person.gender
      : 'unknown';
  editPersonDateOfBirth.value = person.dateOfBirth ?? '';
  editPersonEmail.value = person.email ?? '';
  editPersonPhone.value = person.phone ?? '';
  editPersonPlaceOfBirth.value = typeof metadata.placeOfBirth === 'string' ? metadata.placeOfBirth : '';
  editPersonOccupation.value = typeof metadata.occupation === 'string' ? metadata.occupation : '';
  editPersonNotes.value = typeof metadata.notes === 'string' ? metadata.notes : '';
  editPersonDialog.value = true;
};

const savePersonEdit = async (): Promise<void> => {
  if (!editPersonId.value) return;
  if (!isValidEmail(editPersonEmail.value.trim())) {
    operationError.value = 'Email is required and must be valid.';
    return;
  }
  try {
    operationError.value = '';
    await client.put(`/families/${familyId}/persons/${editPersonId.value}`, {
      givenName: editPersonGivenName.value.trim(),
      familyName: editPersonFamilyName.value.trim(),
      name: `${editPersonGivenName.value.trim()} ${editPersonFamilyName.value.trim()}`.trim(),
      gender: editPersonGender.value,
      dateOfBirth: normalizeOptional(editPersonDateOfBirth.value),
      email: editPersonEmail.value.trim().toLowerCase(),
      phone: normalizeOptional(normalizePhone(editPersonPhone.value)),
      placeOfBirth: normalizeOptional(editPersonPlaceOfBirth.value),
      occupation: normalizeOptional(editPersonOccupation.value),
      notes: normalizeOptional(editPersonNotes.value),
    });
    editPersonDialog.value = false;
    await refetchPeople();
    await refetchRelationships();
  } catch (error: unknown) {
    operationError.value =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not update person.';
  }
};

const removePerson = async (personId: string): Promise<void> => {
  if (!confirm('Delete this person and all connected relationships?')) return;
  try {
    operationError.value = '';
    await client.delete(`/families/${familyId}/persons/${personId}`);
    await refetchPeople();
    await refetchRelationships();
  } catch (error: unknown) {
    operationError.value =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not delete person.';
  }
};

const toFileSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'family';

const exportWorkbook = (sheetName: string, rows: Array<Record<string, string>>, fileNamePrefix: string): void => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const iso = new Date().toISOString();
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 19).replace(/:/g, '');
  const familySlug = toFileSlug(activeFamily.value?.name ?? 'family');
  XLSX.writeFile(workbook, `${familySlug}-${fileNamePrefix}-${date}-${time}.xlsx`);
};

const exportPeopleExcel = (): void => {
  const rows = peopleRows.value.map((row) => {
    const person = personMap.value.get(row.id);
    const metadata = parseMetadata(person?.metadataJson);
    return {
      Name: row.name,
      GivenName: person?.givenName ?? '',
      FamilyName: person?.familyName ?? '',
      Gender: row.gender,
      Email: person?.email ?? '',
      Phone: person?.phone ?? '',
      DateOfBirth: person?.dateOfBirth ?? '',
      PlaceOfBirth: typeof metadata.placeOfBirth === 'string' ? metadata.placeOfBirth : '',
      Occupation: typeof metadata.occupation === 'string' ? metadata.occupation : '',
      Notes: typeof metadata.notes === 'string' ? metadata.notes : '',
    };
  });
  exportWorkbook('People', rows, 'people');
};

const exportRelationshipsExcel = (): void => {
  const rows = relationshipRows.value.map((row) => ({
    From: row.from,
    To: row.to,
    Type: row.type,
  }));
  exportWorkbook('Relationships', rows, 'relationships');
};
</script>
