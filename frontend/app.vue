<template>
  <v-app>
    <v-app-bar elevation="0" class="app-header" height="68">
      <v-app-bar-nav-icon class="d-md-none mobile-nav-icon" @click="drawer = true" />
      <v-app-bar-title class="brand" @click="goHome">
        <img src="/anvera-logo.svg" alt="Anvera logo" class="brand-logo" />
        <span>Anvera</span>
      </v-app-bar-title>
      <v-spacer />

      <div v-if="isLoggedIn" class="d-none d-md-flex align-center ga-2">
        <v-btn variant="text" @click="goFamilies">Families</v-btn>
        <v-btn variant="text" class="px-1" :title="displayName" @click="goProfile">
          <v-avatar size="34" color="primary" variant="flat">
            <v-img v-if="me?.profilePictureUrl" :src="me.profilePictureUrl" alt="profile" />
            <span v-else class="text-caption font-weight-bold">{{ avatarLetter }}</span>
          </v-avatar>
        </v-btn>
        <v-btn icon="mdi-logout" variant="text" title="Logout" @click="logout" />
      </div>
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" temporary location="left" class="d-md-none">
      <v-list>
        <v-list-item title="Home" @click="goHomeAndClose" />
        <v-list-item v-if="isLoggedIn" title="Families" @click="goFamiliesAndClose" />
        <v-list-item v-if="isLoggedIn" title="My Profile" @click="goProfileAndClose" />
        <v-list-item v-if="isLoggedIn" title="Logout" @click="logoutAndClose" />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <NuxtPage />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();
authStore.restore();
const { client } = useApi();
const drawer = ref(false);
const me = ref<{
  id: string;
  email: string | null;
  givenName: string | null;
  familyName: string | null;
  profilePictureUrl: string | null;
} | null>(null);

const isLoggedIn = computed(() => Boolean(authStore.token));
const displayName = computed(() => {
  const given = me.value?.givenName?.trim() ?? '';
  const family = me.value?.familyName?.trim() ?? '';
  if (given || family) return `${given} ${family}`.trim();
  return authStore.email ?? authStore.username ?? 'User';
});
const avatarLetter = computed(() => displayName.value.trim().charAt(0).toUpperCase() || 'U');

const loadMe = async (): Promise<void> => {
  if (!isLoggedIn.value) {
    me.value = null;
    return;
  }
  try {
    me.value = await client.get('/auth/me');
  } catch {
    me.value = null;
  }
};

watch(
  () => authStore.token,
  async () => {
    await loadMe();
  },
  { immediate: true },
);

const goHome = async (): Promise<void> => {
  if (isLoggedIn.value) {
    await router.push('/families');
    return;
  }
  await router.push('/');
};

const goFamilies = async (): Promise<void> => {
  await router.push('/families');
};

const goProfile = async (): Promise<void> => {
  await router.push('/profile');
};

const logout = async (): Promise<void> => {
  authStore.clear();
  me.value = null;
  await router.push('/');
};

const goHomeAndClose = async (): Promise<void> => {
  drawer.value = false;
  await goHome();
};

const goFamiliesAndClose = async (): Promise<void> => {
  drawer.value = false;
  await goFamilies();
};

const goProfileAndClose = async (): Promise<void> => {
  drawer.value = false;
  await goProfile();
};

const logoutAndClose = async (): Promise<void> => {
  drawer.value = false;
  await logout();
};
</script>

<style scoped>
.brand {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 10px;
  cursor: pointer;
  font-weight: 800;
  letter-spacing: 0.2px;
  user-select: none;
}

.brand :deep(.v-toolbar-title__placeholder) {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 100%;
}

.brand-logo {
  width: 42px;
  height: 42px;
  object-fit: contain;
}

@media (max-width: 600px) {
  .brand-logo {
    width: 34px;
    height: 34px;
  }

  .brand :deep(.v-toolbar-title__placeholder > span) {
    font-size: 22px;
    letter-spacing: 0;
  }
}

.mobile-nav-icon {
  color: #0f766e !important;
  opacity: 1 !important;
}
</style>
