<template>
  <v-card variant="flat" class="surface-card mb-2">
    <v-card-text class="d-flex flex-wrap align-center justify-space-between ga-2">
      <div>
        <div class="font-weight-medium">{{ proposal.type }}</div>
        <div class="text-caption text-medium-emphasis">{{ new Date(proposal.createdAt).toLocaleString() }}</div>
      </div>
      <v-chip size="small" :color="proposal.status === 'PENDING' ? 'orange' : proposal.status === 'APPROVED' ? 'green' : 'red'" variant="tonal">
        {{ proposal.status }}
      </v-chip>
      <v-btn size="small" variant="outlined" @click="$emit('open', proposal)">Details</v-btn>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { Proposal } from '@/types/api';

defineProps<{ proposal: Proposal }>();

defineEmits<{
  (e: 'open', proposal: Proposal): void;
}>();
</script>
