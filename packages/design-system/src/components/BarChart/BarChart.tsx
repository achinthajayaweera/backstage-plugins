import { useMemo } from 'react';
import { Typography } from '@material-ui/core';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChoreoTokens } from '../../theme/useChoreoTokens';
import { VisuallyHidden } from '../VisuallyHidden';

export interface BarChartDatum {
  category: string;
  value: number;
}

export interface BarChartProps {
  /** One bar per entry, in the order given. Entries with a non-finite value are skipped. */
  data: BarChartDatum[];
  /** Accessible name for the chart, for example the widget title. */
  ariaLabel: string;
  /** Meaning of `category`, used as a column header in the screen-reader table. */
  categoryLabel?: string;
  /** Meaning of `value`, used in the tooltip and the screen-reader table. */
  valueLabel?: string;
  /**
   * `horizontal` draws bars left to right with categories down the side, which
   * suits long names. `vertical` draws columns. Defaults to `vertical`.
   */
  orientation?: 'horizontal' | 'vertical';
  /** Formats values for the axis, tooltip and screen-reader table. */
  formatValue?: (value: number) => string;
  /** Chart height in px. Defaults to a size derived from the number of bars. */
  height?: number;
  /** Shown instead of a chart when there is nothing to plot. */
  emptyMessage?: string;
}

const MAX_LABEL_CHARS = 24;
const ROW_HEIGHT = 32;
const COLUMN_CHART_HEIGHT = 280;

const useStyles = makeStyles(theme => ({
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    padding: theme.spacing(2),
  },
}));

const defaultFormat = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);

/** Shortens long names so axis ticks do not crowd; the tooltip shows the full text. */
export const truncateLabel = (label: string, max = MAX_LABEL_CHARS): string =>
  label.length > max ? `${label.slice(0, max - 1)}…` : label;

/**
 * A single-series bar chart. It only draws what it is given: it makes no API
 * calls and knows nothing about OpenChoreo, so any dashboard can use it.
 */
export function BarChart({
  data,
  ariaLabel,
  categoryLabel = 'Category',
  valueLabel = 'Value',
  orientation = 'vertical',
  formatValue = defaultFormat,
  height,
  emptyMessage = 'No data to display',
}: BarChartProps) {
  const classes = useStyles();
  const theme = useTheme();
  const tokens = useChoreoTokens();

  const rows = useMemo(
    () => data.filter(d => Number.isFinite(d.value)),
    [data],
  );

  if (rows.length === 0) {
    return (
      <div className={classes.empty} role="status">
        <Typography variant="body2" color="textSecondary">
          {emptyMessage}
        </Typography>
      </div>
    );
  }

  const horizontal = orientation === 'horizontal';
  const wholeNumbers = rows.every(d => Number.isInteger(d.value));
  const chartHeight =
    height ??
    (horizontal
      ? Math.max(160, rows.length * ROW_HEIGHT + 48)
      : COLUMN_CHART_HEIGHT);
  const labelWidth = Math.min(
    160,
    Math.max(...rows.map(d => truncateLabel(d.category).length * 7 + 16)),
  );
  const axisText = { fill: theme.palette.text.secondary, fontSize: 12 };
  const categoryAxis = {
    dataKey: 'category',
    type: 'category' as const,
    tick: axisText,
    tickFormatter: (value: string) => truncateLabel(String(value)),
    interval: 0 as const,
    stroke: tokens.border.default,
  };
  const valueAxis = {
    type: 'number' as const,
    tick: axisText,
    allowDecimals: !wholeNumbers,
    tickFormatter: (value: number) => formatValue(value),
    stroke: tokens.border.default,
  };

  return (
    <div>
      <div role="img" aria-label={ariaLabel} style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart
            data={rows}
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
          >
            <CartesianGrid
              stroke={tokens.border.subtle}
              strokeDasharray="3 3"
            />
            {horizontal ? (
              <>
                <XAxis {...valueAxis} />
                <YAxis {...categoryAxis} width={labelWidth} />
              </>
            ) : (
              <>
                <XAxis {...categoryAxis} />
                <YAxis {...valueAxis} />
              </>
            )}
            <Tooltip
              formatter={(value: unknown) => formatValue(Number(value))}
              contentStyle={{
                background: tokens.surface.raised,
                border: `1px solid ${tokens.border.default}`,
                color: theme.palette.text.primary,
              }}
              cursor={{ fill: tokens.surface.hover }}
            />
            <Bar
              dataKey="value"
              name={valueLabel}
              fill={tokens.chart.series[0]}
              isAnimationActive={false}
            />
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
      <VisuallyHidden as="div">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">{categoryLabel}</th>
              <th scope="col">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(d => (
              <tr key={d.category}>
                <th scope="row">{d.category}</th>
                <td>{formatValue(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </div>
  );
}
