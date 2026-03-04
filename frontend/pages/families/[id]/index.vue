<template>
  <div class="page-shell">
    <div class="d-flex flex-wrap align-center justify-space-between mb-4">
      <div>
        <h1 class="page-title">Family Overview</h1>
        <div class="d-flex flex-wrap align-center ga-2 mb-1">
          <p class="text-subtitle-1 font-weight-medium mb-0">{{ activeFamily?.name ?? 'Family' }}</p>
          <FamilyOwnerBadge :family="activeFamily" compact clickable @select-owner="showOwnerProfile" />
        </div>
        <p class="page-subtitle">Manage people, relationships, and quick kinship lookup in one place.</p>
        <p v-if="!isFamilyOwner" class="text-caption text-medium-emphasis mt-1">
          Read-only view: only this family's owner can edit or delete members/relationships.
        </p>
      </div>
      <div class="d-flex ga-2 family-top-actions">
        <v-btn variant="outlined" @click="goProposals">Proposals</v-btn>
        <v-btn variant="outlined" @click="goVersions">History</v-btn>
        <v-btn variant="outlined" @click="goDanger">Settings</v-btn>
      </div>
    </div>

    <v-card class="surface-card mb-4" variant="flat" title="Family Graph">
      <v-card-text>
        <v-row align="center">
          <v-col cols="12" md="8">
            <div class="d-flex align-start ga-1">
              <v-select
                v-model="focusPersonId"
                :items="focusOptions"
                item-title="title"
                item-value="value"
                label="Focus on person"
                clearable
                density="comfortable"
                hint="Shows selected person and 2-hop neighborhood; everything else is dimmed."
                persistent-hint
                class="flex-grow-1"
              />
              <v-tooltip text="Show focused person details">
                <template #activator="{ props: tipProps }">
                  <v-btn
                    v-bind="tipProps"
                    variant="text"
                    icon="mdi-help-circle-outline"
                    size="small"
                    class="mt-2"
                    :disabled="!focusSummary"
                    @click="showFocusHelp"
                  />
                </template>
              </v-tooltip>
            </div>
          </v-col>
          <v-col cols="12" md="4" class="d-flex justify-md-end ga-2 align-center">
            <v-btn
              variant="outlined"
              prepend-icon="mdi-download"
              :disabled="persons.length === 0 || downloadingGraph"
              :loading="downloadingGraph"
              @click="downloadGraphImage"
            >
              Download Image
            </v-btn>
          </v-col>
        </v-row>
        <GraphVisualization
          ref="graphVisualizationRef"
          :persons="persons"
          :relationships="relationships"
          :focus-person-id="focusPersonId ?? undefined"
          @select-person="openPerson"
        />
      </v-card-text>
    </v-card>

    <v-card class="surface-card mb-4" title="People" variant="flat">
      <v-card-text>
        <div class="d-flex flex-wrap align-center justify-space-between mb-3 ga-2">
          <div class="d-flex flex-wrap ga-2 align-center">
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
            <v-btn
              variant="outlined"
              prepend-icon="mdi-microsoft-excel"
              :disabled="peopleRows.length === 0"
              @click="exportPeopleExcel"
            >
              Export Excel
            </v-btn>
            <v-btn color="primary" :disabled="!isFamilyOwner" @click="goAddPerson">Add Member</v-btn>
          </div>
        </div>
        <div class="table-scroll">
          <v-data-table
            :headers="peopleHeaders"
            :items="peopleRows"
            :search="peopleSearch"
            :items-per-page="10"
            :sort-by="[{ key: 'name', order: 'asc' }]"
            :group-by="peopleGroupBy === 'none' ? [] : [{ key: peopleGroupBy, order: 'asc' }]"
            class="bg-transparent"
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
            <template #item.actions="{ item }">
              <div v-if="item?.id" class="text-right">
                <v-btn
                  size="small"
                  variant="text"
                  :disabled="!isFamilyOwner"
                  @click.stop="startEditPersonById(item.id)"
                >
                  Edit
                </v-btn>
                <v-btn
                  size="small"
                  color="error"
                  variant="text"
                  :disabled="!isFamilyOwner"
                  @click.stop="removePerson(item.id)"
                >
                  Delete
                </v-btn>
              </div>
            </template>
          </v-data-table>
        </div>
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
            <v-btn color="primary" :disabled="!isFamilyOwner" @click="addRelationshipDialog = true">Add Relationship</v-btn>
          </div>
        </div>

        <div class="table-scroll mt-4">
          <v-data-table
            :headers="relationshipHeaders"
            :items="relationshipRows"
            :search="relationshipsSearch"
            :items-per-page="10"
            :sort-by="[{ key: 'from', order: 'asc' }]"
            :group-by="relationshipsGroupBy === 'none' ? [] : [{ key: relationshipsGroupBy, order: 'asc' }]"
            class="bg-transparent"
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
              <span v-else class="text-medium-emphasis">-</span>
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
              <span v-else class="text-medium-emphasis">-</span>
            </template>
            <template #item.type="{ item }">
              <v-chip v-if="item?.type" size="small" variant="tonal">{{ item.type }}</v-chip>
              <span v-else class="text-medium-emphasis">-</span>
            </template>
            <template #item.actions="{ item }">
              <div v-if="item?.id" class="text-right">
                <v-btn
                  size="small"
                  variant="text"
                  :disabled="!isFamilyOwner"
                  @click="startEditRelationship(item.id)"
                >
                  Edit
                </v-btn>
                <v-btn
                  size="small"
                  color="error"
                  variant="text"
                  :disabled="!isFamilyOwner"
                  @click="removeRelationship(item.id)"
                >
                  Delete
                </v-btn>
              </div>
            </template>
          </v-data-table>
        </div>
      </v-card-text>
    </v-card>

    <v-alert v-if="operationError" type="error" variant="tonal" class="mb-4">{{ operationError }}</v-alert>

    <v-dialog v-model="showOwnerDialog" max-width="520">
      <v-card title="Owner Profile">
        <v-card-text v-if="activeFamily?.owner">
          <div class="owner-row"><strong>Name:</strong> {{ activeFamily.ownerName || activeFamily.owner.username }}</div>
          <div class="owner-row"><strong>Username:</strong> {{ activeFamily.owner.username }}</div>
          <div class="owner-row"><strong>Email:</strong> {{ activeFamily.owner.email || '-' }}</div>
          <div class="owner-row"><strong>Phone:</strong> {{ activeFamily.owner.phone || '-' }}</div>
          <div class="owner-row"><strong>Gender:</strong> {{ activeFamily.owner.gender || '-' }}</div>
          <div class="owner-row"><strong>Date Of Birth:</strong> {{ activeFamily.owner.dateOfBirth || '-' }}</div>
        </v-card-text>
        <v-card-text v-else>
          Owner profile details are not available.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showOwnerDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="addRelationshipDialog" max-width="620">
      <v-card title="Add Relationship">
        <v-card-text>
          <v-row>
            <v-col cols="12" md="5">
              <v-select
                v-model="newRelationshipFrom"
                :items="personOptions"
                item-title="label"
                item-value="value"
                label="From"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" md="5">
              <v-select
                v-model="newRelationshipTo"
                :items="personOptions"
                item-title="label"
                item-value="value"
                label="To"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" md="2">
              <v-select v-model="newRelationshipType" :items="relationshipTypes" label="Type" density="comfortable" />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="addRelationshipDialog = false">Cancel</v-btn>
          <v-btn color="primary" :disabled="!isFamilyOwner" @click="addRelationship">Add</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="focusHelpDialog" max-width="560">
      <v-card title="Focused Person Details">
        <v-card-text v-if="focusSummary">
          <div class="summary-title mb-2">{{ focusSummary.name }}</div>
          <div class="summary-row"><strong>Parents:</strong> {{ formatFocusNames(focusSummary.parents) }}</div>
          <div class="summary-row"><strong>Siblings:</strong> {{ formatFocusNames(focusSummary.siblings) }}</div>
          <div class="summary-row"><strong>Spouse:</strong> {{ formatFocusNames(focusSummary.spouses) }}</div>
          <div class="summary-row"><strong>Children:</strong> {{ formatFocusNames(focusSummary.children) }}</div>
        </v-card-text>
        <v-card-text v-else>
          Select a focused person first to view contextual relationship details.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="focusHelpDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="editPersonDialog" max-width="520">
      <v-card title="Edit Person">
        <v-card-text>
          <v-text-field v-model="editPersonGivenName" label="Given Name" density="comfortable" />
          <v-text-field v-model="editPersonFamilyName" label="Family Name" density="comfortable" />
          <v-select v-model="editPersonGender" :items="genderOptions" label="Gender" density="comfortable" />
          <v-text-field
            v-model="editPersonDateOfBirth"
            label="Date of Birth"
            readonly
            density="comfortable"
            placeholder="YYYY-MM-DD"
            @click="editPersonDobMenu = true"
          />
          <v-dialog v-model="editPersonDobMenu" max-width="360">
            <v-card title="Select Date of Birth">
              <v-card-text>
                <v-date-picker
                  :model-value="editPersonDateOfBirth || null"
                  @update:model-value="onEditDobPick"
                />
              </v-card-text>
              <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="editPersonDobMenu = false">Close</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
          <v-text-field v-model="editPersonPhone" label="Phone" density="comfortable" />
          <v-text-field v-model="editPersonEmail" label="Email" density="comfortable" />
          <v-text-field v-model="editPersonPlaceOfBirth" label="Place of Birth" density="comfortable" />
          <v-text-field v-model="editPersonOccupation" label="Occupation" density="comfortable" />
          <v-textarea v-model="editPersonNotes" label="Notes" density="comfortable" rows="2" auto-grow />
          <v-file-input
            v-model="editPersonPhotoFile"
            label="Profile Picture"
            accept="image/png,image/jpeg,image/webp,image/gif"
            density="comfortable"
            prepend-icon="mdi-camera"
            show-size
            @update:model-value="onEditProfilePhotoSelected"
          />
          <div v-if="editPersonProfilePictureDataUrl" class="d-flex align-center ga-2 mt-2">
            <v-avatar size="52">
              <v-img :src="editPersonProfilePictureDataUrl" alt="profile preview" />
            </v-avatar>
            <v-btn size="small" variant="text" color="error" @click="clearEditProfilePhoto">Remove photo</v-btn>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="editPersonDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="savePersonEdit">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="editRelationshipDialog" max-width="620">
      <v-card title="Edit Relationship">
        <v-card-text>
          <v-row>
            <v-col cols="12" md="5">
              <v-select
                v-model="editRelationshipFrom"
                :items="personOptions"
                item-title="label"
                item-value="value"
                label="From"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" md="5">
              <v-select
                v-model="editRelationshipTo"
                :items="personOptions"
                item-title="label"
                item-value="value"
                label="To"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" md="2">
              <v-select v-model="editRelationshipType" :items="relationshipTypes" label="Type" density="comfortable" />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="editRelationshipDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveRelationshipEdit">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </div>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import * as XLSX from 'xlsx';
