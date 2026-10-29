import { render, screen } from '@testing-library/react';
import { MetricCard } from './MetricCard';

describe('MetricCard', () => {
  it('shows the label and the value', () => {
    render(<MetricCard label="Components" value={42} />);
    expect(
      screen.getByRole('group', { name: 'Components' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Components')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('formats a percent value from a fraction', () => {
    render(<MetricCard label="Success rate" value={0.5} format="percent" />);
    expect(screen.getByText(/50/)).toBeInTheDocument();
    expect(screen.getByText(/%/)).toBeInTheDocument();
  });

  it('formats a duration value from seconds', () => {
    render(<MetricCard label="Build time" value={3725} format="duration" />);
    expect(screen.getByText('1h 2m')).toBeInTheDocument();
  });

  it('shows the caption when given one', () => {
    render(<MetricCard label="Runs" value={7} caption="last 30 days" />);
    expect(screen.getByText('last 30 days')).toBeInTheDocument();
  });

  it('shows no caption element when none is given', () => {
    render(<MetricCard label="Runs" value={7} />);
    expect(screen.queryByText('last 30 days')).not.toBeInTheDocument();
  });

  it.each([null, undefined, Number.NaN])(
    'shows a dash and tells screen readers there is no data for %s',
    bad => {
      render(<MetricCard label="Runs" value={bad as any} />);
      expect(screen.getByText(/—/)).toBeInTheDocument();
      expect(screen.getByText(/No data/)).toBeInTheDocument();
    },
  );

  it('does not claim "No data" when there is a number', () => {
    render(<MetricCard label="Runs" value={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByText(/No data/)).not.toBeInTheDocument();
  });
});
