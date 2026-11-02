import { act, render, screen } from '@testing-library/react';
import { catalogWithDeployments } from '@openchoreo/genui-core';
import { GenUiWidget } from './GenUiWidget';

// The real charts need a browser to measure. Stub them so these tests check
// which component is chosen and what it is given, not how it looks.
jest.mock('@openchoreo/backstage-design-system', () => {
  const stub = (name: string) => (props: any) =>
    <div data-testid={name}>{JSON.stringify(props)}</div>;
  return {
    BarChart: stub('bar'),
    PieChart: stub('pie'),
    LineChart: stub('line'),
    MetricCard: stub('metric'),
  };
});

const metricSpec = (label: string) => ({
  version: 1,
  title: label,
  sources: [{ id: 'deployments', endpointId: 'releaseBindings.list' }],
  pipeline: [
    { op: 'filter', args: { field: 'spec.state', cmp: 'eq', value: 'Active' } },
    {
      op: 'aggregate',
      args: { by: [], measures: [{ fn: 'count', as: 'total' }] },
    },
  ],
  view: { kind: 'metric', props: { label, value: 'total' } },
});

const rows = [
  { spec: { state: 'Active' } },
  { spec: { state: 'Active' } },
  { spec: { state: 'Undeploy' } },
];

const okFetch = async () => ({ items: rows, nextCursor: undefined });

const baseProps = {
  catalog: catalogWithDeployments,
  namespaces: ['default'],
  fetchPage: okFetch,
};

const metricProps = () =>
  JSON.parse(screen.getByTestId('metric').textContent ?? '{}');

describe('GenUiWidget', () => {
  it('shows a loading indicator, then the widget', async () => {
    render(<GenUiWidget {...baseProps} spec={metricSpec('Active')} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    await screen.findByTestId('metric');
    expect(metricProps()).toEqual({
      label: 'Active',
      value: 2,
      format: 'number',
    });
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('explains when the person is not permitted to read the data', async () => {
    const denied = async () => {
      throw Object.assign(new Error('no'), { status: 403 });
    };
    render(
      <GenUiWidget
        {...baseProps}
        fetchPage={denied}
        spec={metricSpec('Active')}
      />,
    );
    expect(
      await screen.findByRole('heading', {
        name: 'You do not have access to this data',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('metric')).not.toBeInTheDocument();
  });

  it('explains a saved value that is not a widget', async () => {
    render(<GenUiWidget {...baseProps} spec={{ nothing: true }} />);
    expect(
      await screen.findByRole('heading', {
        name: 'This widget can no longer be shown',
      }),
    ).toBeInTheDocument();
  });

  it('hands the original error to onError', async () => {
    const seen: unknown[] = [];
    const broken = async () => {
      throw new TypeError('secret internal detail');
    };
    render(
      <GenUiWidget
        {...baseProps}
        fetchPage={broken}
        onError={error => seen.push(error)}
        spec={metricSpec('Active')}
      />,
    );
    await screen.findByRole('heading', {
      name: 'The data could not be loaded',
    });
    expect(seen).toHaveLength(1);
    expect(screen.queryByText(/secret/)).not.toBeInTheDocument();
  });

  it('loads again when the saved widget changes', async () => {
    const { rerender } = render(
      <GenUiWidget {...baseProps} spec={metricSpec('First')} />,
    );
    await screen.findByTestId('metric');
    expect(metricProps().label).toBe('First');

    rerender(<GenUiWidget {...baseProps} spec={metricSpec('Second')} />);
    await screen.findByText(/"label":"Second"/);
    expect(metricProps().label).toBe('Second');
  });

  it('does not load again for a new object with the same content', async () => {
    const fetchPage = jest.fn(okFetch);
    const { rerender } = render(
      <GenUiWidget
        {...baseProps}
        fetchPage={fetchPage}
        spec={metricSpec('Same')}
      />,
    );
    await screen.findByTestId('metric');
    expect(fetchPage).toHaveBeenCalledTimes(1);

    rerender(
      <GenUiWidget
        {...baseProps}
        fetchPage={fetchPage}
        spec={metricSpec('Same')}
      />,
    );
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('ignores a slow earlier answer that arrives after a newer one', async () => {
    let releaseFirst: () => void = () => {};
    const slow = () =>
      new Promise<{ items: typeof rows; nextCursor: undefined }>(resolve => {
        releaseFirst = () => resolve({ items: rows, nextCursor: undefined });
      });
    const { rerender } = render(
      <GenUiWidget {...baseProps} fetchPage={slow} spec={metricSpec('Old')} />,
    );

    rerender(
      <GenUiWidget
        {...baseProps}
        fetchPage={okFetch}
        spec={metricSpec('New')}
      />,
    );
    await screen.findByText(/"label":"New"/);

    await act(async () => {
      releaseFirst();
    });
    expect(metricProps().label).toBe('New');
  });
});
