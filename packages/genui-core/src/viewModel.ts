import { getPath, Row } from './paths';
import type { PipelineResult } from './pipeline';
import type { ViewT } from './spec';
import type { Issue } from './validate';

/** Why a widget shows an explanation instead of data. */
export type ExplanationReason =
  | 'unsupported_view'
  | 'no_data'
  | 'bad_data'
  | 'forbidden'
  | 'fetch_failed'
  | 'invalid_spec';

export interface Explanation {
  kind: 'explanation';
  reason: ExplanationReason;
  title: string;
  message: string;
  /** Plain next steps for the person looking at the widget. */
  suggestions: string[];
}

export type MetricFormat = 'number' | 'percent' | 'duration';

/** What a frontend needs to draw one widget. No component or framework names. */
export type ViewModel =
  | {
      kind: 'bar';
      horizontal: boolean;
      data: { category: string; value: number }[];
      notice?: string;
    }
  | {
      kind: 'pie';
      data: { category: string; value: number }[];
      notice?: string;
    }
  | {
      kind: 'line';
      data: { x: string | number; value: number }[];
      notice?: string;
    }
  | {
      kind: 'metric';
      label: string;
      value: number | null;
      format: MetricFormat;
      notice?: string;
    }
  | Explanation;

export interface ViewModelOptions {
  /** Most bars drawn. Defaults to 50. */
  maxBars?: number;
  /** Most line points drawn. Defaults to 500. */
  maxPoints?: number;
}

const NO_CATEGORY = '(none)';

const isNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

const asNumber = (v: unknown): number => (isNumber(v) ? v : Number.NaN);

const asCategory = (v: unknown): string =>
  v === null || v === undefined || v === '' ? NO_CATEGORY : String(v);

const asX = (v: unknown): string | number => {
  if (isNumber(v)) return v;
  return v === null || v === undefined ? NO_CATEGORY : String(v);
};

/** Joins pipeline warnings into one short sentence, or nothing when complete. */
export function noticeFrom(result: PipelineResult): string | undefined {
  if (!result.truncated && result.warnings.length === 0) return undefined;
  return result.warnings.join(' ') || 'Results are partial.';
}

const noData = (what: string): Explanation => ({
  kind: 'explanation',
  reason: 'no_data',
  title: 'No data to show',
  message: `There is nothing to show for ${what} yet.`,
  suggestions: ['Check again after something has been deployed or has run.'],
});

const badData = (what: string): Explanation => ({
  kind: 'explanation',
  reason: 'bad_data',
  title: 'This data cannot be charted',
  message: `${what} did not contain numbers to show.`,
  suggestions: ['Try a different widget for this data.'],
});

/**
 * Turns an already validated view and its rows into something drawable. It
 * never throws: whatever goes wrong becomes an Explanation.
 */
export function toViewModel(
  view: ViewT,
  rows: readonly Row[],
  options: ViewModelOptions = {},
): ViewModel {
  const maxBars = options.maxBars ?? 50;
  const maxPoints = options.maxPoints ?? 500;

  switch (view.kind) {
    case 'chart': {
      const { chartType, orientation, encoding } = view.props;
      if (rows.length === 0) return noData('this chart');

      if (chartType === 'line') {
        const field = encoding.x ?? encoding.category;
        const points = rows.map(r => ({
          x: asX(field ? getPath(r, field) : undefined),
          value: asNumber(getPath(r, encoding.value)),
        }));
        if (!points.some(p => Number.isFinite(p.value))) {
          return badData('The line chart data');
        }
        const shown = points.slice(0, maxPoints);
        return {
          kind: 'line',
          data: shown,
          notice:
            points.length > shown.length
              ? `Showing the first ${shown.length} of ${points.length} points.`
              : undefined,
        };
      }

      const field = encoding.category ?? encoding.x;
      const all = rows.map(r => ({
        category: asCategory(field ? getPath(r, field) : undefined),
        value: asNumber(getPath(r, encoding.value)),
      }));
      if (!all.some(d => Number.isFinite(d.value))) {
        return badData('The chart data');
      }
      if (chartType === 'pie') return { kind: 'pie', data: all };
      const shown = all.slice(0, maxBars);
      return {
        kind: 'bar',
        horizontal: orientation === 'horizontal',
        data: shown,
        notice:
          all.length > shown.length
            ? `Showing the first ${shown.length} of ${all.length} bars.`
            : undefined,
      };
    }

    case 'metric': {
      if (rows.length === 0) return noData(view.props.label);
      const raw = getPath(rows[0], view.props.value);
      return {
        kind: 'metric',
        label: view.props.label,
        value: isNumber(raw) ? raw : null,
        format: view.props.format ?? 'number',
      };
    }

    default:
      return {
        kind: 'explanation',
        reason: 'unsupported_view',
        title: 'This widget type is not available yet',
        message: `Widgets that show a ${
          view.kind === 'table' ? 'table' : 'status list'
        } are coming in a later release.`,
        suggestions: ['Try asking for a chart or a single number instead.'],
      };
  }
}

/** The full step from a finished pipeline run to something drawable. */
export function buildViewModel(
  view: ViewT,
  result: PipelineResult,
  options: ViewModelOptions = {},
): ViewModel {
  const model = toViewModel(view, result.rows, options);
  const notice = noticeFrom(result);
  if (model.kind === 'explanation' || !notice) return model;
  return { ...model, notice: [model.notice, notice].filter(Boolean).join(' ') };
}

/** Plain-language version of a pipeline error code. */
export function explainPipelineError(
  code: 'forbidden' | 'fetch_failed' | 'bad_spec',
  message: string,
): Explanation {
  if (code === 'forbidden') {
    return {
      kind: 'explanation',
      reason: 'forbidden',
      title: 'You do not have access to this data',
      message,
      suggestions: ['Ask an administrator for access, or remove this widget.'],
    };
  }
  if (code === 'fetch_failed') {
    return {
      kind: 'explanation',
      reason: 'fetch_failed',
      title: 'The data could not be loaded',
      message,
      suggestions: ['Try again in a moment.'],
    };
  }
  return {
    kind: 'explanation',
    reason: 'invalid_spec',
    title: 'This widget can no longer be shown',
    message,
    suggestions: ['Remove it and create it again.'],
  };
}

/** Plain-language version of validation problems with a saved or new spec. */
export function explainIssues(issues: readonly Issue[]): Explanation {
  const first = issues[0];
  const extra = issues.length > 1 ? ` (and ${issues.length - 1} more)` : '';
  return {
    kind: 'explanation',
    reason: 'invalid_spec',
    title: 'This widget can no longer be shown',
    message: first ? `${first.message}${extra}` : 'The widget is not valid.',
    suggestions: [
      'The data it needs may have changed. Remove it and create it again.',
    ],
  };
}
