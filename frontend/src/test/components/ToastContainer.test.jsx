import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import ToastContainer from '../../components/shared/ToastContainer';
import { showToast } from '../../utils/toast';

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without toasts initially', () => {
    const { container } = render(<ToastContainer />);
    expect(container.querySelector('.toast')).toBeNull();
  });

  it('shows toast when showToast is called', () => {
    render(<ToastContainer />);
    act(() => {
      showToast('Operation successful', 'success');
    });
    expect(screen.getByText('Operation successful')).toBeInTheDocument();
    expect(screen.getByText('Operation successful')).toHaveClass('toast', 'success');
  });

  it('auto-removes toast after 3 seconds', () => {
    render(<ToastContainer />);
    act(() => {
      showToast('Temporary', 'info');
    });
    expect(screen.getByText('Temporary')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('Temporary')).toBeNull();
  });

  it('shows multiple toasts', () => {
    render(<ToastContainer />);
    act(() => {
      showToast('First', 'info');
      showToast('Second', 'error');
    });
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('has toast-container class on wrapper', () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toHaveClass('toast-container');
  });
});
