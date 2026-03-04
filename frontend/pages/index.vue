<template>
  <div class="page-shell auth-shell">
    <v-row class="auth-grid" align="start" justify="center">
      <v-col cols="12" md="7" lg="7">
        <v-card class="surface-card hero-card" variant="flat">
          <v-card-text>
            <div class="hero-badge">
              <v-icon icon="mdi-family-tree" size="18" />
              <span>Private Family Workspace</span>
            </div>
            <h1 class="page-title mt-3">Welcome to Anvera</h1>
            <p class="page-subtitle hero-subtitle">
              Build and govern your family graph with approval workflows, immutable version history, and clear
              relationship insights.
            </p>

            <v-row class="mt-2" dense>
              <v-col cols="12" sm="6">
                <v-card class="surface-card info-card" variant="flat">
                  <v-card-text>
                    <div class="text-subtitle-1 font-weight-bold mb-1">Owner Governance</div>
                    <div class="text-body-2 text-medium-emphasis">
                      Members submit proposals. Owners review and approve with full audit trail.
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" sm="6">
                <v-card class="surface-card info-card" variant="flat">
                  <v-card-text>
                    <div class="text-subtitle-1 font-weight-bold mb-1">Family Assistant</div>
                    <div class="text-body-2 text-medium-emphasis">
                      Ask natural-language questions using your family context and relationship graph.
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="5" lg="5" class="auth-panel-col">
        <v-card class="surface-card auth-card" variant="flat">
          <v-card-text>
            <div class="text-overline text-medium-emphasis mb-1">Account Access</div>
            <v-tabs v-model="mode" grow>
              <v-tab value="login">Sign In</v-tab>
              <v-tab value="register">Register</v-tab>
            </v-tabs>

            <v-window v-model="mode" class="mt-4">
              <v-window-item value="login">
                <v-form @submit.prevent="onLogin" validate-on="submit lazy" class="auth-form">
                  <v-text-field
                    v-model="identifier"
                    label="Email / Phone / Username"
                    density="comfortable"
                    prepend-inner-icon="mdi-account"
                    autocomplete="username"
                    required
                  />
                  <v-text-field
                    v-model="password"
                    label="Password"
                    :type="showLoginPassword ? 'text' : 'password'"
                    density="comfortable"
                    prepend-inner-icon="mdi-lock"
                    :append-inner-icon="showLoginPassword ? 'mdi-eye-off' : 'mdi-eye'"
                    autocomplete="current-password"
                    required
                    @click:append-inner="showLoginPassword = !showLoginPassword"
                  />
                  <v-btn
                    color="primary"
                    size="large"
                    block
                    type="submit"
                    :loading="submittingLogin"
                    :disabled="!canLogin"
                  >
                    Continue
                  </v-btn>
                </v-form>
              </v-window-item>

              <v-window-item value="register">
                <v-form @submit.prevent="onRegister" validate-on="submit lazy" class="auth-form">
                  <v-row>
                    <v-col cols="12" md="6">
                      <v-text-field v-model="registerGivenName" label="Given Name" density="comfortable" required />
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-text-field v-model="registerFamilyName" label="Family Name" density="comfortable" required />
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-text-field
                        v-model="registerEmail"
                        label="Email"
                        density="comfortable"
                        autocomplete="email"
                        required
                      />
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-text-field
                        v-model="registerPhone"
                        label="Phone (+country code)"
                        density="comfortable"
                        autocomplete="tel"
                        placeholder="+919876543210"
                      />
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-select v-model="registerGender" :items="genderOptions" label="Gender" density="comfortable" />
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-text-field
                        v-model="registerDateOfBirth"
                        label="Date of Birth"
                        readonly
                        density="comfortable"
                        placeholder="YYYY-MM-DD"
                        @click="registerDobDialog = true"
                      />
                      <v-dialog v-model="registerDobDialog" max-width="360">
                        <v-card title="Select Date of Birth">
                          <v-card-text>
                            <v-date-picker :model-value="registerDateOfBirth || null" @update:model-value="onRegisterDobPick" />
                          </v-card-text>
                          <v-card-actions>
                            <v-spacer />
                            <v-btn variant="text" @click="registerDobDialog = false">Close</v-btn>
                          </v-card-actions>
                        </v-card>
                      </v-dialog>
                    </v-col>
                  </v-row>

                  <v-text-field
                    v-model="registerPassword"
                    label="Password"
                    :type="showRegisterPassword ? 'text' : 'password'"
                    density="comfortable"
                    prepend-inner-icon="mdi-lock"
                    :append-inner-icon="showRegisterPassword ? 'mdi-eye-off' : 'mdi-eye'"
                    autocomplete="new-password"
                    required
                    @click:append-inner="showRegisterPassword = !showRegisterPassword"
                  />

                  <v-btn
                    color="primary"
                    size="large"
                    block
                    type="submit"
                    :loading="submittingRegister"
                    :disabled="!canRegister"
                  >
                    Create Account
                  </v-btn>
                </v-form>
              </v-window-item>
            </v-window>

            <v-alert v-if="error" type="error" class="mt-3" variant="tonal">{{ error }}</v-alert>
            <v-divider class="my-4" />
            <div class="text-caption text-medium-emphasis">
              Sign in using email, phone, or username. New accounts use email as default username.
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
const identifier = ref('');
const password = ref('');
const registerPassword = ref('');
const registerGivenName = ref('');
const registerFamilyName = ref('');
const registerGender = ref<'male' | 'female' | 'other' | 'unknown'>('unknown');
const registerDateOfBirth = ref('');
const registerDobDialog = ref(false);
const registerEmail = ref('');
const registerPhone = ref('');
const showLoginPassword = ref(false);
const showRegisterPassword = ref(false);
const submittingLogin = ref(false);
const submittingRegister = ref(false);
const genderOptions: Array<'male' | 'female' | 'other' | 'unknown'> = ['male', 'female', 'other', 'unknown'];
const mode = ref<'login' | 'register'>('login');
const error = ref('');
const router = useRouter();
const { client, applyToken } = useApi();

