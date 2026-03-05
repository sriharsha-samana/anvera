import type { PersonNode } from '../../shared/types';

export type AgeOrder = 'older' | 'younger' | 'unknown';

const parseDate = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

export const compareAge = (
  personX?: Pick<PersonNode, 'dateOfBirth'> | null,
  personY?: Pick<PersonNode, 'dateOfBirth'> | null,
): AgeOrder => {
  const x = parseDate(personX?.dateOfBirth);
  const y = parseDate(personY?.dateOfBirth);
  if (x === null || y === null) return 'unknown';
  if (x < y) return 'older';
  if (x > y) return 'younger';
  return 'unknown';
};
