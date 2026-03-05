<template>
  <v-card variant="flat" class="surface-card">
    <v-card-title>Version Details</v-card-title>
    <v-card-text v-if="version">
      <div><strong>Version:</strong> {{ version.versionNumber }}</div>
      <div><strong>Source:</strong> {{ version.sourceType }}</div>
      <div><strong>Message:</strong> {{ version.message }}</div>
      <div><strong>Created:</strong> {{ new Date(version.createdAt).toLocaleString() }}</div>
      <div v-if="version.rollbackFromVersion != null"><strong>Rollback from:</strong> {{ version.rollbackFromVersion }}</div>
      <v-btn
        class="mt-3"
        color="warning"
        variant="outlined"
        :disabled="!isOwner || latestVersionNumber === version.versionNumber"
        @click="$emit('rollback', version.versionNumber)"
      >
        Rollback to this version
      </v-btn>
    </v-card-text>
    <v-card-text v-else class="text-medium-emphasis">Select a version to inspect details.</v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { FamilyVersion } from '@/types/api';

defineProps<{
  version: FamilyVersion | null;
  isOwner: boolean;
  latestVersionNumber: number | null;
}>();

defineEmits<{
  (e: 'rollback', versionNumber: number): void;
}>();
</script>
