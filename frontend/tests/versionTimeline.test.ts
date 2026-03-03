import { fireEvent, render, screen } from '@testing-library/vue';
import VersionTimeline from '@/components/VersionTimeline.vue';

describe('VersionTimeline', () => {
  test('shows versions and emits rollback', async () => {
    const onRollback = vi.fn();
    render(VersionTimeline, {
      props: {
        versions: [
          {
            id: 'v1',
            familyId: 'f1',
            versionNumber: 3,
            message: 'Approved proposal',
            sourceType: 'PROPOSAL',
            createdAt: new Date().toISOString(),
          },
        ],
        onRollback,
      },
      global: {
        stubs: ['v-card', 'v-card-text', 'v-timeline', 'v-timeline-item', 'v-btn'],
      },
    });

    await fireEvent.click(screen.getByText('Rollback'));
    expect(onRollback).toHaveBeenCalledWith(3);
  });
});
