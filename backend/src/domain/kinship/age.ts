export type AgeOrder = 'older' | 'younger' | 'unknown';

type PersonDOB = { dateOfBirth?: string | null };

const parseDate = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

export const compareAge = (personX?: PersonDOB | null, personY?: PersonDOB | null): AgeOrder => {
  const x = parseDate(personX?.dateOfBirth);
  const y = parseDate(personY?.dateOfBirth);

  if (x === null || y === null) return 'unknown';
  if (x < y) return 'older';
  if (x > y) return 'younger';
  return 'unknown';
};
