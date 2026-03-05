<template>
  <v-navigation-drawer v-model="open" location="right" temporary width="460">
    <div class="pa-4" v-if="proposal">
      <div class="d-flex align-center justify-space-between mb-3">
        <div class="text-subtitle-1 font-weight-bold">Proposal Detail</div>
        <v-btn icon="mdi-close" variant="text" size="small" @click="$emit('close')" />
      </div>

      <div class="mb-2"><strong>Type:</strong> {{ proposal.type }}</div>
      <div class="mb-2"><strong>Status:</strong> {{ proposal.status }}</div>
      <div class="mb-3"><strong>Created:</strong> {{ new Date(proposal.createdAt).toLocaleString() }}</div>

      <ImpactPreviewPanel :impacts="impacts" />

      <div class="d-flex ga-2 mt-4" v-if="showActions">
        <v-btn color="success" @click="$emit('approve', proposal.id)">Approve</v-btn>
        <v-btn color="error" variant="outlined" @click="$emit('reject', proposal.id)">Reject</v-btn>
      </div>
      <div class="d-flex ga-2 mt-2">
        <v-btn variant="outlined" @click="$emit('preview', proposal)">Preview Impact</v-btn>
      </div>
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import type { Proposal } from '@/types/api';

const props = defineProps<{
  modelValue: boolean;
  proposal: Proposal | null;
  showActions: boolean;
}>();

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => {
    if (!value) emit('close');
  },
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'approve', proposalId: string): void;
  (e: 'reject', proposalId: string): void;
  (e: 'preview', proposal: Proposal): void;
}>();

const impacts = computed(() => {
  if (!props.proposal?.previewJson) return [] as string[];
  try {
    const parsed = JSON.parse(props.proposal.previewJson) as { diff?: { impacts?: string[] } };
    return parsed.diff?.impacts ?? [];
  } catch {
    return [];
  }
});
</script>
