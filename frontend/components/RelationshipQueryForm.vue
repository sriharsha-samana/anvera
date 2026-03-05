<template>
  <v-card variant="flat" class="surface-card">
    <v-card-text>
      <div class="text-subtitle-1 font-weight-medium mb-3">Who is connected to whom?</div>
      <v-row>
        <v-col cols="12" md="6">
          <v-select
            :model-value="personA"
            :items="personOptions"
            item-title="title"
            item-value="value"
            label="Person 1 (You)"
            @update:model-value="$emit('update:personA', $event)"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-select
            :model-value="personB"
            :items="personOptions"
            item-title="title"
            item-value="value"
            label="Person 2"
            @update:model-value="$emit('update:personB', $event)"
          />
        </v-col>
      </v-row>
      <div class="d-flex ga-2">
        <v-btn variant="outlined" @click="$emit('swap')">Swap People</v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
defineProps<{
  personA: string | null;
  personB: string | null;
  personOptions: Array<{ title: string; value: string }>;
}>();

defineEmits<{
  (e: 'update:personA', value: string | null): void;
  (e: 'update:personB', value: string | null): void;
  (e: 'swap'): void;
}>();
</script>