const normalizePhone = (value: string): string => value.replace(/[\s\-()]/g, '');
const isValidPhone = (value: string): boolean => /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));
const isFutureDate = (value: string): boolean => {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return true;
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return date.getTime() > todayUtc.getTime();
};
const toLocalYmd = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const formatDateValue = (raw: unknown): string => {
  if (!raw) return '';
  if (Array.isArray(raw)) return formatDateValue(raw[0]);
  if (typeof raw === 'string') return raw.slice(0, 10);
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return toLocalYmd(raw);
  return '';
};
const normalizeOptional = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const canLogin = computed(() => identifier.value.trim().length > 0 && password.value.length >= 1);
const canRegister = computed(() => {
  const email = registerEmail.value.trim();
  return (
    registerGivenName.value.trim().length >= 2 &&
    registerFamilyName.value.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    registerPassword.value.length >= 6
  );
});

const onRegisterDobPick = (value: unknown): void => {
  registerDateOfBirth.value = formatDateValue(value);
};

const onLogin = async (): Promise<void> => {
  if (!canLogin.value || submittingLogin.value) return;
  try {
    submittingLogin.value = true;
    error.value = '';
    const response = await client.post<{ token: string }>('/auth/login', {
      identifier: identifier.value.trim(),
      password: password.value,
    });
    applyToken(response.token);
    await router.push('/families');
  } catch {
    error.value = 'Login failed. Check your credentials.';
  } finally {
    submittingLogin.value = false;
  }
};

const onRegister = async (): Promise<void> => {
  if (!canRegister.value || submittingRegister.value) return;
  try {
    submittingRegister.value = true;
    error.value = '';
    if (registerPhone.value.trim() && !isValidPhone(registerPhone.value.trim())) {
      error.value = 'Phone must include country code, e.g. +919876543210.';
      return;
    }
    if (registerDateOfBirth.value && isFutureDate(registerDateOfBirth.value)) {
      error.value = 'Date of birth cannot be in the future.';
      return;
    }

    const response = await client.post<{ token: string }>('/auth/register', {
      password: registerPassword.value,
      givenName: registerGivenName.value.trim(),
      familyName: registerFamilyName.value.trim(),
      gender: registerGender.value,
      dateOfBirth: normalizeOptional(registerDateOfBirth.value),
      email: registerEmail.value.trim().toLowerCase(),
      phone: normalizeOptional(normalizePhone(registerPhone.value)),
    });
    applyToken(response.token);
    await router.push('/families');
  } catch (err: unknown) {
    const maybeAxios = err as { response?: { data?: { message?: string } } };
    error.value = maybeAxios.response?.data?.message ?? 'Registration failed.';
  } finally {
    submittingRegister.value = false;
  }
};
</script>

<style scoped>
.auth-shell {
  padding-top: 92px;
  max-width: 1160px;
}

.auth-grid {
  row-gap: 16px;
}

.hero-card {
  border-radius: 20px !important;
  background: linear-gradient(180deg, rgb(255 255 255 / 95%) 0%, rgb(250 252 255 / 95%) 100%);
}

.auth-panel-col {
  display: flex;
  justify-content: flex-end;
}

.auth-card {
  width: 100%;
  max-width: 470px;
  border-radius: 20px !important;
}

.auth-form {
  display: grid;
  gap: 8px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: #dff4f7;
  color: #0b7285;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.hero-subtitle {
  max-width: 680px;
}

.info-card {
  border-radius: 14px !important;
}

@media (max-width: 960px) {
  .auth-shell {
    padding-top: 76px;
  }

  .auth-panel-col {
    display: block;
  }

  .auth-card {
    max-width: none;
  }
}

@media (max-width: 640px) {
  .auth-shell {
    padding-top: 66px;
  }

  .hero-card .page-title {
    font-size: 34px;
    line-height: 1.05;
  }

  .hero-subtitle {
    font-size: 14px;
  }
}
</style>
