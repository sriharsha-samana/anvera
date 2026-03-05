<template>
  <v-card variant="outlined" class="person-card-compact">
    <v-card-text class="py-3 px-3">
      <MemberIdentity :person-id="personId" :name="name" :avatar-url="avatarUrl" clickable @select="$emit('select', $event)" />
      <div v-if="meta" class="text-caption text-medium-emphasis mt-2">{{ meta }}</div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
defineProps<{
  personId: string;
  name: string;
  avatarUrl?: string | null;
  meta?: string;
}>();

defineEmits<{
  (e: 'select', personId: string): void;
}>();
</script>

<style scoped>
.person-card-compact {
  min-width: 220px;
}
</style>
