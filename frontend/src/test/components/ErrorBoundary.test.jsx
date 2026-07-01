import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../../components/shared/ErrorBoundary';

const Bomb = ({ shouldThrow }) => {
  if (shouldThrow) throw new Error('Kaboom!');
  return <p>All good</p>;
};

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <p>Hello</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders fallback UI on error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Kaboom!')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    console.error.mockRestore();
  });

  it('resets and re-renders children on Try Again click', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <ErrorBoundary>
        <p>Always visible</p>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Try Again'));
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    console.error.mockRestore();
  });

  it('uses custom fallback when provided', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    console.error.mockRestore();
  });

  it('calls fallback function with error and reset', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fallbackFn = vi.fn(() => <div>Function fallback</div>);
    render(
      <ErrorBoundary fallback={fallbackFn}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(fallbackFn).toHaveBeenCalledWith({
      error: expect.any(Error),
      reset: expect.any(Function)
    });
    expect(screen.getByText('Function fallback')).toBeInTheDocument();
    console.error.mockRestore();
  });
});
