import { fireEvent, render, screen } from '@testing-library/vue';
import ProposalManagement from '@/components/ProposalManagement.vue';

describe('ProposalManagement', () => {
  test('renders owner controls and emits submit', async () => {
    const onSubmit = vi.fn();

    render(ProposalManagement, {
      props: {
        familyId: 'f1',
        proposals: [
          {
            id: 'p1',
            familyId: 'f1',
            type: 'ADD_PERSON',
            payloadJson: '{}',
            previewJson: '{}',
            status: 'PENDING',
            createdAt: new Date().toISOString(),
          },
        ],
        isOwner: true,
        onSubmit,
      },
      global: {
        stubs: ['v-card', 'v-card-text', 'v-row', 'v-col', 'v-select', 'v-text-field', 'v-btn', 'v-dialog', 'v-divider', 'v-list', 'v-list-item', 'v-alert', 'v-spacer', 'v-card-actions'],
      },
    });

    await fireEvent.click(screen.getByText('Submit Proposal'));
    expect(onSubmit).toHaveBeenCalled();
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });
});
