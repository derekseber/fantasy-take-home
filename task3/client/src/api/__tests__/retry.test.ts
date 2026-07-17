import {
  isAbortError,
  parseRetryAfter,
  secondaryBackoffSeconds,
  sleep,
} from '../retry';

describe('parseRetryAfter', () => {
  it('parses delta-seconds with minimum 1', () => {
    expect(parseRetryAfter('0')).toBe(1);
    expect(parseRetryAfter('3')).toBe(3);
  });

  it('parses HTTP-date', () => {
    const now = Date.parse('Wed, 21 Oct 2015 07:28:00 GMT');
    const header = 'Wed, 21 Oct 2015 07:28:05 GMT';
    expect(parseRetryAfter(header, now)).toBe(5);
  });

  it('returns null for missing/invalid', () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('')).toBeNull();
    expect(parseRetryAfter('not-a-date')).toBeNull();
  });
});

describe('secondaryBackoffSeconds', () => {
  it('caps growth', () => {
    expect(secondaryBackoffSeconds(1)).toBe(1);
    expect(secondaryBackoffSeconds(2)).toBe(2);
    expect(secondaryBackoffSeconds(3)).toBe(4);
    expect(secondaryBackoffSeconds(10)).toBe(4);
  });
});

describe('sleep', () => {
  it('resolves after delay', async () => {
    jest.useFakeTimers();
    const p = sleep(1000);
    jest.advanceTimersByTime(1000);
    await expect(p).resolves.toBeUndefined();
    jest.useRealTimers();
  });

  it('rejects on abort', async () => {
    const controller = new AbortController();
    const p = sleep(5000, controller.signal);
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('isAbortError', () => {
  it('detects AbortError', () => {
    expect(isAbortError(new DOMException('Aborted', 'AbortError'))).toBe(true);
    expect(isAbortError(new Error('nope'))).toBe(false);
  });
});
