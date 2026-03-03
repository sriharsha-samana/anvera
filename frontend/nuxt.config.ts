export default defineNuxtConfig({
  devtools: { enabled: false },
  css: ['vuetify/styles', '@mdi/font/css/materialdesignicons.css', '@/assets/main.css'],
  vite: {
    define: {
      'process.env.DEBUG': false,
    },
  },
  typescript: {
    strict: true,
  },
  build: {
    transpile: ['vuetify'],
  },
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000',
    },
  },
});
