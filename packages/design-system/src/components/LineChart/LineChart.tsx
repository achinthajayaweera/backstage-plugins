import { useMemo } from 'react';
import { Typography } from '@material-ui/core';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChoreoTokens } from '../../theme/useChoreoTokens';
import { VisuallyHidden } from '../VisuallyHidden';
import { truncateLabel } from '../BarChart';
import { prepareLinePoints } from './points';

export interface LineChartDatum {
  x: string | number;
  value: number;
}

export interface LineChartProps {
  /**
   * One point per entry, in the order given. A value that is not a finite
   * number leaves a gap in the line instead of being drawn as zero.
   */
  data: LineChartDatum[];
  /** Accessible name for the chart, for example the widget title. */
  ariaLabel: string;
  /** Meaning of `x`, used as a column header in the screen-reader table. */
  xLabel?: string;
  /** Meaning of `value`, used in the tooltip and the screen-reader table. */
  valueLabel?: string;
  /** Formats `x` for the axis, tooltip and screen-reader table, for example as a date. */
  formatX?: (x: string | number) => string;
  /** Formats values for the axis, tooltip and screen-reader table. */
  formatValue?: (value: number) => string;
  /** Chart height in px. Defaults to 280. */
  height?: number;
  /** Shown instead of a chart when there is nothing to plot. */
  emptyMessage?: string;
}

const DEFAULT_HEIGHT = 280;
const NO_VALUE = '—';

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

const defaultFormatX = (x: string | number) => String(x);

/**
 * A single-series line chart. It only draws what it is given: it makes no API
 * calls and knows nothing about OpenChoreo, so any dashboard can use it.
 */
export function LineChart({
  data,
  ariaLabel,
  xLabel = 'Category',
  valueLabel = 'Value',
  formatX = defaultFormatX,
  formatValue = defaultFormat,
  height = DEFAULT_HEIGHT,
  emptyMessage = 'No data to display',
}: LineChartProps) {
  const classes = useStyles();
  const theme = useTheme();
  const tokens = useChoreoTokens();

  const { points, drawable, wholeNumbers } = useMemo(
    () => prepareLinePoints(data),
    [data],
  );

  if (drawable === 0) {
    return (
      <div className={classes.empty} role="status">
        <Typography variant="body2" color="textSecondary">
          {emptyMessage}
        </Typography>
      </div>
    );
  }

  const axisText = { fill: theme.palette.text.secondary, fontSize: 12 };

  // Rows can repeat an x, so number each repeat to keep every key distinct.
  const seen = new Map<string, number>();
  const tableRows = points.map(point => {
    const base = String(point.x);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return { key: `${base}#${count}`, point };
  });

  return (
    <div>
      <div role="img" aria-label={ariaLabel} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart
            data={points}
            margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
          >
            <CartesianGrid
              stroke={tokens.border.subtle}
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="x"
              tick={axisText}
              tickFormatter={(value: string | number) =>
                truncateLabel(formatX(value))
              }
              interval="preserveStartEnd"
              stroke={tokens.border.default}
            />
            <YAxis
              type="number"
              tick={axisText}
              allowDecimals={!wholeNumbers}
              tickFormatter={(value: number) => formatValue(value)}
              stroke={tokens.border.default}
            />
            <Tooltip
              formatter={(value: unknown) => formatValue(Number(value))}
              labelFormatter={(label: unknown) =>
                formatX(label as string | number)
              }
              contentStyle={{
                background: tokens.surface.raised,
                border: `1px solid ${tokens.border.default}`,
                color: theme.palette.text.primary,
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={valueLabel}
              stroke={tokens.chart.series[0]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
      <VisuallyHidden as="div">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">{xLabel}</th>
              <th scope="col">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map(({ key, point }) => (
              <tr key={key}>
                <th scope="row">{formatX(point.x)}</th>
                <td>
                  {point.value === null ? NO_VALUE : formatValue(point.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </div>
  );
}
