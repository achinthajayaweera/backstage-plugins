import { render, screen } from '@testing-library/react';
import type { ViewModel } from '@openchoreo/genui-core';
import { GenUiView } from './GenUiView';

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

const propsOf = (testId: string) =>
  JSON.parse(screen.getByTestId(testId).textContent ?? '{}');

describe('GenUiView', () => {
  it('draws a horizontal bar chart', () => {
    const model: ViewModel = {
      kind: 'bar',
      horizontal: true,
      data: [{ category: 'dev', value: 4 }],
    };
    render(<GenUiView model={model} title="Deployments" />);
    expect(propsOf('bar')).toEqual({
      data: [{ category: 'dev', value: 4 }],
      ariaLabel: 'Deployments',
      orientation: 'horizontal',
    });
  });

  it('draws a vertical bar chart when not horizontal', () => {
    const model: ViewModel = { kind: 'bar', horizontal: false, data: [] };
    render(<GenUiView model={model} title="Deployments" />);
    expect(propsOf('bar').orientation).toBe('vertical');
  });

  it('draws a pie chart', () => {
    const model: ViewModel = {
      kind: 'pie',
      data: [{ category: 'Ready', value: 7 }],
    };
    render(<GenUiView model={model} title="Status" />);
    expect(propsOf('pie')).toEqual({
      data: [{ category: 'Ready', value: 7 }],
      ariaLabel: 'Status',
    });
  });

  it('draws a line chart', () => {
    const model: ViewModel = {
      kind: 'line',
      data: [{ x: '2026-10-26', value: 2 }],
    };
    render(<GenUiView model={model} title="Per day" />);
    expect(propsOf('line')).toEqual({
      data: [{ x: '2026-10-26', value: 2 }],
      ariaLabel: 'Per day',
    });
  });

  it('draws a single number', () => {
    const model: ViewModel = {
      kind: 'metric',
      label: 'Active deployments',
      value: 8,
      format: 'number',
    };
    render(<GenUiView model={model} title="Active" />);
    expect(propsOf('metric')).toEqual({
      label: 'Active deployments',
      value: 8,
      format: 'number',
    });
  });

  it('shows a notice under the chart when there is one', () => {
    const model: ViewModel = {
      kind: 'bar',
      horizontal: false,
      data: [],
      notice: 'Showing the first 50 of 80 bars.',
    };
    render(<GenUiView model={model} title="Bars" />);
    expect(screen.getByRole('note')).toHaveTextContent(
      'Showing the first 50 of 80 bars.',
    );
  });

  it('shows no notice when there is none', () => {
    const model: ViewModel = { kind: 'pie', data: [] };
    render(<GenUiView model={model} title="Pie" />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('explains instead of drawing when there is nothing to draw', () => {
    const model: ViewModel = {
      kind: 'explanation',
      reason: 'unsupported_view',
      title: 'This widget type is not available yet',
      message: 'Widgets that show a table are coming in a later release.',
      suggestions: ['Try asking for a chart or a single number instead.'],
    };
    render(<GenUiView model={model} title="Table" />);
    expect(
      screen.getByRole('heading', {
        name: 'This widget type is not available yet',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('metric')).not.toBeInTheDocument();
  });
});
