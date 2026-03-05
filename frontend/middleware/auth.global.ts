import { useAuthStore } from '@/stores/auth';

const protectedPrefixes = ['/families', '/profile'];

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  auth.restore();

  const isProtected = protectedPrefixes.some((prefix) => to.path === prefix || to.path.startsWith(`${prefix}/`));
  const isLoggedIn = Boolean(auth.token);

  if (isProtected && !isLoggedIn) {
    return navigateTo('/');
  }

  if (to.path === '/' && isLoggedIn) {
    return navigateTo('/families');
  }

  return undefined;
});
