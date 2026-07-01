import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../context/AuthContext';

vi.mock('../../lib/supabase-client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      }))
    }
  }
}));

import { supabase } from '../../lib/supabase-client';

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in loading state', () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    });
    expect(result.current.loading).toBe(true);
  });

  it('sets user when getUser returns one', async () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual(mockUser);
  });

  it('sets user to null when no user returned', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('throws when useAuth is used outside provider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within AuthProvider'
    );
  });

  it('refreshUser updates user state', async () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const newUser = { id: '456', email: 'new@example.com' };
    supabase.auth.getUser.mockResolvedValue({ data: { user: newUser } });
    await act(async () => {
      await result.current.refreshUser();
    });
    expect(result.current.user).toEqual(newUser);
  });
});
