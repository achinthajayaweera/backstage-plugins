import { catalogById, CatalogEndpoint, FieldType } from './catalog';
import { assertNever, outName } from './paths';
import type { StepT, ViewT, WidgetSpecT } from './spec';

export interface Issue {
  code:
    | 'unknown_endpoint'
    | 'module_missing'
    | 'unknown_param'
    | 'bad_param_type'
    | 'duplicate_alias'
    | 'unknown_dataset'
    | 'unknown_field'
    | 'type_mismatch'
    | 'shape_mismatch'
    | 'bad_relative_time';
  path: string;
  message: string;
}

type Schema = Map<string, FieldType>;
const numeric = (t?: FieldType) => t === 'number';
const labelish = (t?: FieldType) =>
  t === 'string' || t === 'time' || t === 'boolean';

/**
 * Layer 3 of the boundary design: static checks of a schema-valid spec against
 * the catalog. Pure and synchronous; messages are written for the LLM retry.
 */
export function validateSpec(
  spec: WidgetSpecT,
  catalog: CatalogEndpoint[],
  installedModules: ReadonlySet<string> = new Set(['core']),
): Issue[] {
  const issues: Issue[] = [];
  const add = (code: Issue['code'], path: string, message: string) =>
    issues.push({ code, path, message });
  const byId = catalogById(catalog);
  const datasets = new Map<string, Schema>();

  spec.sources.forEach((s, i) => {
    const p = `sources[${i}]`;
    if (datasets.has(s.id))
      add('duplicate_alias', `${p}.id`, `Dataset id "${s.id}" is used twice.`);
    const ep = byId.get(s.endpointId);
    if (!ep) {
      add(
        'unknown_endpoint',
        `${p}.endpointId`,
        `"${s.endpointId}" is not in the catalog. Allowed: ${[
          ...byId.keys(),
        ].join(', ')}.`,
      );
      datasets.set(s.id, new Map());
      return;
    }
    if (ep.module !== 'core' && !installedModules.has(ep.module)) {
      add(
        'module_missing',
        `${p}.endpointId`,
        `"${s.endpointId}" needs the ${ep.module} module, which is not installed.`,
      );
    }
    for (const [k, v] of Object.entries(s.params ?? {})) {
      const want = ep.params[k];
      if (!want)
        add(
          'unknown_param',
          `${p}.params.${k}`,
          `"${k}" is not a parameter of ${ep.id}. Allowed: ${
            Object.keys(ep.params).join(', ') || 'none'
          }.`,
        );
      else if (typeof v !== want)
        add('bad_param_type', `${p}.params.${k}`, `"${k}" must be a ${want}.`);
    }
    datasets.set(s.id, new Map(Object.entries(ep.fields)));
  });

  let cursor = spec.sources[0].id;

  spec.pipeline.forEach((step: StepT, i) => {
    const p = `pipeline[${i}]`;
    const from = step.from ?? cursor;
    const into = step.into ?? 'result';
    const inSchema = datasets.get(from);
    if (!inSchema) {
      add(
        'unknown_dataset',
        `${p}.from`,
        `Dataset "${from}" does not exist yet. Known: ${[
          ...datasets.keys(),
        ].join(', ')}.`,
      );
      datasets.set(into, new Map());
      cursor = into;
      return;
    }
    const need = (field: string, at: string): FieldType | undefined => {
      const t = inSchema.get(field);
      if (!t)
        add(
          'unknown_field',
          at,
          `Field "${field}" is not available in "${from}". Available: ${
            [...inSchema.keys()].join(', ') || 'none'
          }.`,
        );
      return t;
    };
    let out: Schema = inSchema;

    switch (step.op) {
      case 'filter': {
        const t = need(step.args.field, `${p}.args.field`);
        const v = step.args.value;
        if (
          v &&
          typeof v === 'object' &&
          !Array.isArray(v) &&
          t &&
          t !== 'time'
        ) {
          add(
            'bad_relative_time',
            `${p}.args.value`,
            `{ago} can only be used on time fields; "${step.args.field}" is ${t}.`,
          );
        }
        if (
          ['gt', 'gte', 'lt', 'lte'].includes(step.args.cmp) &&
          t === 'boolean'
        ) {
          add(
            'type_mismatch',
            `${p}.args.cmp`,
            `"${step.args.cmp}" cannot compare a boolean field.`,
          );
        }
        break;
      }
      case 'select': {
        out = new Map();
        step.args.fields.forEach((f, j) => {
          const t = need(f.path, `${p}.args.fields[${j}].path`);
          if (out.has(f.as))
            add(
              'duplicate_alias',
              `${p}.args.fields[${j}].as`,
              `Column "${f.as}" is defined twice.`,
            );
          if (t) out.set(f.as, t);
        });
        break;
      }
      case 'aggregate': {
        out = new Map();
        step.args.by.forEach((b, j) => {
          const t = need(b.field, `${p}.args.by[${j}].field`);
          const name = outName(b.field, b.as);
          if (out.has(name))
            add(
              'duplicate_alias',
              `${p}.args.by[${j}]`,
              `Group column "${name}" is defined twice; add "as".`,
            );
          if (t) out.set(name, t);
        });
        step.args.measures.forEach((m, j) => {
          const at = `${p}.args.measures[${j}]`;
          let t: FieldType = 'number';
          if (m.fn !== 'count' && !m.field)
            add('unknown_field', `${at}.field`, `"${m.fn}" needs a field.`);
          if (m.field) {
            const ft = need(m.field, `${at}.field`);
            if (ft && ['sum', 'avg'].includes(m.fn) && !numeric(ft))
              add(
                'type_mismatch',
                `${at}.field`,
                `"${m.fn}" needs a number field; "${m.field}" is ${ft}.`,
              );
            if (ft && ['min', 'max'].includes(m.fn)) {
              if (ft === 'number' || ft === 'time') t = ft;
              else
                add(
                  'type_mismatch',
                  `${at}.field`,
                  `"${m.fn}" needs a number or time field; "${m.field}" is ${ft}.`,
                );
            }
          }
          if (out.has(m.as))
            add(
              'duplicate_alias',
              `${at}.as`,
              `Column "${m.as}" is already used.`,
            );
          out.set(m.as, t);
        });
        break;
      }
      case 'sortBy':
        need(step.args.field, `${p}.args.field`);
        break;
      case 'limit':
        break;
      case 'bucketByTime': {
        const t = need(step.args.field, `${p}.args.field`);
        if (t && t !== 'time')
          add(
            'type_mismatch',
            `${p}.args.field`,
            `bucketByTime needs a time field; "${step.args.field}" is ${t}.`,
          );
        out = new Map(inSchema).set(step.args.as, 'string');
        break;
      }
      case 'join': {
        const right = datasets.get(step.args.with);
        if (!right) {
          add(
            'unknown_dataset',
            `${p}.args.with`,
            `Dataset "${step.args.with}" does not exist. Known: ${[
              ...datasets.keys(),
            ].join(', ')}.`,
          );
          break;
        }
        if (step.args.with === from)
          add(
            'duplicate_alias',
            `${p}.args.with`,
            'A dataset cannot be joined to itself.',
          );
        const l = need(step.args.on.left, `${p}.args.on.left`);
        const r = right.get(step.args.on.right);
        if (!r)
          add(
            'unknown_field',
            `${p}.args.on.right`,
            `Field "${step.args.on.right}" is not in "${
              step.args.with
            }". Available: ${[...right.keys()].join(', ')}.`,
          );
        if (l && r && l !== r)
          add(
            'type_mismatch',
            p,
            `Join keys have different types (${l} vs ${r}).`,
          );
        out = new Map(inSchema);
        right.forEach((t, k) => out.set(`${step.args.with}.${k}`, t));
        break;
      }
      default:
        assertNever(step);
    }
    datasets.set(into, out);
    cursor = into;
  });

  checkView(spec.view, datasets.get(cursor) ?? new Map(), add);
  return issues;
}

