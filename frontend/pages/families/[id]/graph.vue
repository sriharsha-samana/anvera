<template>
  <div class="page-shell">
    <div class="d-flex flex-wrap align-center justify-space-between mb-4">
      <div>
        <h1 class="page-title">Graph View</h1>
        <p class="page-subtitle">Hierarchical tree with couple nodes and parent-child connectors.</p>
      </div>
      <v-btn variant="outlined" @click="goBack">Back to Family</v-btn>
    </div>

    <v-card class="surface-card mb-4" variant="flat" title="Focus Mode">
      <v-card-text>
        <v-row>
          <v-col cols="12" md="8">
            <v-select
              v-model="focusPersonId"
              :items="focusOptions"
              item-title="title"
              item-value="value"
              label="Focus on person"
              clearable
              density="comfortable"
              hint="Shows selected person and 2-hop neighborhood; everything else is dimmed."
              persistent-hint
            />
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <GraphVisualization :persons="persons" :relationships="relationships" :focus-person-id="focusPersonId ?? undefined" />

  </div>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import type { Person } from '@/types/api';

const route = useRoute();
const router = useRouter();
const familyId = route.params.id as string;
const { client, authStore } = useApi();

const personQuery = useQuery({
  queryKey: ['graph-persons', familyId],
  queryFn: () => client.get<Person[]>(`/families/${familyId}/persons`),
});

const relationshipQuery = useQuery({
  queryKey: ['graph-relationships', familyId],
  queryFn: () =>
    client.get<Array<{ id: string; fromPersonId: string; toPersonId: string; type: string }>>(
      `/families/${familyId}/relationships`,
    ),
});

const persons = computed(() => personQuery.data.value ?? []);
const relationships = computed(() => relationshipQuery.data.value ?? []);
const focusPersonId = ref<string | null>(null);

const focusOptions = computed(() =>
  persons.value
    .map((person) => ({
      title: person.name,
      value: person.id,
    }))
    .sort((a, b) => a.title.localeCompare(b.title)),
);

watch(
  () => [persons.value, authStore.email, authStore.phone, authStore.username, focusPersonId.value] as const,
  () => {
    if (focusPersonId.value) return;
    const normalizePhone = (value: string): string => value.replace(/[\s\-()]/g, '');
    const authEmail = authStore.email?.trim().toLowerCase();
    const authPhone = authStore.phone ? normalizePhone(authStore.phone) : null;
    let match = null as Person | null;
    if (authEmail) {
      match = persons.value.find((p) => (p.email ?? '').trim().toLowerCase() === authEmail) ?? null;
    }
    if (!match && authPhone) {
      match =
        persons.value.find((p) => {
          const phone = (p.phone ?? '').trim();
          return phone ? normalizePhone(phone) === authPhone : false;
        }) ?? null;
    }
    if (!match) {
      const username = authStore.username?.trim().toLowerCase();
      if (!username) return;
      match = persons.value.find((p) => p.name.trim().toLowerCase() === username) ?? null;
    }
    if (match) {
      focusPersonId.value = match.id;
    }
  },
  { immediate: true, deep: true },
);

const goBack = async (): Promise<void> => {
  await router.push(`/families/${familyId}`);
};
</script>
