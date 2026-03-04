<template>
  <div class="page-shell">
    <div class="d-flex flex-column flex-md-row align-md-center justify-space-between mb-6 ga-3">
      <div>
        <h1 class="page-title">Family Workspace</h1>
        <p class="page-subtitle">Choose a family to review graph, proposals, versions, and relationship insights.</p>
      </div>
      <div class="d-flex flex-column flex-sm-row align-stretch align-sm-center ga-2" style="min-width: min(100%, 420px)">
        <v-text-field
          v-model="newFamilyName"
          label="New Family Name"
          density="comfortable"
          hide-details
        />
        <v-btn color="primary" size="large" @click="createFamily">Create Family</v-btn>
      </div>
    </div>

    <RelationshipAiAssistant />

    <v-row>
      <v-col v-for="family in families" :key="family.id" cols="12" md="6" lg="4">
        <v-card class="surface-card" variant="flat">
          <v-card-item>
            <v-card-title class="text-h6 font-weight-bold">{{ family.name }}</v-card-title>
          </v-card-item>
          <v-card-text class="pt-0 pb-0">
            <FamilyOwnerBadge :family="family" clickable class="mb-2" @select-owner="showOwnerProfile(family)" />
            <div>
            <v-chip :color="family.myRole === 'OWNER' ? 'primary' : 'secondary'" variant="tonal" size="small">
              {{ family.myRole === 'OWNER' ? 'You are Owner' : 'You are Member' }}
            </v-chip>
            </div>
          </v-card-text>
          <v-card-text class="pt-3">
            <div class="text-caption text-medium-emphasis">
              Created: {{ formatDateTime(family.createdAt) }}
            </div>
            <div class="text-caption text-medium-emphasis">
              Total Members: <strong>{{ family.totalMembers ?? 0 }}</strong>
            </div>
          </v-card-text>
          <v-card-actions class="d-flex flex-wrap ga-2">
            <v-btn color="primary" @click="openFamily(family.id)">Overview</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="showOwnerDialog" max-width="520">
      <v-card title="Owner Profile">
        <v-card-text v-if="selectedOwnerFamily?.owner">
          <div class="owner-row"><strong>Name:</strong> {{ selectedOwnerFamily.ownerName || selectedOwnerFamily.owner.username }}</div>
          <div class="owner-row"><strong>Username:</strong> {{ selectedOwnerFamily.owner.username }}</div>
          <div class="owner-row"><strong>Email:</strong> {{ selectedOwnerFamily.owner.email || '-' }}</div>
          <div class="owner-row"><strong>Phone:</strong> {{ selectedOwnerFamily.owner.phone || '-' }}</div>
          <div class="owner-row"><strong>Gender:</strong> {{ selectedOwnerFamily.owner.gender || '-' }}</div>
          <div class="owner-row"><strong>Date Of Birth:</strong> {{ selectedOwnerFamily.owner.dateOfBirth || '-' }}</div>
        </v-card-text>
        <v-card-text v-else>
          Owner profile details are not available.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showOwnerDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import type { Family } from '@/types/api';

const { client } = useApi();
const router = useRouter();
const newFamilyName = ref(`Family ${Date.now()}`);
const showOwnerDialog = ref(false);
const selectedOwnerFamily = ref<Family | null>(null);

const { data, refetch } = useQuery({
  queryKey: ['families'],
  queryFn: () => client.get<Family[]>('/families'),
});

const families = computed(() => data.value ?? []);

const createFamily = async (): Promise<void> => {
  const name = newFamilyName.value.trim() || `Family ${Date.now()}`;
  await client.post('/families', { name });
  newFamilyName.value = `Family ${Date.now()}`;
  await refetch();
};

const openFamily = async (familyId: string): Promise<void> => {
  await router.push(`/families/${familyId}`);
};

const showOwnerProfile = (family: Family): void => {
  selectedOwnerFamily.value = family;
  showOwnerDialog.value = true;
};

const formatDateTime = (value?: string): string => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString();
};
</script>

<style scoped>
.owner-row {
  font-size: 14px;
  margin-top: 6px;
}
</style>
