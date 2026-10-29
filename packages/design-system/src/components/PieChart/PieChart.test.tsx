import { render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@material-ui/core/styles';
import { PieChart } from './PieChart';
import { darkTokens, lightTokens } from '../../theme/tokens';

const mockCaptured: Record<string, any> = { cells: [] };

// Recharts measures the DOM, which jsdom cannot do. Stub the primitives so the
// tests assert on what the chart declares (data, colours), not on pixels.
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({ children, ...props }: any) => {
    mockCaptured.pie = props;
    return <div>{children}</div>;
  },
  Cell: (props: any) => {
    mockCaptured.cells.push(props);
    return null;
  },
  Tooltip: (props: any) => {
    mockCaptured.tooltip = props;
    return null;
  },
  Legend: (props: any) => {
    mockCaptured.legend = props;
    return null;
  },
}));

const data = [
  { category: 'checkout', value: 6 },
  { category: 'cart', value: 3 },
  { category: 'billing', value: 1 },
];

describe('PieChart', () => {
  beforeEach(() => {
    Object.keys(mockCaptured).forEach(k => delete mockCaptured[k]);
    mockCaptured.cells = [];
  });

  describe('empty states', () => {
    it('shows a message instead of a chart when there is no data', () => {
      render(<PieChart data={[]} ariaLabel="Runs" />);
      expect(screen.getByRole('status')).toHaveTextContent(
        'No data to display',
      );
      expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
    });

    it('uses a custom empty message', () => {
      render(
        <PieChart data={[]} ariaLabel="Runs" emptyMessage="Nothing yet" />,
      );
      expect(screen.getByRole('status')).toHaveTextContent('Nothing yet');
    });

    it('shows the empty message when every value is zero or unusable', () => {
      render(
        <PieChart
          ariaLabel="Runs"
          data={[
            { category: 'a', value: 0 },
            { category: 'b', value: -2 },
            { category: 'c', value: Number.NaN },
          ]}
        />,
      );
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
    });
  });

  describe('slices', () => {
    it('hands the slices to the pie keyed by category and value', () => {
      render(<PieChart data={data} ariaLabel="Runs" />);
      expect(mockCaptured.pie.dataKey).toBe('value');
      expect(mockCaptured.pie.nameKey).toBe('category');
      expect(
        mockCaptured.pie.data.map((s: any) => [s.category, s.value]),
      ).toEqual([
        ['checkout', 6],
        ['cart', 3],
        ['billing', 1],
      ]);
    });

    it('merges the smallest slices into "Other" past maxSlices', () => {
      render(<PieChart data={data} ariaLabel="Runs" maxSlices={2} />);
      expect(
        mockCaptured.pie.data.map((s: any) => [s.category, s.value]),
      ).toEqual([
        ['checkout', 6],
        ['Other', 4],
      ]);
    });

    it('uses a custom label for the merged slice', () => {
      render(
        <PieChart
          data={data}
          ariaLabel="Runs"
          maxSlices={2}
          otherLabel="Everything else"
        />,
      );
      expect(mockCaptured.pie.data[1].category).toBe('Everything else');
    });
  });

  describe('colours come from theme tokens', () => {
    it('gives each slice the next light-mode series colour', () => {
      render(<PieChart data={data} ariaLabel="Runs" />);
      expect(mockCaptured.cells.map((c: any) => c.fill)).toEqual(
        lightTokens.chart.series.slice(0, 3),
      );
    });

    it('wraps around when there are more slices than palette colours', () => {
      const many = Array.from({ length: 12 }, (_, i) => ({
        category: `c${i}`,
        value: i + 1,
      }));
      render(<PieChart data={many} ariaLabel="Runs" maxSlices={12} />);
      const palette = lightTokens.chart.series;
      expect(mockCaptured.cells).toHaveLength(12);
      expect(mockCaptured.cells[10].fill).toBe(palette[0]);
      expect(mockCaptured.cells[11].fill).toBe(palette[1]);
    });

    it('uses the dark palette under a dark theme', () => {
      render(
        <ThemeProvider theme={createTheme({ palette: { type: 'dark' } })}>
          <PieChart data={data} ariaLabel="Runs" />
        </ThemeProvider>,
      );
      expect(mockCaptured.cells[0].fill).toBe(darkTokens.chart.series[0]);
    });
  });

  describe('tooltip and legend', () => {
    it('shows the formatted value and the share in the tooltip', () => {
      render(
        <PieChart
          ariaLabel="Runs"
          formatValue={v => `${v} runs`}
          data={[
            { category: 'a', value: 50 },
            { category: 'b', value: 50 },
          ]}
        />,
      );
      const [text, name] = mockCaptured.tooltip.formatter(50, 'a');
      expect(name).toBe('a');
      expect(text).toContain('50 runs');
      expect(text).toMatch(/50/);
      expect(text).toContain('(');
    });

    it('truncates long legend labels but keeps the full text in the data', () => {
      const long = 'a-very-long-project-name-that-would-crowd-the-legend';
      render(
        <PieChart ariaLabel="Runs" data={[{ category: long, value: 1 }]} />,
      );
      const label = mockCaptured.legend.formatter(long);
      expect(label.length).toBeLessThanOrEqual(24);
      expect(label.endsWith('…')).toBe(true);
      expect(mockCaptured.pie.data[0].category).toBe(long);
    });
  });

  describe('sizing', () => {
    it('defaults to 300px and honours an explicit height', () => {
      const { rerender } = render(<PieChart data={data} ariaLabel="Runs" />);
      expect(screen.getByRole('img')).toHaveStyle({ height: '300px' });
      rerender(<PieChart data={data} ariaLabel="Runs" height={180} />);
      expect(screen.getByRole('img')).toHaveStyle({ height: '180px' });
    });
  });

  describe('accessibility', () => {
    it('names the chart image and offers the data as a table with shares', () => {
      render(
        <PieChart
          data={data}
          ariaLabel="Components per project"
          categoryLabel="Project"
          valueLabel="Components"
          formatValue={v => `${v} components`}
        />,
      );
      expect(
        screen.getByRole('img', { name: 'Components per project' }),
      ).toBeInTheDocument();

      const table = screen.getByRole('table', {
        name: 'Components per project',
      });
      expect(
        within(table).getByRole('columnheader', { name: 'Project' }),
      ).toBeInTheDocument();
      expect(
        within(table).getByRole('columnheader', { name: 'Components' }),
      ).toBeInTheDocument();
      expect(
        within(table).getByRole('columnheader', { name: 'Share' }),
      ).toBeInTheDocument();

      const rows = within(table).getAllByRole('row');
      expect(rows).toHaveLength(4); // header + 3 data rows
      expect(
        within(rows[1]).getByRole('rowheader', { name: 'checkout' }),
      ).toBeInTheDocument();
      const cells = within(rows[1]).getAllByRole('cell');
      expect(cells[0]).toHaveTextContent('6 components');
      expect(cells[1]).toHaveTextContent(/60/);
    });
  });
});
