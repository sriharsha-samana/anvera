import { defineStore } from 'pinia';

type AuthState = {
  token: string | null;
  userId: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
};

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: null,
    userId: null,
    username: null,
    email: null,
    phone: null,
  }),
  actions: {
    setSession(
      token: string,
      userId: string,
      username: string,
      email: string | null,
      phone: string | null,
    ): void {
      this.token = token;
      this.userId = userId;
      this.username = username;
      this.email = email;
      this.phone = phone;
      if (process.client) {
        localStorage.setItem('fg_token', token);
        localStorage.setItem('fg_user_id', userId);
        localStorage.setItem('fg_username', username);
        localStorage.setItem('fg_email', email ?? '');
        localStorage.setItem('fg_phone', phone ?? '');
      }
    },
    restore(): void {
      if (!process.client) return;
      this.token = localStorage.getItem('fg_token');
      this.userId = localStorage.getItem('fg_user_id');
      this.username = localStorage.getItem('fg_username');
      this.email = localStorage.getItem('fg_email') || null;
      this.phone = localStorage.getItem('fg_phone') || null;
    },
    clear(): void {
      this.token = null;
      this.userId = null;
      this.username = null;
      this.email = null;
      this.phone = null;
      if (process.client) {
        localStorage.removeItem('fg_token');
        localStorage.removeItem('fg_user_id');
        localStorage.removeItem('fg_username');
        localStorage.removeItem('fg_email');
        localStorage.removeItem('fg_phone');
      }
    },
  },
});
