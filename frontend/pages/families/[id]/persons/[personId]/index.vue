<template>
  <div class="page-shell">
    <div class="d-flex flex-wrap align-center justify-space-between mb-4">
      <v-btn variant="outlined" :to="`/families/${familyId}`">Back</v-btn>
      <div class="d-flex ga-2">
        <v-btn color="primary" :disabled="!isFamilyOwner || !person" @click="openEdit">Edit</v-btn>
        <v-btn color="error" :disabled="!isFamilyOwner || !person" @click="removePerson">Delete</v-btn>
      </div>
    </div>

    <v-alert v-if="!isFamilyOwner" type="info" variant="tonal" class="mb-4">
      Read-only view: only this family's owner can edit or delete this member.
    </v-alert>
    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

    <v-card class="surface-card" title="Member Profile" variant="flat">
      <v-card-text v-if="person">
        <div class="d-flex align-center ga-4 flex-wrap mb-4">
          <v-avatar size="88" color="primary" variant="flat">
            <v-img v-if="personProfilePicture" :src="personProfilePicture" alt="profile picture" />
            <span v-else class="text-h5 font-weight-bold">{{ avatarLetter }}</span>
          </v-avatar>
          <div>
            <div class="text-h5 font-weight-bold">{{ person.name }}</div>
            <div class="mt-2 d-flex ga-2 flex-wrap">
              <v-chip variant="flat" color="secondary" size="small">{{ person.gender }}</v-chip>
              <v-chip v-if="person.dateOfBirth" variant="tonal" size="small">DOB: {{ person.dateOfBirth }}</v-chip>
            </div>
          </div>
        </div>

        <v-row>
          <v-col cols="12" md="6">
            <v-card variant="outlined" class="h-100">
              <v-card-title class="text-subtitle-1">Contact</v-card-title>
              <v-card-text>
                <div class="mb-2">
                  <div class="text-caption text-medium-emphasis">Email</div>
                  <div>{{ displayEmail }}</div>
                </div>
                <div>
                  <div class="text-caption text-medium-emphasis">Phone</div>
                  <div>{{ displayPhone }}</div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="6">
            <v-card variant="outlined" class="h-100">
              <v-card-title class="text-subtitle-1">Personal</v-card-title>
              <v-card-text>
                <div class="mb-2">
                  <div class="text-caption text-medium-emphasis">Place of Birth</div>
                  <div>{{ displayPlaceOfBirth }}</div>
                </div>
                <div class="mb-2">
                  <div class="text-caption text-medium-emphasis">Occupation</div>
                  <div>{{ displayOccupation }}</div>
                </div>
                <div>
                  <div class="text-caption text-medium-emphasis">Notes</div>
                  <div>{{ displayNotes }}</div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-text v-else class="text-medium-emphasis">Person not found.</v-card-text>
    </v-card>

    <v-dialog v-model="editDialog" max-width="520">
      <v-card title="Edit Person">
        <v-card-text>
          <v-text-field v-model="editGivenName" label="Given Name" density="comfortable" />
          <v-text-field v-model="editFamilyName" label="Family Name" density="comfortable" />
          <v-select v-model="editGender" :items="genderOptions" label="Gender" density="comfortable" />
          <DateInputField
            v-model="editDateOfBirth"
            label="Date of Birth"
            density="comfortable"
            persistent-hint
          />
          <v-text-field v-model="editPhone" label="Phone" density="comfortable" />
          <v-text-field v-model="editEmail" label="Email" density="comfortable" />
          <v-text-field v-model="editPlaceOfBirth" label="Place of Birth" density="comfortable" />
          <v-text-field v-model="editOccupation" label="Occupation" density="comfortable" />
          <v-textarea v-model="editNotes" label="Notes" density="comfortable" rows="2" auto-grow />
          <v-file-input
            v-model="editPhotoFile"
            label="Profile Picture"
            accept="image/png,image/jpeg,image/webp,image/gif"
            density="comfortable"
            prepend-icon="mdi-camera"
            show-size
            @update:model-value="onEditProfilePhotoSelected"
          />
          <div v-if="editProfilePictureDataUrl" class="d-flex align-center ga-2 mt-2">
            <v-avatar size="52">
              <v-img :src="editProfilePictureDataUrl" alt="profile preview" />
            </v-avatar>
            <v-btn size="small" variant="text" color="error" @click="clearEditProfilePhoto">Remove photo</v-btn>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="editDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveEdit">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app' });