import type { Family, Person } from '@/types/api';

type RelationshipRow = {
  id: string;
  fromPersonId: string;
  toPersonId: string;
  type: 'PARENT' | 'SPOUSE' | 'SIBLING' | 'INLAW';
};

type GraphVisualizationHandle = {
  downloadAsImage: (fileName?: string) => Promise<void>;
};

type FocusSummary = {
  name: string;
  parents: string[];
  siblings: string[];
  spouses: string[];
  children: string[];
};

const route = useRoute();
const router = useRouter();
const familyId = route.params.id as string;
const { client, authStore } = useApi();
authStore.restore();
const operationError = ref('');
const graphVisualizationRef = ref<GraphVisualizationHandle | null>(null);
const downloadingGraph = ref(false);

const { data, refetch } = useQuery({
  queryKey: ['persons', familyId],
  queryFn: () => client.get<Person[]>(`/families/${familyId}/persons`),
});
const { data: familiesData } = useQuery({
  queryKey: ['families'],
  queryFn: () => client.get<Family[]>('/families'),
});
const { data: relationshipsData, refetch: refetchRelationships } = useQuery({
  queryKey: ['relationships', familyId],
  queryFn: () => client.get<RelationshipRow[]>(`/families/${familyId}/relationships`),
});

const persons = computed(() => data.value ?? []);
const relationships = computed(() => relationshipsData.value ?? []);
const activeFamily = computed(() => (familiesData.value ?? []).find((f) => f.id === familyId) ?? null);
const isFamilyOwner = computed(() => {
  if (!activeFamily.value || !authStore.userId) return false;
  return activeFamily.value.ownerId === authStore.userId;
});
const newRelationshipFrom = ref('');
const newRelationshipTo = ref('');
const newRelationshipType = ref<'PARENT' | 'SPOUSE' | 'SIBLING' | 'INLAW'>('PARENT');
const addRelationshipDialog = ref(false);
const relationshipTypes: Array<'PARENT' | 'SPOUSE' | 'SIBLING' | 'INLAW'> = ['PARENT', 'SPOUSE', 'SIBLING', 'INLAW'];
const genderOptions: Array<'male' | 'female' | 'other' | 'unknown'> = ['male', 'female', 'other', 'unknown'];
const editPersonDialog = ref(false);
const editPersonId = ref<string | null>(null);
const editPersonGivenName = ref('');
const editPersonFamilyName = ref('');
const editPersonGender = ref<'male' | 'female' | 'other' | 'unknown'>('unknown');
const editPersonDateOfBirth = ref('');
const editPersonDobMenu = ref(false);
const editPersonEmail = ref('');
const editPersonPhone = ref('');
const editPersonPlaceOfBirth = ref('');
const editPersonOccupation = ref('');
const editPersonNotes = ref('');
const editPersonPhotoFile = ref<File | File[] | null>(null);
const editPersonProfilePictureDataUrl = ref('');
const editRelationshipDialog = ref(false);
const editRelationshipId = ref<string | null>(null);
const editRelationshipFrom = ref('');
const editRelationshipTo = ref('');
const editRelationshipType = ref<'PARENT' | 'SPOUSE' | 'SIBLING' | 'INLAW'>('PARENT');
const focusPersonId = ref<string | null>(null);
const focusHelpDialog = ref(false);
const showOwnerDialog = ref(false);
const peopleSearch = ref('');
const relationshipsSearch = ref('');
const peopleGroupBy = ref<'none' | 'gender' | 'emailDomain' | 'familyName'>('none');
const relationshipsGroupBy = ref<'none' | 'type' | 'from' | 'to'>('none');

