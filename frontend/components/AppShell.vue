<template>
  <v-app>
    <v-app-bar elevation="0" height="72" class="app-shell-bar">
      <v-app-bar-nav-icon class="d-none d-md-inline-flex" @click="drawer = !drawer" />
      <v-app-bar-title class="brand" @click="goFamilies">
        <img src="/anvera-logo.svg" alt="Anvera logo" class="brand-logo" />
        <span>Anvera</span>
      </v-app-bar-title>

      <v-spacer />
      <v-menu v-model="notificationsOpen" location="bottom end" :close-on-content-click="false">
        <template #activator="{ props: menuProps }">
          <v-btn icon variant="text" title="Notifications" v-bind="menuProps">
            <v-badge :model-value="notificationCount > 0" :content="notificationCount > 99 ? '99+' : notificationCount" color="error" floating>
              <v-icon icon="mdi-bell-outline" />
            </v-badge>
          </v-btn>
        </template>
        <v-list density="compact" min-width="340">
          <v-list-item
            v-if="!activeFamilyId"
            title="Select a family to view notifications"
            subtitle="Notifications are shown for the active family."
            prepend-icon="mdi-information-outline"
          />
          <v-list-item v-else-if="proposalsQuery.isLoading.value" title="Loading notifications..." prepend-icon="mdi-loading mdi-spin" />
          <v-list-item
            v-for="item in notificationItems"
            :key="item.id"
            :title="item.title"
            :subtitle="item.subtitle"
            :prepend-icon="item.icon"
            @click="goToNotificationsTarget(item.target)"
          />
          <v-list-item
            v-if="activeFamilyId && !proposalsQuery.isLoading.value && notificationItems.length === 0"
            title="No notifications right now"
            subtitle="You are all caught up for this family."
            prepend-icon="mdi-bell-check-outline"
          />
          <v-divider v-if="activeFamilyId" class="my-1" />
          <v-list-item
            v-if="activeFamilyId"
            title="Open Proposal Inbox"
            subtitle="Review all proposal activity"
            prepend-icon="mdi-open-in-new"
            @click="goToNotificationsTarget('proposals')"
          />
        </v-list>
      </v-menu>
      <v-btn icon="mdi-account-circle-outline" variant="text" @click="goProfile" />
      <v-btn icon="mdi-logout" variant="text" @click="logout" />
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" :temporary="$vuetify.display.mdAndDown" width="272">
      <v-list nav>
        <v-list-item title="Families" prepend-icon="mdi-home-city-outline" @click="goFamilies" />
        <v-list-item
          :disabled="!activeFamilyId"
          title="Family Overview"
          prepend-icon="mdi-view-dashboard-outline"
          @click="goFamilyRoute('')"
        />
        <v-list-item
          :disabled="!activeFamilyId"
          title="Generational Band Layout"
          prepend-icon="mdi-family-tree"
          @click="goFamilyGraphLayout('generations')"
        />
        <v-list-item
          :disabled="!activeFamilyId"
          title="Radial Family Layout"
          prepend-icon="mdi-chart-donut"
          @click="goFamilyGraphLayout('radial')"
        />
        <v-list-item
          :disabled="!activeFamilyId"
          title="Timeline Lineage View"
          prepend-icon="mdi-timeline-text-outline"
          @click="goFamilyGraphLayout('timeline')"
        />
        <v-list-item
          :disabled="!activeFamilyId"
          title="Relationship Explorer"
          prepend-icon="mdi-compass-outline"
          @click="goFamilyRoute('/explore')"
        />
        <v-list-item
          :disabled="!activeFamilyId"
          title="Proposals"
          prepend-icon="mdi-file-document-edit-outline"
          @click="goFamilyRoute('/proposals')"
        />
        <v-list-item
          :disabled="!activeFamilyId"
          title="History"
          prepend-icon="mdi-timeline-clock-outline"
          @click="goFamilyRoute('/versions')"
        />
        <v-list-item
          :disabled="!activeFamilyId"
          title="People Directory"
          prepend-icon="mdi-account-group-outline"
          @click="goFamilyRoute('/people')"
        />
        <v-tooltip text="Owner only" :disabled="isOwner">
          <template #activator="{ props: tipProps }">
            <div v-bind="tipProps">
              <v-list-item
                :disabled="!activeFamilyId || !isOwner"
                title="Settings"
                prepend-icon="mdi-shield-alert-outline"
                @click="goFamilyRoute('/danger')"
              />
            </div>
          </template>
        </v-tooltip>
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <div class="px-4 py-4">
        <ContextStrip
          v-if="showContextStrip"
          :family-name="activeFamily?.name ?? null"
          :role="(activeFamily?.myRole as 'OWNER' | 'MEMBER' | null) ?? null"
          :self-person-name="selfPersonName"
          :dataset-mode="'Master'"
          @open-self="openSelf"
        />
        <slot />
      </div>
    </v-main>

    <v-bottom-navigation v-if="$vuetify.display.smAndDown && activeFamilyId" grow>
      <v-btn @click="goFamilyRoute('')"><span>Overview</span></v-btn>
      <v-btn @click="goFamilyRoute('/explore')"><span>Explore</span></v-btn>
      <v-btn @click="goFamilyRoute('/proposals')"><span>Proposals</span></v-btn>
      <v-btn @click="goFamilyRoute('/versions')"><span>History</span></v-btn>
      <v-btn @click="moreOpen = true"><span>More</span></v-btn>
    </v-bottom-navigation>

    <v-bottom-sheet v-model="moreOpen">
      <v-card>
        <v-card-title>More</v-card-title>
        <v-list>
          <v-list-item title="Generational Band Layout" prepend-icon="mdi-family-tree" @click="goMoreGraph('generations')" />
          <v-list-item title="Radial Family Layout" prepend-icon="mdi-chart-donut" @click="goMoreGraph('radial')" />
          <v-list-item
            title="Timeline Lineage View"
            prepend-icon="mdi-timeline-text-outline"
            @click="goMoreGraph('timeline')"
          />
          <v-list-item title="People Directory" prepend-icon="mdi-account-group-outline" @click="goMore('/people')" />
          <v-list-item title="Settings" prepend-icon="mdi-shield-alert-outline" :disabled="!isOwner" @click="goMore('/danger')" />
          <v-list-item title="Families" prepend-icon="mdi-home-city-outline" @click="goMoreFamilies" />
          <v-list-item title="Profile" prepend-icon="mdi-account-circle-outline" @click="goMoreProfile" />
          <v-list-item title="Logout" prepend-icon="mdi-logout" @click="logoutFromMore" />
        </v-list>
      </v-card>
    </v-bottom-sheet>

    <PersonDrawer :family-id="activeFamilyId" />
  </v-app>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { useDisplay } from 'vuetify';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { useAppContextStore } from '@/stores/appContext';
