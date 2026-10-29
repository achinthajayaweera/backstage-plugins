import { prepareLinePoints } from './points';

describe('prepareLinePoints', () => {
  it('keeps the given order and values', () => {
    const { points } = prepareLinePoints([
      { x: 'Mon', value: 3 },
      { x: 'Tue', value: 1 },
      { x: 'Wed', value: 2 },
    ]);
    expect(points.map(p => [p.x, p.value])).toEqual([
      ['Mon', 3],
      ['Tue', 1],
      ['Wed', 2],
    ]);
  });

  it('turns values that are not finite numbers into gaps', () => {
    const { points, drawable } = prepareLinePoints([
      { x: 1, value: 4 },
      { x: 2, value: Number.NaN },
      { x: 3, value: Infinity },
      { x: 4, value: 6 },
    ]);
    expect(points.map(p => p.value)).toEqual([4, null, null, 6]);
    expect(drawable).toBe(2);
  });

  it('turns a missing value into a gap', () => {
    const { points } = prepareLinePoints([
      { x: 'a', value: null as unknown as number },
      { x: 'b', value: undefined as unknown as number },
    ]);
    expect(points.map(p => p.value)).toEqual([null, null]);
  });

  it('keeps zero and negative values as real points', () => {
    const { points, drawable } = prepareLinePoints([
      { x: 'a', value: 0 },
      { x: 'b', value: -2 },
    ]);
    expect(points.map(p => p.value)).toEqual([0, -2]);
    expect(drawable).toBe(2);
  });

  it('reports nothing drawable for empty input or only gaps', () => {
    expect(prepareLinePoints([]).drawable).toBe(0);
    expect(prepareLinePoints([{ x: 'a', value: Number.NaN }]).drawable).toBe(0);
  });

  it('reports whole numbers only when every real value is whole', () => {
    expect(
      prepareLinePoints([
        { x: 1, value: 2 },
        { x: 2, value: 5 },
      ]).wholeNumbers,
    ).toBe(true);
    expect(
      prepareLinePoints([
        { x: 1, value: 2 },
        { x: 2, value: 2.5 },
      ]).wholeNumbers,
    ).toBe(false);
  });

  it('ignores gaps when deciding about whole numbers', () => {
    expect(
      prepareLinePoints([
        { x: 1, value: 2 },
        { x: 2, value: Number.NaN },
      ]).wholeNumbers,
    ).toBe(true);
  });

  it('does not change the input rows', () => {
    const rows = [{ x: 'a', value: Number.NaN }];
    prepareLinePoints(rows);
    expect(Number.isNaN(rows[0].value)).toBe(true);
  });
});
