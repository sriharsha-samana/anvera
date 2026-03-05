<template>
  <div>
    <div class="d-flex flex-wrap align-center justify-space-between mb-4">
      <div>
        <h1 class="page-title">History</h1>
        <p class="page-subtitle">Immutable snapshots with rollback-as-new-version governance.</p>
      </div>
      <v-btn variant="outlined" @click="goBack">Back to Overview</v-btn>
    </div>

    <v-alert v-if="operationError" type="error" variant="tonal" class="mb-4">{{ operationError }}</v-alert>
    <v-row>
      <v-col cols="12" md="7">
        <v-card class="surface-card mt-4" variant="flat">
          <v-card-title>Timeline</v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item
                v-for="version in versions"
                :key="version.id"
                :title="`v${version.versionNumber} • ${version.message}`"
                :subtitle="new Date(version.createdAt).toLocaleString()"
                @click="onSelectVersion(version)"
              />
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col v-if="display.mdAndUp.value" cols="12" md="5">
        <VersionDiffPanel
          :version="selectedVersion"
          :is-owner="isOwner"
          :latest-version-number="latestVersionNumber"
          @rollback="requestRollback"
        />
      </v-col>
    </v-row>
    <v-bottom-sheet v-model="showMobileVersionSheet">
      <v-card class="surface-card pa-2">
        <VersionDiffPanel
          :version="selectedVersion"
          :is-owner="isOwner"
          :latest-version-number="latestVersionNumber"
          @rollback="requestRollback"
        />
      </v-card>
    </v-bottom-sheet>
    <RollbackDialog v-model="showRollback" :version-number="targetVersion" @confirm="confirmRollback" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app' });

import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { useDisplay } from 'vuetify';
import type { Family, FamilyVersion } from '@/types/api';

const route = useRoute();
const router = useRouter();
const familyId = route.params.id as string;
const { client } = useApi();
const queryClient = useQueryClient();

const showRollback = ref(false);
const targetVersion = ref(1);
const operationError = ref('');
const selectedVersion = ref<FamilyVersion | null>(null);
const showMobileVersionSheet = ref(false);
const display = useDisplay();

const query = useQuery({
  queryKey: ['versions', familyId],
  queryFn: () => client.get<FamilyVersion[]>(`/families/${familyId}/versions`),
});
const familiesQuery = useQuery({
  queryKey: ['families'],
  queryFn: () => client.get<Family[]>('/families'),
});

const versions = computed(() => query.data.value ?? []);
const latestVersionNumber = computed(() => versions.value[0]?.versionNumber ?? null);
const activeFamily = computed(() => (familiesQuery.data.value ?? []).find((family) => family.id === familyId) ?? null);
const isOwner = computed(() => activeFamily.value?.myRole === 'OWNER');

watch(
  versions,
  (next) => {
    if (!selectedVersion.value && next.length > 0) {
      selectedVersion.value = next[0];
    }
  },
  { immediate: true },
);

const requestRollback = (versionNumber: number): void => {
  if (latestVersionNumber.value === versionNumber) {
    operationError.value = `Already at version ${versionNumber}. Pick an older version to roll back.`;
    return;
  }
  targetVersion.value = versionNumber;
  showRollback.value = true;
};

const onSelectVersion = (version: FamilyVersion): void => {
  selectedVersion.value = version;
  if (display.smAndDown.value) showMobileVersionSheet.value = true;
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
