<template>
  <div class="page-shell">
    <div class="d-flex flex-wrap align-center justify-space-between mb-4">
      <div>
        <h1 class="page-title">Settings</h1>
        <p class="text-subtitle-1 font-weight-medium mb-1">{{ activeFamily?.name ?? 'Family' }}</p>
        <p class="page-subtitle">Owner-only family settings and irreversible actions.</p>
      </div>
      <div class="d-flex ga-2">
        <v-btn variant="outlined" @click="goOverview">Back to Family</v-btn>
      </div>
    </div>

    <v-alert v-if="!isFamilyOwner" type="info" variant="tonal" class="mb-4">
      You can clone this family set. Only this family's owner can rename or delete this family.
    </v-alert>
    <v-alert v-if="operationError" type="error" variant="tonal" class="mb-4">{{ operationError }}</v-alert>

    <v-card class="surface-card mb-4" title="Rename Family" variant="flat">
      <v-card-text>
        <v-text-field
          v-model="newFamilyName"
          label="Family Name"
          density="comfortable"
          :disabled="!isFamilyOwner"
          maxlength="120"
        />
        <div class="d-flex justify-end">
          <v-btn color="primary" :disabled="!canRename" @click="renameFamily">Save Name</v-btn>
        </div>
      </v-card-text>
    </v-card>

    <v-card class="surface-card mb-4" title="Clone Family Set" variant="flat">
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-3">
          Create a complete copy of this family dataset (members, people, relationships, proposals, versions, and
          audit history) into a new family.
        </p>
        <v-text-field
          v-model="cloneFamilyName"
          label="New Family Name"
          density="comfortable"
          :disabled="cloningFamily"
          maxlength="120"
        />
        <div class="d-flex justify-end">
          <v-btn color="primary" :loading="cloningFamily" :disabled="!canCloneFamily" @click="cloneFamilySet">
            Clone Family
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <v-card class="surface-card danger-card" title="Danger Zone" variant="flat">
      <v-card-text>
        <v-alert type="warning" variant="tonal" class="mb-3">
          Deleting this family permanently removes all members, relationships, proposals, version history, and audit
          records. This action cannot be undone.
        </v-alert>
        <div class="d-flex justify-end">
          <v-btn color="error" :disabled="!isFamilyOwner" @click="openDeleteFamilyDialog">Delete Family Permanently</v-btn>
        </div>
      </v-card-text>
    </v-card>

    <v-dialog v-model="deleteFamilyDialog" max-width="560">
      <v-card title="Delete Family Permanently">
        <v-card-text>
          <v-alert type="error" variant="tonal" class="mb-3">
            This removes all data in this family permanently and cannot be recovered.
          </v-alert>
          <p class="text-body-2 mb-2">
            Type <strong>{{ activeFamily?.name ?? 'family name' }}</strong> to confirm deletion.
          </p>
          <v-text-field v-model="deleteFamilyConfirmName" label="Family Name Confirmation" density="comfortable" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteFamilyDialog = false">Cancel</v-btn>
          <v-btn color="error" :disabled="!canConfirmFamilyDelete" @click="confirmDeleteFamily">Delete Permanently</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
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

const operationError = ref('');
const deleteFamilyDialog = ref(false);
const deleteFamilyConfirmName = ref('');
const newFamilyName = ref('');
const cloneFamilyName = ref('');
const cloningFamily = ref(false);

const familiesQuery = useQuery({
  queryKey: ['families'],
  queryFn: () => client.get<Family[]>('/families'),
});

const activeFamily = computed(() => (familiesQuery.data.value ?? []).find((family) => family.id === familyId) ?? null);
const isFamilyOwner = computed(() => activeFamily.value?.myRole === 'OWNER' || activeFamily.value?.ownerId === authStore.userId);
const canRename = computed(() => {
  const current = activeFamily.value?.name.trim() ?? '';
  const next = newFamilyName.value.trim();
  return isFamilyOwner.value && next.length > 0 && next.length <= 120 && next !== current;
});
const canConfirmFamilyDelete = computed(() => {
  const expected = activeFamily.value?.name.trim() ?? '';
  return isFamilyOwner.value && expected.length > 0 && deleteFamilyConfirmName.value.trim() === expected;
});
const canCloneFamily = computed(() => {
  const proposed = cloneFamilyName.value.trim();
  return !cloningFamily.value && proposed.length > 0 && proposed.length <= 120;
});

watch(
  () => activeFamily.value?.name ?? '',
  (name) => {
    newFamilyName.value = name;
    cloneFamilyName.value = name ? `${name} (Copy)` : '';
  },
  { immediate: true },
);

const renameFamily = async (): Promise<void> => {
  if (!canRename.value) return;
  try {
    operationError.value = '';
    await client.put(`/families/${familyId}`, { name: newFamilyName.value.trim() });
    await familiesQuery.refetch();
  } catch (error: unknown) {
    operationError.value =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not rename family.';
  }
};

const openDeleteFamilyDialog = (): void => {
  if (!isFamilyOwner.value) return;
  deleteFamilyConfirmName.value = '';
  deleteFamilyDialog.value = true;
};

const confirmDeleteFamily = async (): Promise<void> => {
  if (!canConfirmFamilyDelete.value) return;
  try {
    operationError.value = '';
    await client.delete(`/families/${familyId}`);
    deleteFamilyDialog.value = false;
    await router.push('/families');
  } catch (error: unknown) {
    operationError.value =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
      'Could not delete family.';
  }
};

const cloneFamilySet = async (): Promise<void> => {
  if (!canCloneFamily.value) return;
  try {
    operationError.value = '';
    cloningFamily.value = true;
    const cloned = await client.post<Family>(`/families/${familyId}/clone`, { name: cloneFamilyName.value.trim() });
    await familiesQuery.refetch();
    await router.push(`/families/${cloned.id}`);
  } catch (error: unknown) {
    operationError.value =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
      'Could not clone family.';
  } finally {
    cloningFamily.value = false;
  }
};

const goOverview = async (): Promise<void> => {
  await router.push(`/families/${familyId}`);
};
</script>

<style scoped>
.danger-card {
  border: 1px solid #fecaca;
}

@media (max-width: 720px) {
  .page-shell > .d-flex {
    gap: 10px;
  }

  .page-shell > .d-flex .d-flex {
    width: 100%;
  }

  .page-shell > .d-flex .d-flex :deep(.v-btn) {
    width: 100%;
  }
}
</style>
