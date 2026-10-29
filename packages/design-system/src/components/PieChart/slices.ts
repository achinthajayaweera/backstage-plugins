export interface PieSliceInput {
  category: string;
  value: number;
}

export type PieSlice = {
  category: string;
  value: number;
  /** Fraction of the total, from 0 to 1. */
  share: number;
};

export interface PreparedSlices {
  slices: PieSlice[];
  total: number;
}

/** Fewer than two slices cannot be drawn as separate pieces plus an "other". */
const MIN_SLICES = 2;

/**
 * Turns raw rows into the slices a pie can draw.
 *
 * - Rows whose value is not a finite number above zero are dropped, because a
 *   pie cannot show a negative or empty share.
 * - Rows with the same category are added together, so every slice has a
 *   distinct name.
 * - When there are more than `maxSlices` slices, the largest `maxSlices - 1`
 *   are kept and the rest are added into one slice named `otherLabel`. Only
 *   then are slices sorted (largest first); otherwise the given order is kept.
 */
export function prepareSlices(
  rows: readonly PieSliceInput[],
  maxSlices: number,
  otherLabel: string,
): PreparedSlices {
  const limit = Math.max(MIN_SLICES, Math.floor(maxSlices) || MIN_SLICES);

  const merged = new Map<string, number>();
  for (const row of rows) {
    if (Number.isFinite(row.value) && row.value > 0) {
      merged.set(row.category, (merged.get(row.category) ?? 0) + row.value);
    }
  }

  let kept = Array.from(merged, ([category, value]) => ({ category, value }));

  if (kept.length > limit) {
    const sorted = [...kept].sort((a, b) => b.value - a.value);
    const head = sorted.slice(0, limit - 1);
    const restTotal = sorted
      .slice(limit - 1)
      .reduce((sum, slice) => sum + slice.value, 0);
    const existing = head.find(slice => slice.category === otherLabel);
    if (existing) {
      existing.value += restTotal;
      kept = head;
    } else {
      kept = [...head, { category: otherLabel, value: restTotal }];
    }
  }

  const total = kept.reduce((sum, slice) => sum + slice.value, 0);
  const slices = kept.map(slice => ({
    ...slice,
    share: total > 0 ? slice.value / total : 0,
  }));
  return { slices, total };
}
