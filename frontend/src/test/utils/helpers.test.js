import { describe, it, expect } from 'vitest';
import {
  formatDateTime,
  getCustomerStatus,
  sentimentToScore,
  scoreToSentiment,
  getPriorityBadge,
  getStageBadgeClass,
  getStatusBadgeClass,
  getVendorStatusBadgeClass
} from '../../utils/helpers';

describe('formatDateTime', () => {
  it('returns formatted date for valid date string', () => {
    const result = formatDateTime('2024-01-15T10:30:00Z');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('returns "-" for null', () => {
    expect(formatDateTime(null)).toBe('-');
  });

  it('returns "-" for undefined', () => {
    expect(formatDateTime(undefined)).toBe('-');
  });

  it('returns "-" for empty string', () => {
    expect(formatDateTime('')).toBe('-');
  });
});

describe('getCustomerStatus', () => {
  it('returns "Active" for date within 30 days', () => {
    const recent = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(getCustomerStatus(recent)).toBe('Active');
  });

  it('returns "Inactive" for date older than 30 days', () => {
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    expect(getCustomerStatus(old)).toBe('Inactive');
  });

  it('returns "Inactive" for null', () => {
    expect(getCustomerStatus(null)).toBe('Inactive');
  });
});

describe('sentimentToScore', () => {
  it('returns 1 for negative', () => {
    expect(sentimentToScore('Negative')).toBe(1);
  });

  it('returns 3 for neutral', () => {
    expect(sentimentToScore('Neutral')).toBe(3);
  });

  it('returns 5 for positive', () => {
    expect(sentimentToScore('Positive')).toBe(5);
  });

  it('returns 3 for null', () => {
    expect(sentimentToScore(null)).toBe(3);
  });

  it('is case-insensitive', () => {
    expect(sentimentToScore('negative')).toBe(1);
    expect(sentimentToScore('NEUTRAL')).toBe(3);
    expect(sentimentToScore('Positive')).toBe(5);
  });
});

describe('scoreToSentiment', () => {
  it('returns "Negative" for score <= 2', () => {
    expect(scoreToSentiment(1)).toBe('Negative');
    expect(scoreToSentiment(2)).toBe('Negative');
  });

  it('returns "Neutral" for score 3-4', () => {
    expect(scoreToSentiment(3)).toBe('Neutral');
    expect(scoreToSentiment(4)).toBe('Neutral');
  });

  it('returns "Positive" for score > 4', () => {
    expect(scoreToSentiment(5)).toBe('Positive');
  });
});

describe('getPriorityBadge', () => {
  it('returns High priority badge', () => {
    const result = getPriorityBadge('High');
    expect(result.text).toBe('High');
    expect(result.className).toContain('priority-high');
  });

  it('returns Medium as default', () => {
    const result = getPriorityBadge(null);
    expect(result.text).toBe('Medium');
    expect(result.className).toContain('priority-medium');
  });
});

describe('getStageBadgeClass', () => {
  it('returns lowercase stage class', () => {
    expect(getStageBadgeClass('Prospecting')).toBe('stage-badge stage-prospecting');
  });

  it('defaults to prospecting', () => {
    expect(getStageBadgeClass(null)).toBe('stage-badge stage-prospecting');
  });
});

describe('getStatusBadgeClass', () => {
  it('normalizes status with spaces to hyphens', () => {
    expect(getStatusBadgeClass('On Hold')).toBe('lead-status-badge status-on-hold');
  });

  it('defaults to open', () => {
    expect(getStatusBadgeClass(null)).toBe('lead-status-badge status-open');
  });
});

describe('getVendorStatusBadgeClass', () => {
  it('returns active class for Active', () => {
    const result = getVendorStatusBadgeClass('Active');
    expect(result).toContain('vendor-active');
  });

  it('returns inactive class for Inactive', () => {
    const result = getVendorStatusBadgeClass('Inactive');
    expect(result).toContain('vendor-inactive');
  });

  it('defaults to active', () => {
    const result = getVendorStatusBadgeClass(null);
    expect(result).toContain('vendor-active');
  });
});