const personOptions = computed(() =>
  persons.value.map((p) => ({ label: p.name, value: p.id })),
);
const focusOptions = computed(() =>
  persons.value
    .map((person) => ({
      title: person.name,
      value: person.id,
    }))
    .sort((a, b) => a.title.localeCompare(b.title)),
);

const peopleHeaders = [
  { title: 'Member', key: 'name', sortable: true },
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

const relationshipsGroupByOptions = [
  { title: 'None', value: 'none' as const },
  { title: 'Type', value: 'type' as const },
  { title: 'From', value: 'from' as const },
  { title: 'To', value: 'to' as const },
];

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const normalizePhone = (value: string): string => value.replace(/[\s\-()]/g, '');
const isValidPhone = (value: string): boolean => /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));
const isFutureDate = (value: string): boolean => {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return true;
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return date.getTime() > todayUtc.getTime();
};
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
  if (fromData) return fromData;
  const fromUrl = typeof metadata.profilePictureUrl === 'string' ? metadata.profilePictureUrl.trim() : '';
  return fromUrl || null;
};

const personMap = computed(() => {
  const map = new Map<string, Person>();
  for (const person of persons.value) map.set(person.id, person);
  return map;
});

const peopleRows = computed(() =>
  persons.value.map((person) => ({
    id: person.id,
    name: person.name,
    avatarUrl: getProfilePictureUrl(person),
    gender: person.gender || 'unknown',
    emailDomain: (person.email?.split('@')[1] ?? 'unknown').toLowerCase(),
    familyName: person.familyName?.trim() || 'Unknown',
    raw: person,
  })),
);

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

