import { ComponentType, useEffect, useMemo, useState } from 'react';
import Collapse from '@material-ui/core/Collapse';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import InputAdornment from '@material-ui/core/InputAdornment';
import InputBase from '@material-ui/core/InputBase';
import ButtonBase from '@material-ui/core/ButtonBase';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import SearchIcon from '@material-ui/icons/Search';
import { makeStyles } from '@material-ui/core/styles';
import type { AddWidgetDialogProps } from '@backstage/plugin-home/alpha';
import { InfoCard } from '@backstage/core-components';
import { matchPrompt, presetTitle } from './promptMatcher';
import { widgetPreviews } from './widgetPreviews';

const GENERATED_WIDGET = 'OpenChoreoGeneratedWidget';
const ROTATE_MS = 2500;

// Every example must be something matchPrompt can answer.
export const EXAMPLE_PROMPTS = [
  'Show my deployments per environment as a bar chart',
  'How many active deployments do I have?',
  'Show deployments by status as a pie chart',
  'Show deployments per day as a line chart',
];

const useStyles = makeStyles(theme => ({
  bar: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.spacing(2),
    padding: theme.spacing(3, 3),
    marginBottom: theme.spacing(2),
    transition: 'box-shadow 0.2s ease',
    '&:focus-within': { boxShadow: theme.shadows[4] },
  },
  label: { fontWeight: 600 },
  inputWrap: {
    position: 'relative',
    minHeight: 48,
    marginTop: theme.spacing(1),
  },
  example: {
    position: 'absolute',
    top: 6,
    left: 0,
    pointerEvents: 'none',
    color: theme.palette.text.secondary,
    animation: '$fade 2.5s ease-in-out',
  },
  '@keyframes fade': {
    '0%': { opacity: 0 },
    '15%': { opacity: 1 },
    '85%': { opacity: 1 },
    '100%': { opacity: 0 },
  },
  model: { marginTop: theme.spacing(1.5), minWidth: 260 },
  message: { marginTop: theme.spacing(1) },
  search: { marginBottom: theme.spacing(2) },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing(2),
    maxHeight: '55vh',
    overflowY: 'auto',
    padding: theme.spacing(0.5),
  },
  card: {
    flex: `0 0 calc((100% - ${theme.spacing(2) * 2}px) / 3)`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    borderRadius: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
    overflow: 'hidden',
    textAlign: 'left',
    '&:hover $addOverlay': { opacity: 1 },
  },
  previewFrame: {
    position: 'relative',
    height: 160,
    overflow: 'hidden',
    backgroundColor: theme.palette.background.default,
    pointerEvents: 'none',
  },
  previewScale: {
    position: 'absolute',
    top: 0,
    left: '50%',
    width: '166%',
    height: '166%',
    transform: 'translate(-50%, 0) scale(0.6)',
    transformOrigin: 'top center',
  },
  addOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    color: '#fff',
    opacity: 0,
    transition: 'opacity 0.15s ease',
    fontWeight: 600,
  },
  meta: { padding: theme.spacing(1.5) },
}));

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Replacement for the home page "Add widget" dialog. A prompt bar picks a
 * generated widget from typed text (mock matcher for now, an LLM later), and
 * the list below adds any widget as usual.
 */
type PromptAddWidgetDialogProps = AddWidgetDialogProps & {
  /** Preview components keyed by widget name. Defaults to the sample previews. */
  previews?: Record<string, ComponentType>;
};

export function PromptAddWidgetDialog(props: PromptAddWidgetDialogProps) {
  const {
    open,
    onClose,
    widgets,
    handleAdd,
    previews = widgetPreviews,
  } = props;
  const classes = useStyles();
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [model, setModel] = useState('anthropic');
  const [message, setMessage] = useState<string | undefined>();
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open || text || reducedMotion()) return undefined;
    const id = setInterval(
      () => setIndex(i => (i + 1) % EXAMPLE_PROMPTS.length),
      ROTATE_MS,
    );
    return () => clearInterval(id);
  }, [open, text]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return widgets
      .filter(w => w.name !== GENERATED_WIDGET)
      .filter(w => `${w.title ?? ''} ${w.name}`.toLowerCase().includes(q));
  }, [widgets, query]);

  const submit = () => {
    const preset = matchPrompt(text);
    const widget = widgets.find(w => w.name === GENERATED_WIDGET);
    if (!preset || !widget) {
      setMessage(
        `I can't build that yet. Try asking about deployments, for example: ${EXAMPLE_PROMPTS[0]}`,
      );
      return;
    }
    setMessage(undefined);
    setText('');
    handleAdd(widget, { preset, title: presetTitle(preset) });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Add new widget to dashboard</DialogTitle>
      <DialogContent>
        <div className={classes.bar} onFocus={() => setExpanded(true)}>
          <Typography variant="h6" className={classes.label}>
            What do you want your widget to do?
          </Typography>
          <div className={classes.inputWrap}>
            <InputBase
              fullWidth
              value={text}
              onChange={e => {
                setText(e.target.value);
                setMessage(undefined);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && text.trim()) {
                  e.preventDefault();
                  submit();
                }
              }}
              inputProps={{ 'aria-label': 'Describe the widget you want' }}
            />
            {!text && (
              <Typography
                key={index}
                className={classes.example}
                style={reducedMotion() ? { animation: 'none' } : undefined}
                aria-hidden
              >
                {EXAMPLE_PROMPTS[index]}
              </Typography>
            )}
          </div>
          <Collapse in={expanded}>
            <TextField
              select
              size="small"
              variant="outlined"
              className={classes.model}
              label="Model (preview, not connected yet)"
              value={model}
              onChange={e => setModel(e.target.value)}
            >
              <MenuItem value="anthropic">Anthropic</MenuItem>
              <MenuItem value="openai">OpenAI</MenuItem>
            </TextField>
          </Collapse>
          {message && (
            <Typography
              className={classes.message}
              variant="body2"
              color="textSecondary"
              role="status"
            >
              {message}
            </Typography>
          )}
        </div>
        <TextField
          fullWidth
          variant="outlined"
          size="small"
          placeholder="Search widgets"
          className={classes.search}
          value={query}
          onChange={e => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          inputProps={{ 'aria-label': 'Search widgets' }}
        />
        <div className={classes.grid}>
          {shown.map(widget => {
            const Preview = previews[widget.name];
            const title = widget.title ?? widget.name;
            return (
              <ButtonBase
                key={widget.name}
                className={classes.card}
                onClick={() => handleAdd(widget)}
                focusRipple
              >
                <div className={classes.previewFrame}>
                  <div
                    className={classes.previewScale}
                    aria-hidden="true"
                    {...{ inert: '' }}
                  >
                    <InfoCard title={title} divider>
                      {Preview ? (
                        <Preview />
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          No Preview Available
                        </Typography>
                      )}
                    </InfoCard>
                  </div>
                  <div className={classes.addOverlay}>
                    <Typography variant="button" style={{ color: '#fff' }}>
                      + Add widget
                    </Typography>
                  </div>
                </div>
                <div className={classes.meta}>
                  <Typography variant="subtitle2">{title}</Typography>
                  {widget.description && (
                    <Typography variant="caption" color="textSecondary">
                      {widget.description}
                    </Typography>
                  )}
                </div>
              </ButtonBase>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
