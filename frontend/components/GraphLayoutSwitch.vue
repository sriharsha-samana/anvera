<template>
  <v-btn-toggle :model-value="modelValue" mandatory density="comfortable" @update:model-value="$emit('update:modelValue', $event)">
    <v-btn value="generations" prepend-icon="mdi-family-tree">Generational Band</v-btn>
    <v-btn value="radial" prepend-icon="mdi-chart-donut">Radial</v-btn>
    <v-btn value="timeline" prepend-icon="mdi-timeline-text-outline">Timeline</v-btn>
  </v-btn-toggle>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: 'generations' | 'radial' | 'timeline';
}>();

defineEmits<{
  (e: 'update:modelValue', value: 'generations' | 'radial' | 'timeline'): void;
}>();
</script>