const focusSummary = computed<FocusSummary | null>(() => {
  const focusId = focusPersonId.value;
  if (!focusId) return null;
  const focusPerson = personMap.value.get(focusId);
  if (!focusPerson) return null;

  const parents = new Set<string>();
  const siblings = new Set<string>();
  const spouses = new Set<string>();
  const children = new Set<string>();
  const parentByChild = new Map<string, string[]>();

  for (const rel of relationships.value) {
    if (rel.type === 'PARENT') {
      const arr = parentByChild.get(rel.toPersonId) ?? [];
      arr.push(rel.fromPersonId);
      parentByChild.set(rel.toPersonId, arr);
      if (rel.toPersonId === focusId) parents.add(rel.fromPersonId);
      if (rel.fromPersonId === focusId) children.add(rel.toPersonId);
    } else if (rel.type === 'SPOUSE') {
      if (rel.fromPersonId === focusId) spouses.add(rel.toPersonId);
      if (rel.toPersonId === focusId) spouses.add(rel.fromPersonId);
    } else if (rel.type === 'SIBLING') {
      if (rel.fromPersonId === focusId) siblings.add(rel.toPersonId);
      if (rel.toPersonId === focusId) siblings.add(rel.fromPersonId);
    }
  }

  for (const parentId of parents) {
    for (const rel of relationships.value) {
      if (rel.type === 'PARENT' && rel.fromPersonId === parentId && rel.toPersonId !== focusId) {
        siblings.add(rel.toPersonId);
      }
    }
  }

  for (const childId of children) {
    const childParents = parentByChild.get(childId) ?? [];
    for (const parentId of childParents) {
      if (parentId !== focusId) spouses.add(parentId);
    }
  }

  const toNames = (ids: Set<string>): string[] =>
    [...ids]
      .map((id) => personMap.value.get(id)?.name ?? id)
      .sort((a, b) => a.localeCompare(b));

  return {
    name: focusPerson.name,
    parents: toNames(parents),
    siblings: toNames(siblings),
    spouses: toNames(spouses),
    children: toNames(children),
  };
});

