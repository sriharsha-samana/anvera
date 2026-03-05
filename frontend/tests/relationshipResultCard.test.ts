import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import RelationshipResultCard from '@/components/RelationshipResultCard.vue';

describe('RelationshipResultCard', () => {
  it('renders english and telugu labels with tags', () => {
    render(RelationshipResultCard, {
      props: {
        englishLabel: 'Cousin',
        teluguLabel: 'కజిన్',
        bloodTag: 'blood',
        lineageTag: 'lineage: mixed',
        ageTag: 'age: not determinable',
        multiplePaths: true,
      },
    });

    expect(screen.getByText('Cousin')).toBeTruthy();
    expect(screen.getByText('కజిన్')).toBeTruthy();
    expect(screen.getByText('blood')).toBeTruthy();
    expect(screen.getByText('Multiple shortest paths found.')).toBeTruthy();
  });
});
