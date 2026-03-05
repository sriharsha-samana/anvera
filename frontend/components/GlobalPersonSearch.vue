<template>
  <v-autocomplete
    ref="inputRef"
    v-model="selected"
    :items="items"
    item-title="title"
    item-value="value"
    label="Search members"
    density="comfortable"
    prepend-inner-icon="mdi-magnify"
    clearable
    hide-details
    class="global-search"
    @update:model-value="onSelect"
  />
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    items: Array<{ title: string; value: string }>;
    modelValue?: string | null;
  }>(),
  { modelValue: null },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void;
  (e: 'select', value: string): void;
}>();

const selected = ref<string | null>(props.modelValue ?? null);
const inputRef = ref();

watch(
  () => props.modelValue,
  (value) => {
    selected.value = value ?? null;
  },
);

const onSelect = (value: string | null): void => {
  emit('update:modelValue', value);
  if (value) emit('select', value);
};

const focusInput = (): void => {
  const el = inputRef.value?.$el?.querySelector('input') as HTMLInputElement | null;
  el?.focus();
};

defineExpose({ focusInput });
</script>

<style scoped>
.global-search {
  min-width: min(420px, 48vw);
}

@media (max-width: 960px) {
  .global-search {
    min-width: 100%;
  }
}
</style>
