import { catalogWithDeployments } from './deployments';
import { deploymentFetchPage, deploymentSpecs } from './deployments.fixtures';
import { MOCK_NOW } from './mocks';
import { runPipeline } from './pipeline';
import type { PipelineResult } from './pipeline';
import {
  buildViewModel,
  explainIssues,
  explainPipelineError,
  noticeFrom,
  toViewModel,
} from './viewModel';

const chart = (
  chartType: 'bar' | 'pie' | 'line',
  encoding: Record<string, string>,
  orientation?: 'horizontal' | 'vertical',
) =>
  ({
    kind: 'chart',
    props: { chartType, encoding, ...(orientation ? { orientation } : {}) },
  } as any);

const metric = (value = 'total', format?: string) =>
  ({
    kind: 'metric',
    props: { label: 'Runs', value, ...(format ? { format } : {}) },
  } as any);

const result = (
  rows: any[],
  extra: Partial<PipelineResult> = {},
): PipelineResult => ({
  rows,
  truncated: false,
  calls: 1,
  warnings: [],
  ...extra,
});

describe('bar charts', () => {
  const view = chart('bar', { category: 'env', value: 'n' }, 'horizontal');

  it('maps rows to categories and values and keeps their order', () => {
    const model = toViewModel(view, [
      { env: 'dev', n: 4 },
      { env: 'prod', n: 2 },
    ]);
    expect(model).toEqual({
      kind: 'bar',
      horizontal: true,
      data: [
        { category: 'dev', value: 4 },
        { category: 'prod', value: 2 },
      ],
    });
  });

  it('is vertical unless asked otherwise', () => {
    const model = toViewModel(chart('bar', { category: 'env', value: 'n' }), [
      { env: 'a', n: 1 },
    ]);
    expect((model as any).horizontal).toBe(false);
  });

  it('labels a missing category instead of dropping the row', () => {
    const model = toViewModel(view, [
      { env: null, n: 3 },
      { n: 1 },
      { env: '', n: 2 },
    ]);
    expect((model as any).data.map((d: any) => d.category)).toEqual([
      '(none)',
      '(none)',
      '(none)',
    ]);
  });

  it('accepts x as the category field', () => {
    const model = toViewModel(chart('bar', { x: 'env', value: 'n' }), [
      { env: 'dev', n: 4 },
    ]);
    expect((model as any).data).toEqual([{ category: 'dev', value: 4 }]);
  });

  it('explains when there is no data', () => {
    const model = toViewModel(view, []);
    expect(model.kind).toBe('explanation');
    expect((model as any).reason).toBe('no_data');
  });

  it('explains when no value is a number', () => {
    const model = toViewModel(view, [
      { env: 'a', n: 'many' },
      { env: 'b', n: null },
    ]);
    expect((model as any).reason).toBe('bad_data');
  });

  it('keeps rows with a bad value, for the chart to skip', () => {
    const model = toViewModel(view, [
      { env: 'a', n: 2 },
      { env: 'b', n: 'x' },
    ]);
    expect((model as any).data).toHaveLength(2);
    expect(Number.isNaN((model as any).data[1].value)).toBe(true);
  });

  it('shows only the first bars and says so', () => {
    const rows = Array.from({ length: 80 }, (_, i) => ({ env: `e${i}`, n: i }));
    const model = toViewModel(view, rows) as any;
    expect(model.data).toHaveLength(50);
    expect(model.notice).toBe('Showing the first 50 of 80 bars.');
  });
});

describe('pie and line charts', () => {
  it('maps a pie chart', () => {
    const model = toViewModel(
      chart('pie', { category: 'status', value: 'n' }),
      [
        { status: 'Ready', n: 7 },
        { status: 'NotReady', n: 1 },
      ],
    );
    expect(model).toEqual({
      kind: 'pie',
      data: [
        { category: 'Ready', value: 7 },
        { category: 'NotReady', value: 1 },
      ],
    });
  });

  it('maps a line chart, keeping text and number x values', () => {
    const model = toViewModel(chart('line', { x: 'day', value: 'n' }), [
      { day: '2026-10-25', n: 1 },
      { day: 7, n: 2 },
    ]);
    expect(model).toEqual({
      kind: 'line',
      data: [
        { x: '2026-10-25', value: 1 },
        { x: 7, value: 2 },
      ],
    });
  });

  it('uses category as the x field when only that is given', () => {
    const model = toViewModel(chart('line', { category: 'day', value: 'n' }), [
      { day: 'a', n: 1 },
    ]);
    expect((model as any).data).toEqual([{ x: 'a', value: 1 }]);
  });

  it('shows only the first points and says so', () => {
    const rows = Array.from({ length: 600 }, (_, i) => ({ day: i, n: i }));
    const model = toViewModel(chart('line', { x: 'day', value: 'n' }), rows, {
      maxPoints: 100,
    }) as any;
    expect(model.data).toHaveLength(100);
    expect(model.notice).toBe('Showing the first 100 of 600 points.');
  });
});

