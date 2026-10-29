import { formatMetricValue, NO_VALUE } from './format';

describe('formatMetricValue', () => {
  describe('number', () => {
    it('is the default format', () => {
      expect(formatMetricValue(42, undefined, 'en-US')).toBe('42');
    });

    it('groups thousands and keeps at most two decimals', () => {
      expect(formatMetricValue(1234.567, 'number', 'en-US')).toBe('1,234.57');
    });

    it('shows zero and negative numbers', () => {
      expect(formatMetricValue(0, 'number', 'en-US')).toBe('0');
      expect(formatMetricValue(-5, 'number', 'en-US')).toBe('-5');
    });
  });

  describe('percent', () => {
    it('treats the value as a fraction', () => {
      expect(formatMetricValue(0.256, 'percent', 'en-US')).toBe('25.6%');
      expect(formatMetricValue(1, 'percent', 'en-US')).toBe('100%');
      expect(formatMetricValue(0, 'percent', 'en-US')).toBe('0%');
    });
  });

  describe('duration', () => {
    it('shows seconds on their own', () => {
      expect(formatMetricValue(45, 'duration')).toBe('45s');
    });

    it('shows zero seconds', () => {
      expect(formatMetricValue(0, 'duration')).toBe('0s');
    });

    it('shows the two largest non-zero units', () => {
      expect(formatMetricValue(3725, 'duration')).toBe('1h 2m');
      expect(formatMetricValue(90061, 'duration')).toBe('1d 1h');
      expect(formatMetricValue(125, 'duration')).toBe('2m 5s');
    });

    it('drops a zero unit instead of printing it', () => {
      expect(formatMetricValue(3600, 'duration')).toBe('1h');
      expect(formatMetricValue(60, 'duration')).toBe('1m');
    });

    it('rounds to whole seconds before splitting into units', () => {
      expect(formatMetricValue(59.6, 'duration')).toBe('1m');
      expect(formatMetricValue(0.4, 'duration')).toBe('0s');
    });

    it('cannot show a negative duration', () => {
      expect(formatMetricValue(-1, 'duration')).toBe(NO_VALUE);
    });
  });

  describe('missing values', () => {
    it.each([null, undefined, Number.NaN, Infinity, -Infinity])(
      'gives the placeholder for %s',
      bad => {
        expect(formatMetricValue(bad as any, 'number')).toBe(NO_VALUE);
        expect(formatMetricValue(bad as any, 'percent')).toBe(NO_VALUE);
        expect(formatMetricValue(bad as any, 'duration')).toBe(NO_VALUE);
      },
    );
  });
});
