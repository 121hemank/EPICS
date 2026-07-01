import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricCard from '../../components/shared/MetricCard';

describe('MetricCard', () => {
  it('renders title and value', () => {
    render(<MetricCard title="Total Leads" value={42} />);
    expect(screen.getByText('Total Leads')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('displays 0 when value is null', () => {
    render(<MetricCard title="Empty" />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('displays 0 when value is undefined', () => {
    render(<MetricCard title="Undefined" value={undefined} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('has metric card class', () => {
    const { container } = render(<MetricCard title="Test" value={1} />);
    expect(container.firstChild).toHaveClass('vendor-metric-card');
  });
});
