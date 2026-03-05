<template>
  <div class="date-input-field">
    <v-text-field
      :model-value="displayValue"
      :label="label"
      :density="density"
      :placeholder="placeholder"
      :hint="hint"
      :persistent-hint="persistentHint"
      :clearable="clearable"
      prepend-inner-icon="mdi-calendar-month-outline"
      append-inner-icon="mdi-calendar"
      @update:model-value="onTyping"
      @click:append-inner="menu = true"
      @click:clear="emit('update:modelValue', '')"
      @blur="normalizeTypedValue"
    />

    <v-dialog v-model="menu" max-width="360">
      <v-card title="Select date">
        <v-card-text class="pb-0">
          <v-date-picker :model-value="modelValue || null" :max="max" @update:model-value="onPick" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="menu = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    density?: 'default' | 'comfortable' | 'compact';
    placeholder?: string;
    hint?: string;
    persistentHint?: boolean;
    clearable?: boolean;
    max?: string;
  }>(),
  {
    density: 'comfortable',
    placeholder: 'YYYY-MM-DD',
    hint: 'Use calendar or type YYYY-MM-DD',
    persistentHint: false,
    clearable: true,
    max: '',
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const menu = ref(false);
const displayValue = ref(props.modelValue ?? '');

watch(
  () => props.modelValue,
  (value) => {
    displayValue.value = value ?? '';
  },
);

const toLocalYmd = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateValue = (raw: unknown): string => {
  if (!raw) return '';
  if (Array.isArray(raw)) return formatDateValue(raw[0]);
  if (typeof raw === 'string') return raw.slice(0, 10);
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return toLocalYmd(raw);
  return '';
};

const onTyping = (value: string): void => {
  displayValue.value = value;
  emit('update:modelValue', value);
};

const normalizeTypedValue = (): void => {
  const value = displayValue.value.trim();
  if (!value) {
    emit('update:modelValue', '');
    return;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return;
  const normalized = formatDateValue(parsed);
  displayValue.value = normalized;
  emit('update:modelValue', normalized);
};

const onPick = (value: unknown): void => {
  const formatted = formatDateValue(value);
  displayValue.value = formatted;
  emit('update:modelValue', formatted);
};
</script>