describe('metrics', () => {
  it('reads the first row', () => {
    expect(toViewModel(metric(), [{ total: 8 }])).toEqual({
      kind: 'metric',
      label: 'Runs',
      value: 8,
      format: 'number',
    });
  });

  it('passes the format on', () => {
    expect(
      (toViewModel(metric('rate', 'percent'), [{ rate: 0.5 }]) as any).format,
    ).toBe('percent');
  });

  it('shows no number rather than a wrong one', () => {
    expect((toViewModel(metric(), [{ total: 'lots' }]) as any).value).toBe(
      null,
    );
    expect((toViewModel(metric(), [{}]) as any).value).toBe(null);
  });

  it('explains when there are no rows', () => {
    expect((toViewModel(metric(), []) as any).reason).toBe('no_data');
  });
});

describe('widget types that are not built yet', () => {
  it.each(['table', 'statusList'])('explains clearly for %s', kind => {
    const model = toViewModel({ kind, props: {} } as any, [{ a: 1 }]);
    expect(model.kind).toBe('explanation');
    expect((model as any).reason).toBe('unsupported_view');
    expect((model as any).suggestions).toHaveLength(1);
  });
});

describe('notices and errors', () => {
  it('has no notice for a complete result', () => {
    expect(noticeFrom(result([]))).toBe(undefined);
  });

  it('adds the pipeline warnings as a notice', () => {
    const model = buildViewModel(
      chart('bar', { category: 'env', value: 'n' }),
      result([{ env: 'a', n: 1 }], {
        truncated: true,
        warnings: ['Call limit reached; results are partial.'],
      }),
    ) as any;
    expect(model.notice).toBe('Call limit reached; results are partial.');
  });

  it('keeps both notices when there are two', () => {
    const rows = Array.from({ length: 80 }, (_, i) => ({ env: `e${i}`, n: i }));
    const model = buildViewModel(
      chart('bar', { category: 'env', value: 'n' }),
      result(rows, { truncated: true, warnings: ['Partial.'] }),
    ) as any;
    expect(model.notice).toBe('Showing the first 50 of 80 bars. Partial.');
  });

  it('never adds a notice to an explanation', () => {
    const model = buildViewModel(
      metric(),
      result([], { truncated: true, warnings: ['Partial.'] }),
    );
    expect(model.kind).toBe('explanation');
    expect('notice' in model).toBe(false);
  });

  it('explains each pipeline error code', () => {
    expect(explainPipelineError('forbidden', 'No.').reason).toBe('forbidden');
    expect(explainPipelineError('fetch_failed', 'Down.').reason).toBe(
      'fetch_failed',
    );
    expect(explainPipelineError('bad_spec', 'Odd.').reason).toBe(
      'invalid_spec',
    );
    expect(explainPipelineError('forbidden', 'No.').message).toBe('No.');
  });

  it('explains validation problems and counts the rest', () => {
    const one = explainIssues([
      { code: 'unknown_field', path: 'x', message: 'Unknown field.' },
    ]);
    expect(one.message).toBe('Unknown field.');
    const many = explainIssues([
      { code: 'unknown_field', path: 'x', message: 'Unknown field.' },
      { code: 'type_mismatch', path: 'y', message: 'Wrong type.' },
    ]);
    expect(many.message).toBe('Unknown field. (and 1 more)');
    expect(explainIssues([]).message).toBe('The widget is not valid.');
  });
});

describe('from a finished pipeline run to something drawable', () => {
  const build = async (name: keyof typeof deploymentSpecs) => {
    const spec = deploymentSpecs[name];
    const run = await runPipeline(spec, catalogWithDeployments, {
      namespaces: ['default'],
      fetchPage: deploymentFetchPage(),
      now: MOCK_NOW,
    });
    return buildViewModel(spec.view, run);
  };

  it('draws deployments per environment as a bar chart', async () => {
    expect(await build('byEnvironment')).toEqual({
      kind: 'bar',
      horizontal: true,
      data: [
        { category: 'dev', value: 4 },
        { category: 'staging', value: 3 },
        { category: 'prod', value: 2 },
      ],
    });
  });

  it('draws active deployments as one number', async () => {
    expect(await build('activeCount')).toEqual({
      kind: 'metric',
      label: 'Active deployments',
      value: 8,
      format: 'number',
    });
  });

  it('draws deployments per day as a line', async () => {
    const model = (await build('perDay')) as any;
    expect(model.kind).toBe('line');
    expect(model.data[model.data.length - 1]).toEqual({
      x: '2026-10-26',
      value: 2,
    });
  });

  it('draws deployments by status as a pie chart', async () => {
    const model = (await build('byStatus')) as any;
    expect(model.kind).toBe('pie');
    expect(model.data).toHaveLength(3);
  });

  it('explains the table that cannot be drawn yet', async () => {
    expect(((await build('recentTable')) as any).reason).toBe(
      'unsupported_view',
    );
  });
});
