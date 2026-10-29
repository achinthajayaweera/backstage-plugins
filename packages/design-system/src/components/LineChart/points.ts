export type LineInput = {
  x: string | number;
  value: number;
};

export type LinePoint = {
  x: string | number;
  /** `null` marks a gap: a value that is missing or not a finite number. */
  value: number | null;
};

export type PreparedPoints = {
  points: LinePoint[];
  /** How many points have a real value. A line needs at least one. */
  drawable: number;
  /** True when every real value is a whole number, so the axis can skip decimals. */
  wholeNumbers: boolean;
};

/**
 * Turns raw rows into the points a line chart can draw.
 *
 * The given order is kept, because for a time series the order is the
 * meaning. A value that is not a finite number becomes a gap (`null`), so the
 * line breaks there instead of pretending the value was zero.
 */
export function prepareLinePoints(rows: readonly LineInput[]): PreparedPoints {
  const points: LinePoint[] = rows.map(row => ({
    x: row.x,
    value: Number.isFinite(row.value) ? row.value : null,
  }));
  const real = points.filter(p => p.value !== null);
  return {
    points,
    drawable: real.length,
    wholeNumbers: real.every(p => Number.isInteger(p.value)),
  };
}
