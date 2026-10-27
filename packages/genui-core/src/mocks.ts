/** Fixtures for building and testing the renderer before any LLM is connected. */
import type { ComposeResponseT } from './spec';
import type { Page } from './pipeline';
import type { Row } from './paths';

export const MOCK_NOW = Date.parse('2026-10-26T12:00:00Z');
const daysAgo = (d: number) => new Date(MOCK_NOW - d * 86400e3).toISOString();

export const mockData: Record<string, Row[]> = {
  'projects.list': [
    {
      metadata: {
        name: 'shop',
        namespace: 'default',
        creationTimestamp: daysAgo(90),
      },
    },
    {
      metadata: {
        name: 'billing',
        namespace: 'default',
        creationTimestamp: daysAgo(60),
      },
    },
    {
      metadata: {
        name: 'empty-proj',
        namespace: 'default',
        creationTimestamp: daysAgo(2),
      },
    },
  ],
  'components.list': [
    {
      metadata: { name: 'cart', creationTimestamp: daysAgo(80) },
      spec: { owner: { projectName: 'shop' }, autoDeploy: true },
    },
    {
      metadata: { name: 'checkout', creationTimestamp: daysAgo(70) },
      spec: { owner: { projectName: 'shop' }, autoDeploy: false },
    },
    {
      metadata: { name: 'invoices', creationTimestamp: daysAgo(50) },
      spec: { owner: { projectName: 'billing' }, autoDeploy: true },
    },
  ],
  'workflowRuns.list': [
    ...[1, 1, 2, 3, 5, 8, 12, 20].map((d, i) => ({
      metadata: { name: `run-${i}`, creationTimestamp: daysAgo(d) },
      spec: { workflow: { name: i % 3 === 0 ? 'docker-build' : 'buildpack' } },
      status: { startedAt: daysAgo(d), completedAt: daysAgo(d - 0.01) },
    })),
    {
      metadata: { name: 'run-old', creationTimestamp: daysAgo(45) },
      spec: { workflow: { name: 'docker-build' } },
      status: { startedAt: daysAgo(45) },
    },
  ],
};

/** A fetchPage that serves mockData in pages of `pageSize`. */
export const mockFetchPage =
  (pageSize = 2) =>
  async (
    ep: { id: string },
    _q: Record<string, unknown>,
    _ns: string | undefined,
    cursor?: string,
  ): Promise<Page> => {
    const all = mockData[ep.id] ?? [];
    const start = cursor ? parseInt(cursor, 10) : 0;
    const end = start + pageSize;
    return {
      items: all.slice(start, end),
      nextCursor: end < all.length ? String(end) : undefined,
    };
  };

export const mockResponses: Record<string, ComposeResponseT> = {
  barRunsByWorkflow: {
    type: 'spec',
    spec: {
      version: 1,
      title: 'Workflow runs by workflow (30 days)',
      sources: [{ id: 'runs', endpointId: 'workflowRuns.list' }],
      pipeline: [
        {
          op: 'filter',
          args: {
            field: 'metadata.creationTimestamp',
            cmp: 'gte',
            value: { ago: '30d' },
          },
        },
        {
          op: 'aggregate',
          args: {
            by: [{ field: 'spec.workflow.name', as: 'workflow' }],
            measures: [{ fn: 'count', as: 'runs' }],
          },
        },
        { op: 'sortBy', args: { field: 'runs', dir: 'desc' } },
        { op: 'limit', args: { n: 10 } },
      ],
      view: {
        kind: 'chart',
        props: {
          chartType: 'bar',
          orientation: 'horizontal',
          encoding: { category: 'workflow', value: 'runs' },
        },
      },
    },
  },
  lineRunsPerDay: {
    type: 'spec',
    spec: {
      version: 1,
      title: 'Workflow runs per day (14 days)',
      sources: [{ id: 'runs', endpointId: 'workflowRuns.list' }],
      pipeline: [
        {
          op: 'filter',
          args: {
            field: 'metadata.creationTimestamp',
            cmp: 'gte',
            value: { ago: '2w' },
          },
        },
        {
          op: 'bucketByTime',
          args: {
            field: 'metadata.creationTimestamp',
            interval: 'day',
            as: 'day',
          },
        },
        {
          op: 'aggregate',
          args: {
            by: [{ field: 'day' }],
            measures: [{ fn: 'count', as: 'runs' }],
          },
        },
        { op: 'sortBy', args: { field: 'day', dir: 'asc' } },
      ],
      view: {
        kind: 'chart',
        props: { chartType: 'line', encoding: { x: 'day', value: 'runs' } },
      },
    },
  },
  // Two endpoints merged: projects LEFT JOIN components, so empty projects show as 0.
  pieComponentsPerProject: {
    type: 'spec',
    spec: {
      version: 1,
      title: 'Components per project',
      sources: [
        { id: 'projects', endpointId: 'projects.list' },
        { id: 'components', endpointId: 'components.list' },
      ],
      pipeline: [
        {
          op: 'join',
          from: 'projects',
          args: {
            with: 'components',
            kind: 'left',
            on: { left: 'metadata.name', right: 'spec.owner.projectName' },
          },
        },
        {
          op: 'aggregate',
          args: {
            by: [{ field: 'metadata.name', as: 'project' }],
            measures: [
              {
                fn: 'count',
                field: 'components.metadata.name',
                as: 'components',
              },
            ],
          },
        },
      ],
      view: {
        kind: 'chart',
        props: {
          chartType: 'pie',
          encoding: { category: 'project', value: 'components' },
        },
      },
    },
  },
  metricProjectCount: {
    type: 'spec',
    spec: {
      version: 1,
      title: 'Projects',
      sources: [{ id: 'projects', endpointId: 'projects.list' }],
      pipeline: [
        {
          op: 'aggregate',
          args: { by: [], measures: [{ fn: 'count', as: 'total' }] },
        },
      ],
      view: { kind: 'metric', props: { label: 'Projects', value: 'total' } },
    },
  },
  tableComponents: {
    type: 'spec',
    spec: {
      version: 1,
      title: 'Components',
      sources: [{ id: 'components', endpointId: 'components.list' }],
      pipeline: [
        {
          op: 'select',
          args: {
            fields: [
              { path: 'metadata.name', as: 'name' },
              { path: 'spec.owner.projectName', as: 'project' },
              { path: 'spec.autoDeploy', as: 'autoDeploy' },
            ],
          },
        },
        { op: 'sortBy', args: { field: 'project', dir: 'asc' } },
      ],
      view: {
        kind: 'table',
        props: {
          columns: [
            { field: 'name', header: 'Component' },
            { field: 'project', header: 'Project' },
            { field: 'autoDeploy', header: 'Auto deploy' },
          ],
        },
      },
    },
  },
  refusalNoData: {
    type: 'refusal',
    reason: 'no_data_source',
    message: 'CPU usage per component is not available from any supported API.',
    alternatives: ['Components per project', 'Workflow runs by workflow'],
  },
  clarifyMostActive: {
    type: 'clarify',
    question: 'What does "most active" mean?',
    options: ['Most workflow runs', 'Most components'],
  },
};
