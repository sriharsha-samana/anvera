<template>
  <v-card title="Version Timeline" class="mb-4">
    <v-card-text>
      <v-timeline density="compact" side="end">
        <v-timeline-item
          v-for="version in versions"
          :key="version.id"
          :dot-color="version.sourceType === 'ROLLBACK' ? 'error' : 'primary'"
        >
          <div class="timeline-row">
            <div class="timeline-text">
              <strong>v{{ version.versionNumber }}</strong> - {{ version.message }}
              <div class="text-caption">{{ new Date(version.createdAt).toLocaleString() }}</div>
            </div>
            <v-btn
              size="small"
              class="rollback-btn"
              :disabled="version.versionNumber === latestVersionNumber"
              @click="$emit('rollback', version.versionNumber)"
            >
              {{ version.versionNumber === latestVersionNumber ? 'Current' : 'Rollback' }}
            </v-btn>
          </div>
        </v-timeline-item>
      </v-timeline>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { FamilyVersion } from '@/types/api';

defineProps<{ versions: FamilyVersion[]; latestVersionNumber: number | null }>();
defineEmits<{ rollback: [versionNumber: number] }>();
</script>

<style scoped>
.timeline-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.timeline-text {
  min-width: 0;
  flex: 1 1 auto;
  overflow-wrap: anywhere;
}

.rollback-btn {
  flex: 0 0 132px;
}

@media (max-width: 680px) {
  .timeline-row {
    flex-direction: column;
    align-items: stretch;
  }

  .rollback-btn {
    flex: 1 1 auto;
    width: 100%;
  }
}
</style>
