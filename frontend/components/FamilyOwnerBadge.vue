<template>
  <button
    type="button"
    class="owner-badge"
    :class="{ compact, clickable }"
    :disabled="!clickable"
    @click="$emit('select-owner')"
  >
    <span class="owner-label">Owner</span>
    <strong class="owner-name">{{ ownerLabel }}</strong>
  </button>
</template>

<script setup lang="ts">
import type { Family } from '@/types/api';

const props = withDefaults(
  defineProps<{
    family?: Family | null;
    compact?: boolean;
    clickable?: boolean;
  }>(),
  {
    family: null,
    compact: false,
    clickable: false,
  },
);
defineEmits<{ 'select-owner': [] }>();

const ownerLabel = computed(
  () => props.family?.ownerName || props.family?.owner?.username || props.family?.ownerId || 'Unknown',
);
</script>

<style scoped>
.owner-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  appearance: none;
  font: inherit;
  text-align: left;
  outline: none;
  border-radius: 999px;
  border: 1px solid #bfdcf5;
  background: #e8f3ff;
  color: #0f3c66;
  padding: 4px 10px;
  line-height: 1;
  cursor: default;
  border-width: 1px;
}

.owner-badge:disabled {
  opacity: 1;
}

.owner-badge.clickable {
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
}

.owner-badge.clickable:hover {
  box-shadow: 0 2px 8px rgb(15 60 102 / 18%);
  transform: translateY(-1px);
}

.owner-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 700;
  opacity: 0.75;
}

.owner-name {
  font-size: 13px;
  font-weight: 700;
}

.owner-badge.compact {
  padding: 3px 8px;
}

.owner-badge.compact .owner-label {
  font-size: 10px;
}

.owner-badge.compact .owner-name {
  font-size: 12px;
}
</style>
