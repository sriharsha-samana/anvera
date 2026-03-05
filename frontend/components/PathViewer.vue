<template>
  <v-card variant="flat" class="surface-card">
    <v-card-title>How this connection was found</v-card-title>
    <v-card-text>
      <v-alert v-if="paths.length === 0" variant="tonal" type="info">No connection path found yet.</v-alert>
      <v-expansion-panels v-else multiple>
        <v-expansion-panel v-for="(path, index) in paths" :key="`path-${index}`">
          <v-expansion-panel-title>Connection {{ index + 1 }} ({{ Math.max(path.length - 1, 0) }} step{{ Math.max(path.length - 1, 0) === 1 ? '' : 's' }})</v-expansion-panel-title>
          <v-expansion-panel-text>
            <div class="d-flex flex-wrap ga-2">
              <v-chip v-for="(node, nodeIndex) in path" :key="`${index}-${nodeIndex}`" size="small" variant="outlined">
                {{ node }}
              </v-chip>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
defineProps<{
  paths: string[][];
}>();
</script>
