import type { CatalogEndpoint } from './catalog';
import { PipelineDeps, PipelineError, runPipeline } from './pipeline';
import { WidgetSpec } from './spec';
import { validateSpec } from './validate';
import {
  buildViewModel,
  explainIssues,
  explainPipelineError,
  ViewModel,
  ViewModelOptions,
} from './viewModel';

export interface LoadWidgetOptions extends PipelineDeps {
  /** Optional modules the deployment has installed. Defaults to core only. */
  installedModules?: ReadonlySet<string>;
  view?: ViewModelOptions;
  /**
   * Called with the original error when loading fails, so the host can log
   * it. The person looking at the widget only sees a plain message.
   */
  onError?: (error: unknown) => void;
}

export interface LoadedWidget {
  /** The widget's own title, or a plain default when the spec is unreadable. */
  title: string;
  /** What to draw, or why there is nothing to draw. */
  model: ViewModel;
}

const DEFAULT_TITLE = 'Widget';

/**
 * Everything a widget needs, in one call: read the saved spec, check it
 * against the catalog, fetch its data, and shape the result. It never throws.
 * Every failure becomes an explanation the person can read.
 */
export async function loadWidget(
  rawSpec: unknown,
  catalog: CatalogEndpoint[],
  options: LoadWidgetOptions,
): Promise<LoadedWidget> {
  const parsed = WidgetSpec.safeParse(rawSpec);
  if (!parsed.success) {
    return {
      title: DEFAULT_TITLE,
      model: explainPipelineError(
        'bad_spec',
        'The saved widget is not in a format this version understands.',
      ),
    };
  }
  const spec = parsed.data;

  const issues = validateSpec(spec, catalog, options.installedModules);
  if (issues.length > 0) {
    return { title: spec.title, model: explainIssues(issues) };
  }

  try {
    const result = await runPipeline(spec, catalog, options);
    return {
      title: spec.title,
      model: buildViewModel(spec.view, result, options.view),
    };
  } catch (error) {
    options.onError?.(error);
    const code = error instanceof PipelineError ? error.code : 'fetch_failed';
    // The raw text of a failed fetch can name internal addresses or servers,
    // so people see a plain message and the original goes to onError.
    const message =
      error instanceof PipelineError && code !== 'fetch_failed'
        ? error.message
        : 'Could not load the data for this widget.';
    return {
      title: spec.title,
      model: explainPipelineError(code, message),
    };
  }
}