function checkView(
  view: ViewT,
  s: Schema,
  add: (c: Issue['code'], p: string, m: string) => void,
) {
  const col = (name: string | undefined, at: string) => {
    if (!name) return undefined;
    const t = s.get(name);
    if (!t)
      add(
        'unknown_field',
        at,
        `Column "${name}" is not in the final result. Available: ${
          [...s.keys()].join(', ') || 'none'
        }.`,
      );
    return t;
  };
  switch (view.kind) {
    case 'chart': {
      const { chartType, encoding } = view.props;
      const axisKey = chartType === 'line' ? 'x' : 'category';
      const axisName = encoding[axisKey];
      if (!axisName)
        add(
          'shape_mismatch',
          `view.props.encoding.${axisKey}`,
          `A ${chartType} chart needs encoding.${axisKey}.`,
        );
      const a = col(axisName, `view.props.encoding.${axisKey}`);
      const v = col(encoding.value, 'view.props.encoding.value');
      if (a && !labelish(a))
        add(
          'shape_mismatch',
          `view.props.encoding.${axisKey}`,
          `${axisKey} must be a string or time column.`,
        );
      if (v && !numeric(v))
        add(
          'shape_mismatch',
          'view.props.encoding.value',
          `value must be a number column; "${encoding.value}" is ${v}.`,
        );
      if (chartType === 'line' && a && a !== 'time' && a !== 'string')
        add(
          'shape_mismatch',
          'view.props.encoding.x',
          'line x must be time or string.',
        );
      break;
    }
    case 'metric': {
      const v = col(view.props.value, 'view.props.value');
      if (v && !numeric(v))
        add(
          'shape_mismatch',
          'view.props.value',
          `A metric needs a number column; "${view.props.value}" is ${v}.`,
        );
      break;
    }
    case 'table':
      view.props.columns.forEach((c, i) =>
        col(c.field, `view.props.columns[${i}].field`),
      );
      break;
    case 'statusList':
      col(view.props.label, 'view.props.label');
      col(view.props.status, 'view.props.status');
      break;
    default:
      assertNever(view);
  }
}
