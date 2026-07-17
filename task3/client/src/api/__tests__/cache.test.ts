import { TtlCache, cacheKey } from '../cache';

describe('TtlCache', () => {
  it('returns cached value within TTL', () => {
    const cache = new TtlCache(1000);
    const key = cacheKey('GET', '/players');
    cache.set(key, { players: [] }, 1000);
    expect(cache.get(key, 1500)).toEqual({ players: [] });
  });

  it('expires after TTL', () => {
    const cache = new TtlCache(1000);
    const key = cacheKey('GET', '/players');
    cache.set(key, { players: [1] }, 1000);
    expect(cache.get(key, 2001)).toBeUndefined();
  });

  it('invalidates by prefix', () => {
    const cache = new TtlCache(10_000);
    cache.set('GET /players', { a: 1 });
    cache.set('GET /players?q=x', { a: 2 });
    cache.set('GET /other', { a: 3 });
    cache.invalidatePrefix('GET /players');
    expect(cache.get('GET /players')).toBeUndefined();
    expect(cache.get('GET /players?q=x')).toBeUndefined();
    expect(cache.get('GET /other')).toEqual({ a: 3 });
  });
});

describe('cacheKey', () => {
  it('normalizes method case', () => {
    expect(cacheKey('get', '/players')).toBe('GET /players');
  });
});
