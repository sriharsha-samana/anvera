<template>
  <div>
    <div class="d-flex flex-wrap align-center justify-space-between mb-4">
      <div>
        <h1 class="page-title">Family Overview</h1>
        <p class="page-subtitle">Dashboard summary for family health, activity, and relationship structure.</p>
      </div>
      <div class="d-flex ga-2 flex-wrap">
        <v-btn color="primary" @click="goGraph">Open Graph Studio</v-btn>
        <v-btn variant="outlined" @click="goPeople">Open People Directory</v-btn>
      </div>
    </div>

    <v-alert v-if="operationError" type="error" variant="tonal" class="mb-4">{{ operationError }}</v-alert>

    <v-row>
      <v-col cols="12" md="3">
        <v-card class="surface-card" variant="flat">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">Members</div>
            <div class="text-h4 font-weight-bold">{{ persons.length }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card class="surface-card" variant="flat">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">Relationships</div>
            <div class="text-h4 font-weight-bold">{{ relationships.length }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card class="surface-card" variant="flat">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">Pending Proposals</div>
            <div class="text-h4 font-weight-bold">{{ pendingProposalCount }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card class="surface-card" variant="flat">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">Latest Version</div>
            <div class="text-h4 font-weight-bold">v{{ latestVersionNumber ?? 0 }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-1">
      <v-col cols="12">
        <v-card class="surface-card" variant="flat">
          <v-card-title>Family Health Scorecard</v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6" md="3" v-for="item in healthScoreItems" :key="item.label">
                <div class="health-item">
                  <div class="text-caption text-medium-emphasis">{{ item.label }}</div>
                  <div class="d-flex align-center justify-space-between mt-1">
                    <div class="text-h6 font-weight-bold">{{ item.score }}%</div>
                    <v-chip size="x-small" :color="item.color" variant="tonal">{{ item.status }}</v-chip>
                  </div>
                  <v-progress-linear :model-value="item.score" :color="item.color" height="8" rounded class="mt-2" />
                  <div class="text-caption mt-2">{{ item.summary }}</div>
                  <div class="text-caption text-medium-emphasis mt-1"><strong>Review:</strong> {{ item.review }}</div>
                  <div class="text-caption text-medium-emphasis"><strong>Fix:</strong> {{ item.fix }}</div>
                  <v-btn v-if="item.actionLabel" size="x-small" variant="text" color="primary" class="mt-1 px-0" @click="item.action">
                    {{ item.actionLabel }}
                  </v-btn>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-1">
      <v-col cols="12" md="6">
        <v-card class="surface-card" variant="flat">
          <v-card-title>Member Gender Distribution</v-card-title>
          <v-card-text>
            <div v-for="entry in genderDistribution" :key="entry.label" class="mb-3">
              <div class="d-flex justify-space-between text-caption mb-1">
                <span>{{ entry.label }}</span>
                <span>{{ entry.count }}</span>
              </div>
              <v-progress-linear :model-value="entry.percent" color="primary" height="10" rounded />
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card class="surface-card" variant="flat">
          <v-card-title>Relationship Mix Sunburst</v-card-title>
          <v-card-text>
            <div class="sunburst-wrap">
              <div class="sunburst-chart" :style="{ background: relationshipMixGradient }">
                <div class="sunburst-hole" />
              </div>
              <div class="sunburst-legend">
                <div v-for="entry in relationshipMixSegments" :key="entry.label" class="sunburst-legend-item">
                  <span class="sunburst-dot" :style="{ backgroundColor: entry.color }" />
                  <span class="text-caption">{{ entry.label }}</span>
                  <span class="text-caption text-medium-emphasis ml-auto">{{ entry.count }}</span>
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-1">
      <v-col cols="12" md="6">
        <v-card class="surface-card mb-3" variant="flat">
          <v-card-title>At Risk Insights</v-card-title>
          <v-card-text>
            <v-alert v-if="atRiskInsights.length === 0" density="compact" variant="tonal" type="success">
              No immediate risk signals detected.
            </v-alert>
            <v-list v-else density="compact">
              <v-list-item v-for="risk in atRiskInsights" :key="risk.id">
                <template #prepend>
                  <v-icon :icon="risk.icon" :color="risk.color" />
                </template>
                <v-list-item-title>{{ risk.title }} ({{ risk.count }})</v-list-item-title>
                <v-list-item-subtitle>
                  <div><strong>Review:</strong> {{ risk.review }}</div>
                  <div><strong>Fix:</strong> {{ risk.fix }}</div>
                </v-list-item-subtitle>
                <template #append>
                  <v-btn size="x-small" variant="text" color="primary" @click="risk.action">
                    {{ risk.actionLabel }}
                  </v-btn>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <v-card class="surface-card" variant="flat">
          <v-card-title>Governance Snapshot</v-card-title>
          <v-card-text>
            <div class="d-flex align-center justify-space-between py-2">
              <span>Pending proposals</span>
              <v-chip size="small" color="orange" variant="tonal">{{ pendingProposalCount }}</v-chip>
            </div>
            <div class="d-flex align-center justify-space-between py-2">
              <span>Approved proposals</span>
              <v-chip size="small" color="green" variant="tonal">{{ approvedProposalCount }}</v-chip>
            </div>
            <div class="d-flex align-center justify-space-between py-2">
              <span>Rejected proposals</span>
              <v-chip size="small" color="red" variant="tonal">{{ rejectedProposalCount }}</v-chip>
            </div>
            <div class="d-flex ga-2 mt-3">
              <v-btn variant="outlined" @click="goProposals">Open Proposals</v-btn>
              <v-btn variant="outlined" @click="goHistory">Open History</v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card class="surface-card" variant="flat">
          <v-card-title>Quick Actions</v-card-title>
          <v-card-text>
            <div class="d-flex flex-wrap ga-2">
              <v-btn color="primary" @click="goGraph">Graph Studio</v-btn>
              <v-btn variant="outlined" @click="goExplore">Relationship Explorer</v-btn>
              <v-btn variant="outlined" @click="goPeople">People Directory</v-btn>
              <v-btn variant="outlined" @click="goProposals">Proposals</v-btn>
              <v-btn variant="outlined" @click="goHistory">History</v-btn>
              <v-btn variant="outlined" :disabled="!isFamilyOwner" @click="goSettings">Settings</v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app' });

import { useQuery } from '@tanstack/vue-query';
import type { Family, FamilyVersion, Person, Proposal } from '@/types/api';

const route = useRoute();
const router = useRouter();
const familyId = route.params.id as string;
const { client, authStore } = useApi();
authStore.restore();

const operationError = ref('');

const peopleQuery = useQuery({
  queryKey: ['overview-persons', familyId],
  queryFn: () => client.get<Person[]>(`/families/${familyId}/persons`),
});
const relationshipsQuery = useQuery({
  queryKey: ['overview-relationships', familyId],
  queryFn: () =>
    client.get<Array<{ id: string; type: string; fromPersonId: string; toPersonId: string }>>(
      `/families/${familyId}/relationships`,
    ),
});
const proposalsQuery = useQuery({
  queryKey: ['overview-proposals', familyId],
  queryFn: () => client.get<Proposal[]>(`/families/${familyId}/proposals`),
});
const versionsQuery = useQuery({
  queryKey: ['overview-versions', familyId],
  queryFn: () => client.get<FamilyVersion[]>(`/families/${familyId}/versions`),
});
const familiesQuery = useQuery({
  queryKey: ['families'],
  queryFn: () => client.get<Family[]>('/families'),
});

const persons = computed(() => peopleQuery.data.value ?? []);
const relationships = computed(() => relationshipsQuery.data.value ?? []);
const proposals = computed(() => proposalsQuery.data.value ?? []);
const versions = computed(() => versionsQuery.data.value ?? []);
const activeFamily = computed(() => (familiesQuery.data.value ?? []).find((family) => family.id === familyId) ?? null);
const isFamilyOwner = computed(() => {
  if (!activeFamily.value || !authStore.userId) return false;
  return activeFamily.value.ownerId === authStore.userId;
});

const latestVersionNumber = computed(() => versions.value[0]?.versionNumber ?? null);

const pendingProposalCount = computed(() => proposals.value.filter((proposal) => proposal.status === 'PENDING').length);
const approvedProposalCount = computed(() => proposals.value.filter((proposal) => proposal.status === 'APPROVED').length);
const rejectedProposalCount = computed(() => proposals.value.filter((proposal) => proposal.status === 'REJECTED').length);

const distribution = (entries: string[]) => {
  const total = entries.length || 1;
  const map = new Map<string, number>();
  for (const entry of entries) map.set(entry, (map.get(entry) ?? 0) + 1);
  return [...map.entries()].map(([label, count]) => ({
    label,
    count,
    percent: Math.round((count / total) * 100),
  }));
};

const genderDistribution = computed(() =>
  distribution(
    persons.value.map((person) => {
      const g = (person.gender ?? 'unknown').toLowerCase();
      if (g === 'male') return 'Male';
      if (g === 'female') return 'Female';
      if (g === 'other') return 'Other';
      return 'Unknown';
    }),
  ),
);

const relationshipDistribution = computed(() =>
  distribution(relationships.value.map((relationship) => relationship.type || 'UNKNOWN')),
);

const personCompletenessScore = computed(() => {
  if (persons.value.length === 0) return 100;
  const total = persons.value.reduce((acc, person) => {
    let filled = 0;
    if (person.name?.trim()) filled += 1;
    if (person.gender?.trim()) filled += 1;
    if (person.dateOfBirth?.trim()) filled += 1;
    if (person.email?.trim()) filled += 1;
    if (person.phone?.trim()) filled += 1;
    return acc + filled / 5;
  }, 0);
  return Math.round((total / persons.value.length) * 100);
});

const isolatedMemberIds = computed(() => {
  const connected = new Set<string>();
  for (const relationship of relationships.value) {
    connected.add(relationship.fromPersonId);
    connected.add(relationship.toPersonId);
  }
  return persons.value.filter((person) => !connected.has(person.id)).map((person) => person.id);
});

const connectivityScore = computed(() => {
  if (persons.value.length === 0) return 100;
  return Math.round(((persons.value.length - isolatedMemberIds.value.length) / persons.value.length) * 100);
});

const duplicateContactRisk = computed(() => {
  const emailMap = new Map<string, number>();
  const phoneMap = new Map<string, number>();
  for (const person of persons.value) {
    const email = (person.email ?? '').trim().toLowerCase();
    const phone = (person.phone ?? '').replace(/[\s\-()]/g, '');
    if (email) emailMap.set(email, (emailMap.get(email) ?? 0) + 1);
    if (phone) phoneMap.set(phone, (phoneMap.get(phone) ?? 0) + 1);
  }
  const emailDup = [...emailMap.values()].filter((count) => count > 1).length;
  const phoneDup = [...phoneMap.values()].filter((count) => count > 1).length;
  return emailDup + phoneDup;
});

const governanceFlowScore = computed(() => {
  if (proposals.value.length === 0) return 100;
  return Math.round(((proposals.value.length - pendingProposalCount.value) / proposals.value.length) * 100);
});

const integrityScore = computed(() => {
  if (persons.value.length === 0) return 100;
  const penalty = Math.min(80, duplicateContactRisk.value * 10 + isolatedMemberIds.value.length * 5);
  return Math.max(20, 100 - penalty);
});

const resolveScoreStatus = (score: number): { status: string; color: string } => {
  if (score >= 80) return { status: 'Good', color: 'success' };
  if (score >= 60) return { status: 'Watch', color: 'warning' };
  return { status: 'Risk', color: 'error' };
};

const healthScoreItems = computed(() => {
  const items = [
    {
      label: 'Profile Completeness',
      score: personCompletenessScore.value,
      summary: 'How complete member profiles are.',
      review: 'Open People Directory and check missing DOB, email, phone, gender.',
      fix: 'Edit member profiles to fill missing fields.',
      actionLabel: 'Review Members',
      action: goPeople,
    },
    {
      label: 'Graph Connectivity',
      score: connectivityScore.value,
      summary: 'How many members are connected in the family graph.',
      review: 'Check isolated members with no relationships.',
      fix: 'Add valid parent/spouse/sibling relationships.',
      actionLabel: 'Open Graph Studio',
      action: goGraph,
    },
    {
      label: 'Governance Flow',
      score: governanceFlowScore.value,
      summary: 'How quickly pending proposals are resolved.',
      review: 'Inspect pending queue and stale proposals.',
      fix: 'Approve/reject proposals with clear reasons.',
      actionLabel: 'Review Proposals',
      action: goProposals,
    },
    {
      label: 'Data Integrity',
      score: integrityScore.value,
      summary: 'Checks for duplicate contacts and structural anomalies.',
      review: 'Look for duplicate email/phone and risky nodes.',
      fix: 'Merge/correct duplicate identities and invalid links.',
      actionLabel: 'View Risk Insights',
      action: goPeople,
    },
  ];
  return items.map((item) => ({ ...item, ...resolveScoreStatus(item.score) }));
});

const relationshipMixSegments = computed(() => {
  const map = new Map<string, { label: string; count: number; color: string }>([
    ['PARENT', { label: 'Blood • Parent', count: 0, color: '#2563eb' }],
    ['SIBLING', { label: 'Blood • Sibling', count: 0, color: '#0ea5e9' }],
    ['SPOUSE', { label: 'Marriage • Spouse', count: 0, color: '#f59e0b' }],
    ['INLAW', { label: 'Marriage • In-law', count: 0, color: '#f97316' }],
    ['OTHER', { label: 'Other', count: 0, color: '#64748b' }],
  ]);
  for (const relationship of relationships.value) {
    const key = map.has(relationship.type) ? relationship.type : 'OTHER';
    const current = map.get(key);
    if (!current) continue;
    current.count += 1;
  }
  return [...map.values()].filter((entry) => entry.count > 0);
});

const relationshipMixGradient = computed(() => {
  if (relationshipMixSegments.value.length === 0) return 'conic-gradient(#e2e8f0 0 100%)';
  const total = relationshipMixSegments.value.reduce((acc, entry) => acc + entry.count, 0);
  let cursor = 0;
  const slices = relationshipMixSegments.value
    .map((entry) => {
      const pct = (entry.count / total) * 100;
      const start = cursor;
      const end = cursor + pct;
      cursor = end;
      return `${entry.color} ${start}% ${end}%`;
    })
    .join(', ');
  return `conic-gradient(${slices})`;
});

const pendingChangeMentions = computed(() => {
  const mentions = new Map<string, number>();
  for (const proposal of proposals.value.filter((entry) => entry.status === 'PENDING')) {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = proposal.payloadJson ? (JSON.parse(proposal.payloadJson) as Record<string, unknown>) : {};
    } catch {
      parsed = {};
    }
    const ids = new Set<string>();
    const readId = (value: unknown): void => {
      if (typeof value === 'string' && value.trim()) ids.add(value);
    };
    readId(parsed.personId);
    readId(parsed.fromPersonId);
    readId(parsed.toPersonId);
    if (typeof parsed.data === 'object' && parsed.data) {
      const data = parsed.data as Record<string, unknown>;
      readId(data.personId);
      readId(data.fromPersonId);
      readId(data.toPersonId);
    }
    for (const id of ids) mentions.set(id, (mentions.get(id) ?? 0) + 1);
  }
  return mentions;
});

const atRiskInsights = computed(() => {
  const list: Array<{
    id: string;
    title: string;
    count: number;
    review: string;
    fix: string;
    icon: string;
    color: string;
    actionLabel: string;
    action: () => Promise<void>;
  }> = [];
  if (isolatedMemberIds.value.length > 0) {
    list.push({
      id: 'isolated',
      title: 'Isolated members',
      count: isolatedMemberIds.value.length,
      review: 'Open Graph Studio and check members with zero links.',
      fix: 'Add valid relationships to connect them to the family graph.',
      icon: 'mdi-account-off-outline',
      color: 'warning',
      actionLabel: 'Open Graph Studio',
      action: goGraph,
    });
  }
  if (duplicateContactRisk.value > 0) {
    list.push({
      id: 'duplicate-contact',
      title: 'Duplicate contact patterns',
      count: duplicateContactRisk.value,
      review: 'Review members with repeated email/phone values in People Directory.',
      fix: 'Correct duplicates or merge profiles representing the same person.',
      icon: 'mdi-content-duplicate',
      color: 'error',
      actionLabel: 'Review Members',
      action: goPeople,
    });
  }
  const highChange = [...pendingChangeMentions.value.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
  if (highChange.length > 0) {
    const totalMentions = highChange.reduce((acc, [, count]) => acc + count, 0);
    list.push({
      id: 'high-change',
      title: 'High-change pending members',
      count: totalMentions,
      review: 'Inspect pending proposals touching the same members repeatedly.',
      fix: 'Resolve stale/conflicting proposals and consolidate edits.',
      icon: 'mdi-timeline-alert-outline',
      color: 'info',
      actionLabel: 'Review Proposals',
      action: goProposals,
    });
  }
  return list;
});

const goOverview = async (): Promise<void> => {
  await router.push(`/families/${familyId}`);
};

const goGraph = async (): Promise<void> => {
  await router.push(`/families/${familyId}/graph`);
};

const goExplore = async (): Promise<void> => {
  await router.push(`/families/${familyId}/explore`);
};

const goPeople = async (): Promise<void> => {
  await router.push(`/families/${familyId}/people`);
};

const goProposals = async (): Promise<void> => {
  await router.push(`/families/${familyId}/proposals`);
};

const goHistory = async (): Promise<void> => {
  await router.push(`/families/${familyId}/versions`);
};

const goSettings = async (): Promise<void> => {
  await router.push(`/families/${familyId}/danger`);
};

void goOverview;
</script>

<style scoped>
.health-item {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px;
  background: #fff;
}

.sunburst-wrap {
  display: flex;
  align-items: center;
  gap: 16px;
}

.sunburst-chart {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.sunburst-hole {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.sunburst-legend {
  flex: 1;
}

.sunburst-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.sunburst-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

@media (max-width: 760px) {
  .sunburst-wrap {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
