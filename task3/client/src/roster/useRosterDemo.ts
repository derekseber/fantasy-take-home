import { useCallback, useEffect, useState } from 'react';

import { useApiClient } from '../api/useApiClient';
import type {
  AddToRosterRequest,
  Player,
  PlayersResponse,
  Roster,
  RosterResponse,
} from '../api/types';

export type RowState = 'idle' | 'adding' | 'rostered' | 'error';

/**
 * Thin domain/view-model over useApiClient.
 * Owns search + optimistic row state + 429 burst trigger.
 * Does NOT own dedupe, cache, retry, or cancellation.
 */
export function useRosterDemo() {
  const {
    get,
    post,
    status,
    error,
    retryAttempt,
    retryAfterSeconds,
    baseUrl,
  } = useApiClient();

  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [roster, setRoster] = useState<Roster>({ players: [] });
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const loadPlayers = useCallback(
    async (
      q: string,
      options?: { bypassCache?: boolean; trackStatus?: boolean },
    ) => {
      const path =
        q.trim() === ''
          ? '/players'
          : `/players?q=${encodeURIComponent(q.trim())}`;
      const res = await get<PlayersResponse>(path, options);
      setPlayers(res.players);
      return res;
    },
    [get],
  );

  useEffect(() => {
    void loadPlayers('').catch(() => {
      // status surfaced via api.error
    });
  }, [loadPlayers]);

  const search = useCallback(
    async (q: string) => {
      setQuery(q);
      try {
        await loadPlayers(q);
      } catch {
        // surfaced via status / error
      }
    },
    [loadPlayers],
  );

  const addPlayer = useCallback(
    async (playerId: string) => {
      setRowStates((prev) => ({ ...prev, [playerId]: 'adding' }));
      setRowErrors((prev) => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
      try {
        const body: AddToRosterRequest = { playerId };
        const res = await post<RosterResponse>('/roster', body);
        setRoster(res.roster);
        const rosteredIds = new Set(res.roster.players.map((p) => p.id));
        setRowStates((prev) => {
          const next = { ...prev };
          for (const id of rosteredIds) {
            next[id] = 'rostered';
          }
          return next;
        });
      } catch (err) {
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: string }).message)
            : 'Failed to add player';
        setRowStates((prev) => ({ ...prev, [playerId]: 'error' }));
        setRowErrors((prev) => ({ ...prev, [playerId]: message }));
      }
    },
    [post],
  );

  /** Fire distinct searches to exhaust the demo token bucket (avoids dedupe). */
  const trigger429 = useCallback(async () => {
    const suffixes = ['a', 'e', 'i', 'o', 'u', 'y', 'r', 'n', 's', 't'];
    await Promise.allSettled(
      suffixes.map((s, i) =>
        get<PlayersResponse>(`/players?q=${s}${i}`, {
          bypassCache: true,
          trackStatus: i === 0,
        }),
      ),
    );
    try {
      await loadPlayers(query, { bypassCache: true });
    } catch {
      // surfaced via status / error
    }
  }, [get, loadPlayers, query]);

  return {
    query,
    setQuery,
    search,
    players,
    roster,
    rowStates,
    rowErrors,
    addPlayer,
    trigger429,
    reload: () => loadPlayers(query),
    status,
    error,
    retryAttempt,
    retryAfterSeconds,
    baseUrl,
  };
}
