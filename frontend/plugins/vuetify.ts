import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { aliases, mdi } from 'vuetify/iconsets/mdi';

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    components,
    directives,
    icons: {
      defaultSet: 'mdi',
      aliases,
      sets: {
        mdi,
      },
    },
    theme: {
      defaultTheme: 'enterprise',
      themes: {
        enterprise: {
          dark: false,
          colors: {
            primary: '#0b7285',
            secondary: '#ff922b',
            background: '#f6f7fb',
            surface: '#ffffff',
            error: '#c92a2a',
            success: '#2b8a3e',
          },
        },
      },
    },
  });

  nuxtApp.vueApp.use(vuetify);
});
