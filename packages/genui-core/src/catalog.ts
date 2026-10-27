export type FieldType = 'string' | 'number' | 'boolean' | 'time';

export interface CatalogEndpoint {
  id: string;
  /** Which optional OpenChoreo module must be installed. */
  module: 'core' | 'observability' | 'finops';
  description: string;
  /** "namespace" endpoints are called once per namespace the user can see. */
  scope: 'namespace' | 'global';
  /** Read-only is by operation, not by HTTP verb: the observability API reads via POST. */
  method: 'GET' | 'POST';
  operationId: string;
  paginated: boolean;
  /** Query params the LLM may set. Anything else (namespace, cursor, limit) is set by the binder. */
  params: Record<string, 'string' | 'number' | 'boolean'>;
  /** Flat dotted paths the LLM may reference, with their types. */
  fields: Record<string, FieldType>;
}

/**
 * Hand-written seed. Paths and params below were checked against
 * openchoreo-api.yaml; the real catalog will be generated from the specs.
 */
export const seedCatalog: CatalogEndpoint[] = [
  {
    id: 'projects.list',
    module: 'core',
    description: 'Projects in a namespace',
    scope: 'namespace',
    method: 'GET',
    operationId: 'listProjects',
    paginated: true,
    params: { labelSelector: 'string' },
    fields: {
      'metadata.name': 'string',
      'metadata.namespace': 'string',
      'metadata.creationTimestamp': 'time',
    },
  },
  {
    id: 'components.list',
    module: 'core',
    description: 'Components in a namespace, optionally for one project',
    scope: 'namespace',
    method: 'GET',
    operationId: 'listComponents',
    paginated: true,
    params: { project: 'string', labelSelector: 'string' },
    fields: {
      'metadata.name': 'string',
      'metadata.namespace': 'string',
      'metadata.creationTimestamp': 'time',
      'spec.owner.projectName': 'string',
      'spec.autoDeploy': 'boolean',
      'spec.autoBuild': 'boolean',
    },
  },
  {
    id: 'workflowRuns.list',
    module: 'core',
    description: 'Workflow runs in a namespace (no server-side time filter)',
    scope: 'namespace',
    method: 'GET',
    operationId: 'listWorkflowRuns',
    paginated: true,
    params: { workflow: 'string', labelSelector: 'string' },
    fields: {
      'metadata.name': 'string',
      'metadata.namespace': 'string',
      'metadata.creationTimestamp': 'time',
      'spec.workflow.name': 'string',
      'status.startedAt': 'time',
      'status.completedAt': 'time',
    },
  },
];

export const catalogById = (c: CatalogEndpoint[]) =>
  new Map(c.map(e => [e.id, e]));
