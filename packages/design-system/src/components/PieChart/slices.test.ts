import { prepareSlices } from './slices';

describe('prepareSlices', () => {
  it('drops values that cannot be drawn: zero, negative and non-finite', () => {
    const { slices } = prepareSlices(
      [
        { category: 'ok', value: 4 },
        { category: 'zero', value: 0 },
        { category: 'negative', value: -3 },
        { category: 'nan', value: Number.NaN },
        { category: 'inf', value: Infinity },
      ],
      8,
      'Other',
    );
    expect(slices.map(s => s.category)).toEqual(['ok']);
  });

  it('returns no slices and a zero total for empty input', () => {
    expect(prepareSlices([], 8, 'Other')).toEqual({ slices: [], total: 0 });
  });

  it('adds rows with the same category together', () => {
    const { slices, total } = prepareSlices(
      [
        { category: 'a', value: 2 },
        { category: 'b', value: 1 },
        { category: 'a', value: 3 },
      ],
      8,
      'Other',
    );
    expect(slices.map(s => [s.category, s.value])).toEqual([
      ['a', 5],
      ['b', 1],
    ]);
    expect(total).toBe(6);
  });

  it('keeps the given order when there are few enough slices', () => {
    const { slices } = prepareSlices(
      [
        { category: 'small', value: 1 },
        { category: 'big', value: 9 },
        { category: 'mid', value: 5 },
      ],
      8,
      'Other',
    );
    expect(slices.map(s => s.category)).toEqual(['small', 'big', 'mid']);
  });

  it('computes each share as a fraction of the total', () => {
    const { slices } = prepareSlices(
      [
        { category: 'a', value: 1 },
        { category: 'b', value: 3 },
      ],
      8,
      'Other',
    );
    expect(slices[0].share).toBeCloseTo(0.25);
    expect(slices[1].share).toBeCloseTo(0.75);
  });

  it('merges the smallest slices into one "other" slice past the limit', () => {
    const { slices, total } = prepareSlices(
      [
        { category: 'a', value: 1 },
        { category: 'b', value: 5 },
        { category: 'c', value: 3 },
        { category: 'd', value: 2 },
        { category: 'e', value: 4 },
      ],
      3,
      'Other',
    );
    expect(slices.map(s => [s.category, s.value])).toEqual([
      ['b', 5],
      ['e', 4],
      ['Other', 6],
    ]);
    expect(total).toBe(15);
  });

  it('does not merge when the count equals the limit', () => {
    const { slices } = prepareSlices(
      [
        { category: 'a', value: 1 },
        { category: 'b', value: 2 },
        { category: 'c', value: 3 },
      ],
      3,
      'Other',
    );
    expect(slices).toHaveLength(3);
    expect(slices.map(s => s.category)).toEqual(['a', 'b', 'c']);
  });

  it('treats a limit below two as two', () => {
    const { slices } = prepareSlices(
      [
        { category: 'a', value: 1 },
        { category: 'b', value: 2 },
        { category: 'c', value: 3 },
      ],
      0,
      'Other',
    );
    expect(slices.map(s => s.category)).toEqual(['c', 'Other']);
  });

  it('folds the rest into an existing slice that already has the other label', () => {
    const { slices } = prepareSlices(
      [
        { category: 'Other', value: 10 },
        { category: 'a', value: 5 },
        { category: 'b', value: 1 },
        { category: 'c', value: 1 },
      ],
      3,
      'Other',
    );
    expect(slices.map(s => [s.category, s.value])).toEqual([
      ['Other', 12],
      ['a', 5],
    ]);
  });

  it('keeps shares adding up to one', () => {
    const { slices } = prepareSlices(
      Array.from({ length: 12 }, (_, i) => ({
        category: `c${i}`,
        value: i + 1,
      })),
      5,
      'Other',
    );
    const sum = slices.reduce((s, slice) => s + slice.share, 0);
    expect(sum).toBeCloseTo(1);
  });
});
