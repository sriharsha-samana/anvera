<template>
  <v-card variant="flat" class="surface-card">
    <v-card-title>Need a simple explanation?</v-card-title>
    <v-card-text>
      <div class="d-flex ga-2 mb-3">
        <v-btn color="primary" variant="outlined" :loading="loading" :disabled="disabled" @click="$emit('explain')">Explain Clearly</v-btn>
      </div>
      <v-alert v-if="error" type="error" variant="tonal" class="mb-3">{{ error }}</v-alert>
      <p v-if="explanation" class="text-body-2" style="white-space: pre-wrap">{{ explanation }}</p>
      <div v-else class="text-caption text-medium-emphasis">Uses only calculated paths from your family data.</div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
defineProps<{
  explanation: string;
  loading: boolean;
  disabled: boolean;
  error: string;
}>();

defineEmits<{
  (e: 'explain'): void;
}>();
</script>
