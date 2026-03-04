<template>
  <div class="page-shell">
    <div class="d-flex flex-wrap align-center justify-space-between mb-4">
      <div>
        <h1 class="page-title">Proposal Management</h1>
        <p class="page-subtitle">Members submit change requests. Owner approves or rejects with full auditability.</p>
      </div>
      <v-btn variant="outlined" @click="goBack">Back to Family</v-btn>
    </div>
    <v-alert v-if="operationError" type="error" variant="tonal" class="mb-4">{{ operationError }}</v-alert>

    <ProposalManagement
      :family-id="familyId"
      :proposals="proposals"
      :persons="persons"
      :relationships="relationships"
      :is-owner="isOwner"
      @submit="submitProposal"
      @approve="approve"
      @reject="openReject"
    />

    <v-dialog v-model="rejectDialog" max-width="520">
      <v-card class="surface-card" title="Reject Proposal">
        <v-card-text>
          <v-textarea v-model="rejectReason" label="Reason" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="rejectDialog = false">Cancel</v-btn>
          <v-btn color="error" @click="reject">Reject</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import type { Family, Person, Proposal } from '@/types/api';

const route = useRoute();
const router = useRouter();
const familyId = route.params.id as string;
const { client } = useApi();
const rejectDialog = ref(false);
const rejectReason = ref('Not aligned with governance rules');
const rejectingProposalId = ref('');
const operationError = ref('');

const query = useQuery({
  queryKey: ['proposals', familyId],
  queryFn: () => client.get<Proposal[]>(`/families/${familyId}/proposals`),
});
const personsQuery = useQuery({
  queryKey: ['proposal-persons', familyId],
  queryFn: () => client.get<Person[]>(`/families/${familyId}/persons`),
});
const relationshipsQuery = useQuery({
  queryKey: ['proposal-relationships', familyId],
  queryFn: () =>
    client.get<Array<{ id: string; fromPersonId: string; toPersonId: string; type: 'PARENT' | 'SPOUSE' | 'SIBLING' | 'INLAW' }>>(
      `/families/${familyId}/relationships`,
    ),
});
const familiesQuery = useQuery({
  queryKey: ['families'],
  queryFn: () => client.get<Family[]>('/families'),
});
const activeFamily = computed(() => (familiesQuery.data.value ?? []).find((family) => family.id === familyId) ?? null);
const isOwner = computed(() => activeFamily.value?.myRole === 'OWNER');

const proposals = computed(() => query.data.value ?? []);
const persons = computed(() => personsQuery.data.value ?? []);
const relationships = computed(() => relationshipsQuery.data.value ?? []);

const submitProposal = async (payload: unknown): Promise<void> => {
  try {
    operationError.value = '';
    await client.post(`/families/${familyId}/proposals`, payload);
    await query.refetch();
  } catch (error: unknown) {
    operationError.value =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
      'Could not submit proposal.';
  }
};

const approve = async (id: string): Promise<void> => {
  try {
    operationError.value = '';
    await client.post(`/proposals/${id}/approve`);
    await query.refetch();
  } catch (error: unknown) {
    operationError.value =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
      'Could not approve proposal.';
  }
};

const openReject = (id: string): void => {
  rejectingProposalId.value = id;
  rejectDialog.value = true;
};

const reject = async (): Promise<void> => {
  try {
    operationError.value = '';
    await client.post(`/proposals/${rejectingProposalId.value}/reject`, { reason: rejectReason.value });
    rejectDialog.value = false;
    await query.refetch();
  } catch (error: unknown) {
    operationError.value =
      (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
      'Could not reject proposal.';
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
