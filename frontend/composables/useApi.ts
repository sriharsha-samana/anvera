import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '@/stores/auth';
import { ApiClient } from '@/utils/apiClient';

type AuthToken = {
  userId: string;
  username: string;
  email?: string | null;
  phone?: string | null;
};

export const useApi = () => {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  authStore.restore();

  const client = new ApiClient(config.public.apiBaseUrl, authStore.token ?? undefined);

  const applyToken = (token: string): void => {
    const decoded = jwtDecode<AuthToken>(token);
    authStore.setSession(token, decoded.userId, decoded.username, decoded.email ?? null, decoded.phone ?? null);
    client.setToken(token);
  };

  return { client, applyToken, authStore };
};
