<template>
  <div class="page-shell">
    <div class="d-flex flex-wrap align-center justify-space-between mb-4">
      <div>
        <h1 class="page-title">Add Member</h1>
        <p class="page-subtitle">Create a new family member with validated identity and profile data.</p>
      </div>
      <v-btn variant="outlined" @click="goBack">Back to Overview</v-btn>
    </div>

    <v-card class="surface-card" variant="flat">
      <v-card-text>
        <v-row>
          <v-col cols="12" md="4">
            <v-text-field v-model="givenName" label="Given Name" density="comfortable" />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field v-model="familyName" label="Family Name" density="comfortable" />
          </v-col>
          <v-col cols="12" md="4">
            <v-select v-model="gender" :items="genderOptions" label="Gender" density="comfortable" />
          </v-col>

          <v-col cols="12" md="4">
            <v-text-field
              v-model="dateOfBirth"
              label="Date of Birth"
              readonly
              density="comfortable"
              placeholder="YYYY-MM-DD"
              @click="dobDialog = true"
            />
            <v-dialog v-model="dobDialog" max-width="360">
              <v-card title="Select Date of Birth">
                <v-card-text>
                  <v-date-picker :model-value="dateOfBirth || null" @update:model-value="onDobPick" />
                </v-card-text>
                <v-card-actions>
                  <v-spacer />
                  <v-btn variant="text" @click="dobDialog = false">Close</v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
          </v-col>

          <v-col cols="12" md="4">
            <v-text-field v-model="phone" label="Phone (+country code)" density="comfortable" />
          </v-col>

          <v-col cols="12" md="4">
            <v-text-field v-model="email" label="Email (required)" density="comfortable" />
          </v-col>

          <v-col cols="12" md="4">
            <v-text-field v-model="placeOfBirth" label="Place of Birth" density="comfortable" />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field v-model="occupation" label="Occupation" density="comfortable" />
          </v-col>
          <v-col cols="12" md="4">
            <v-textarea v-model="notes" label="Notes" density="comfortable" rows="2" auto-grow />
          </v-col>

          <v-col cols="12">
            <v-file-input
              v-model="photoFile"
              label="Profile Picture"
              accept="image/png,image/jpeg,image/webp,image/gif"
              density="comfortable"
              prepend-icon="mdi-camera"
              show-size
              @update:model-value="onProfilePhotoSelected"
            />
            <div v-if="profilePictureDataUrl" class="d-flex align-center ga-2 mt-2">
              <v-avatar size="56">
                <v-img :src="profilePictureDataUrl" alt="profile preview" />
              </v-avatar>
              <v-btn size="small" variant="text" color="error" @click="clearProfilePhoto">Remove photo</v-btn>
            </div>
          </v-col>

          <v-col cols="12" class="d-flex justify-end">
            <v-btn color="primary" :disabled="!isFamilyOwner" :loading="submitting" @click="submit">Create Member</v-btn>
          </v-col>
        </v-row>

        <v-alert v-if="errorMessage" type="error" variant="tonal" class="mt-2">{{ errorMessage }}</v-alert>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import type { Family } from '@/types/api';

const route = useRoute();
const router = useRouter();
const familyId = route.params.id as string;
const { client, authStore } = useApi();
authStore.restore();

const { data: familiesData } = useQuery({
  queryKey: ['families'],
  queryFn: () => client.get<Family[]>('/families'),
});

const activeFamily = computed(() => (familiesData.value ?? []).find((f) => f.id === familyId) ?? null);
const isFamilyOwner = computed(() => {
  if (!activeFamily.value || !authStore.userId) return false;
  return activeFamily.value.ownerId === authStore.userId;
});

const givenName = ref('');
const familyName = ref('');
const gender = ref<'male' | 'female' | 'other' | 'unknown'>('unknown');
const dateOfBirth = ref('');
const dobDialog = ref(false);
const phone = ref('');
const email = ref('');
const placeOfBirth = ref('');
const occupation = ref('');
const notes = ref('');
const photoFile = ref<File | File[] | null>(null);
const profilePictureDataUrl = ref('');
const errorMessage = ref('');
const submitting = ref(false);
const genderOptions: Array<'male' | 'female' | 'other' | 'unknown'> = ['male', 'female', 'other', 'unknown'];

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
const extractFirstFile = (value: File | File[] | null): File | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};
const fileToDataUrl = async (file: File): Promise<string> =>
  await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read selected image'));
    reader.readAsDataURL(file);
  });

const onDobPick = (value: unknown): void => {
  dateOfBirth.value = formatDateValue(value);
};

const onProfilePhotoSelected = async (): Promise<void> => {
  const file = extractFirstFile(photoFile.value);
  if (!file) {
    profilePictureDataUrl.value = '';
    return;
  }
  if (file.size > 1024 * 1024) {
    errorMessage.value = 'Profile picture must be 1MB or smaller.';
    photoFile.value = null;
    profilePictureDataUrl.value = '';
    return;
  }
  errorMessage.value = '';
  profilePictureDataUrl.value = await fileToDataUrl(file);
};

const clearProfilePhoto = (): void => {
  photoFile.value = null;
  profilePictureDataUrl.value = '';
};

const submit = async (): Promise<void> => {
  if (!isFamilyOwner.value) {
    errorMessage.value = 'Only family owner can add members directly.';
    return;
  }

  errorMessage.value = '';
  if (givenName.value.trim().length < 2) {
    errorMessage.value = 'Given name must be at least 2 characters.';
    return;
  }
  if (familyName.value.trim().length < 2) {
    errorMessage.value = 'Family name must be at least 2 characters.';
    return;
  }
  if (!isValidEmail(email.value.trim())) {
    errorMessage.value = 'Email is required and must be valid.';
    return;
  }
  if (phone.value.trim() && !isValidPhone(phone.value.trim())) {
    errorMessage.value = 'Phone must include country code, e.g. +919876543210.';
    return;
  }
  if (dateOfBirth.value && isFutureDate(dateOfBirth.value)) {
    errorMessage.value = 'Date of birth cannot be in the future.';
    return;
  }

  submitting.value = true;
  try {
    await client.post(`/families/${familyId}/persons`, {
      givenName: givenName.value.trim(),
      familyName: familyName.value.trim(),
      name: `${givenName.value.trim()} ${familyName.value.trim()}`.trim(),
      gender: gender.value,
      dateOfBirth: normalizeOptional(dateOfBirth.value),
      email: email.value.trim().toLowerCase(),
      phone: normalizeOptional(normalizePhone(phone.value)),
      placeOfBirth: normalizeOptional(placeOfBirth.value),
      occupation: normalizeOptional(occupation.value),
      notes: normalizeOptional(notes.value),
      profilePictureDataUrl: normalizeOptional(profilePictureDataUrl.value),
    });
    await router.push(`/families/${familyId}`);
  } catch (error: unknown) {
    errorMessage.value =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not create member.';
  } finally {
    submitting.value = false;
  }
};

const goBack = async (): Promise<void> => {
  await router.push(`/families/${familyId}`);
};
</script>

<style scoped>
@media (max-width: 720px) {
  .page-shell > .d-flex {
    gap: 10px;
  }

  .page-shell > .d-flex :deep(.v-btn) {
    width: 100%;
  }
}
</style>
