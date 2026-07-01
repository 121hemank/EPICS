import { describe, it, expect, vi } from 'vitest';
import { addToastListener, showToast } from '../../utils/toast';

describe('toast', () => {
  it('addToastListener returns unsubscribe function', () => {
    const fn = vi.fn();
    const unsubscribe = addToastListener(fn);
    expect(typeof unsubscribe).toBe('function');
  });

  it('showToast calls all listeners with message and type', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    addToastListener(fn1);
    addToastListener(fn2);

    showToast('Hello', 'success');
    expect(fn1).toHaveBeenCalledWith({ message: 'Hello', type: 'success', id: expect.any(Number) });
    expect(fn2).toHaveBeenCalledWith({ message: 'Hello', type: 'success', id: expect.any(Number) });
  });

  it('showToast defaults type to "info"', () => {
    const fn = vi.fn();
    addToastListener(fn);
    showToast('Test');
    expect(fn).toHaveBeenCalledWith({ message: 'Test', type: 'info', id: expect.any(Number) });
  });

  it('unsubscribe removes listener', () => {
    const fn = vi.fn();
    const unsubscribe = addToastListener(fn);
    unsubscribe();
    showToast('Should not fire');
    expect(fn).not.toHaveBeenCalled();
  });
});
