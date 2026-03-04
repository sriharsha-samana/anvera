<template>
  <div class="page-shell">
    <div class="d-flex flex-wrap align-center justify-space-between mb-4">
      <div>
        <h1 class="page-title">Version Timeline</h1>
        <p class="page-subtitle">Immutable snapshots with rollback-as-new-version governance.</p>
      </div>
      <v-btn variant="outlined" @click="goBack">Back to Family</v-btn>
    </div>

    <v-alert v-if="operationError" type="error" variant="tonal" class="mb-4">{{ operationError }}</v-alert>
    <VersionTimeline :versions="versions" :latest-version-number="latestVersionNumber" @rollback="requestRollback" />
    <RollbackDialog v-model="showRollback" :version-number="targetVersion" @confirm="confirmRollback" />
  </div>
</template>

<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import type { FamilyVersion } from '@/types/api';

const route = useRoute();
const router = useRouter();
const familyId = route.params.id as string;
const { client } = useApi();
const queryClient = useQueryClient();

const showRollback = ref(false);
const targetVersion = ref(1);
const operationError = ref('');

const query = useQuery({
  queryKey: ['versions', familyId],
  queryFn: () => client.get<FamilyVersion[]>(`/families/${familyId}/versions`),
});

const versions = computed(() => query.data.value ?? []);
const latestVersionNumber = computed(() => versions.value[0]?.versionNumber ?? null);

const requestRollback = (versionNumber: number): void => {
  if (latestVersionNumber.value === versionNumber) {
    operationError.value = `Already at version ${versionNumber}. Pick an older version to roll back.`;
    return;
  }
  targetVersion.value = versionNumber;
  showRollback.value = true;
};

const confirmRollback = async (): Promise<void> => {
  try {
    operationError.value = '';
    await client.post(`/families/${familyId}/rollback/${targetVersion.value}`);
    showRollback.value = false;
    await Promise.all([
      query.refetch(),
      queryClient.invalidateQueries({ queryKey: ['persons', familyId] }),
      queryClient.invalidateQueries({ queryKey: ['relationships', familyId] }),
      queryClient.invalidateQueries({ queryKey: ['families'] }),
    ]);
    await router.push(`/families/${familyId}?rolledBack=${Date.now()}`);
  } catch (error: unknown) {
    operationError.value =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
      'Rollback failed. Please try again.';
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
