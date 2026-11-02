import { useEffect, useRef, useState } from 'react';
import { CircularProgress } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  CatalogEndpoint,
  LoadedWidget,
  loadWidget,
  PipelineDeps,
} from '@openchoreo/genui-core';
import { GenUiView } from './GenUiView';

export interface GenUiWidgetProps {
  /** The saved widget, exactly as it was stored. */
  spec: unknown;
  /** The data sources a widget may use. Keep this value stable between renders. */
  catalog: CatalogEndpoint[];
  /**
   * Fetches one page of an endpoint with the signed-in person's own access.
   * Keep this function stable between renders, for example with useCallback.
   */
  fetchPage: PipelineDeps['fetchPage'];
  /** Namespaces to read from. */
  namespaces: string[];
  /** Optional modules this deployment has installed. Defaults to core only. */
  installedModules?: ReadonlySet<string>;
  /** Called with the original error when loading fails, so the host can log it. */
  onError?: (error: unknown) => void;
  /** Overrides the current time, for repeatable tests. */
  now?: number;
}

const useStyles = makeStyles(theme => ({
  loading: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(3),
  },
}));

/**
 * Loads a saved widget and draws it, or explains why it cannot. It loads again
 * when the saved widget's content, the namespaces, the catalog or the fetch
 * function change, and it ignores a slower earlier answer that arrives late.
 */
export function GenUiWidget(props: GenUiWidgetProps) {
  const { catalog, fetchPage, installedModules } = props;
  const classes = useStyles();
  const [loaded, setLoaded] = useState<LoadedWidget | undefined>();

  // Compared by content, so a new object holding the same widget does not load again.
  const specKey = JSON.stringify(props.spec);
  const namespaceKey = props.namespaces.join('\n');

  // The newest props, read inside the effect without making it run again.
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    let current = true;
    setLoaded(undefined);
    const { spec, namespaces, now } = latest.current;
    loadWidget(spec, catalog, {
      namespaces,
      fetchPage,
      installedModules,
      now,
      onError: error => latest.current.onError?.(error),
    }).then(result => {
      if (current) setLoaded(result);
    });
    return () => {
      current = false;
    };
  }, [specKey, namespaceKey, catalog, fetchPage, installedModules]);

  if (!loaded) {
    return (
      <div className={classes.loading}>
        <CircularProgress size={24} aria-label="Loading widget" />
      </div>
    );
  }
  return <GenUiView model={loaded.model} title={loaded.title} />;
}