import { useQuery } from '@tanstack/vue-query';
import type { Family, Person } from '@/types/api';

const route = useRoute();
const router = useRouter();
const familyId = route.params.id as string;
const personId = route.params.personId as string;
const { client, authStore } = useApi();
authStore.restore();
const errorMessage = ref('');
const editDialog = ref(false);
const editGivenName = ref('');
const editFamilyName = ref('');
const editGender = ref<'male' | 'female' | 'other' | 'unknown'>('unknown');
const editDateOfBirth = ref('');
const editEmail = ref('');
const editPhone = ref('');
const editPlaceOfBirth = ref('');
const editOccupation = ref('');
const editNotes = ref('');
const editPhotoFile = ref<File | File[] | null>(null);
const editProfilePictureDataUrl = ref('');
const genderOptions: Array<'male' | 'female' | 'other' | 'unknown'> = ['male', 'female', 'other', 'unknown'];

const query = useQuery({
  queryKey: ['person-detail', familyId],
  queryFn: () => client.get<Person[]>(`/families/${familyId}/persons`),
});
const familiesQuery = useQuery({
  queryKey: ['families'],
  queryFn: () => client.get<Family[]>('/families'),
});

const person = computed(() => (query.data.value ?? []).find((p) => p.id === personId));
const personMetadata = computed(() => parseMetadata(person.value?.metadataJson));
const personProfilePicture = computed(() => {
  if (!person.value) return '';
  const metadata = personMetadata.value;
  const dataUrl = typeof metadata.profilePictureDataUrl === 'string' ? metadata.profilePictureDataUrl : '';
  const url = typeof metadata.profilePictureUrl === 'string' ? metadata.profilePictureUrl : '';
  return dataUrl || person.value.profilePictureUrl || url;
});
const avatarLetter = computed(() => person.value?.name.trim().charAt(0).toUpperCase() || 'P');
const displayEmail = computed(() => {
  if (!person.value) return 'N/A';
  const fromMeta = typeof personMetadata.value.email === 'string' ? personMetadata.value.email : '';
  return person.value.email || fromMeta || 'N/A';
});
const displayPhone = computed(() => {
  if (!person.value) return 'N/A';
  const fromMeta = typeof personMetadata.value.phone === 'string' ? personMetadata.value.phone : '';
  return person.value.phone || fromMeta || 'N/A';
});
const displayPlaceOfBirth = computed(() => {
  if (!person.value) return 'N/A';
  return typeof personMetadata.value.placeOfBirth === 'string' ? personMetadata.value.placeOfBirth : 'N/A';
});
const displayOccupation = computed(() => {
  if (!person.value) return 'N/A';
  return typeof personMetadata.value.occupation === 'string' ? personMetadata.value.occupation : 'N/A';
});
const displayNotes = computed(() => {
  if (!person.value) return 'N/A';
  return typeof personMetadata.value.notes === 'string' ? personMetadata.value.notes : 'N/A';
});
const activeFamily = computed(() => (familiesQuery.data.value ?? []).find((f) => f.id === familyId) ?? null);
const isFamilyOwner = computed(() => {
  if (!activeFamily.value || !authStore.userId) return false;
  return activeFamily.value.ownerId === authStore.userId;
});
const parseMetadata = (raw: string | null | undefined): Record<string, unknown> => {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
};
const extractNames = (personRecord: Person): { givenName: string; familyName: string } => {
  const columnGiven = typeof personRecord.givenName === 'string' ? personRecord.givenName.trim() : '';
  const columnFamily = typeof personRecord.familyName === 'string' ? personRecord.familyName.trim() : '';
  if (columnGiven || columnFamily) {
    return { givenName: columnGiven, familyName: columnFamily };
  }
  const metadata = parseMetadata(personRecord.metadataJson);
  const metaGiven = typeof metadata.givenName === 'string' ? metadata.givenName.trim() : '';
  const metaFamily = typeof metadata.familyName === 'string' ? metadata.familyName.trim() : '';
  if (metaGiven || metaFamily) {
    return { givenName: metaGiven, familyName: metaFamily };
  }
  const parts = personRecord.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { givenName: '', familyName: '' };
  if (parts.length === 1) return { givenName: parts[0], familyName: '' };
  return { givenName: parts.slice(0, -1).join(' '), familyName: parts[parts.length - 1] };
};
const normalizeOptional = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};
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
const onEditProfilePhotoSelected = async (): Promise<void> => {
  const file = extractFirstFile(editPhotoFile.value);
  if (!file) {
    editProfilePictureDataUrl.value = '';
    return;
  }
  if (file.size > 1024 * 1024) {
    errorMessage.value = 'Profile picture must be 1MB or smaller.';
    editPhotoFile.value = null;
    editProfilePictureDataUrl.value = '';
    return;
  }
  errorMessage.value = '';
  editProfilePictureDataUrl.value = await fileToDataUrl(file);
};
const clearEditProfilePhoto = (): void => {
  editPhotoFile.value = null;
  editProfilePictureDataUrl.value = '';
};

