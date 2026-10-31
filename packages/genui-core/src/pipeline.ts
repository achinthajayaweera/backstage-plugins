import { catalogById, CatalogEndpoint } from './catalog';
import type { Row } from './paths';
import type { WidgetSpecT } from './spec';
import { applyStep } from './transform';

export interface Page {
  items: Row[];
  nextCursor?: string;
}

export interface PipelineDeps {
  /** Namespaces the signed-in user can see. Namespace-scoped endpoints run once per entry. */
  namespaces: string[];
  /** One authenticated page fetch. Must throw {status} on HTTP errors. */
  fetchPage: (
    ep: CatalogEndpoint,
    query: Record<string, unknown>,
    namespace: string | undefined,
    cursor?: string,
  ) => Promise<Page>;
  now?: number;
  limits?: Partial<Limits>;
}
export interface Limits {
  maxNamespaces: number;
  maxCalls: number;
  maxRowsPerSource: number;
}
export const DEFAULT_LIMITS: Limits = {
  maxNamespaces: 10,
  maxCalls: 20,
  maxRowsPerSource: 5000,
};

export interface PipelineResult {
  rows: Row[];
  truncated: boolean;
  calls: number;
  warnings: string[];
}

export class PipelineError extends Error {
  constructor(
    public code: 'forbidden' | 'fetch_failed' | 'bad_spec',
    message: string,
  ) {
    super(message);
  }
}

/** Runs an already validated spec: fetch every source in parallel, then the transform steps. */
export async function runPipeline(
  spec: WidgetSpecT,
  catalog: CatalogEndpoint[],
  deps: PipelineDeps,
): Promise<PipelineResult> {
  const limits = { ...DEFAULT_LIMITS, ...deps.limits };
  const byId = catalogById(catalog);
  const warnings: string[] = [];
  let calls = 0;
  let truncated = false;

  const fetchSource = async (
    src: WidgetSpecT['sources'][number],
  ): Promise<[string, Row[]]> => {
    const ep = byId.get(src.endpointId);
    if (!ep)
      throw new PipelineError('bad_spec', `Unknown endpoint ${src.endpointId}`);
    const scopes = ep.scope === 'namespace' ? deps.namespaces : [undefined];
    if (scopes.length > limits.maxNamespaces) {
      truncated = true;
      warnings.push(
        `Only the first ${limits.maxNamespaces} namespaces were queried.`,
      );
    }
    const rows: Row[] = [];
    let denied = 0;
    for (const ns of scopes.slice(0, limits.maxNamespaces)) {
      let cursor: string | undefined;
      try {
        do {
          if (calls >= limits.maxCalls) {
            truncated = true;
            warnings.push('Call limit reached; results are partial.');
            break;
          }
          calls++;
          const page = await deps.fetchPage(
            ep,
            { ...(src.params ?? {}) },
            ns,
            cursor,
          );
          rows.push(...(ep.derive ? page.items.map(ep.derive) : page.items));
          cursor = ep.paginated ? page.nextCursor : undefined;
          if (rows.length >= limits.maxRowsPerSource) {
            truncated = true;
            warnings.push(
              `Row limit (${limits.maxRowsPerSource}) reached for ${src.id}; narrow by project or time.`,
            );
            rows.length = limits.maxRowsPerSource;
            cursor = undefined;
          }
        } while (cursor);
      } catch (e: any) {
        if (e?.status === 401 || e?.status === 403) {
          denied++;
          warnings.push(
            `Not permitted to read ${ep.id}${ns ? ` in ${ns}` : ''}.`,
          );
        } else
          throw new PipelineError(
            'fetch_failed',
            `Could not load ${ep.id}: ${e?.message ?? 'unknown error'}`,
          );
      }
    }
    if (denied && denied === Math.min(scopes.length, limits.maxNamespaces)) {
      throw new PipelineError(
        'forbidden',
        `You are not permitted to read ${ep.id}.`,
      );
    }
    return [src.id, rows];
  };

  const datasets = new Map<string, Row[]>(
    await Promise.all(spec.sources.map(fetchSource)),
  );
  const now = deps.now ?? Date.now();
  let cursor = spec.sources[0].id;
  for (const step of spec.pipeline) {
    const out = applyStep(step, datasets.get(step.from ?? cursor) ?? [], {
      now,
      datasets,
    });
    const into = step.into ?? 'result';
    datasets.set(into, out);
    cursor = into;
  }
  return { rows: datasets.get(cursor) ?? [], truncated, calls, warnings };
}
