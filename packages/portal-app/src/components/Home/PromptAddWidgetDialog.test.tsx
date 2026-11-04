import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromptAddWidgetDialog } from './PromptAddWidgetDialog';

const widgets = [
  { name: 'OpenChoreoGeneratedWidget', title: 'Generated widget (preview)' },
  { name: 'OpenChoreoQuickActions', title: 'Quick Actions' },
];

const setup = () => {
  const handleAdd = jest.fn();
  render(
    <PromptAddWidgetDialog
      open
      onClose={jest.fn()}
      widgets={widgets}
      previews={{}}
      handleAdd={handleAdd}
    />,
  );
  return handleAdd;
};

describe('PromptAddWidgetDialog', () => {
  it('adds the generated widget with the matched preset', async () => {
    const handleAdd = setup();
    await userEvent.type(
      screen.getByLabelText('Describe the widget you want'),
      'deployments by status as a pie chart{enter}',
    );
    expect(handleAdd).toHaveBeenCalledWith(widgets[0], {
      preset: 'byStatus',
      title: 'Deployments by status',
    });
  });

  it('explains when the prompt cannot be built', async () => {
    const handleAdd = setup();
    await userEvent.type(
      screen.getByLabelText('Describe the widget you want'),
      'show me the weather{enter}',
    );
    expect(handleAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent("can't build that");
  });

  it('adds a listed widget without settings', async () => {
    const handleAdd = setup();
    await userEvent.click(
      screen.getAllByRole('button', { name: /Quick Actions/ })[0],
    );
    expect(handleAdd).toHaveBeenCalledWith(widgets[1]);
  });

  it('filters the list with the search box', async () => {
    setup();
    await userEvent.type(screen.getByLabelText('Search widgets'), 'quick');
    expect(screen.queryByText('Generated widget (preview)')).toBeNull();
    expect(screen.getAllByText('Quick Actions').length).toBeGreaterThan(0);
  });

  it('does not list the generated widget as a card', () => {
    setup();
    expect(screen.queryByText('Generated widget (preview)')).toBeNull();
  });
});
