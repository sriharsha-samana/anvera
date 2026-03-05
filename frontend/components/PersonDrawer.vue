<template>
  <v-navigation-drawer v-model="open" location="right" temporary width="380">
    <div class="pa-4" v-if="person">
      <div class="d-flex align-center justify-space-between mb-3">
        <div class="text-subtitle-1 font-weight-bold">Member Details</div>
        <v-btn icon="mdi-close" variant="text" size="small" @click="close" />
      </div>

      <MemberIdentity :person-id="person.id" :name="person.name" :avatar-url="person.profilePictureUrl || null" />

      <v-list density="compact" class="mt-3" lines="two">
        <v-list-item title="Gender" :subtitle="person.gender || '-'" />
        <v-list-item title="Date of birth" :subtitle="person.dateOfBirth || '-'" />
        <v-list-item title="Email" :subtitle="person.email || '-'" />
        <v-list-item title="Phone" :subtitle="person.phone || '-'" />
        <v-list-item title="Relationship to self" :subtitle="relationshipLabel" />
      </v-list>

      <div class="d-flex ga-2 mt-3">
        <v-btn color="primary" variant="outlined" block @click="openProfile">Open full profile</v-btn>
      </div>
    </div>
    <div v-else class="pa-4 text-medium-emphasis">Select a person to view details.</div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { useUiStore } from '@/stores/ui';
import { useAppContextStore } from '@/stores/appContext';
import type { Person } from '@/types/api';

const props = defineProps<{
  familyId?: string | null;
}>();

const ui = useUiStore();
const appContext = useAppContextStore();
const router = useRouter();
const { client } = useApi();

const open = computed({
  get: () => ui.personDrawerOpen,
  set: (value: boolean) => {
    if (!value) ui.closePerson();
  },
});

const personQuery = useQuery({
  queryKey: computed(() => ['drawer-persons', props.familyId]),
  enabled: computed(() => Boolean(props.familyId && open.value)),
  queryFn: () => client.get<Person[]>(`/families/${props.familyId}/persons`),
});

const person = computed(() => {
  const id = ui.selectedPersonId;
  if (!id) return null;
  return (personQuery.data.value ?? []).find((entry) => entry.id === id) ?? null;
});

const selfPersonId = computed(() => {
  if (!props.familyId) return null;
  return appContext.selfByFamily[props.familyId] ?? null;
});

const relationQuery = useQuery({
  queryKey: computed(() => ['drawer-relationship', props.familyId, selfPersonId.value, person.value?.id]),
  enabled: computed(() => Boolean(props.familyId && selfPersonId.value && person.value?.id && selfPersonId.value !== person.value?.id)),
  queryFn: () =>
    client.get<{ label: string }>(
      `/relationship?familyId=${props.familyId}&personA=${selfPersonId.value}&personB=${person.value?.id}`,
    ),
});

const relationshipLabel = computed(() => {
  if (!person.value) return '-';
  if (selfPersonId.value && person.value.id === selfPersonId.value) return 'Self';
  return relationQuery.data.value?.label ?? 'Unknown';
});

const close = (): void => {
  ui.closePerson();
};

const openProfile = async (): Promise<void> => {
  if (!props.familyId || !person.value) return;
  ui.closePerson();
  await router.push(`/families/${props.familyId}/persons/${person.value.id}`);
};
</script>
