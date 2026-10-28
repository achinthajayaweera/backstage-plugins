import { render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@material-ui/core/styles';
import { BarChart, truncateLabel } from './BarChart';
import { darkTokens, lightTokens } from '../../theme/tokens';

const mockCaptured: Record<string, any> = {};

// Recharts measures the DOM, which jsdom cannot do. Stub the primitives so the
// tests assert on what the chart declares (data, axes, colours), not on pixels.
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children, ...props }: any) => {
    mockCaptured.chart = props;
    return <div data-testid="bar-chart">{children}</div>;
  },
  Bar: (props: any) => {
    mockCaptured.bar = props;
    return null;
  },
  XAxis: (props: any) => {
    mockCaptured.xAxis = props;
    return null;
  },
  YAxis: (props: any) => {
    mockCaptured.yAxis = props;
    return null;
  },
  CartesianGrid: () => null,
  Tooltip: (props: any) => {
    mockCaptured.tooltip = props;
    return null;
  },
}));

const data = [
  { category: 'checkout', value: 12 },
  { category: 'cart', value: 7 },
  { category: 'billing', value: 3 },
];

describe('BarChart', () => {
  beforeEach(() => {
    Object.keys(mockCaptured).forEach(k => delete mockCaptured[k]);
  });

  describe('empty states', () => {
    it('shows a message instead of a chart when there is no data', () => {
      render(<BarChart data={[]} ariaLabel="Runs" />);
      expect(screen.getByRole('status')).toHaveTextContent(
        'No data to display',
      );
      expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
    });

    it('uses a custom empty message', () => {
      render(
        <BarChart data={[]} ariaLabel="Runs" emptyMessage="Nothing yet" />,
      );
      expect(screen.getByRole('status')).toHaveTextContent('Nothing yet');
    });

    it('skips non-finite values and shows the empty message if none remain', () => {
      const { rerender } = render(
        <BarChart
          ariaLabel="Runs"
          data={[...data, { category: 'bad', value: Number.NaN }]}
        />,
      );
      expect(mockCaptured.chart.data).toHaveLength(3);

      rerender(
        <BarChart
          ariaLabel="Runs"
          data={[
            { category: 'a', value: Number.NaN },
            { category: 'b', value: Infinity },
          ]}
        />,
      );
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('layout', () => {
    it('draws columns by default: category on X, value on Y', () => {
      render(<BarChart data={data} ariaLabel="Runs" />);
      expect(mockCaptured.chart.layout).toBe('horizontal');
      expect(mockCaptured.xAxis.type).toBe('category');
      expect(mockCaptured.yAxis.type).toBe('number');
    });

    it('draws horizontal bars when asked: category on Y, value on X', () => {
      render(
        <BarChart data={data} ariaLabel="Runs" orientation="horizontal" />,
      );
      expect(mockCaptured.chart.layout).toBe('vertical');
      expect(mockCaptured.xAxis.type).toBe('number');
      expect(mockCaptured.yAxis.type).toBe('category');
    });

    it('passes the rows through in the order given', () => {
      render(<BarChart data={data} ariaLabel="Runs" />);
      expect(mockCaptured.chart.data).toEqual(data);
    });

    it('sizes horizontal charts by number of bars and honours an explicit height', () => {
      const many = Array.from({ length: 20 }, (_, i) => ({
        category: `c${i}`,
        value: i,
      }));
      const { rerender } = render(
        <BarChart data={many} ariaLabel="Runs" orientation="horizontal" />,
      );
      expect(screen.getByRole('img')).toHaveStyle({ height: '688px' });

      rerender(
        <BarChart
          data={many}
          ariaLabel="Runs"
          orientation="horizontal"
          height={300}
        />,
      );
      expect(screen.getByRole('img')).toHaveStyle({ height: '300px' });
    });
  });

  describe('colours come from theme tokens', () => {
    it('uses the first light-mode series colour by default', () => {
      render(<BarChart data={data} ariaLabel="Runs" />);
      expect(mockCaptured.bar.fill).toBe(lightTokens.chart.series[0]);
    });

    it('uses the dark palette under a dark theme', () => {
      render(
        <ThemeProvider theme={createTheme({ palette: { type: 'dark' } })}>
          <BarChart data={data} ariaLabel="Runs" />
        </ThemeProvider>,
      );
      expect(mockCaptured.bar.fill).toBe(darkTokens.chart.series[0]);
    });
  });

  describe('axes', () => {
    it('hides fractional ticks when every value is a whole number', () => {
      render(<BarChart data={data} ariaLabel="Runs" />);
      expect(mockCaptured.yAxis.allowDecimals).toBe(false);
    });

    it('allows fractional ticks when any value has decimals', () => {
      render(
        <BarChart
          ariaLabel="Latency"
          data={[
            { category: 'a', value: 1.5 },
            { category: 'b', value: 2 },
          ]}
        />,
      );
      expect(mockCaptured.yAxis.allowDecimals).toBe(true);
    });

    it('truncates long category ticks but keeps the full text in the data', () => {
      const long = 'a-very-long-project-name-that-would-crowd-the-axis';
      render(
        <BarChart ariaLabel="Runs" data={[{ category: long, value: 1 }]} />,
      );
      const tick = mockCaptured.xAxis.tickFormatter(long);
      expect(tick.length).toBeLessThanOrEqual(24);
      expect(tick.endsWith('…')).toBe(true);
      expect(mockCaptured.chart.data[0].category).toBe(long);
    });

    it('formats axis values and tooltip values with formatValue', () => {
      render(
        <BarChart
          data={data}
          ariaLabel="Runs"
          formatValue={v => `${v} runs`}
        />,
      );
      expect(mockCaptured.yAxis.tickFormatter(5)).toBe('5 runs');
      expect(mockCaptured.tooltip.formatter(7)).toBe('7 runs');
    });
  });

  describe('accessibility', () => {
    it('names the chart image and offers the data as a table', () => {
      render(
        <BarChart
          data={data}
          ariaLabel="Workflow runs by component"
          categoryLabel="Component"
          valueLabel="Runs"
          formatValue={v => `${v} runs`}
        />,
      );
      expect(
        screen.getByRole('img', { name: 'Workflow runs by component' }),
      ).toBeInTheDocument();

      const table = screen.getByRole('table', {
        name: 'Workflow runs by component',
      });
      expect(
        within(table).getByRole('columnheader', { name: 'Component' }),
      ).toBeInTheDocument();
      expect(
        within(table).getByRole('columnheader', { name: 'Runs' }),
      ).toBeInTheDocument();
      const rows = within(table).getAllByRole('row');
      expect(rows).toHaveLength(4); // header + 3 data rows
      expect(
        within(rows[1]).getByRole('rowheader', { name: 'checkout' }),
      ).toBeInTheDocument();
      expect(within(rows[1]).getByRole('cell')).toHaveTextContent('12 runs');
    });
  });
});

describe('truncateLabel', () => {
  it('leaves short labels alone', () => {
    expect(truncateLabel('cart')).toBe('cart');
  });

  it('keeps labels exactly at the limit', () => {
    expect(truncateLabel('a'.repeat(24))).toBe('a'.repeat(24));
  });

  it('shortens longer labels to the limit with an ellipsis', () => {
    const result = truncateLabel('a'.repeat(30));
    expect(result).toHaveLength(24);
    expect(result.endsWith('…')).toBe(true);
  });

  it('accepts a custom limit', () => {
    expect(truncateLabel('abcdef', 4)).toBe('abc…');
  });
});
