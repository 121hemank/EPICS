import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination, { usePagination, getPaginatedData } from '../../components/shared/Pagination';

describe('Pagination', () => {
  it('renders nothing when totalPages <= 1', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders page buttons', () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />
    );
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Next »')).toBeInTheDocument();
    expect(screen.getByText('« Prev')).toBeInTheDocument();
  });

  it('calls onPageChange when clicking a page', () => {
    const onChange = vi.fn();
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={onChange} />
    );
    fireEvent.click(screen.getByText('3'));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('highlights current page', () => {
    render(
      <Pagination currentPage={3} totalPages={5} onPageChange={vi.fn()} />
    );
    const activeBtn = screen.getByText('3');
    expect(activeBtn).toHaveClass('page-btn-active');
  });

  it('disables prev on first page', () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />
    );
    expect(screen.getByText('« Prev')).toBeDisabled();
  });

  it('disables next on last page', () => {
    render(
      <Pagination currentPage={5} totalPages={5} onPageChange={vi.fn()} />
    );
    expect(screen.getByText('Next »')).toBeDisabled();
  });

  it('shows ellipsis for many pages', () => {
    render(
      <Pagination currentPage={1} totalPages={20} onPageChange={vi.fn()} />
    );
    expect(screen.getByText('...')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });
});

describe('usePagination', () => {
  it('returns correct totalPages', () => {
    expect(usePagination([1, 2, 3, 4, 5], 2).totalPages).toBe(3);
  });

  it('returns at least 1 page for empty data', () => {
    expect(usePagination([], 10).totalPages).toBe(1);
  });
});

describe('getPaginatedData', () => {
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('returns first page', () => {
    expect(getPaginatedData(data, 1, 3)).toEqual([1, 2, 3]);
  });

  it('returns second page', () => {
    expect(getPaginatedData(data, 2, 3)).toEqual([4, 5, 6]);
  });

  it('returns last partial page', () => {
    expect(getPaginatedData(data, 4, 3)).toEqual([10]);
  });

  it('returns empty array for empty data', () => {
    expect(getPaginatedData([], 1, 10)).toEqual([]);
  });
});
