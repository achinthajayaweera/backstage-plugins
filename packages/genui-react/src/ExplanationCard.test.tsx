import { render, screen } from '@testing-library/react';
import type { Explanation } from '@openchoreo/genui-core';
import { ExplanationCard } from './ExplanationCard';

const explanation = (suggestions: string[]): Explanation => ({
  kind: 'explanation',
  reason: 'no_data',
  title: 'No data to show',
  message: 'There is nothing to show for this chart yet.',
  suggestions,
});

describe('ExplanationCard', () => {
  it('shows the title, the message and each suggestion', () => {
    render(
      <ExplanationCard
        explanation={explanation(['Check again later.', 'Try another widget.'])}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'No data to show' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('There is nothing to show for this chart yet.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Check again later.')).toBeInTheDocument();
  });

  it('shows no list when there are no suggestions', () => {
    render(<ExplanationCard explanation={explanation([])} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('is announced as a status message', () => {
    render(<ExplanationCard explanation={explanation([])} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
