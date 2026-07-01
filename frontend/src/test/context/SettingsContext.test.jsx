import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, renderHook } from '@testing-library/react';
import { SettingsProvider, useSettings } from '../../context/SettingsContext';

describe('SettingsContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides default settings', () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: SettingsProvider
    });
    expect(result.current.settings.backendUrl).toBe('http://127.0.0.1:8000');
    expect(result.current.settings.theme).toBe('light');
    expect(result.current.settings.sentimentWeight).toBe(50);
    expect(result.current.settings.ratingWeight).toBe(50);
    expect(result.current.settings.displayName).toBe('');
  });

  it('updateSettings merges partial updates', () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: SettingsProvider
    });
    act(() => {
      result.current.updateSettings({ displayName: 'John', theme: 'dark' });
    });
    expect(result.current.settings.displayName).toBe('John');
    expect(result.current.settings.theme).toBe('dark');
    expect(result.current.settings.backendUrl).toBe('http://127.0.0.1:8000');
  });

  it('persists settings to localStorage', () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: SettingsProvider
    });
    act(() => {
      result.current.updateSettings({ displayName: 'Persisted' });
    });
    const stored = JSON.parse(localStorage.getItem('epics_crm_settings'));
    expect(stored.displayName).toBe('Persisted');
  });

  it('loads settings from localStorage on mount', () => {
    localStorage.setItem('epics_crm_settings', JSON.stringify({
      displayName: 'Preloaded', theme: 'dark'
    }));
    const { result } = renderHook(() => useSettings(), {
      wrapper: SettingsProvider
    });
    expect(result.current.settings.displayName).toBe('Preloaded');
    expect(result.current.settings.theme).toBe('dark');
  });

  it('throws when useSettings is used outside provider', () => {
    expect(() => renderHook(() => useSettings())).toThrow(
      'useSettings must be used within SettingsProvider'
    );
  });

  it('adds dark class to body when theme is dark', () => {
    const { result } = renderHook(() => useSettings(), { wrapper: SettingsProvider });
    act(() => {
      result.current.updateSettings({ theme: 'dark' });
    });
    expect(document.body.classList.contains('dark')).toBe(true);
  });
});
