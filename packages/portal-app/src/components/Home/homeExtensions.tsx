import { createFrontendModule } from '@backstage/frontend-plugin-api';
import {
  HomePageWidgetBlueprint,
  HomePageLayoutBlueprint,
} from '@backstage/plugin-home-react/alpha';

// Home page widgets + layout (new frontend system). Each widget's card
// extension owns the card frame and title, so the components render body-only
// to avoid duplicate titles. `params.name` is the widget's core.extensionName
// (used in the default layout); the `oc-` id prefix avoids clashing with the
// home plugin's built-in widgets.
const defaultWidgetLayout = {
  height: { minRows: 4 },
  width: { minColumns: 4 },
};

const recentlyVisitedWidget = HomePageWidgetBlueprint.make({
  name: 'oc-recently-visited',
  params: {
    name: 'OpenChoreoRecentlyVisited',
    title: 'Recently Visited',
    description: 'Pages and entities you visited recently.',
    layout: defaultWidgetLayout,
    components: async () => {
      const { RecentlyVisitedContent } = await import('./RecentlyVisitedCard');
      return { Content: RecentlyVisitedContent };
    },
  },
});

const myProjectsWidget = HomePageWidgetBlueprint.make({
  name: 'oc-my-projects',
  params: {
    name: 'OpenChoreoMyProjects',
    title: 'My Projects',
    description: 'Project, component and deployment counts at a glance.',
    layout: defaultWidgetLayout,
    components: async () => {
      const { MyProjectsWidget } = await import('@openchoreo/backstage-plugin');
      return { Content: () => <MyProjectsWidget disableCard /> };
    },
  },
});

const quickActionsWidget = HomePageWidgetBlueprint.make({
  name: 'oc-quick-actions',
  params: {
    name: 'OpenChoreoQuickActions',
    title: 'Quick Actions',
    description: 'Shortcuts to common tasks like creating a component.',
    layout: defaultWidgetLayout,
    components: async () => {
      const { QuickActionsSection } = await import(
        '@openchoreo/backstage-plugin'
      );
      return { Content: () => <QuickActionsSection hideTitle /> };
    },
  },
});

const recentDeploymentsWidget = HomePageWidgetBlueprint.make({
  name: 'oc-recent-deployments',
  params: {
    name: 'OpenChoreoRecentDeployments',
    title: 'Recent Deployments',
    description: 'Latest releases across your components.',
    layout: defaultWidgetLayout,
    components: async () => {
      const { RecentDeploymentsContent } = await import(
        './RecentDeploymentsCard'
      );
      return { Content: RecentDeploymentsContent };
    },
  },
});

const generatedWidget = HomePageWidgetBlueprint.make({
  name: 'oc-generated-widget',
  params: {
    name: 'OpenChoreoGeneratedWidget',
    title: 'Generated widget (preview)',
    description:
      'A chart or number drawn from a ready-made widget spec, using sample data. Pick which one with the settings icon.',
    layout: defaultWidgetLayout,
    settings: {
      schema: {
        title: 'Generated widget',
        type: 'object',
        properties: {
          title: { type: 'string', title: 'Title' },
          preset: {
            type: 'string',
            title: 'Widget',
            default: 'byEnvironment',
            oneOf: [
              { const: 'byEnvironment', title: 'Deployments per environment' },
              { const: 'activeCount', title: 'Active deployments' },
              { const: 'perDay', title: 'Deployments per day' },
              { const: 'byStatus', title: 'Deployments by status' },
            ],
          },
        },
      },
    },
    components: async () => {
      const { GeneratedWidgetContent } = await import('./GeneratedWidget');
      return { Content: GeneratedWidgetContent };
    },
  },
});

const homeLayout = HomePageLayoutBlueprint.make({
  params: {
    loader: async () => {
      const { HomePageLayout } = await import('./HomePageLayout');
      return HomePageLayout;
    },
  },
});

// Contributes the layout + widgets to `page:home`. The layout uses an
// internal input, so this must be a module of the `home` plugin.
export const homeModule = createFrontendModule({
  pluginId: 'home',
  extensions: [
    homeLayout,
    recentlyVisitedWidget,
    myProjectsWidget,
    quickActionsWidget,
    generatedWidget,
    recentDeploymentsWidget,
  ],
});
