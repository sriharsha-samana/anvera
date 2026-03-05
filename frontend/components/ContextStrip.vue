<template>
  <v-sheet class="context-strip" rounded="lg" border>
    <div class="context-row">
      <div class="context-item">
        <span class="context-label">Family</span>
        <strong>{{ familyName || '—' }}</strong>
      </div>
      <div class="context-item">
        <span class="context-label">Role</span>
        <v-chip size="small" variant="tonal" :color="role === 'OWNER' ? 'primary' : 'secondary'">{{ role || '—' }}</v-chip>
      </div>
      <div class="context-item">
        <span class="context-label">Self</span>
        <v-chip
          size="small"
          variant="tonal"
          :disabled="!selfPersonName"
          prepend-icon="mdi-account"
          @click="$emit('open-self')"
        >
          {{ selfPersonName || 'Not linked' }}
        </v-chip>
      </div>
      <div class="context-item">
        <span class="context-label">Dataset</span>
        <v-chip size="small" variant="tonal">{{ datasetMode }}</v-chip>
      </div>
    </div>
  </v-sheet>
</template>

<script setup lang="ts">
defineProps<{
  familyName?: string | null;
  role?: 'OWNER' | 'MEMBER' | null;
  selfPersonName?: string | null;
  datasetMode?: 'Master' | 'Clone';
}>();

defineEmits<{
  (e: 'open-self'): void;
}>();
</script>

<style scoped>
.context-strip {
  margin-bottom: 16px;
  padding: 10px 14px;
  background: #f8fbff;
}

.context-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.context-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.context-label {
  color: #64748b;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
