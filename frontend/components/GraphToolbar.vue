<template>
  <v-card variant="flat" class="mb-3">
    <v-card-text>
      <div class="d-flex flex-wrap ga-2 align-center">
        <v-select
          :model-value="focusPersonId"
          :items="focusOptions"
          item-title="title"
          item-value="value"
          label="Focus person"
          clearable
          density="comfortable"
          hide-details
          style="min-width: 240px"
          @update:model-value="onFocusPersonChange"
        />

        <v-slider
          :model-value="depth"
          min="1"
          max="5"
          step="1"
          thumb-label
          hide-details
          color="primary"
          style="max-width: 220px"
          @update:model-value="$emit('update:depth', Number($event))"
        >
          <template #prepend><span class="text-caption">Depth</span></template>
        </v-slider>

        <v-select
          :model-value="edgeScope"
          :items="edgeScopeOptions"
          label="Edges"
          density="comfortable"
          hide-details
          style="max-width: 160px"
          @update:model-value="$emit('update:edgeScope', $event)"
        />

        <v-select
          :model-value="parentalSide"
          :items="parentalSideOptions"
          label="Side"
          density="comfortable"
          hide-details
          style="max-width: 180px"
          @update:model-value="$emit('update:parentalSide', $event)"
        />

        <v-spacer />
        <v-btn variant="outlined" prepend-icon="mdi-download" :disabled="disableExport" @click="$emit('download')">Download Image</v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
defineProps<{
  layoutMode: 'generations' | 'radial' | 'timeline';
  focusPersonId: string | null;
  depth: number;
  edgeScope: 'all' | 'blood' | 'marriage';
  parentalSide: 'all' | 'maternal' | 'paternal';
  focusOptions: Array<{ title: string; value: string }>;
  disableExport?: boolean;
}>();

const edgeScopeOptions = [
  { title: 'All', value: 'all' },
  { title: 'Blood', value: 'blood' },
  { title: 'Marriage', value: 'marriage' },
] as const;

const parentalSideOptions = [
  { title: 'All sides', value: 'all' },
  { title: 'Maternal', value: 'maternal' },
  { title: 'Paternal', value: 'paternal' },
] as const;

const emit = defineEmits<{
  (e: 'update:focusPersonId', value: string | null): void;
  (e: 'update:depth', value: number): void;
  (e: 'update:edgeScope', value: 'all' | 'blood' | 'marriage'): void;
  (e: 'update:parentalSide', value: 'all' | 'maternal' | 'paternal'): void;
  (e: 'download'): void;
}>();

const onFocusPersonChange = (value: unknown): void => {
  emit('update:focusPersonId', typeof value === 'string' && value.trim() ? value : null);
};
</script>
