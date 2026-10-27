import { seedCatalog } from './catalog';
import { mockResponses } from './mocks';
import { clone, MockName, specOf } from './testUtils';
import { validateSpec } from './validate';

const codes = (spec: ReturnType<typeof specOf>, ...rest: any[]) =>
  (validateSpec as any)(spec, seedCatalog, ...rest).map((i: any) => i.code);

describe('validateSpec', () => {
  it('passes every valid mock spec', () => {
    const specNames = (Object.keys(mockResponses) as MockName[]).filter(
      name => mockResponses[name].type === 'spec',
    );
    const failures = specNames.flatMap(name =>
      validateSpec(specOf(name), seedCatalog).map(issue => ({
        name,
        ...issue,
      })),
    );
    expect(specNames.length).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });

  it('reports an unknown endpoint and lists the allowed ones', () => {
    const spec = specOf('barRunsByWorkflow');
    spec.sources[0].endpointId = 'cpuUsage.list';
    const issues = validateSpec(spec, seedCatalog);
    expect(issues[0].code).toBe('unknown_endpoint');
    expect(issues[0].message).toContain('workflowRuns.list');
  });

  it('reports an unknown field and an unknown param', () => {
    const badField = specOf('barRunsByWorkflow');
    (badField.pipeline[0] as any).args.field = 'status.phase';
    expect(codes(badField)).toContain('unknown_field');

    const badParam = specOf('barRunsByWorkflow');
    badParam.sources[0].params = { since: '30d' };
    expect(codes(badParam)).toContain('unknown_param');
  });

  it('reports a param of the wrong type', () => {
    const spec = specOf('barRunsByWorkflow');
    spec.sources[0].params = { workflow: 5 };
    expect(codes(spec)).toContain('bad_param_type');
  });

  it('rejects a non-numeric value column and a relative time on a string field', () => {
    const notNumeric = specOf('barRunsByWorkflow');
    (notNumeric.view as any).props.encoding.value = 'workflow';
    expect(codes(notNumeric)).toContain('shape_mismatch');

    const wrongAgo = specOf('barRunsByWorkflow');
    (wrongAgo.pipeline[0] as any).args.field = 'spec.workflow.name';
    expect(codes(wrongAgo)).toContain('bad_relative_time');
  });

  it('requires encoding.x for line charts and encoding.category for bar and pie', () => {
    const line = specOf('lineRunsPerDay');
    delete (line.view as any).props.encoding.x;
    expect(codes(line)).toContain('shape_mismatch');
  });

  it('rejects sum over a string field and a join over mismatched key types', () => {
    const sumString = specOf('pieComponentsPerProject');
    (sumString.pipeline[1] as any).args.measures = [
      { fn: 'sum', field: 'metadata.name', as: 'x' },
    ];
    expect(codes(sumString)).toContain('type_mismatch');

    const badJoin = specOf('pieComponentsPerProject');
    (badJoin.pipeline[0] as any).args.on.right = 'spec.autoDeploy';
    expect(codes(badJoin)).toContain('type_mismatch');
  });

  it('reports duplicate dataset ids and unknown datasets', () => {
    const dup = specOf('pieComponentsPerProject');
    dup.sources[1].id = 'projects';
    expect(codes(dup)).toContain('duplicate_alias');

    const unknown = specOf('pieComponentsPerProject');
    (unknown.pipeline[0] as any).args.with = 'nope';
    expect(codes(unknown)).toContain('unknown_dataset');
  });

  it('flags endpoints from modules that are not installed', () => {
    const catalog = [
      ...seedCatalog,
      {
        ...clone(seedCatalog[0]),
        id: 'alerts.list',
        module: 'observability' as const,
      },
    ];
    const spec = specOf('metricProjectCount');
    spec.sources[0].endpointId = 'alerts.list';

    const withoutModule = validateSpec(spec, catalog).map(i => i.code);
    expect(withoutModule).toContain('module_missing');

    const withModule = validateSpec(
      spec,
      catalog,
      new Set(['core', 'observability']),
    ).map(i => i.code);
    expect(withModule).not.toContain('module_missing');
  });
});
