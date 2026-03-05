<template>
  <v-card variant="flat" class="surface-card">
    <v-card-title class="d-flex align-center justify-space-between flex-wrap ga-2">
      <span>Relationship Summary</span>
      <v-btn-toggle
        :model-value="language"
        density="compact"
        mandatory
        variant="outlined"
        @update:model-value="$emit('update:language', $event)"
      >
        <v-btn value="english">English</v-btn>
        <v-btn value="telugu">తెలుగు</v-btn>
        <v-btn value="both">Both</v-btn>
      </v-btn-toggle>
    </v-card-title>
    <v-card-text>
      <div class="text-caption text-medium-emphasis mb-1">Detected relationship</div>
      <div class="text-body-1 font-weight-medium mb-3">{{ englishLabel }}</div>
      <div v-if="language === 'english' || language === 'both'" class="text-h6 mb-1">{{ englishSummary }}</div>
      <div v-if="language === 'telugu' || language === 'both'" class="text-subtitle-1 text-medium-emphasis mb-3">{{ teluguSummary }}</div>
      <div class="d-flex flex-wrap ga-2">
        <v-chip size="small" variant="tonal">{{ bloodTag }}</v-chip>
        <v-chip size="small" variant="tonal">{{ lineageTag }}</v-chip>
        <v-chip size="small" variant="tonal">{{ ageTag }}</v-chip>
      </div>
      <div v-if="multiplePaths" class="text-caption text-medium-emphasis mt-2">More than one valid connection path found.</div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
defineProps<{
  englishLabel: string;
  englishSummary: string;
  teluguSummary: string;
  bloodTag: string;
  lineageTag: string;
  ageTag: string;
  multiplePaths: boolean;
  language: 'english' | 'telugu' | 'both';
}>();

defineEmits<{
  (e: 'update:language', value: 'english' | 'telugu' | 'both'): void;
}>();
</script>