const openEdit = (): void => {
  if (!person.value) return;
  const metadata = parseMetadata(person.value.metadataJson);
  const names = extractNames(person.value);
  editGivenName.value = names.givenName;
  editFamilyName.value = names.familyName;
  editGender.value =
    person.value.gender === 'male' ||
    person.value.gender === 'female' ||
    person.value.gender === 'other' ||
    person.value.gender === 'unknown'
      ? person.value.gender
      : 'unknown';
  editDateOfBirth.value = person.value.dateOfBirth ?? '';
  editEmail.value = person.value.email ?? (typeof metadata.email === 'string' ? metadata.email : '');
  editPhone.value = person.value.phone ?? (typeof metadata.phone === 'string' ? metadata.phone : '');
  editPlaceOfBirth.value = typeof metadata.placeOfBirth === 'string' ? metadata.placeOfBirth : '';
  editOccupation.value = typeof metadata.occupation === 'string' ? metadata.occupation : '';
  editNotes.value = typeof metadata.notes === 'string' ? metadata.notes : '';
  editProfilePictureDataUrl.value =
    (typeof metadata.profilePictureDataUrl === 'string' ? metadata.profilePictureDataUrl : '') ||
    (typeof metadata.profilePictureUrl === 'string' ? metadata.profilePictureUrl : '');
  editDialog.value = true;
};

const saveEdit = async (): Promise<void> => {
  if (!person.value) return;
  try {
    errorMessage.value = '';
    if (editGivenName.value.trim().length < 2) {
      errorMessage.value = 'Given name must be at least 2 characters.';
      return;
    }
    if (editFamilyName.value.trim().length < 2) {
      errorMessage.value = 'Family name must be at least 2 characters.';
      return;
    }
    if (!isValidEmail(editEmail.value.trim())) {
      errorMessage.value = 'Email is required and must be valid.';
      return;
    }
    if (editPhone.value.trim() && !isValidPhone(editPhone.value.trim())) {
      errorMessage.value = 'Phone must include country code, e.g. +919876543210.';
      return;
    }
    if (editDateOfBirth.value && isFutureDate(editDateOfBirth.value)) {
      errorMessage.value = 'Date of birth cannot be in the future.';
      return;
    }
    await client.put(`/families/${familyId}/persons/${person.value.id}`, {
      givenName: editGivenName.value.trim(),
      familyName: editFamilyName.value.trim(),
      name: `${editGivenName.value.trim()} ${editFamilyName.value.trim()}`.trim(),
      gender: editGender.value,
      dateOfBirth: normalizeOptional(editDateOfBirth.value),
      email: editEmail.value.trim().toLowerCase(),
      phone: normalizeOptional(normalizePhone(editPhone.value)),
      placeOfBirth: normalizeOptional(editPlaceOfBirth.value),
      occupation: normalizeOptional(editOccupation.value),
      notes: normalizeOptional(editNotes.value),
      profilePictureDataUrl: normalizeOptional(editProfilePictureDataUrl.value),
    });
    editDialog.value = false;
    await query.refetch();
  } catch (error: unknown) {
    errorMessage.value =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not update person.';
  }
};

const removePerson = async (): Promise<void> => {
  if (!person.value) return;
  if (!confirm('Delete this person and all connected relationships?')) return;
  try {
    errorMessage.value = '';
    await client.delete(`/families/${familyId}/persons/${person.value.id}`);
    await router.push(`/families/${familyId}`);
  } catch (error: unknown) {
    errorMessage.value =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not delete person.';
  }
};
</script>

<style scoped>
@media (max-width: 720px) {
  .page-shell > .d-flex {
    gap: 10px;
  }

  .page-shell > .d-flex > :first-child {
    width: 100%;
  }

  .page-shell > .d-flex > :last-child {
    width: 100%;
    justify-content: stretch;
  }

  .page-shell > .d-flex > :last-child :deep(.v-btn) {
    flex: 1 1 50%;
  }
}
</style>
