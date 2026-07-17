import { useCallback, useEffect, useRef, useState } from 'react';

import { TtlCache, cacheKey } from './cache';
import {
  isAbortError,
  parseRetryAfter,
  secondaryBackoffSeconds,
  sleep,
} from './retry';
import type {
  ApiErrorDetail,
  ApiErrorEnvelope,
  RequestStatus,
} from './types';

const DEFAULT_TTL_MS = 10_000;
const MAX_429_RETRIES = 3;
const MAX_SECONDARY_RETRIES = 2;

export type ApiClientError = ApiErrorDetail & {
  status: number;
  retryAfterSeconds?: number;
};

export type UseApiClientState<T = unknown> = {
  status: RequestStatus;
  data: T | null;
  error: ApiClientError | null;
  retryAttempt: number;
  retryAfterSeconds: number | null;
};

export type RequestOptions = {
  /** When true, skip reading the TTL cache (still writes on success for GET). */
  bypassCache?: boolean;
  /** Override UI status updates for background bursts. Default true. */
  trackStatus?: boolean;
};

function defaultBaseUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env && env.trim() !== '') {
    return env.replace(/\/$/, '');
  }
  return 'http://localhost:8080';
}

function dedupeKey(method: string, path: string, body?: unknown): string {
  const bodyPart =
    body === undefined ? '' : ` ${stableStringify(body)}`;
  return `${method.toUpperCase()} ${path}${bodyPart}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function normalizePath(path: string): string {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path;
}

async function readError(
  res: Response,
): Promise<ApiClientError> {
  let detail: ApiErrorDetail = {
    code: 'internal_error',
    message: res.statusText || 'Request failed',
  };
  try {
    const json = (await res.json()) as ApiErrorEnvelope;
    if (json?.error?.code) {
      detail = json.error;
    }
  } catch {
    // keep fallback
  }
  const retryAfterSeconds =
    parseRetryAfter(res.headers.get('Retry-After')) ?? undefined;
  return { ...detail, status: res.status, retryAfterSeconds };
}

/**
 * Transport hook: dedupe, GET TTL cache, 429 Retry-After retry (primary),
 * bounded 5xx/network retry (secondary), AbortController on unmount.
 */
export function useApiClient() {
  const baseUrl = defaultBaseUrl();
  const cacheRef = useRef(new TtlCache(DEFAULT_TTL_MS));
  const inFlightRef = useRef(new Map<string, Promise<unknown>>());
  const controllersRef = useRef(new Set<AbortController>());
  const mountedRef = useRef(true);

  const [state, setState] = useState<UseApiClientState>({
    status: 'idle',
    data: null,
    error: null,
    retryAttempt: 0,
    retryAfterSeconds: null,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      for (const c of controllersRef.current) {
        c.abort();
      }
      controllersRef.current.clear();
    };
  }, []);

  const update = useCallback((patch: Partial<UseApiClientState>) => {
    if (!mountedRef.current) {
      return;
    }
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const execute = useCallback(
    async <T,>(
      method: 'GET' | 'POST',
      path: string,
      body?: unknown,
      options: RequestOptions = {},
    ): Promise<T> => {
      const track = options.trackStatus !== false;
      const normalized = normalizePath(path);
      const url = `${baseUrl}${normalized}`;
      const key = dedupeKey(method, normalized, body);
      const getKey = cacheKey('GET', normalized);

      if (method === 'GET' && !options.bypassCache) {
        const cached = cacheRef.current.get<T>(getKey);
        if (cached !== undefined) {
          if (track) {
            update({
              status: 'success',
              data: cached,
              error: null,
              retryAttempt: 0,
              retryAfterSeconds: null,
            });
          }
          return cached;
        }
      }

      const existing = inFlightRef.current.get(key);
      if (existing) {
        return existing as Promise<T>;
      }

      const run = (async (): Promise<T> => {
        if (track) {
          update({
            status: 'loading',
            error: null,
            retryAttempt: 0,
            retryAfterSeconds: null,
          });
        }

        let attempt429 = 0;
        let attemptSecondary = 0;

        // Outer loop: retries after waits
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const controller = new AbortController();
          controllersRef.current.add(controller);
          try {
            const init: RequestInit = {
              method,
              signal: controller.signal,
              headers: { Accept: 'application/json' },
            };
            if (body !== undefined) {
              init.headers = {
                ...init.headers,
                'Content-Type': 'application/json',
              };
              init.body = JSON.stringify(body);
            }

            let res: Response;
            try {
              res = await fetch(url, init);
            } catch (err) {
              if (isAbortError(err)) {
                throw err;
              }
              attemptSecondary += 1;
              if (attemptSecondary > MAX_SECONDARY_RETRIES) {
                const error: ApiClientError = {
                  code: 'internal_error',
                  message:
                    err instanceof Error ? err.message : 'Network error',
                  status: 0,
                };
                if (track) {
                  update({ status: 'error', error, data: null });
                }
                throw error;
              }
              const wait = secondaryBackoffSeconds(attemptSecondary);
              if (track) {
                update({
                  status: 'retrying',
                  retryAttempt: attemptSecondary,
                  retryAfterSeconds: wait,
                });
              }
              await sleep(wait * 1000, controller.signal);
              continue;
            }

            if (res.status === 429) {
              attempt429 += 1;
              const retrySecs =
                parseRetryAfter(res.headers.get('Retry-After')) ?? 1;
              if (attempt429 > MAX_429_RETRIES) {
                const error = await readError(res);
                if (track) {
                  update({ status: 'error', error, data: null });
                }
                throw error;
              }
              if (track) {
                update({
                  status: 'retrying',
                  retryAttempt: attempt429,
                  retryAfterSeconds: retrySecs,
                });
              }
              await sleep(retrySecs * 1000, controller.signal);
              continue;
            }

            if (res.status >= 500) {
              attemptSecondary += 1;
              if (attemptSecondary > MAX_SECONDARY_RETRIES) {
                const error = await readError(res);
                if (track) {
                  update({ status: 'error', error, data: null });
                }
                throw error;
              }
              const wait = secondaryBackoffSeconds(attemptSecondary);
              if (track) {
                update({
                  status: 'retrying',
                  retryAttempt: attemptSecondary,
                  retryAfterSeconds: wait,
                });
              }
              await sleep(wait * 1000, controller.signal);
              continue;
            }

            if (!res.ok) {
              const error = await readError(res);
              if (track) {
                update({ status: 'error', error, data: null });
              }
              throw error;
            }

            const data = (await res.json()) as T;
            if (method === 'GET') {
              cacheRef.current.set(getKey, data);
            } else if (method === 'POST' && normalized.startsWith('/roster')) {
              cacheRef.current.invalidatePrefix('GET /players');
            }
            if (track) {
              update({
                status: 'success',
                data,
                error: null,
                retryAttempt: 0,
                retryAfterSeconds: null,
              });
            }
            return data;
          } finally {
            controllersRef.current.delete(controller);
          }
        }
      })();

      inFlightRef.current.set(key, run);
      try {
        return await run;
      } finally {
        inFlightRef.current.delete(key);
      }
    },
    [baseUrl, update],
  );

  const get = useCallback(
    <T,>(path: string, options?: RequestOptions) =>
      execute<T>('GET', path, undefined, options),
    [execute],
  );

  const post = useCallback(
    <T,>(path: string, body: unknown, options?: RequestOptions) =>
      execute<T>('POST', path, body, options),
    [execute],
  );

  const reset = useCallback(() => {
    update({
      status: 'idle',
      data: null,
      error: null,
      retryAttempt: 0,
      retryAfterSeconds: null,
    });
  }, [update]);

  return {
    ...state,
    baseUrl,
    get,
    post,
    reset,
    /** Exposed for tests */
    _cache: cacheRef,
    _inFlight: inFlightRef,
  };
}

export { dedupeKey, stableStringify, defaultBaseUrl };
