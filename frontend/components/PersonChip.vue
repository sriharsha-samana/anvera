<template>
  <MemberIdentity
    :person-id="personId"
    :name="name"
    :avatar-url="avatarUrl"
    :subtitle="subtitle"
    size="sm"
    clickable
    @select="$emit('select', $event)"
  />
</template>

<script setup lang="ts">
defineProps<{
  personId: string;
  name: string;
  avatarUrl?: string | null;
  subtitle?: string;
}>();

defineEmits<{
  (e: 'select', personId: string): void;
}>();
</script>
