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

      <v-row v-else>
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

      <v-btn color="primary" @click="submitProposal">Submit Proposal</v-btn>
      <v-alert v-if="formError" type="error" variant="tonal" class="mt-3">{{ formError }}</v-alert>

      <v-dialog v-model="showPreview" max-width="700">
        <v-card title="Impact Preview">
          <v-card-text>
            <pre>{{ previewJson }}</pre>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn @click="showPreview = false">Close</v-btn>
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
              <v-btn size="small" @click="openPreview(proposal.previewJson)">Preview</v-btn>
            </div>
          </template>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { Person, Proposal } from '@/types/api';

const props = withDefaults(
  defineProps<{ familyId: string; proposals: Proposal[]; isOwner: boolean; persons?: Person[] }>(),
  { persons: () => [] },
);
const emit = defineEmits<{ approve: [proposalId: string]; reject: [proposalId: string]; submit: [payload: unknown] }>();

const proposalTypes = ['ADD_PERSON', 'ADD_RELATIONSHIP'];
const relationshipTypes = ['PARENT', 'SPOUSE', 'SIBLING', 'INLAW'];
const genderOptions = ['male', 'female', 'other', 'unknown'] as const;

const type = ref<'ADD_PERSON' | 'ADD_RELATIONSHIP'>('ADD_PERSON');
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
const showPreview = ref(false);
const previewJson = ref('');
const formError = ref('');
const personOptions = computed(() =>
  props.persons
    .map((person) => ({
      label: person.name,
      value: person.id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label)),
);

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const normalizePhone = (value: string): string => value.replace(/[\s\-()]/g, '');
const isValidPhone = (value: string): boolean => /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));
const normalizeOptional = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};
const formatDateValue = (raw: unknown): string => {
  if (!raw) return '';
  if (typeof raw === 'string') return raw.slice(0, 10);
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString().slice(0, 10);
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
};

const openPreview = (json: string): void => {
  previewJson.value = json;
  showPreview.value = true;
};

void props;
</script>

<style scoped>
.proposal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

@media (max-width: 680px) {
  .proposal-actions {
    width: 100%;
    justify-content: stretch;
  }

  .proposal-actions :deep(.v-btn) {
    flex: 1 1 100%;
  }
}
</style>
