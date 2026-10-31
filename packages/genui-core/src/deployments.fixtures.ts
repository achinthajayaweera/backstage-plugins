/** Small deployment fixtures for tests and for building the renderer. */
import { MOCK_NOW } from './mocks';
import type { Page } from './pipeline';
import type { Row } from './paths';
import type { WidgetSpecT } from './spec';

const daysAgo = (d: number) => new Date(MOCK_NOW - d * 86400e3).toISOString();

type ReadyState = 'True' | 'False' | 'Unknown' | 'none';

const binding = (
  name: string,
  project: string,
  component: string,
  environment: string,
  release: string,
  state: 'Active' | 'Undeploy',
  ready: ReadyState,
  updatedDaysAgo: number | undefined,
  createdDaysAgo = 60,
): Row => ({
  metadata: {
    name,
    namespace: 'default',
    creationTimestamp: daysAgo(createdDaysAgo),
  },
  spec: {
    owner: { projectName: project, componentName: component },
    environment,
    releaseName: release,
    state,
  },
  status: {
    ...(updatedDaysAgo === undefined
      ? {}
      : { lastSpecUpdateTime: daysAgo(updatedDaysAgo) }),
    conditions:
      ready === 'none'
        ? []
        : [
            {
              type: 'Ready',
              status: ready,
              lastTransitionTime: daysAgo(updatedDaysAgo ?? createdDaysAgo),
              reason: ready === 'True' ? 'Reconciled' : 'NotReconciled',
            },
          ],
  },
});

/** Nine deployments across three projects and three environments. */
export const deploymentRows: Row[] = [
  binding('cart-dev', 'shop', 'cart', 'dev', 'v1', 'Active', 'True', 0.5),
  binding('cart-staging', 'shop', 'cart', 'staging', 'v1', 'Active', 'True', 2),
  binding('cart-prod', 'shop', 'cart', 'prod', 'v0', 'Active', 'True', 10),
  binding(
    'checkout-dev',
    'shop',
    'checkout',
    'dev',
    'v2',
    'Active',
    'False',
    1,
  ),
  binding(
    'checkout-staging',
    'shop',
    'checkout',
    'staging',
    'v1',
    'Active',
    'True',
    3,
  ),
  binding(
    'invoices-dev',
    'billing',
    'invoices',
    'dev',
    'v1',
    'Active',
    'True',
    0.25,
  ),
  binding(
    'invoices-staging',
    'billing',
    'invoices',
    'staging',
    'v0',
    'Undeploy',
    'none',
    20,
  ),
  binding(
    'invoices-prod',
    'billing',
    'invoices',
    'prod',
    'v3',
    'Active',
    'True',
    40,
  ),
  // Never updated: its deployment time falls back to its creation time.
  binding(
    'legacy-dev',
    'billing',
    'legacy-api',
    'dev',
    'v1',
    'Active',
    'True',
    undefined,
    5,
  ),
];

/** A fetchPage serving `rows` in pages of `pageSize`, for any namespace. */
export const deploymentFetchPage =
  (rows: Row[] = deploymentRows, pageSize = 4) =>
  async (
    _ep: { id: string },
    _query: Record<string, unknown>,
    _namespace: string | undefined,
    cursor?: string,
  ): Promise<Page> => {
    const start = cursor ? parseInt(cursor, 10) : 0;
    const end = start + pageSize;
    return {
      items: rows.slice(start, end),
      nextCursor: end < rows.length ? String(end) : undefined,
    };
  };

export type DeploymentSpecName =
  | 'byEnvironment'
  | 'activeCount'
  | 'perDay'
  | 'byStatus'
  | 'recentTable';

const source = [{ id: 'deployments', endpointId: 'releaseBindings.list' }];

export const deploymentSpecs: Record<DeploymentSpecName, WidgetSpecT> = {
  byEnvironment: {
    version: 1,
    title: 'Deployments per environment',
    sources: source,
    pipeline: [
      {
        op: 'aggregate',
        args: {
          by: [{ field: 'spec.environment', as: 'environment' }],
          measures: [{ fn: 'count', as: 'deployments' }],
        },
      },
      { op: 'sortBy', args: { field: 'deployments', dir: 'desc' } },
    ],
    view: {
      kind: 'chart',
      props: {
        chartType: 'bar',
        orientation: 'horizontal',
        encoding: { category: 'environment', value: 'deployments' },
      },
    },
  },
  activeCount: {
    version: 1,
    title: 'Active deployments',
    sources: source,
    pipeline: [
      {
        op: 'filter',
        args: { field: 'spec.state', cmp: 'eq', value: 'Active' },
      },
      {
        op: 'aggregate',
        args: { by: [], measures: [{ fn: 'count', as: 'total' }] },
      },
    ],
    view: {
      kind: 'metric',
      props: { label: 'Active deployments', value: 'total' },
    },
  },
  perDay: {
    version: 1,
    title: 'Deployments per day (14 days)',
    sources: source,
    pipeline: [
      {
        op: 'filter',
        args: {
          field: 'derived.deployedAt',
          cmp: 'gte',
          value: { ago: '2w' },
        },
      },
      {
        op: 'bucketByTime',
        args: { field: 'derived.deployedAt', interval: 'day', as: 'day' },
      },
      {
        op: 'aggregate',
        args: {
          by: [{ field: 'day' }],
          measures: [{ fn: 'count', as: 'deployments' }],
        },
      },
      { op: 'sortBy', args: { field: 'day', dir: 'asc' } },
    ],
    view: {
      kind: 'chart',
      props: {
        chartType: 'line',
        encoding: { x: 'day', value: 'deployments' },
      },
    },
  },
  byStatus: {
    version: 1,
    title: 'Deployments by status',
    sources: source,
    pipeline: [
      {
        op: 'aggregate',
        args: {
          by: [{ field: 'derived.status', as: 'status' }],
          measures: [{ fn: 'count', as: 'deployments' }],
        },
      },
    ],
    view: {
      kind: 'chart',
      props: {
        chartType: 'pie',
        encoding: { category: 'status', value: 'deployments' },
      },
    },
  },
  recentTable: {
    version: 1,
    title: 'Newest deployments',
    sources: source,
    pipeline: [
      { op: 'sortBy', args: { field: 'derived.deployedAt', dir: 'desc' } },
      { op: 'limit', args: { n: 5 } },
      {
        op: 'select',
        args: {
          fields: [
            { path: 'spec.owner.componentName', as: 'component' },
            { path: 'spec.environment', as: 'environment' },
            { path: 'spec.releaseName', as: 'release' },
            { path: 'derived.status', as: 'status' },
            { path: 'derived.deployedAt', as: 'deployedAt' },
          ],
        },
      },
    ],
    view: {
      kind: 'table',
      props: {
        columns: [
          { field: 'component', header: 'Component' },
          { field: 'environment', header: 'Environment' },
          { field: 'release', header: 'Release' },
          { field: 'status', header: 'Status' },
          { field: 'deployedAt', header: 'Deployed' },
        ],
      },
    },
  },
};
