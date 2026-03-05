<template>
  <div>
    <div class="d-flex flex-wrap align-center justify-space-between mb-4">
      <div>
        <h1 class="page-title">{{ pageTitle }}</h1>
        <p class="page-subtitle">{{ pageSubtitle }}</p>
      </div>
      <v-btn variant="outlined" @click="goBack">Back to Overview</v-btn>
    </div>

    <GraphToolbar
      :layout-mode="layoutMode"
      :focus-person-id="focusPersonId"
      v-model:depth="focusDepth"
      v-model:edge-scope="edgeScope"
      v-model:parental-side="parentalSide"
      :focus-options="focusOptions"
      :disable-export="persons.length === 0 || downloading || layoutMode === 'radial' || layoutMode === 'timeline'"
      @update:focus-person-id="onFocusPersonUpdate"
      @download="downloadGraphImage"
    />

    <GraphCanvas
      ref="graphCanvasRef"
      :persons="persons"
      :relationships="relationships"
      :layout-mode="layoutMode"
      :focus-person-id="focusPersonId"
      :depth="focusDepth"
      :edge-scope="edgeScope"
      :parental-side="parentalSide"
      @select-person="openPerson"
    />
  </div>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { useUiStore } from '@/stores/ui';
import type { Person } from '@/types/api';

definePageMeta({ layout: 'app' });

type GraphCanvasHandle = { downloadAsImage: (fileName?: string) => Promise<void> };
type GraphLayoutMode = 'generations' | 'radial' | 'timeline';

const route = useRoute();
const router = useRouter();
const familyId = route.params.id as string;
const { client, authStore } = useApi();
const ui = useUiStore();

const graphCanvasRef = ref<GraphCanvasHandle | null>(null);
const coerceLayoutMode = (value: unknown): GraphLayoutMode =>
  value === 'radial' || value === 'timeline' ? value : 'generations';

const layoutMode = ref<GraphLayoutMode>(coerceLayoutMode(route.query.layout));
const focusPersonId = ref<string | null>(null);
const autoFocusResolved = ref(false);
const focusClearedByUser = ref(false);
const focusDepth = ref(2);
const edgeScope = ref<'all' | 'blood' | 'marriage'>('all');
const parentalSide = ref<'all' | 'maternal' | 'paternal'>('all');
const downloading = ref(false);

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
const pageTitle = computed(() => {
  if (layoutMode.value === 'radial') return 'Radial Family Layout';
  if (layoutMode.value === 'timeline') return 'Timeline Lineage View';
  return 'Generational Band Layout';
});

const pageSubtitle = computed(() => {
  if (layoutMode.value === 'radial') return 'Explore family members distributed around generation rings.';
  if (layoutMode.value === 'timeline') return 'Review lineage by generation as a clean chronological sequence.';
  return 'Review family structure grouped by generations with scoped depth filtering.';
});

const focusOptions = computed(() =>
  persons.value
    .map((person) => ({
      title: person.name,
      value: person.id,
    }))
    .sort((a, b) => a.title.localeCompare(b.title)),
);

watch(
  () => route.query.layout,
  (value) => {
    const next = coerceLayoutMode(value);
    if (next !== layoutMode.value) layoutMode.value = next;
  },
  { immediate: true },
);

watch(layoutMode, async (value) => {
  const nextQuery = { ...route.query, layout: value };
  if (route.query.layout === value) return;
  await router.replace({ query: nextQuery });
});

watch(
  () => [persons.value, authStore.email, authStore.phone, authStore.username, focusPersonId.value] as const,
  () => {
    if (focusPersonId.value || autoFocusResolved.value || focusClearedByUser.value) return;
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
      autoFocusResolved.value = true;
    }
  },
  { immediate: true, deep: true },
);

const onFocusPersonUpdate = (value: string | null): void => {
  focusPersonId.value = value;
  if (value) {
    autoFocusResolved.value = true;
    focusClearedByUser.value = false;
    return;
  }
  focusClearedByUser.value = true;
};

const goBack = async (): Promise<void> => {
  await router.push(`/families/${familyId}`);
};

const openPerson = (personId: string): void => {
  ui.openPerson(personId);
};

const downloadGraphImage = async (): Promise<void> => {
  if (!graphCanvasRef.value) return;
  try {
    downloading.value = true;
    await graphCanvasRef.value.downloadAsImage(`anvera-graph-${new Date().toISOString().slice(0, 10)}.png`);
  } finally {
    downloading.value = false;
  }
};
</script>
