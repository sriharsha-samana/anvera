<template>
  <div class="owner-badge" :class="{ compact }">
    <span class="owner-label">Owner</span>
    <strong class="owner-name">{{ ownerLabel }}</strong>
  </div>
</template>

<script setup lang="ts">
import type { Family } from '@/types/api';

const props = withDefaults(
  defineProps<{
    family?: Family | null;
    compact?: boolean;
  }>(),
  {
    family: null,
    compact: false,
  },
);

const ownerLabel = computed(
  () => props.family?.ownerName || props.family?.owner?.username || props.family?.ownerId || 'Unknown',
);
</script>

<style scoped>
.owner-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  border: 1px solid #bfdcf5;
  background: #e8f3ff;
  color: #0f3c66;
  padding: 4px 10px;
  line-height: 1;
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
