import { render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@material-ui/core/styles';
import { LineChart } from './LineChart';
import { darkTokens, lightTokens } from '../../theme/tokens';

const mockCaptured: Record<string, any> = {};

// Recharts measures the DOM, which jsdom cannot do. Stub the primitives so the
// tests assert on what the chart declares (data, colours), not on pixels.
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children, ...props }: any) => {
    mockCaptured.chart = props;
    return <div data-testid="line-chart">{children}</div>;
  },
  Line: (props: any) => {
    mockCaptured.line = props;
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
  { x: 'Mon', value: 3 },
  { x: 'Tue', value: 5 },
  { x: 'Wed', value: 2 },
];

describe('LineChart', () => {
  beforeEach(() => {
    Object.keys(mockCaptured).forEach(k => delete mockCaptured[k]);
  });

  describe('empty states', () => {
    it('shows a message instead of a chart when there is no data', () => {
      render(<LineChart data={[]} ariaLabel="Runs" />);
      expect(screen.getByRole('status')).toHaveTextContent(
        'No data to display',
      );
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    });

    it('uses a custom empty message', () => {
      render(
        <LineChart data={[]} ariaLabel="Runs" emptyMessage="Nothing yet" />,
      );
      expect(screen.getByRole('status')).toHaveTextContent('Nothing yet');
    });

    it('shows the empty message when no value is usable', () => {
      render(
        <LineChart
          ariaLabel="Runs"
          data={[
            { x: 'a', value: Number.NaN },
            { x: 'b', value: Infinity },
          ]}
        />,
      );
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    });
  });

  describe('data', () => {
    it('hands the points to the chart in the order given', () => {
      render(<LineChart data={data} ariaLabel="Runs" />);
      expect(mockCaptured.chart.data).toEqual([
        { x: 'Mon', value: 3 },
        { x: 'Tue', value: 5 },
        { x: 'Wed', value: 2 },
      ]);
      expect(mockCaptured.xAxis.dataKey).toBe('x');
      expect(mockCaptured.line.dataKey).toBe('value');
    });

    it('leaves a gap for a bad value instead of drawing zero', () => {
      render(
        <LineChart
          ariaLabel="Runs"
          data={[
            { x: 1, value: 4 },
            { x: 2, value: Number.NaN },
            { x: 3, value: 6 },
          ]}
        />,
      );
      expect(mockCaptured.chart.data.map((p: any) => p.value)).toEqual([
        4,
        null,
        6,
      ]);
      expect(mockCaptured.line.connectNulls).toBe(false);
    });

    it('still draws a chart for a single point', () => {
      render(<LineChart ariaLabel="Runs" data={[{ x: 'Mon', value: 1 }]} />);
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(mockCaptured.line.dot).toBeTruthy();
    });
  });

  describe('colours come from theme tokens', () => {
    it('uses the first light-mode series colour', () => {
      render(<LineChart data={data} ariaLabel="Runs" />);
      expect(mockCaptured.line.stroke).toBe(lightTokens.chart.series[0]);
    });

    it('uses the dark palette under a dark theme', () => {
      render(
        <ThemeProvider theme={createTheme({ palette: { type: 'dark' } })}>
          <LineChart data={data} ariaLabel="Runs" />
        </ThemeProvider>,
      );
      expect(mockCaptured.line.stroke).toBe(darkTokens.chart.series[0]);
    });
  });

  describe('axes and tooltip', () => {
    it('avoids decimal ticks when every value is whole', () => {
      render(<LineChart data={data} ariaLabel="Runs" />);
      expect(mockCaptured.yAxis.allowDecimals).toBe(false);
    });

    it('allows decimal ticks when a value has a fraction', () => {
      render(
        <LineChart
          ariaLabel="Runs"
          data={[
            { x: 'a', value: 1.5 },
            { x: 'b', value: 2 },
          ]}
        />,
      );
      expect(mockCaptured.yAxis.allowDecimals).toBe(true);
    });

    it('formats x ticks and truncates long ones', () => {
      const long = 'a-very-long-label-that-would-crowd-the-axis-ticks';
      render(
        <LineChart
          ariaLabel="Runs"
          formatX={x => `day ${x}`}
          data={[{ x: long, value: 1 }]}
        />,
      );
      const tick = mockCaptured.xAxis.tickFormatter(long);
      expect(tick.length).toBeLessThanOrEqual(24);
      expect(tick.endsWith('…')).toBe(true);
    });

    it('formats tooltip values and the tooltip label', () => {
      render(
        <LineChart
          ariaLabel="Runs"
          formatX={x => `day ${x}`}
          formatValue={v => `${v} runs`}
          data={[{ x: 1, value: 3 }]}
        />,
      );
      expect(mockCaptured.tooltip.formatter(3)).toBe('3 runs');
      expect(mockCaptured.tooltip.labelFormatter(1)).toBe('day 1');
    });
  });

  describe('sizing', () => {
    it('defaults to 280px and honours an explicit height', () => {
      const { rerender } = render(<LineChart data={data} ariaLabel="Runs" />);
      expect(screen.getByRole('img')).toHaveStyle({ height: '280px' });
      rerender(<LineChart data={data} ariaLabel="Runs" height={180} />);
      expect(screen.getByRole('img')).toHaveStyle({ height: '180px' });
    });
  });

  describe('accessibility', () => {
    it('names the chart image and offers the data as a table', () => {
      render(
        <LineChart
          data={data}
          ariaLabel="Runs per day"
          xLabel="Day"
          valueLabel="Runs"
          formatValue={v => `${v} runs`}
        />,
      );
      expect(
        screen.getByRole('img', { name: 'Runs per day' }),
      ).toBeInTheDocument();

      const table = screen.getByRole('table', { name: 'Runs per day' });
      expect(
        within(table).getByRole('columnheader', { name: 'Day' }),
      ).toBeInTheDocument();
      expect(
        within(table).getByRole('columnheader', { name: 'Runs' }),
      ).toBeInTheDocument();

      const rows = within(table).getAllByRole('row');
      expect(rows).toHaveLength(4); // header + 3 data rows
      expect(
        within(rows[1]).getByRole('rowheader', { name: 'Mon' }),
      ).toBeInTheDocument();
      expect(within(rows[1]).getByRole('cell')).toHaveTextContent('3 runs');
    });

    it('lists a gap as a dash and keeps repeated x values as separate rows', () => {
      render(
        <LineChart
          ariaLabel="Runs"
          data={[
            { x: 'Mon', value: 1 },
            { x: 'Mon', value: Number.NaN },
          ]}
        />,
      );
      const rows = within(screen.getByRole('table')).getAllByRole('row');
      expect(rows).toHaveLength(3);
      expect(within(rows[2]).getByRole('cell')).toHaveTextContent('—');
    });
  });
});
