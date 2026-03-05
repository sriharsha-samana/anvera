<template>
  <div class="page-shell">
    <div class="d-flex flex-wrap align-center justify-space-between mb-4">
      <div>
        <h1 class="page-title">My Profile</h1>
        <p class="page-subtitle">Your account identity and linked member profiles across families.</p>
      </div>
      <v-btn variant="outlined" @click="goFamilies">Families</v-btn>
    </div>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">{{ errorMessage }}</v-alert>

    <v-card class="surface-card mb-4" variant="flat">
      <v-card-text>
        <div class="d-flex align-center ga-4 flex-wrap">
          <v-avatar size="84" color="primary" variant="flat">
            <v-img v-if="me?.profilePictureUrl" :src="me.profilePictureUrl" alt="profile" />
            <span v-else class="text-h5 font-weight-bold">{{ avatarLetter }}</span>
          </v-avatar>
          <div>
            <div class="text-h5 font-weight-bold">{{ fullName }}</div>
            <div class="text-body-2 text-medium-emphasis">{{ me?.email ?? authStore.email ?? 'No email' }}</div>
            <div class="text-body-2 text-medium-emphasis" v-if="me?.phone || authStore.phone">{{ me?.phone ?? authStore.phone }}</div>
            <div class="mt-2 d-flex ga-2">
              <v-chip v-if="me?.gender" variant="tonal" size="small">{{ me.gender }}</v-chip>
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <v-card class="surface-card" variant="flat" title="Linked Family Members">
      <v-card-text>
        <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-3" />
        <v-alert v-else-if="links.length === 0" type="info" variant="tonal">
          No member profile is linked yet by email/phone. Create a family member with your same email or phone.
        </v-alert>
        <v-list v-else lines="two">
          <v-list-item
            v-for="link in links"
            :key="`${link.familyId}-${link.personId}`"
            :title="link.personName"
            :subtitle="link.familyName"
            @click="openPerson(link.familyId, link.personId)"
          >
            <template #prepend>
              <v-avatar size="38" color="primary" variant="tonal">
                <span class="text-caption font-weight-bold">{{ link.personName.charAt(0).toUpperCase() }}</span>
              </v-avatar>
            </template>
            <template #append>
              <v-btn variant="text" color="primary">Open</v-btn>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app' });

import type { Family, Person } from '@/types/api';

const router = useRouter();
const { client, authStore } = useApi();
authStore.restore();

const me = ref<{
  id: string;
  givenName: string | null;
  familyName: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  profilePictureUrl: string | null;
} | null>(null);
const loading = ref(false);
const errorMessage = ref('');
const links = ref<Array<{ familyId: string; familyName: string; personId: string; personName: string }>>([]);

const fullName = computed(() => {
  const given = me.value?.givenName?.trim() ?? '';
  const family = me.value?.familyName?.trim() ?? '';
  if (given || family) return `${given} ${family}`.trim();
  return authStore.email ?? authStore.username ?? 'User';
});

const avatarLetter = computed(() => fullName.value.charAt(0).toUpperCase() || 'U');

const normalizePhone = (value: string): string => value.replace(/[\s\-()]/g, '');

const loadProfile = async (): Promise<void> => {
  loading.value = true;
  errorMessage.value = '';
  try {
    me.value = await client.get('/auth/me');
    const families = await client.get<Family[]>('/families');

    const authEmail = (me.value.email ?? authStore.email ?? '').trim().toLowerCase();
    const authPhoneRaw = me.value.phone ?? authStore.phone ?? '';
    const authPhone = authPhoneRaw ? normalizePhone(authPhoneRaw) : '';

    const personLists = await Promise.all(
      families.map(async (family) => ({
        family,
        persons: await client.get<Person[]>(`/families/${family.id}/persons`),
      })),
    );

    const mapped: Array<{ familyId: string; familyName: string; personId: string; personName: string }> = [];
    for (const entry of personLists) {
      const person = entry.persons.find((p) => {
        const email = (p.email ?? '').trim().toLowerCase();
        const phone = p.phone ? normalizePhone(p.phone) : '';
        return (authEmail && email === authEmail) || (authPhone && phone === authPhone);
      });
      if (person) {
        mapped.push({
          familyId: entry.family.id,
          familyName: entry.family.name,
          personId: person.id,
          personName: person.name,
        });
      }
    }

    links.value = mapped;
  } catch (error: unknown) {
    const maybeAxios = error as { response?: { data?: { message?: string } } };
    errorMessage.value = maybeAxios.response?.data?.message ?? 'Could not load profile.';
  } finally {
    loading.value = false;
  }
};

const goFamilies = async (): Promise<void> => {
  await router.push('/families');
};

const openPerson = async (familyId: string, personId: string): Promise<void> => {
  await router.push(`/families/${familyId}/persons/${personId}`);
};

onMounted(async () => {
  await loadProfile();
});
</script>

<style scoped>
@media (max-width: 720px) {
  .page-shell > .d-flex {
    gap: 10px;
  }

  .page-shell > .d-flex :deep(.v-btn) {
    width: 100%;
  }
}
</style>
