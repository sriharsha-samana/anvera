import { defineStore } from 'pinia';

type AppContextState = {
  activeFamilyId: string | null;
  selfByFamily: Record<string, string>;
  language: 'EN' | 'TE';
};

export const useAppContextStore = defineStore('appContext', {
  state: (): AppContextState => ({
    activeFamilyId: null,
    selfByFamily: {},
    language: 'EN',
  }),
  actions: {
    setActiveFamily(familyId: string | null): void {
      this.activeFamilyId = familyId;
      if (process.client) {
        if (familyId) localStorage.setItem('anvera_active_family_id', familyId);
        else localStorage.removeItem('anvera_active_family_id');
      }
    },
    setSelfPerson(familyId: string, personId: string | null): void {
      if (!personId) {
        delete this.selfByFamily[familyId];
      } else {
        this.selfByFamily[familyId] = personId;
      }
      if (process.client) localStorage.setItem('anvera_self_by_family', JSON.stringify(this.selfByFamily));
    },
    setLanguage(language: 'EN' | 'TE'): void {
      this.language = language;
      if (process.client) localStorage.setItem('anvera_language', language);
    },
    restore(): void {
      if (!process.client) return;
      this.activeFamilyId = localStorage.getItem('anvera_active_family_id');
      const rawSelf = localStorage.getItem('anvera_self_by_family');
      if (rawSelf) {
        try {
          this.selfByFamily = JSON.parse(rawSelf) as Record<string, string>;
        } catch {
          this.selfByFamily = {};
        }
      }
      const lang = localStorage.getItem('anvera_language');
      if (lang === 'EN' || lang === 'TE') this.language = lang;
    },
  },
});
