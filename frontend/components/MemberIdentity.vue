<template>
  <button
    v-if="clickable"
    type="button"
    class="member-identity member-identity-btn"
    :class="[`member-${size}`]"
    @click="onSelect"
  >
    <v-avatar :size="avatarSize" class="member-avatar">
      <v-img v-if="avatarUrl" :src="avatarUrl" :alt="name" cover />
      <span v-else class="avatar-fallback">{{ initial }}</span>
    </v-avatar>
    <span class="member-text">
      <span class="member-name">{{ name }}</span>
      <span v-if="subtitle" class="member-subtitle">{{ subtitle }}</span>
    </span>
  </button>

  <div v-else class="member-identity" :class="[`member-${size}`]">
    <v-avatar :size="avatarSize" class="member-avatar">
      <v-img v-if="avatarUrl" :src="avatarUrl" :alt="name" cover />
      <span v-else class="avatar-fallback">{{ initial }}</span>
    </v-avatar>
    <span class="member-text">
      <span class="member-name">{{ name }}</span>
      <span v-if="subtitle" class="member-subtitle">{{ subtitle }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    personId?: string;
    name: string;
    avatarUrl?: string | null;
    subtitle?: string;
    clickable?: boolean;
    size?: 'sm' | 'md';
  }>(),
  {
    personId: undefined,
    avatarUrl: null,
    subtitle: undefined,
    clickable: false,
    size: 'md',
  },
);

const emit = defineEmits<{
  (e: 'select', personId: string): void;
}>();

const initial = computed(() => props.name.trim().charAt(0).toUpperCase() || '?');
const avatarSize = computed(() => (props.size === 'sm' ? 28 : 34));

const onSelect = (): void => {
  if (!props.personId) return;
  emit('select', props.personId);
};
</script>

<style scoped>
.member-identity {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.member-identity-btn {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  text-align: left;
}

.member-identity-btn:hover .member-name {
  text-decoration: underline;
}

.member-avatar {
  flex: 0 0 auto;
  background: #e2e8f0;
  color: #1e293b;
  font-weight: 700;
}

.avatar-fallback {
  font-size: 12px;
}

.member-text {
  display: inline-flex;
  flex-direction: column;
  min-width: 0;
}

.member-name {
  color: #0f172a;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.member-subtitle {
  color: #64748b;
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
}

.member-sm .member-name {
  font-size: 13px;
  max-width: 200px;
}

.member-sm .member-subtitle {
  font-size: 11px;
  max-width: 220px;
}
</style>
