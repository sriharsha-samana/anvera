<template>
  <div class="page-shell">
    <div class="d-flex flex-wrap align-center justify-space-between mb-4">
      <div>
        <h1 class="page-title">Version Timeline</h1>
        <p class="page-subtitle">Immutable snapshots with rollback-as-new-version governance.</p>
      </div>
      <v-btn variant="outlined" @click="goBack">Back to Family</v-btn>
    </div>

    <VersionTimeline :versions="versions" @rollback="requestRollback" />
    <RollbackDialog v-model="showRollback" :version-number="targetVersion" @confirm="confirmRollback" />
  </div>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import type { FamilyVersion } from '@/types/api';

const route = useRoute();
const router = useRouter();
const familyId = route.params.id as string;
const { client } = useApi();

const showRollback = ref(false);
const targetVersion = ref(1);

const query = useQuery({
  queryKey: ['versions', familyId],
  queryFn: () => client.get<FamilyVersion[]>(`/families/${familyId}/versions`),
});

const versions = computed(() => query.data.value ?? []);

const requestRollback = (versionNumber: number): void => {
  targetVersion.value = versionNumber;
  showRollback.value = true;
};

const confirmRollback = async (): Promise<void> => {
  await client.post(`/families/${familyId}/rollback/${targetVersion.value}`);
  showRollback.value = false;
  await query.refetch();
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