const showFocusHelp = (): void => {
  focusHelpDialog.value = true;
};
const showOwnerProfile = (): void => {
  showOwnerDialog.value = true;
};

const formatFocusNames = (items: string[]): string => (items.length > 0 ? items.join(', ') : 'None');
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
  if (Array.isArray(raw)) {
    return formatDateValue(raw[0]);
  }
  if (typeof raw === 'string') {
    return raw.slice(0, 10);
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return toLocalYmd(raw);
  }
  return '';
};
const extractNames = (person: Person): { givenName: string; familyName: string } => {
  const columnGiven = typeof person.givenName === 'string' ? person.givenName.trim() : '';
  const columnFamily = typeof person.familyName === 'string' ? person.familyName.trim() : '';
  if (columnGiven || columnFamily) {
    return { givenName: columnGiven, familyName: columnFamily };
  }
  const metadata = parseMetadata(person.metadataJson);
  const metaGiven = typeof metadata.givenName === 'string' ? metadata.givenName.trim() : '';
  const metaFamily = typeof metadata.familyName === 'string' ? metadata.familyName.trim() : '';
  if (metaGiven || metaFamily) {
    return { givenName: metaGiven, familyName: metaFamily };
  }
  const parts = person.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { givenName: '', familyName: '' };
  if (parts.length === 1) return { givenName: parts[0], familyName: '' };
  return { givenName: parts.slice(0, -1).join(' '), familyName: parts[parts.length - 1] };
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
const onEditDobPick = (value: unknown): void => {
  editPersonDateOfBirth.value = formatDateValue(value);
};
const onEditProfilePhotoSelected = async (): Promise<void> => {
  const file = extractFirstFile(editPersonPhotoFile.value);
  if (!file) {
    editPersonProfilePictureDataUrl.value = '';
    return;
  }
  if (file.size > 1024 * 1024) {
    operationError.value = 'Profile picture must be 1MB or smaller.';
    editPersonPhotoFile.value = null;
    editPersonProfilePictureDataUrl.value = '';
    return;
  }
  operationError.value = '';
  editPersonProfilePictureDataUrl.value = await fileToDataUrl(file);
};
const clearEditProfilePhoto = (): void => {
  editPersonPhotoFile.value = null;
  editPersonProfilePictureDataUrl.value = '';
};

watch(
  () => [persons.value, authStore.email, authStore.phone, authStore.username, focusPersonId.value] as const,
  () => {
    if (focusPersonId.value) return;
    const normalizePhoneValue = (value: string): string => value.replace(/[\s\-()]/g, '');
    const authEmail = authStore.email?.trim().toLowerCase();
    const authPhone = authStore.phone ? normalizePhoneValue(authStore.phone) : null;
    let match = null as Person | null;
    if (authEmail) {
      match = persons.value.find((p) => (p.email ?? '').trim().toLowerCase() === authEmail) ?? null;
    }
    if (!match && authPhone) {
      match =
        persons.value.find((p) => {
          const phone = (p.phone ?? '').trim();
          return phone ? normalizePhoneValue(phone) === authPhone : false;
        }) ?? null;
    }
    if (!match) {
      const username = authStore.username?.trim().toLowerCase();
      if (!username) return;
      match = persons.value.find((p) => p.name.trim().toLowerCase() === username) ?? null;
    }
    if (match) {
      focusPersonId.value = match.id;
    }
  },
  { immediate: true, deep: true },
);

const addRelationship = async (): Promise<void> => {
  if (!newRelationshipFrom.value || !newRelationshipTo.value) {
    operationError.value = 'Please select both From and To members.';
    return;
  }
  if (newRelationshipFrom.value === newRelationshipTo.value) {
    operationError.value = 'From and To cannot be the same person.';
    return;
  }
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
    newRelationshipType.value = 'PARENT';
    await refetchRelationships();
  } catch (error: unknown) {
    operationError.value =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
      'Could not add relationship.';
  }
};

