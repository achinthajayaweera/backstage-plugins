import type { StepT } from './spec';
import { agoToMs, assertNever, getPath, outName, Row } from './paths';

export interface TransformCtx {
  now: number;
  datasets: Map<string, Row[]>;
}

const ISO = /^\d{4}-\d{2}-\d{2}/;
const isNil = (v: unknown) => v === undefined || v === null;

function cmpValues(a: any, b: any): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') {
    if (ISO.test(a) && ISO.test(b)) return Date.parse(a) - Date.parse(b);
    if (a < b) return -1;
    return a > b ? 1 : 0;
  }
  return NaN;
}

function matches(
  row: Row,
  args: Extract<StepT, { op: 'filter' }>['args'],
  now: number,
) {
  const v = getPath(row, args.field);
  if (args.cmp === 'exists') return !isNil(v);
  if (isNil(v)) return false;
  const target: any = args.value;
  if (target && typeof target === 'object' && !Array.isArray(target)) {
    // {ago: "30d"} compares as a point in time
    const t = typeof v === 'string' ? Date.parse(v) : NaN;
    const limit = now - agoToMs(target.ago);
    switch (args.cmp) {
      case 'gt':
        return t > limit;
      case 'gte':
        return t >= limit;
      case 'lt':
        return t < limit;
      case 'lte':
        return t <= limit;
      default:
        return false;
    }
  }
  switch (args.cmp) {
    case 'eq':
      return v === target;
    case 'ne':
      return v !== target;
    case 'in':
      return Array.isArray(target) && target.includes(v);
    case 'contains':
      return (
        typeof v === 'string' &&
        typeof target === 'string' &&
        v.toLowerCase().includes(target.toLowerCase())
      );
    default: {
      const c = cmpValues(v, target);
      if (Number.isNaN(c)) return false;
      if (args.cmp === 'gt') return c > 0;
      if (args.cmp === 'gte') return c >= 0;
      if (args.cmp === 'lt') return c < 0;
      return c <= 0;
    }
  }
}

function bucket(
  iso: string,
  interval: 'hour' | 'day' | 'week',
): string | undefined {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  const d = new Date(t);
  if (interval === 'hour') return `${d.toISOString().slice(0, 13)}:00Z`;
  if (interval === 'day') return d.toISOString().slice(0, 10);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day),
  )
    .toISOString()
    .slice(0, 10);
}

export function applyStep(step: StepT, rows: Row[], ctx: TransformCtx): Row[] {
  switch (step.op) {
    case 'filter':
      return rows.filter(r => matches(r, step.args, ctx.now));

    case 'select':
      return rows.map(r =>
        Object.fromEntries(
          step.args.fields.map(f => [f.as, getPath(r, f.path)]),
        ),
      );

    case 'aggregate': {
      const { by, measures } = step.args;
      const groups = new Map<string, Row[]>();
      for (const r of rows) {
        const key = JSON.stringify(by.map(b => getPath(r, b.field) ?? null));
        (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
      }
      if (by.length === 0 && groups.size === 0) groups.set('[]', []);
      return [...groups.values()].map(g => {
        const out: Row = {};
        by.forEach(
          b =>
            (out[outName(b.field, b.as)] = g[0]
              ? getPath(g[0], b.field)
              : undefined),
        );
        for (const m of measures) {
          const vals = m.field
            ? g.map(r => getPath(r, m.field!)).filter(v => !isNil(v))
            : g;
          const nums = (vals as any[]).filter(
            v => typeof v === 'number' && Number.isFinite(v),
          ) as number[];
          switch (m.fn) {
            case 'count':
              out[m.as] = vals.length;
              break;
            case 'sum':
              out[m.as] = nums.reduce((a, b) => a + b, 0);
              break;
            case 'avg':
              out[m.as] = nums.length
                ? nums.reduce((a, b) => a + b, 0) / nums.length
                : undefined;
              break;
            case 'min':
              out[m.as] = (vals as any[]).reduce(
                (a, b) => (a === undefined || cmpValues(b, a) < 0 ? b : a),
                undefined,
              );
              break;
            case 'max':
              out[m.as] = (vals as any[]).reduce(
                (a, b) => (a === undefined || cmpValues(b, a) > 0 ? b : a),
                undefined,
              );
              break;
            default:
              assertNever(m.fn);
          }
        }
        return out;
      });
    }

    case 'sortBy': {
      const dir = step.args.dir === 'asc' ? 1 : -1;
      return [...rows].sort((a, b) => {
        const x = getPath(a, step.args.field);
        const y = getPath(b, step.args.field);
        if (isNil(x) && isNil(y)) return 0;
        if (isNil(x)) return 1; // missing values always last
        if (isNil(y)) return -1;
        const c = cmpValues(x, y);
        return Number.isNaN(c) ? 0 : c * dir;
      });
    }

    case 'limit':
      return rows.slice(0, step.args.n);

    case 'bucketByTime':
      return rows.map(r => {
        const v = getPath(r, step.args.field);
        return {
          ...r,
          [step.args.as]:
            typeof v === 'string' ? bucket(v, step.args.interval) : undefined,
        };
      });

    case 'join': {
      const right = ctx.datasets.get(step.args.with) ?? [];
      const index = new Map<unknown, Row[]>();
      for (const r of right) {
        const k = getPath(r, step.args.on.right);
        if (isNil(k)) continue;
        (index.get(k) ?? index.set(k, []).get(k)!).push(r);
      }
      const out: Row[] = [];
      for (const l of rows) {
        const hits = index.get(getPath(l, step.args.on.left)) ?? [];
        if (hits.length)
          hits.forEach(h => out.push({ ...l, [step.args.with]: h }));
        else if (step.args.kind === 'left') out.push({ ...l });
      }
      return out;
    }

    default:
      return assertNever(step);
  }
}
