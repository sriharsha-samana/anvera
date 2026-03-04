<template>
  <v-card class="surface-card mb-4" variant="flat" title="Family Assistant">
    <v-card-text>
      <p class="text-body-2 text-medium-emphasis mb-3">
        {{ assistantHint }}
      </p>
      <v-row>
        <v-col v-if="hasFamilyContext" cols="12" md="5">
          <v-select
            v-model="selectedMePersonId"
            :items="personOptions"
            item-title="title"
            item-value="value"
            label="I am"
            clearable
            density="comfortable"
            hint='For "to me" questions, select yourself; it can also auto-map from your email/phone.'
            persistent-hint
          />
        </v-col>
        <v-col cols="12" :md="hasFamilyContext ? 7 : 12">
          <v-text-field
            v-model="question"
            label="Ask a question"
            density="comfortable"
            :placeholder="questionPlaceholder"
            @keyup.enter="ask"
          />
        </v-col>
      </v-row>

      <div class="d-flex flex-wrap ga-2">
        <v-btn color="primary" :loading="loading" @click="ask">Ask Family Assistant</v-btn>
      </div>

      <v-alert v-if="errorMessage" type="error" variant="tonal" class="mt-3">{{ errorMessage }}</v-alert>
      <div v-if="suggestions.length > 0" class="mt-2">
        <div class="text-caption mb-1">Did you mean:</div>
        <div class="d-flex flex-wrap ga-2">
          <v-chip
            v-for="name in suggestions"
            :key="name"
            color="primary"
            variant="outlined"
            @click="applySuggestion(name)"
          >
            {{ name }}
          </v-chip>
        </div>
      </div>

      <v-alert v-if="result" type="info" variant="tonal" class="mt-3">
        <div class="font-weight-bold mb-1">Answer</div>
        <div>{{ result.answer }}</div>
        <div v-if="!hasFamilyContext" class="text-caption mt-2">
          Family context used: <strong>{{ result.family.name }}</strong>
        </div>
        <div class="text-caption mt-2">
          Computed: <strong>{{ result.resolved.subject.name }}</strong> is
          <strong>{{ humanLabel }}</strong>
          to
          <strong>{{ result.resolved.object.isMe ? 'you' : result.resolved.object.name }}</strong>.
          <span v-if="!result.aiAvailable"> Ollama unavailable, fallback explanation used.</span>
        </div>
        <div v-if="result.relatedPeople && result.relatedPeople.length > 1" class="text-caption mt-2">
          Matches: {{ result.relatedPeople.map((p) => p.name).join(', ') }}
        </div>
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { AiRelationshipAskResponse, Person } from '@/types/api';

const props = defineProps<{
  familyId?: string;
  persons?: Person[];
}>();

const { client, authStore } = useApi();
const question = ref('');
const selectedMePersonId = ref<string | null>(null);
const result = ref<AiRelationshipAskResponse | null>(null);
const errorMessage = ref<string | null>(null);
const suggestions = ref<string[]>([]);
const loading = ref(false);

const hasFamilyContext = computed(() => Boolean(props.familyId));
const assistantHint = computed(() =>
  hasFamilyContext.value
    ? 'Ask natural-language questions about this family and get answers grounded in the current family graph.'
    : 'Ask natural-language questions across all your families. The assistant will pick the best matching family context.',
);
const questionPlaceholder = computed(() =>
  hasFamilyContext.value ? 'Who is Ramesh to me?' : 'Who is Ramesh to me? (searches across my families)',
);

const personOptions = computed(() =>
  (props.persons ?? [])
    .map((p) => ({ title: p.name, value: p.id }))
    .sort((a, b) => a.title.localeCompare(b.title)),
);

watch(
  () => [props.persons ?? [], authStore.email, authStore.phone, authStore.username, selectedMePersonId.value] as const,
  () => {
    if (!hasFamilyContext.value) return;
    if (selectedMePersonId.value) return;
    const normalizePhone = (value: string): string => value.replace(/[\s\-()]/g, '');
    const authEmail = authStore.email?.trim().toLowerCase();
    const authPhone = authStore.phone ? normalizePhone(authStore.phone) : null;
    const persons = props.persons ?? [];
    let match = null as Person | null;
    if (authEmail) {
      match = persons.find((p) => (p.email ?? '').trim().toLowerCase() === authEmail) ?? null;
    }
    if (!match && authPhone) {
      match =
        persons.find((p) => {
          const phone = (p.phone ?? '').trim();
          return phone ? normalizePhone(phone) === authPhone : false;
        }) ?? null;
    }
    if (!match) {
      const username = authStore.username?.trim().toLowerCase();
      if (!username) return;
      match = persons.find((p) => p.name.trim().toLowerCase() === username) ?? null;
    }
    if (match) {
      selectedMePersonId.value = match.id;
    }
  },
  { immediate: true, deep: true },
);

const humanLabel = computed(() => {
  if (!result.value) return '';
  const rel = result.value.relationship;
  if (rel.label !== 'Cousin') return rel.label.toLowerCase();
  const degree = rel.degree ?? 1;
  const removal = rel.removal ?? 0;
  return removal === 0 ? `${degree} degree cousin` : `${degree} degree cousin ${removal} removed`;
});

const ask = async (): Promise<void> => {
  errorMessage.value = null;
  result.value = null;
  suggestions.value = [];

  if (question.value.trim().length < 3) {
    errorMessage.value = 'Please enter a longer question.';
    return;
  }

  loading.value = true;
  try {
    result.value = await client.post<AiRelationshipAskResponse>('/ai/ask', {
      familyId: props.familyId ?? undefined,
      question: question.value.trim(),
      mePersonId: hasFamilyContext.value ? (selectedMePersonId.value ?? undefined) : undefined,
    });
  } catch (error: unknown) {
    const maybeAxios = error as {
      response?: {
        data?: {
          message?: string;
          details?: {
            suggestions?: string[];
          };
        };
      };
    };
    errorMessage.value = maybeAxios.response?.data?.message ?? 'Failed to get answer.';
    suggestions.value = maybeAxios.response?.data?.details?.suggestions ?? [];
  } finally {
    loading.value = false;
  }
};

const applySuggestion = (name: string): void => {
  const pattern = /who\s+is\s+(.+?)\s+to\s+(.+?)\??$/i;
  if (pattern.test(question.value.trim())) {
    question.value = question.value.replace(pattern, `Who is ${name} to $2?`);
  } else {
    question.value = `Who is ${name} to me?`;
  }
  errorMessage.value = null;
  suggestions.value = [];
};
</script>
