import { useMemo } from 'react';
import { Typography } from '@material-ui/core';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import {
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useChoreoTokens } from '../../theme/useChoreoTokens';
import { VisuallyHidden } from '../VisuallyHidden';
import { truncateLabel } from '../BarChart';
import { prepareSlices } from './slices';

export interface PieChartDatum {
  category: string;
  value: number;
}

export interface PieChartProps {
  /**
   * One slice per category. Values that are not a finite number above zero are
   * skipped, and rows that share a category are added together.
   */
  data: PieChartDatum[];
  /** Accessible name for the chart, for example the widget title. */
  ariaLabel: string;
  /** Meaning of `category`, used as a column header in the screen-reader table. */
  categoryLabel?: string;
  /** Meaning of `value`, used in the tooltip and the screen-reader table. */
  valueLabel?: string;
  /** Formats values for the tooltip and the screen-reader table. */
  formatValue?: (value: number) => string;
  /** Chart height in px. Defaults to 300. */
  height?: number;
  /** Shown instead of a chart when there is nothing to plot. */
  emptyMessage?: string;
  /**
   * Most slices drawn separately. Beyond this, the smallest slices are added
   * into one slice named `otherLabel`. Defaults to 8; the palette has 10
   * colours, so colours never repeat within a chart at the default.
   */
  maxSlices?: number;
  /** Name of the merged slice. Defaults to "Other". */
  otherLabel?: string;
}

const DEFAULT_HEIGHT = 300;
const DEFAULT_MAX_SLICES = 8;

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

const formatShare = (share: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(share);

/**
 * A pie (donut) chart. It only draws what it is given: it makes no API calls
 * and knows nothing about OpenChoreo, so any dashboard can use it.
 */
export function PieChart({
  data,
  ariaLabel,
  categoryLabel = 'Category',
  valueLabel = 'Value',
  formatValue = defaultFormat,
  height = DEFAULT_HEIGHT,
  emptyMessage = 'No data to display',
  maxSlices = DEFAULT_MAX_SLICES,
  otherLabel = 'Other',
}: PieChartProps) {
  const classes = useStyles();
  const theme = useTheme();
  const tokens = useChoreoTokens();

  const { slices } = useMemo(
    () => prepareSlices(data, maxSlices, otherLabel),
    [data, maxSlices, otherLabel],
  );

  if (slices.length === 0) {
    return (
      <div className={classes.empty} role="status">
        <Typography variant="body2" color="textSecondary">
          {emptyMessage}
        </Typography>
      </div>
    );
  }

  const shareByCategory = new Map(slices.map(s => [s.category, s.share]));
  const palette = tokens.chart.series;

  return (
    <div>
      <div role="img" aria-label={ariaLabel} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="category"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={slices.length > 1 ? 1 : 0}
              stroke={theme.palette.background.paper}
              isAnimationActive={false}
            >
              {slices.map((slice, index) => (
                <Cell
                  key={slice.category}
                  fill={palette[index % palette.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: unknown, name: unknown) => [
                `${formatValue(Number(value))} (${formatShare(
                  shareByCategory.get(String(name)) ?? 0,
                )})`,
                String(name),
              ]}
              contentStyle={{
                background: tokens.surface.raised,
                border: `1px solid ${tokens.border.default}`,
                color: theme.palette.text.primary,
              }}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{
                fontSize: 12,
                color: theme.palette.text.secondary,
              }}
              formatter={(value: unknown) => truncateLabel(String(value))}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
      <VisuallyHidden as="div">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">{categoryLabel}</th>
              <th scope="col">{valueLabel}</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {slices.map(slice => (
              <tr key={slice.category}>
                <th scope="row">{slice.category}</th>
                <td>{formatValue(slice.value)}</td>
                <td>{formatShare(slice.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </div>
  );
}
