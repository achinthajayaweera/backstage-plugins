import { Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import type { Explanation } from '@openchoreo/genui-core';

export interface ExplanationCardProps {
  explanation: Explanation;
}

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(2),
  },
  suggestions: {
    margin: 0,
    paddingLeft: theme.spacing(2.5),
  },
}));

/** Says, in plain words, why a widget cannot show data and what to do next. */
export function ExplanationCard({ explanation }: ExplanationCardProps) {
  const classes = useStyles();
  return (
    <div className={classes.root} role="status">
      <Typography variant="subtitle1" component="h3">
        {explanation.title}
      </Typography>
      <Typography variant="body2" color="textSecondary">
        {explanation.message}
      </Typography>
      {explanation.suggestions.length > 0 && (
        <ul className={classes.suggestions}>
          {explanation.suggestions.map(suggestion => (
            <li key={suggestion}>
              <Typography variant="body2" component="span">
                {suggestion}
              </Typography>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
