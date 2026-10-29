import { Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { VisuallyHidden } from '../VisuallyHidden';
import { formatMetricValue, MetricFormat, NO_VALUE } from './format';

export interface MetricCardProps {
  /** What is being measured, for example "Failed runs". */
  label: string;
  /** The number to show. Anything that is not a finite number shows a dash. */
  value: number | null | undefined;
  /**
   * How to show the value: `number` (default), `percent` (the value is a
   * fraction, so 0.25 shows as 25%) or `duration` (the value is in seconds).
   */
  format?: MetricFormat;
  /** Optional small text under the value, for example "last 30 days". */
  caption?: string;
}

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1, 0),
  },
  value: {
    fontWeight: theme.typography.fontWeightMedium as number,
    fontVariantNumeric: 'tabular-nums',
  },
}));

/**
 * A single headline number with a label. It only shows what it is given: it
 * makes no API calls and knows nothing about OpenChoreo, so any dashboard can
 * use it.
 */
export function MetricCard({
  label,
  value,
  format = 'number',
  caption,
}: MetricCardProps) {
  const classes = useStyles();
  const text = formatMetricValue(value, format);

  return (
    <div className={classes.root} role="group" aria-label={label}>
      <Typography variant="body2" color="textSecondary">
        {label}
      </Typography>
      <Typography variant="h4" component="p" className={classes.value}>
        {text}
        {text === NO_VALUE && (
          <VisuallyHidden as="span"> No data</VisuallyHidden>
        )}
      </Typography>
      {caption && (
        <Typography variant="caption" color="textSecondary">
          {caption}
        </Typography>
      )}
    </div>
  );
}
