export type MetricFormat = 'number' | 'percent' | 'duration';

/** Shown when there is no usable number to display. */
export const NO_VALUE = '—';

const DURATION_UNITS = [
  ['d', 86400],
  ['h', 3600],
  ['m', 60],
  ['s', 1],
] as const;

/** Whole seconds as the two largest non-zero units, e.g. 3725 becomes "1h 2m". */
function formatDuration(totalSeconds: number): string {
  let remaining = Math.round(totalSeconds);
  if (remaining <= 0) {
    return '0s';
  }
  const parts: string[] = [];
  for (const [suffix, size] of DURATION_UNITS) {
    const amount = Math.floor(remaining / size);
    remaining -= amount * size;
    if (amount > 0) {
      parts.push(`${amount}${suffix}`);
    }
    if (parts.length === 2) {
      break;
    }
  }
  return parts.join(' ');
}

/**
 * Formats one metric value for display.
 *
 * Units are part of the contract, because a number alone cannot say what it
 * measures:
 * - `number`: any number, shown with up to two decimals.
 * - `percent`: a fraction, so 0.256 is shown as 25.6%.
 * - `duration`: a count of seconds. Negative durations cannot be shown.
 *
 * Anything that is not a finite number gives {@link NO_VALUE}.
 */
export function formatMetricValue(
  value: number | null | undefined,
  format: MetricFormat = 'number',
  locale?: string,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return NO_VALUE;
  }
  switch (format) {
    case 'percent':
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(value);
    case 'duration':
      return value < 0 ? NO_VALUE : formatDuration(value);
    default:
      return new Intl.NumberFormat(locale, {
        maximumFractionDigits: 2,
      }).format(value);
  }
}
