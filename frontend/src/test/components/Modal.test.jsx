import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../../components/shared/Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal open={false} onClose={vi.fn()} title="Test">
        <p>Content</p>
      </Modal>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders title and children when open', () => {
    render(
      <Modal open={true} onClose={vi.fn()} title="My Modal">
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.getByText('My Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('calls onClose when clicking backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>
    );
    fireEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking content', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>
    );
    fireEvent.click(screen.getByText('Content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when clicking close button', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>
    );
    fireEvent.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
