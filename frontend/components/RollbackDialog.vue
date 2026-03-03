<template>
  <v-dialog v-model="model" max-width="520">
    <v-card title="Confirm Rollback">
      <v-card-text>
        Roll back to version <strong>{{ versionNumber }}</strong>? This creates a new append-only version and marks newer approved proposals as overridden.
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="model = false">Cancel</v-btn>
        <v-btn color="error" @click="$emit('confirm', versionNumber)">Confirm Rollback</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: boolean; versionNumber: number }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; confirm: [version: number] }>();

const model = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});
</script>