const startEditPerson = (person: Person): void => {
  const metadata = parseMetadata(person.metadataJson);
  const names = extractNames(person);
  editPersonId.value = person.id;
  editPersonGivenName.value = names.givenName;
  editPersonFamilyName.value = names.familyName;
  editPersonGender.value =
    person.gender === 'male' || person.gender === 'female' || person.gender === 'other' || person.gender === 'unknown'
      ? person.gender
      : 'unknown';
  editPersonDateOfBirth.value = person.dateOfBirth ?? '';
  editPersonEmail.value = person.email ?? (typeof metadata.email === 'string' ? metadata.email : '');
  editPersonPhone.value = person.phone ?? (typeof metadata.phone === 'string' ? metadata.phone : '');
  editPersonPlaceOfBirth.value = typeof metadata.placeOfBirth === 'string' ? metadata.placeOfBirth : '';
  editPersonOccupation.value = typeof metadata.occupation === 'string' ? metadata.occupation : '';
  editPersonNotes.value = typeof metadata.notes === 'string' ? metadata.notes : '';
  editPersonProfilePictureDataUrl.value =
    (typeof metadata.profilePictureDataUrl === 'string' ? metadata.profilePictureDataUrl : '') ||
    (typeof metadata.profilePictureUrl === 'string' ? metadata.profilePictureUrl : '');
  editPersonDialog.value = true;
};

const startEditPersonById = (personId: string): void => {
  const person = persons.value.find((entry) => entry.id === personId);
  if (!person) return;
  startEditPerson(person);
};

const savePersonEdit = async (): Promise<void> => {
  if (!editPersonId.value) return;
  try {
    operationError.value = '';
    if (editPersonGivenName.value.trim().length < 2) {
      operationError.value = 'Given name must be at least 2 characters.';
      return;
    }
    if (editPersonFamilyName.value.trim().length < 2) {
      operationError.value = 'Family name must be at least 2 characters.';
      return;
    }
    if (!isValidEmail(editPersonEmail.value.trim())) {
      operationError.value = 'Email is required and must be valid.';
      return;
    }
    if (editPersonPhone.value.trim() && !isValidPhone(editPersonPhone.value.trim())) {
      operationError.value = 'Phone must include country code, e.g. +919876543210.';
      return;
    }
    if (editPersonDateOfBirth.value && isFutureDate(editPersonDateOfBirth.value)) {
      operationError.value = 'Date of birth cannot be in the future.';
      return;
    }
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
      profilePictureDataUrl: normalizeOptional(editPersonProfilePictureDataUrl.value),
    });
    editPersonDialog.value = false;
    await refetch();
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
    await refetch();
    await refetchRelationships();
  } catch (error: unknown) {
    operationError.value =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not delete person.';
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
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
      'Could not update relationship.';
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
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
      'Could not delete relationship.';
  }
};

