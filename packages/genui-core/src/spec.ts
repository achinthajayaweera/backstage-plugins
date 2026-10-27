import { z } from 'zod';

/** Dotted field path into a row, e.g. "spec.owner.projectName". */
export const Field = z
  .string()
  .max(120)
  .regex(/^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)*$/);
/** Name of a dataset or output column. No dots, so it is always a top-level key. */
export const Alias = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,31}$/);

const Scalar = z.union([z.string().max(200), z.number(), z.boolean()]);
/** Relative time such as {"ago":"30d"}; resolved against "now" by the engine. */
export const Ago = z
  .object({ ago: z.string().regex(/^\d{1,3}[mhdw]$/) })
  .strict();

export const Source = z
  .object({
    id: Alias,
    endpointId: z.string().max(80),
    params: z.record(z.string(), Scalar).optional(),
  })
  .strict();

const base = { from: Alias.optional(), into: Alias.optional() };

export const Step = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('filter'),
      ...base,
      args: z
        .object({
          field: Field,
          cmp: z.enum([
            'eq',
            'ne',
            'gt',
            'gte',
            'lt',
            'lte',
            'in',
            'contains',
            'exists',
          ]),
          value: z.union([Scalar, z.array(Scalar).max(20), Ago]).optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      op: z.literal('select'),
      ...base,
      args: z
        .object({
          fields: z
            .array(z.object({ path: Field, as: Alias }).strict())
            .min(1)
            .max(12),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      op: z.literal('aggregate'),
      ...base,
      args: z
        .object({
          by: z
            .array(z.object({ field: Field, as: Alias.optional() }).strict())
            .max(2),
          measures: z
            .array(
              z
                .object({
                  fn: z.enum(['count', 'sum', 'avg', 'min', 'max']),
                  field: Field.optional(),
                  as: Alias,
                })
                .strict(),
            )
            .min(1)
            .max(4),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      op: z.literal('sortBy'),
      ...base,
      args: z.object({ field: Field, dir: z.enum(['asc', 'desc']) }).strict(),
    })
    .strict(),
  z
    .object({
      op: z.literal('limit'),
      ...base,
      args: z.object({ n: z.number().int().min(1).max(1000) }).strict(),
    })
    .strict(),
  z
    .object({
      op: z.literal('bucketByTime'),
      ...base,
      args: z
        .object({
          field: Field,
          interval: z.enum(['hour', 'day', 'week']),
          as: Alias,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      op: z.literal('join'),
      ...base,
      args: z
        .object({
          with: Alias,
          kind: z.enum(['inner', 'left']),
          on: z.object({ left: Field, right: Field }).strict(),
        })
        .strict(),
    })
    .strict(),
]);

export const View = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('chart'),
      props: z
        .object({
          chartType: z.enum(['bar', 'pie', 'line']),
          orientation: z.enum(['horizontal', 'vertical']).optional(),
          encoding: z
            .object({
              category: Alias.optional(),
              x: Alias.optional(),
              value: Alias,
            })
            .strict(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('metric'),
      props: z
        .object({
          label: z.string().max(60),
          value: Alias,
          format: z.enum(['number', 'percent', 'duration']).optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('table'),
      props: z
        .object({
          columns: z
            .array(
              z.object({ field: Alias, header: z.string().max(40) }).strict(),
            )
            .min(1)
            .max(8),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('statusList'),
      props: z.object({ label: Alias, status: Alias }).strict(),
    })
    .strict(),
]);

export const WidgetSpec = z
  .object({
    version: z.literal(1),
    title: z.string().min(1).max(80),
    sources: z.array(Source).min(1).max(3),
    pipeline: z.array(Step).max(8).default([]),
    view: View,
  })
  .strict();

export const RefusalReason = z.enum([
  'no_data_source',
  'unsupported_component',
  'module_missing',
  'out_of_scope',
  'unsafe',
]);

/** What the LLM is allowed to return. Everything else is rejected. */
export const ComposeResponse = z.discriminatedUnion('type', [
  z.object({ type: z.literal('spec'), spec: WidgetSpec }).strict(),
  z
    .object({
      type: z.literal('refusal'),
      reason: RefusalReason,
      message: z.string().max(300),
      alternatives: z.array(z.string().max(120)).max(3).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('clarify'),
      question: z.string().max(200),
      options: z.array(z.string().max(120)).min(2).max(3),
    })
    .strict(),
]);

export type WidgetSpecT = z.infer<typeof WidgetSpec>;
export type StepT = z.infer<typeof Step>;
export type ViewT = z.infer<typeof View>;
export type ComposeResponseT = z.infer<typeof ComposeResponse>;
