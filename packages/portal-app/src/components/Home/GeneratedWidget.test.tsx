import { render, screen } from '@testing-library/react';
import { GeneratedWidgetContent } from './GeneratedWidget';

// The real charts need a browser to measure. Stub them so these tests check
// which component is drawn and with what, not how it looks.
jest.mock('@openchoreo/backstage-design-system', () => {
  const stub = (name: string) => (props: any) =>
    <div data-testid={name}>{JSON.stringify(props)}</div>;
  return {
    BarChart: stub('bar'),
    PieChart: stub('pie'),
    LineChart: stub('line'),
    MetricCard: stub('metric'),
  };
});

describe('GeneratedWidgetContent', () => {
  it('draws deployments per environment when no preset is saved yet', async () => {
    render(<GeneratedWidgetContent />);
    expect(await screen.findByTestId('bar')).toBeInTheDocument();
  });

  it('draws the chosen preset', async () => {
    render(<GeneratedWidgetContent preset="activeCount" />);
    const metric = await screen.findByTestId('metric');
    expect(JSON.parse(metric.textContent ?? '{}').value).toBe(8);
  });

  it('falls back to the first preset for an unknown value', async () => {
    render(<GeneratedWidgetContent preset="nope" />);
    expect(await screen.findByTestId('bar')).toBeInTheDocument();
  });

  it('says that the data is sample data', async () => {
    render(<GeneratedWidgetContent />);
    await screen.findByTestId('bar');
    expect(screen.getByText('Sample data (preview)')).toBeInTheDocument();
  });
});
