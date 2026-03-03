<template>
  <div class="page-shell">
    <div class="d-flex flex-wrap align-center justify-space-between mb-4">
      <div>
        <h1 class="page-title">Family Overview</h1>
        <p class="text-subtitle-1 font-weight-medium mb-1">{{ activeFamily?.name ?? 'Family' }}</p>
        <p class="page-subtitle">Manage people, relationships, and quick kinship lookup in one place.</p>
        <p v-if="!isFamilyOwner" class="text-caption text-medium-emphasis mt-1">
          Read-only view: only this family's owner can edit or delete members/relationships.
        </p>
      </div>
      <div class="d-flex ga-2 family-top-actions">
        <v-btn variant="outlined" @click="goProposals">Proposals</v-btn>
        <v-btn variant="outlined" @click="goVersions">Timeline</v-btn>
        <v-btn variant="outlined" @click="goDanger">Settings</v-btn>
      </div>
    </div>

    <v-card class="surface-card mb-4" variant="flat" title="Family Graph">
      <v-card-text>
        <v-row>
          <v-col cols="12" md="8">
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
            />
          </v-col>
        </v-row>
        <GraphVisualization
          :persons="persons"
          :relationships="relationships"
          :focus-person-id="focusPersonId ?? undefined"
        />
      </v-card-text>
    </v-card>

    <v-card class="surface-card mb-4" title="People" variant="flat">
      <v-card-text>
        <div class="d-flex justify-end mb-3">
          <v-btn color="primary" :disabled="!isFamilyOwner" @click="goAddPerson">Add Member</v-btn>
        </div>
        <div class="table-scroll">
        <v-table density="comfortable">
          <thead>
            <tr>
              <th>Name</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="person in persons" :key="person.id" class="row-click" @click="openPerson(person.id)">
              <td>{{ person.name }}</td>
              <td class="text-right">
                <v-btn
                  size="small"
                  variant="text"
                  :disabled="!isFamilyOwner"
                  @click.stop="startEditPerson(person)"
                >
                  Edit
                </v-btn>
                <v-btn
                  size="small"
                  color="error"
                  variant="text"
                  :disabled="!isFamilyOwner"
                  @click.stop="removePerson(person.id)"
                >
                  Delete
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
        </div>
      </v-card-text>
    </v-card>

    <v-card class="surface-card mb-4" title="Relationships" variant="flat">
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
        <v-btn color="primary" :disabled="!isFamilyOwner" @click="addRelationship">Add Relationship</v-btn>

        <div class="table-scroll mt-4">
        <v-table density="comfortable">
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Type</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rel in readableRelationships" :key="rel.id">
              <td>{{ rel.fromName }}</td>
              <td>{{ rel.toName }}</td>
              <td><v-chip size="small" variant="tonal">{{ rel.type }}</v-chip></td>
              <td class="text-right">
                <v-btn
                  size="small"
                  variant="text"
                  :disabled="!isFamilyOwner"
                  @click="startEditRelationship(rel.id)"
                >
                  Edit
                </v-btn>
                <v-btn
                  size="small"
                  color="error"
                  variant="text"
                  :disabled="!isFamilyOwner"
                  @click="removeRelationship(rel.id)"
                >
                  Delete
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
        </div>
      </v-card-text>
    </v-card>

    <v-alert v-if="operationError" type="error" variant="tonal" class="mb-4">{{ operationError }}</v-alert>

    <RelationshipAiAssistant :family-id="familyId" :persons="persons" />

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
import type { Family, Person } from '@/types/api';

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
authStore.restore();
const operationError = ref('');

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

const personNameMap = computed(() => {
  const map = new Map<string, string>();
  for (const person of persons.value) map.set(person.id, person.name);
  return map;
});

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

const readableRelationships = computed(() =>
  relationships.value.map((r) => ({
    id: r.id,
    fromName: personNameMap.value.get(r.fromPersonId) ?? 'Unknown member',
    toName: personNameMap.value.get(r.toPersonId) ?? 'Unknown member',
    type: r.type,
  })),
);

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
const normalizeOptional = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};
const formatDateValue = (raw: unknown): string => {
  if (!raw) return '';
  if (typeof raw === 'string') {
    return raw.slice(0, 10);
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
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
  try {
    operationError.value = '';
    await client.post(`/families/${familyId}/relationships`, {
      fromPersonId: newRelationshipFrom.value,
      toPersonId: newRelationshipTo.value,
      type: newRelationshipType.value,
    });
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
</script>

<style scoped>
.row-click {
  cursor: pointer;
}
.row-click:hover {
  background: #f8fafc;
}

.table-scroll {
  overflow-x: auto;
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
