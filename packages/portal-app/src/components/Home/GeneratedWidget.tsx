import { Typography } from '@material-ui/core';
import {
  catalogWithDeployments,
  deploymentFetchPage,
  deploymentSpecs,
  MOCK_NOW,
} from '@openchoreo/genui-core';
import { GenUiWidget } from '@openchoreo/genui-react';

const PRESETS = ['byEnvironment', 'activeCount', 'perDay', 'byStatus'] as const;
type Preset = (typeof PRESETS)[number];

const isPreset = (value: unknown): value is Preset =>
  PRESETS.includes(value as Preset);

// Created once, because the widget reloads when these change identity.
const fetchPage = deploymentFetchPage();
const NAMESPACES = ['default'];

export interface GeneratedWidgetContentProps {
  /** Which ready-made widget to draw. Unknown or missing values use the first. */
  preset?: string;
}

/**
 * Draws a ready-made generated widget over sample data. This is the first,
 * mock-data version: it proves the widget behaves like any other home page
 * widget before real data is connected.
 */
export function GeneratedWidgetContent({
  preset,
}: GeneratedWidgetContentProps) {
  const key: Preset = isPreset(preset) ? preset : 'byEnvironment';
  return (
    <div>
      <GenUiWidget
        spec={deploymentSpecs[key]}
        catalog={catalogWithDeployments}
        fetchPage={fetchPage}
        namespaces={NAMESPACES}
        now={MOCK_NOW}
      />
      <Typography variant="caption" color="textSecondary">
        Sample data (preview)
      </Typography>
    </div>
  );
}
