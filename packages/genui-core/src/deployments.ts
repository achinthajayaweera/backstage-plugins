import { CatalogEndpoint, seedCatalog } from './catalog';
import { getPath, Row } from './paths';

/** Overall state of one deployment, read from its Ready condition. */
export type DeploymentStatus = 'Ready' | 'NotReady' | 'Unknown';

/**
 * A condition of type Ready with status True is Ready, False is NotReady.
 * Anything else (no Ready condition, or an Unknown one) is Unknown.
 */
export function deploymentStatus(row: Row): DeploymentStatus {
  const conditions = getPath(row, 'status.conditions');
  const ready = Array.isArray(conditions)
    ? conditions.find(c => c?.type === 'Ready')
    : undefined;
  if (ready?.status === 'True') return 'Ready';
  if (ready?.status === 'False') return 'NotReady';
  return 'Unknown';
}

/**
 * Adds the fields a release binding cannot offer as a plain path:
 * `derived.status`, `derived.ready`, and `derived.deployedAt` (the last spec
 * update, or the creation time when there has been no update). Returns a new
 * row and leaves the original untouched.
 */
export function deriveReleaseBinding(row: Row): Row {
  const status = deploymentStatus(row);
  return {
    ...row,
    derived: {
      ...(row.derived ?? {}),
      status,
      ready: status === 'Ready',
      deployedAt:
        getPath(row, 'status.lastSpecUpdateTime') ??
        getPath(row, 'metadata.creationTimestamp') ??
        null,
    },
  };
}

/**
 * A deployment in OpenChoreo is a release binding: a component release bound
 * to an environment. Paths were read from openchoreo-api.yaml.
 */
export const releaseBindingEndpoint: CatalogEndpoint = {
  id: 'releaseBindings.list',
  module: 'core',
  description:
    'Deployments: release bindings (a component release bound to an environment) in a namespace',
  scope: 'namespace',
  method: 'GET',
  operationId: 'listReleaseBindings',
  paginated: true,
  params: { labelSelector: 'string' },
  fields: {
    'metadata.name': 'string',
    'metadata.namespace': 'string',
    'metadata.creationTimestamp': 'time',
    'spec.owner.projectName': 'string',
    'spec.owner.componentName': 'string',
    'spec.environment': 'string',
    'spec.releaseName': 'string',
    'spec.state': 'string',
    'status.lastSpecUpdateTime': 'time',
    'derived.status': 'string',
    'derived.ready': 'boolean',
    'derived.deployedAt': 'time',
  },
  derive: deriveReleaseBinding,
};

/** The seed catalog plus deployments. */
export const catalogWithDeployments: CatalogEndpoint[] = [
  ...seedCatalog,
  releaseBindingEndpoint,
];
