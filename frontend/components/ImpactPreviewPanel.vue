<template>
  <v-card variant="tonal">
    <v-card-title class="text-subtitle-1">Impact Preview</v-card-title>
    <v-card-text>
      <div v-if="impacts.length === 0" class="text-caption text-medium-emphasis">No impact summary available.</div>
      <ul v-else class="impact-list">
        <li v-for="impact in impacts" :key="impact">{{ impact }}</li>
      </ul>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
defineProps<{ impacts: string[] }>();
</script>

<style scoped>
.impact-list {
  margin: 0;
  padding-left: 18px;
}
</style>
