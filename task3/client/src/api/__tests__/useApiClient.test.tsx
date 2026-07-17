import { act, renderHook, waitFor } from '@testing-library/react-native';

import { dedupeKey, useApiClient } from '../useApiClient';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return new Response(JSON.stringify(body), { ...init, headers });
}

describe('dedupeKey', () => {
  it('is stable for key order in body', () => {
    expect(dedupeKey('POST', '/roster', { playerId: 'p1', x: 1 })).toBe(
      dedupeKey('POST', '/roster', { x: 1, playerId: 'p1' }),
    );
  });

  it('differs for different queries', () => {
    expect(dedupeKey('GET', '/players?q=a')).not.toBe(
      dedupeKey('GET', '/players?q=b'),
    );
  });
});

describe('useApiClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('loads successfully and caches GET', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      return jsonResponse({ players: [{ id: 'p1', name: 'A', position: 'QB', team: 'BOS' }] });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useApiClient());
    expect(result.current.status).toBe('idle');

    await act(async () => {
      await result.current.get('/players');
    });

    expect(result.current.status).toBe('success');
    expect(result.current.data).toEqual({
      players: [{ id: 'p1', name: 'A', position: 'QB', team: 'BOS' }],
    });

    await act(async () => {
      await result.current.get('/players');
    });
    expect(calls).toBe(1);
  });

  it('dedupes in-flight identical GETs', async () => {
    let resolveFetch!: (v: Response) => void;
    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useApiClient());

    let p1!: Promise<unknown>;
    let p2!: Promise<unknown>;
    act(() => {
      p1 = result.current.get('/players');
      p2 = result.current.get('/players');
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    resolveFetch!(jsonResponse({ players: [] }));
    await act(async () => {
      await Promise.all([p1, p2]);
    });
    expect(result.current.status).toBe('success');
  });

  it('retries on 429 using Retry-After', async () => {
    jest.useFakeTimers();
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return jsonResponse(
          { error: { code: 'rate_limited', message: 'Too many requests' } },
          { status: 429, headers: { 'Retry-After': '1' } },
        );
      }
      return jsonResponse({ players: [] });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useApiClient());

    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.get('/players?q=z');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('retrying');
    });
    expect(result.current.retryAfterSeconds).toBe(1);

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await pending;
    });

    expect(result.current.status).toBe('success');
    expect(calls).toBe(2);
  });

  it('fails immediately on other 4xx', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse(
        { error: { code: 'invalid_request', message: 'bad' } },
        { status: 400 },
      ),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useApiClient());
    await act(async () => {
      await expect(result.current.post('/roster', { playerId: '' })).rejects.toMatchObject({
        code: 'invalid_request',
        status: 400,
      });
    });
    expect(result.current.status).toBe('error');
  });

  it('aborts in-flight request on unmount', async () => {
    global.fetch = jest.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    ) as unknown as typeof fetch;

    const { result, unmount } = renderHook(() => useApiClient());
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.get('/players');
    });
    unmount();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('invalidates player cache after roster POST', async () => {
    let playersCalls = 0;
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if ((init?.method ?? 'GET') === 'POST') {
        return jsonResponse(
          { roster: { players: [{ id: 'p1', name: 'A', position: 'QB', team: 'BOS' }] } },
          { status: 201 },
        );
      }
      playersCalls += 1;
      return jsonResponse({ players: [] });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useApiClient());
    await act(async () => {
      await result.current.get('/players');
    });
    expect(playersCalls).toBe(1);

    await act(async () => {
      await result.current.post('/roster', { playerId: 'p1' });
    });

    await act(async () => {
      await result.current.get('/players');
    });
    expect(playersCalls).toBe(2);
  });
});
