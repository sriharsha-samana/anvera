import { defineStore } from 'pinia';

type UiState = {
  personDrawerOpen: boolean;
  selectedPersonId: string | null;
};

export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    personDrawerOpen: false,
    selectedPersonId: null,
  }),
  actions: {
    openPerson(personId: string): void {
      this.selectedPersonId = personId;
      this.personDrawerOpen = true;
    },
    closePerson(): void {
      this.personDrawerOpen = false;
    },
  },
});