import type { Family, Person, Proposal } from '@/types/api';
type GraphLayoutMode = 'generations' | 'radial' | 'timeline';

const auth = useAuthStore();
const ui = useUiStore();
const appContext = useAppContextStore();
const { client } = useApi();
const route = useRoute();
const router = useRouter();
const display = useDisplay();
const drawer = ref(true);
const moreOpen = ref(false);
const notificationsOpen = ref(false);

auth.restore();
appContext.restore();

const isLoggedIn = computed(() => Boolean(auth.token));
const routeFamilyId = computed(() => {
  const param = route.params.id;
  return typeof param === 'string' ? param : null;
});

watch(
  routeFamilyId,
  (familyId) => {
    if (familyId) appContext.setActiveFamily(familyId);
  },
  { immediate: true },
);

watch(
  () => display.lgAndUp.value,
  (desktop) => {
    drawer.value = desktop;
  },
  { immediate: true },
);

const familiesQuery = useQuery({
  queryKey: ['shell-families'],
  enabled: computed(() => isLoggedIn.value),
  queryFn: () => client.get<Family[]>('/families'),
});

const activeFamilyId = computed(() => routeFamilyId.value ?? appContext.activeFamilyId);
const families = computed(() => familiesQuery.data.value ?? []);
const activeFamily = computed(() => families.value.find((family) => family.id === activeFamilyId.value) ?? null);
const isOwner = computed(() => activeFamily.value?.myRole === 'OWNER');

const personsQuery = useQuery({
  queryKey: computed(() => ['shell-persons', activeFamilyId.value]),
  enabled: computed(() => Boolean(activeFamilyId.value)),
  queryFn: () => client.get<Person[]>(`/families/${activeFamilyId.value}/persons`),
});

