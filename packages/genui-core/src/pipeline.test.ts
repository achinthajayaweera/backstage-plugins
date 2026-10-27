import { seedCatalog } from './catalog';
import { MOCK_NOW, mockFetchPage } from './mocks';
import { PipelineError, PipelineDeps, runPipeline } from './pipeline';
import { MockName, specOf } from './testUtils';

const run = (name: MockName, extra: Partial<PipelineDeps> = {}) =>
  runPipeline(specOf(name), seedCatalog, {
    namespaces: ['default'],
    fetchPage: mockFetchPage(2),
    now: MOCK_NOW,
    ...extra,
  });

const forbidden = async () => {
  throw Object.assign(new Error('no'), { status: 403 });
};

describe('runPipeline', () => {
  it('bar: filters by relative time, groups, counts and sorts', async () => {
    const result = await run('barRunsByWorkflow');
    expect(result.rows).toEqual([
      { workflow: 'buildpack', runs: 5 },
      { workflow: 'docker-build', runs: 3 },
    ]); // the 45-day-old run is excluded
    expect(result.calls).toBe(5); // 9 rows served 2 at a time
  });

  it('line: buckets by day and sorts ascending', async () => {
    const result = await run('lineRunsPerDay');
    const days = result.rows.map(r => r.day);
    expect([...days].sort()).toEqual(days);
    expect(result.rows.reduce((sum, r) => sum + r.runs, 0)).toBe(7);
  });

  it('multi-endpoint: a left join keeps projects with zero components', async () => {
    const result = await run('pieComponentsPerProject');
    expect(
      Object.fromEntries(result.rows.map(r => [r.project, r.components])),
    ).toEqual({ shop: 2, billing: 1, 'empty-proj': 0 });
  });

  it('metric and table', async () => {
    expect((await run('metricProjectCount')).rows).toEqual([{ total: 3 }]);
    const table = await run('tableComponents');
    expect(table.rows.map(r => r.project)).toEqual(['billing', 'shop', 'shop']);
  });

  it('a global count over no rows still yields one zero row', async () => {
    const result = await run('metricProjectCount', {
      fetchPage: async () => ({ items: [] }),
    });
    expect(result.rows).toEqual([{ total: 0 }]);
  });

  it('enforces row and call caps and reports truncation', async () => {
    const rowCapped = await run('tableComponents', {
      limits: { maxRowsPerSource: 2 },
    });
    expect(rowCapped.truncated).toBe(true);
    expect(rowCapped.rows).toHaveLength(2);

    const callCapped = await run('barRunsByWorkflow', {
      limits: { maxCalls: 2 },
    });
    expect(callCapped.truncated).toBe(true);
    expect(callCapped.calls).toBe(2);
  });

  it('only queries the first maxNamespaces namespaces', async () => {
    const result = await run('metricProjectCount', {
      namespaces: ['a', 'b', 'c'],
      limits: { maxNamespaces: 2 },
      fetchPage: mockFetchPage(10),
    });
    expect(result.truncated).toBe(true);
    expect(result.calls).toBe(2);
  });

  it('maps a 403 everywhere to a typed forbidden error', async () => {
    await expect(
      run('metricProjectCount', { fetchPage: forbidden }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('skips a forbidden namespace and warns, when others succeed', async () => {
    const mixed: PipelineDeps['fetchPage'] = (ep, query, ns, cursor) =>
      ns === 'secret' ? forbidden() : mockFetchPage(10)(ep, query, ns, cursor);
    const result = await run('metricProjectCount', {
      namespaces: ['default', 'secret'],
      fetchPage: mixed,
    });
    expect(result.rows).toEqual([{ total: 3 }]);
    expect(result.warnings.join()).toMatch(/Not permitted/);
  });

  it('wraps other fetch failures in a PipelineError', async () => {
    const boom = async () => {
      throw new Error('boom');
    };
    await expect(
      run('metricProjectCount', { fetchPage: boom }),
    ).rejects.toBeInstanceOf(PipelineError);
  });
});
