import {
  catalogWithDeployments,
  deriveReleaseBinding,
  deploymentStatus,
  releaseBindingEndpoint,
} from './deployments';
import {
  deploymentFetchPage,
  deploymentRows,
  deploymentSpecs,
} from './deployments.fixtures';
import { seedCatalog } from './catalog';
import { MOCK_NOW } from './mocks';
import { PipelineError, runPipeline } from './pipeline';
import { WidgetSpec } from './spec';
import { validateSpec } from './validate';
import type { Row } from './paths';

const run = (name: keyof typeof deploymentSpecs, namespaces = ['default']) =>
  runPipeline(deploymentSpecs[name], catalogWithDeployments, {
    namespaces,
    fetchPage: deploymentFetchPage(),
    now: MOCK_NOW,
  });

const withConditions = (conditions: unknown): Row => ({
  metadata: { name: 'x', creationTimestamp: '2026-01-01T00:00:00Z' },
  status: { conditions },
});

describe('deploymentStatus', () => {
  it('reads the Ready condition', () => {
    expect(
      deploymentStatus(withConditions([{ type: 'Ready', status: 'True' }])),
    ).toBe('Ready');
    expect(
      deploymentStatus(withConditions([{ type: 'Ready', status: 'False' }])),
    ).toBe('NotReady');
    expect(
      deploymentStatus(withConditions([{ type: 'Ready', status: 'Unknown' }])),
    ).toBe('Unknown');
  });

  it('is Unknown without a Ready condition', () => {
    expect(deploymentStatus(withConditions([]))).toBe('Unknown');
    expect(deploymentStatus(withConditions(undefined))).toBe('Unknown');
    expect(
      deploymentStatus(withConditions([{ type: 'Synced', status: 'True' }])),
    ).toBe('Unknown');
  });

  it('finds Ready among other conditions', () => {
    const row = withConditions([
      { type: 'Synced', status: 'False' },
      { type: 'Ready', status: 'True' },
    ]);
    expect(deploymentStatus(row)).toBe('Ready');
  });
});

describe('deriveReleaseBinding', () => {
  it('adds status, ready and deployedAt under derived', () => {
    const row = deriveReleaseBinding({
      ...withConditions([{ type: 'Ready', status: 'True' }]),
      status: {
        lastSpecUpdateTime: '2026-10-01T00:00:00Z',
        conditions: [{ type: 'Ready', status: 'True' }],
      },
    });
    expect(row.derived).toEqual({
      status: 'Ready',
      ready: true,
      deployedAt: '2026-10-01T00:00:00Z',
    });
  });

  it('falls back to the creation time, then to null', () => {
    expect(deriveReleaseBinding(withConditions([])).derived.deployedAt).toBe(
      '2026-01-01T00:00:00Z',
    );
    expect(deriveReleaseBinding({ status: {} }).derived.deployedAt).toBe(null);
  });

  it('keeps the original fields and does not change the input', () => {
    const input = withConditions([{ type: 'Ready', status: 'False' }]);
    const copy = JSON.parse(JSON.stringify(input));
    const out = deriveReleaseBinding(input);
    expect(out.metadata).toEqual(input.metadata);
    expect(out.derived.ready).toBe(false);
    expect(input).toEqual(copy);
  });
});

describe('catalog with deployments', () => {
  it('adds one endpoint and leaves the seed catalog unchanged', () => {
    expect(catalogWithDeployments).toHaveLength(seedCatalog.length + 1);
    expect(catalogWithDeployments[catalogWithDeployments.length - 1]).toBe(
      releaseBindingEndpoint,
    );
  });

  it('offers the derived fields to specs', () => {
    expect(releaseBindingEndpoint.fields['derived.status']).toBe('string');
    expect(releaseBindingEndpoint.fields['derived.ready']).toBe('boolean');
    expect(releaseBindingEndpoint.fields['derived.deployedAt']).toBe('time');
  });
});

describe('deployment specs', () => {
  it.each(Object.keys(deploymentSpecs) as (keyof typeof deploymentSpecs)[])(
    'passes the schema and the catalog check: %s',
    name => {
      expect(WidgetSpec.safeParse(deploymentSpecs[name]).success).toBe(true);
      expect(
        validateSpec(deploymentSpecs[name], catalogWithDeployments),
      ).toEqual([]);
    },
  );

  it('are rejected against the seed catalog, which has no deployments', () => {
    const issues = validateSpec(deploymentSpecs.byEnvironment, seedCatalog);
    expect(issues[0].code).toBe('unknown_endpoint');
  });
});

describe('running the deployment specs', () => {
  it('counts deployments per environment, largest first', async () => {
    const { rows } = await run('byEnvironment');
    expect(rows).toEqual([
      { environment: 'dev', deployments: 4 },
      { environment: 'staging', deployments: 3 },
      { environment: 'prod', deployments: 2 },
    ]);
  });

  it('counts only active deployments', async () => {
    expect((await run('activeCount')).rows).toEqual([{ total: 8 }]);
  });

  it('counts deployments per day over two weeks, using the creation time when never updated', async () => {
    const { rows } = await run('perDay');
    expect(rows).toEqual([
      { day: '2026-10-16', deployments: 1 },
      { day: '2026-10-21', deployments: 1 },
      { day: '2026-10-23', deployments: 1 },
      { day: '2026-10-24', deployments: 1 },
      { day: '2026-10-25', deployments: 1 },
      { day: '2026-10-26', deployments: 2 },
    ]);
  });

  it('counts deployments by status', async () => {
    const { rows } = await run('byStatus');
    const byStatus = Object.fromEntries(
      rows.map(r => [r.status, r.deployments]),
    );
    expect(byStatus).toEqual({ Ready: 7, NotReady: 1, Unknown: 1 });
  });

  it('lists the newest deployments first', async () => {
    const { rows } = await run('recentTable');
    expect(rows.map(r => `${r.component}/${r.environment}`)).toEqual([
      'invoices/dev',
      'cart/dev',
      'checkout/dev',
      'cart/staging',
      'checkout/staging',
    ]);
    expect(rows[2].status).toBe('NotReady');
  });

  it('reads every page, however small', async () => {
    const result = await runPipeline(
      deploymentSpecs.activeCount,
      catalogWithDeployments,
      {
        namespaces: ['default'],
        fetchPage: deploymentFetchPage(deploymentRows, 2),
        now: MOCK_NOW,
      },
    );
    expect(result.rows).toEqual([{ total: 8 }]);
    expect(result.calls).toBe(5);
  });

  it('asks once per namespace, because deployments are namespace scoped', async () => {
    const one = await run('activeCount', ['default']);
    const two = await run('activeCount', ['default', 'other']);
    expect(two.calls).toBe(one.calls * 2);
    expect(two.rows).toEqual([{ total: 16 }]);
  });

  it('gives the same result every time for the same spec and data', async () => {
    const first = JSON.stringify((await run('perDay')).rows);
    for (let i = 0; i < 100; i++) {
      expect(JSON.stringify((await run('perDay')).rows)).toBe(first);
    }
  });

  it('reports a permission error when every namespace is denied', async () => {
    let error: unknown;
    try {
      await runPipeline(deploymentSpecs.byEnvironment, catalogWithDeployments, {
        namespaces: ['default'],
        fetchPage: async () => {
          throw Object.assign(new Error('no'), { status: 403 });
        },
        now: MOCK_NOW,
      });
    } catch (e) {
      error = e;
    }
    expect(error instanceof PipelineError).toBe(true);
    expect((error as PipelineError).code).toBe('forbidden');
  });
});
