import { Typography } from '@material-ui/core';
import {
  BarChart,
  LineChart,
  MetricCard,
  PieChart,
} from '@openchoreo/backstage-design-system';
import type { ViewModel } from '@openchoreo/genui-core';
import { ExplanationCard } from './ExplanationCard';

export interface GenUiViewProps {
  /** What to draw, from `buildViewModel` in `@openchoreo/genui-core`. */
  model: ViewModel;
  /** Accessible name for the widget, usually its title. */
  title: string;
}

type Drawable = Exclude<ViewModel, { kind: 'explanation' }>;

function draw(model: Drawable, title: string) {
  switch (model.kind) {
    case 'bar':
      return (
        <BarChart
          data={model.data}
          ariaLabel={title}
          orientation={model.horizontal ? 'horizontal' : 'vertical'}
        />
      );
    case 'pie':
      return <PieChart data={model.data} ariaLabel={title} />;
    case 'line':
      return <LineChart data={model.data} ariaLabel={title} />;
    default:
      return (
        <MetricCard
          label={model.label}
          value={model.value}
          format={model.format}
        />
      );
  }
}

/**
 * Draws one widget from its view model with the matching design-system
 * component, or shows an explanation when there is nothing to draw.
 */
export function GenUiView({ model, title }: GenUiViewProps) {
  if (model.kind === 'explanation') {
    return <ExplanationCard explanation={model} />;
  }
  return (
    <div>
      {draw(model, title)}
      {model.notice && (
        <Typography variant="caption" color="textSecondary" role="note">
          {model.notice}
        </Typography>
      )}
    </div>
  );
}
