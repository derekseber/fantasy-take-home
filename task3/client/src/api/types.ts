/**
 * Client types mirroring task3/API.md 1:1.
 */

export type Player = {
  id: string;
  name: string;
  position: string;
  team: string;
};

export type Roster = {
  players: Player[];
};

export type PlayersResponse = {
  players: Player[];
};

export type AddToRosterRequest = {
  playerId: string;
};

export type RosterResponse = {
  roster: Roster;
};

export type ApiErrorCode =
  | 'invalid_request'
  | 'player_not_found'
  | 'player_already_rostered'
  | 'not_found'
  | 'method_not_allowed'
  | 'rate_limited'
  | 'internal_error';

export type ApiErrorDetail = {
  code: ApiErrorCode | string;
  message: string;
  details?: Record<string, unknown>;
};

export type ApiErrorEnvelope = {
  error: ApiErrorDetail;
};

export type RequestStatus = 'idle' | 'loading' | 'retrying' | 'success' | 'error';
