/**
 * Parse Retry-After as delta-seconds or HTTP-date.
 * Returns whole seconds to wait (minimum 1 when a value is present).
 */
export function parseRetryAfter(
  header: string | null,
  now = Date.now(),
): number | null {
  if (header == null || header.trim() === '') {
    return null;
  }
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) {
    const secs = parseInt(trimmed, 10);
    return Math.max(1, secs);
  }
  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) {
    return null;
  }
  const secs = Math.ceil((dateMs - now) / 1000);
  return Math.max(1, secs);
}

/** Secondary bounded delay for network/5xx (not the primary 429 path). */
export function secondaryBackoffSeconds(attempt: number): number {
  // attempt is 1-based after the first failure
  return Math.min(4, 2 ** (attempt - 1));
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    signal?.addEventListener('abort', onAbort);
  });
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}
