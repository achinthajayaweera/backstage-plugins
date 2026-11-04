import type { ComponentType } from 'react';
import {
  MyProjectsWidgetPreview,
  QuickActionsSectionPreview,
} from '@openchoreo/backstage-plugin';
import { RecentDeploymentsPreview } from './RecentDeploymentsCard';
import { RecentlyVisitedPreview } from './RecentlyVisitedCard';
import { GeneratedWidgetContent } from './GeneratedWidget';

const MyProjectsPreview = () => <MyProjectsWidgetPreview disableCard />;
const QuickActionsPreview = () => <QuickActionsSectionPreview hideTitle />;
// Sample data only, never an API call.
const GeneratedPreview = () => <GeneratedWidgetContent />;

/**
 * Static previews for the "Add widget" gallery, keyed by widget name. They
 * show sample data and never call an API.
 */
export const widgetPreviews: Record<string, ComponentType> = {
  OpenChoreoRecentlyVisited: RecentlyVisitedPreview,
  OpenChoreoMyProjects: MyProjectsPreview,
  OpenChoreoQuickActions: QuickActionsPreview,
  OpenChoreoRecentDeployments: RecentDeploymentsPreview,
  OpenChoreoGeneratedWidget: GeneratedPreview,
};