const persons = computed(() => personsQuery.data.value ?? []);
const proposalsQuery = useQuery({
  queryKey: computed(() => ['shell-proposals', activeFamilyId.value]),
  enabled: computed(() => Boolean(isLoggedIn.value && activeFamilyId.value)),
  queryFn: () => client.get<Proposal[]>(`/families/${activeFamilyId.value}/proposals`),
});
const proposals = computed(() => proposalsQuery.data.value ?? []);
const pendingProposalCount = computed(() => proposals.value.filter((proposal) => proposal.status === 'PENDING').length);
const approvedProposalCount = computed(() => proposals.value.filter((proposal) => proposal.status === 'APPROVED').length);
const rejectedProposalCount = computed(() => proposals.value.filter((proposal) => proposal.status === 'REJECTED').length);
const notificationCount = computed(() => {
  if (!activeFamilyId.value) return 0;
  if (isOwner.value) return pendingProposalCount.value;
  return pendingProposalCount.value + rejectedProposalCount.value;
});
const notificationItems = computed(
  (): Array<{ id: string; title: string; subtitle: string; icon: string; target: 'proposals' | 'history' }> => {
    const items: Array<{ id: string; title: string; subtitle: string; icon: string; target: 'proposals' | 'history' }> = [];
    if (!activeFamilyId.value) return items;

    if (isOwner.value) {
      if (pendingProposalCount.value > 0) {
        items.push({
          id: 'pending-owner',
          title: `${pendingProposalCount.value} proposal${pendingProposalCount.value > 1 ? 's' : ''} awaiting your review`,
          subtitle: 'Open Proposal Inbox to approve or reject pending changes.',
          icon: 'mdi-clipboard-check-outline',
          target: 'proposals',
        });
      }
      if (rejectedProposalCount.value > 0) {
        items.push({
          id: 'rejected-owner',
          title: `${rejectedProposalCount.value} proposal${rejectedProposalCount.value > 1 ? 's were' : ' was'} rejected`,
          subtitle: 'Members can resubmit after addressing review comments.',
          icon: 'mdi-close-circle-outline',
          target: 'proposals',
        });
      }
      return items;
    }

    if (pendingProposalCount.value > 0) {
      items.push({
        id: 'pending-member',
        title: `${pendingProposalCount.value} proposal${pendingProposalCount.value > 1 ? 's are' : ' is'} under review`,
        subtitle: 'Owner review is pending in the proposal inbox.',
        icon: 'mdi-clock-outline',
        target: 'proposals',
      });
    }
    if (approvedProposalCount.value > 0) {
      items.push({
        id: 'approved-member',
        title: `${approvedProposalCount.value} proposal${approvedProposalCount.value > 1 ? 's' : ''} approved`,
        subtitle: 'Approved changes are reflected in latest family versions.',
        icon: 'mdi-check-circle-outline',
        target: 'history',
      });
    }
    if (rejectedProposalCount.value > 0) {
      items.push({
        id: 'rejected-member',
        title: `${rejectedProposalCount.value} proposal${rejectedProposalCount.value > 1 ? 's' : ''} rejected`,
        subtitle: 'Review rejection reason and resubmit with corrections.',
        icon: 'mdi-alert-circle-outline',
        target: 'proposals',
      });
    }
    return items;
  },
);

const resolveSelfPerson = (): Person | null => {
  const familyId = activeFamilyId.value;
  if (!familyId) return null;
  const saved = appContext.selfByFamily[familyId];
  if (saved) {
    const found = persons.value.find((person) => person.id === saved);
    if (found) return found;
  }

  const authEmail = auth.email?.trim().toLowerCase();
  if (authEmail) {
    const byEmail = persons.value.find((person) => (person.email ?? '').trim().toLowerCase() === authEmail);
    if (byEmail) {
      appContext.setSelfPerson(familyId, byEmail.id);
      return byEmail;
    }
  }

  const authPhone = auth.phone?.replace(/[^\d+]/g, '') ?? '';
  if (authPhone) {
    const byPhone = persons.value.find((person) => (person.phone ?? '').replace(/[^\d+]/g, '') === authPhone);
    if (byPhone) {
      appContext.setSelfPerson(familyId, byPhone.id);
      return byPhone;
    }
  }

  return null;
};

const selfPerson = computed(() => resolveSelfPerson());
const selfPersonName = computed(() => selfPerson.value?.name ?? null);

const showContextStrip = computed(() => route.path.startsWith('/families/') && Boolean(activeFamilyId.value));

const goFamilies = async (): Promise<void> => {
  drawer.value = false;
  await router.push('/families');
};

const goFamilyRoute = async (suffix: string): Promise<void> => {
  if (!activeFamilyId.value) return;
  drawer.value = false;
  await router.push(`/families/${activeFamilyId.value}${suffix}`);
};

const goFamilyGraphLayout = async (layout: GraphLayoutMode): Promise<void> => {
  if (!activeFamilyId.value) return;
  drawer.value = false;
  await router.push({ path: `/families/${activeFamilyId.value}/graph`, query: { layout } });
};

const goToNotificationsTarget = async (target: 'proposals' | 'history'): Promise<void> => {
  notificationsOpen.value = false;
  if (!activeFamilyId.value) return;
  if (target === 'history') {
    await router.push(`/families/${activeFamilyId.value}/versions`);
    return;
  }
  await router.push(`/families/${activeFamilyId.value}/proposals`);
};

const goMore = async (suffix: string): Promise<void> => {
  moreOpen.value = false;
  await goFamilyRoute(suffix);
};

const goMoreGraph = async (layout: GraphLayoutMode): Promise<void> => {
  moreOpen.value = false;
  await goFamilyGraphLayout(layout);
};

const goMoreFamilies = async (): Promise<void> => {
  moreOpen.value = false;
  await goFamilies();
};

const goMoreProfile = async (): Promise<void> => {
  moreOpen.value = false;
  await goProfile();
};

const logoutFromMore = async (): Promise<void> => {
  moreOpen.value = false;
  await logout();
};

const goProfile = async (): Promise<void> => {
  await router.push('/profile');
};

const logout = async (): Promise<void> => {
  auth.clear();
  appContext.setActiveFamily(null);
  ui.closePerson();
  await router.push('/');
};

const openSelf = (): void => {
  if (selfPerson.value) ui.openPerson(selfPerson.value.id);
};
</script>

<style scoped>
.app-shell-bar {
  border-bottom: 1px solid #e2e8f0;
  background: #fff;
}

.brand {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  user-select: none;
  font-weight: 800;
}

.brand-logo {
  width: 36px;
  height: 36px;
}
</style>
