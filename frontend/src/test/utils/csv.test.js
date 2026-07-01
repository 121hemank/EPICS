import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadCSV } from '../../utils/csv';

describe('downloadCSV', () => {
  beforeEach(() => {
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('alerts when no data', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    downloadCSV([], ['name'], 'test.csv');
    expect(alertSpy).toHaveBeenCalledWith('No data available to download.');
  });

  it('creates a CSV blob and triggers download', () => {
    const data = [{ name: 'Alice', age: 30 }];
    downloadCSV(data, ['name', 'age'], 'people.csv');

    expect(document.body.appendChild).toHaveBeenCalled();
    expect(document.body.removeChild).toHaveBeenCalled();
  });

  it('escapes double quotes in values', () => {
    const data = [{ name: 'John "Johnny" Doe' }];
    downloadCSV(data, ['name'], 'test.csv');

    expect(document.body.appendChild).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});