const goAddPerson = async (): Promise<void> => {
  await router.push(`/families/${familyId}/persons/new`);
};

const goProposals = async (): Promise<void> => {
  await router.push(`/families/${familyId}/proposals`);
};

const goVersions = async (): Promise<void> => {
  await router.push(`/families/${familyId}/versions`);
};

const goDanger = async (): Promise<void> => {
  await router.push(`/families/${familyId}/danger`);
};

const openPerson = async (personId: string): Promise<void> => {
  await router.push(`/families/${familyId}/persons/${personId}`);
};

const toFileSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'family';

const exportWorkbook = (sheetName: string, rows: Array<Record<string, string>>, fileNamePrefix: string): void => {
  if (rows.length === 0) {
    operationError.value = 'No rows available to export.';
    return;
  }
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
  operationError.value = '';
  const columns = [
    'Name',
    'GivenName',
    'FamilyName',
    'Gender',
    'Email',
    'Phone',
    'DateOfBirth',
    'PlaceOfBirth',
    'Occupation',
    'Notes',
  ] as const;
  const rows: Array<Record<(typeof columns)[number], string>> = peopleRows.value.map((row) => {
    const person = personMap.value.get(row.id);
    const metadata = parseMetadata(person?.metadataJson);
    const names = person ? extractNames(person) : { givenName: '', familyName: '' };
    return {
      Name: row.name,
      GivenName: names.givenName,
      FamilyName: names.familyName,
      Gender: row.gender,
      Email: person?.email ?? '',
      Phone: person?.phone ?? '',
      DateOfBirth: person?.dateOfBirth ?? '',
      PlaceOfBirth: typeof metadata.placeOfBirth === 'string' ? metadata.placeOfBirth : '',
      Occupation: typeof metadata.occupation === 'string' ? metadata.occupation : '',
      Notes: typeof metadata.notes === 'string' ? metadata.notes : '',
    };
  });
  const normalizedRows = rows.map((row) => {
    const ordered = {} as Record<string, string>;
    for (const key of columns) ordered[key] = row[key];
    return ordered;
  });
  exportWorkbook('People', normalizedRows, 'people');
};

const exportRelationshipsExcel = (): void => {
  operationError.value = '';
  const columns = ['From', 'To', 'Type'] as const;
  const rows: Array<Record<(typeof columns)[number], string>> = relationshipRows.value.map((row) => ({
    From: row.from,
    To: row.to,
    Type: row.type,
  }));
  const normalizedRows = rows.map((row) => {
    const ordered = {} as Record<string, string>;
    for (const key of columns) ordered[key] = row[key];
    return ordered;
  });
  exportWorkbook('Relationships', normalizedRows, 'relationships');
};

const downloadGraphImage = async (): Promise<void> => {
  if (!graphVisualizationRef.value) return;
  try {
    operationError.value = '';
    downloadingGraph.value = true;
    const date = new Date().toISOString().slice(0, 10);
    const familySlug = toFileSlug(activeFamily.value?.name ?? 'family');
    await graphVisualizationRef.value.downloadAsImage(`${familySlug}-graph-${date}.png`);
  } catch (error: unknown) {
    operationError.value =
      (error as Error)?.message?.trim() || 'Could not export graph image. Please try again.';
  } finally {
    downloadingGraph.value = false;
  }
};
</script>

<style scoped>
.table-scroll {
  overflow-x: auto;
}

.summary-title {
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
}

.summary-row {
  font-size: 14px;
  color: #334155;
  margin-top: 4px;
}

.owner-row {
  font-size: 14px;
  margin-top: 6px;
  color: #334155;
}

.family-top-actions {
  flex-wrap: wrap;
}

@media (max-width: 720px) {
  .family-top-actions {
    width: 100%;
  }

  .family-top-actions :deep(.v-btn) {
    flex: 1 1 calc(50% - 8px);
    min-width: 0;
  }
}
</style>
