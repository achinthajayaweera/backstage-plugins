import { catalogWithDeployments } from './deployments';
import { deploymentFetchPage, deploymentSpecs } from './deployments.fixtures';
import { loadWidget } from './loadWidget';
import { MOCK_NOW } from './mocks';
import { seedCatalog } from './catalog';

const options = {
  namespaces: ['default'],
  fetchPage: deploymentFetchPage(),
  now: MOCK_NOW,
};

describe('loadWidget', () => {
  it('draws a saved widget from its data', async () => {
    const { title, model } = await loadWidget(
      deploymentSpecs.byEnvironment,
      catalogWithDeployments,
      options,
    );
    expect(title).toBe('Deployments per environment');
    expect(model.kind).toBe('bar');
    expect((model as any).data[0]).toEqual({ category: 'dev', value: 4 });
  });

  it('gives a number for a metric widget', async () => {
    const { model } = await loadWidget(
      deploymentSpecs.activeCount,
      catalogWithDeployments,
      options,
    );
    expect(model).toEqual({
      kind: 'metric',
      label: 'Active deployments',
      value: 8,
      format: 'number',
    });
  });

  it('explains a widget type that is not built yet', async () => {
    const { title, model } = await loadWidget(
      deploymentSpecs.recentTable,
      catalogWithDeployments,
      options,
    );
    expect(title).toBe('Newest deployments');
    expect((model as any).reason).toBe('unsupported_view');
  });

  it.each([null, undefined, 'text', 42, {}, { version: 2 }])(
    'explains a saved value that is not a widget: %s',
    async raw => {
      const { title, model } = await loadWidget(
        raw,
        catalogWithDeployments,
        options,
      );
      expect(title).toBe('Widget');
      expect((model as any).reason).toBe('invalid_spec');
    },
  );

  it('explains a widget whose data source no longer exists', async () => {
    const { title, model } = await loadWidget(
      deploymentSpecs.byEnvironment,
      seedCatalog,
      options,
    );
    expect(title).toBe('Deployments per environment');
    expect((model as any).reason).toBe('invalid_spec');
  });

  it('explains a missing permission', async () => {
    const { model } = await loadWidget(
      deploymentSpecs.byEnvironment,
      catalogWithDeployments,
      {
        ...options,
        fetchPage: async () => {
          throw Object.assign(new Error('no'), { status: 403 });
        },
      },
    );
    expect((model as any).reason).toBe('forbidden');
  });

  it('explains a server error', async () => {
    const { model } = await loadWidget(
      deploymentSpecs.byEnvironment,
      catalogWithDeployments,
      {
        ...options,
        fetchPage: async () => {
          throw Object.assign(new Error('boom'), { status: 500 });
        },
      },
    );
    expect((model as any).reason).toBe('fetch_failed');
    expect(JSON.stringify(model).includes('boom')).toBe(false);
  });

  it('does not leak the text of an unexpected error', async () => {
    const { model } = await loadWidget(
      deploymentSpecs.byEnvironment,
      catalogWithDeployments,
      {
        ...options,
        fetchPage: async () => {
          throw new TypeError('secret internal detail');
        },
      },
    );
    expect((model as any).reason).toBe('fetch_failed');
    expect(JSON.stringify(model).includes('secret')).toBe(false);
  });

  it('hands the original error to onError for logging', async () => {
    const seen: unknown[] = [];
    await loadWidget(deploymentSpecs.byEnvironment, catalogWithDeployments, {
      ...options,
      fetchPage: async () => {
        throw new TypeError('secret internal detail');
      },
      onError: error => seen.push(error),
    });
    expect(seen).toHaveLength(1);
    expect((seen[0] as Error).message).toMatch(/secret internal detail/);
  });

  it('does not call onError when everything works', async () => {
    const seen: unknown[] = [];
    await loadWidget(deploymentSpecs.byEnvironment, catalogWithDeployments, {
      ...options,
      onError: error => seen.push(error),
    });
    expect(seen).toHaveLength(0);
  });

  it('keeps going and shows a notice when the results are partial', async () => {
    const { model } = await loadWidget(
      deploymentSpecs.byEnvironment,
      catalogWithDeployments,
      {
        ...options,
        fetchPage: deploymentFetchPage(undefined, 2),
        limits: { maxCalls: 1 },
      },
    );
    expect(model.kind).toBe('bar');
    expect((model as any).notice).toMatch(/limit/i);
  });

  it('gives the same result every time', async () => {
    const first = JSON.stringify(
      await loadWidget(deploymentSpecs.perDay, catalogWithDeployments, options),
    );
    for (let i = 0; i < 10; i++) {
      expect(
        JSON.stringify(
          await loadWidget(
            deploymentSpecs.perDay,
            catalogWithDeployments,
            options,
          ),
        ),
      ).toBe(first);
    }
  });
});
