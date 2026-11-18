import type { GameId, PlayerSeat } from '../../shared/types.js';

export interface GameStepResult<TState> {
  state: TState;
  voiceClip?: string;
  sfx?: string;
  scoreDeltas?: Record<string, number>;
  error?: string;
}

export interface GameDefinition<
  TState = unknown,
  TOptions = Record<string, unknown>,
  TPublic = unknown,
  TPrivate = unknown,
  TAction = Record<string, unknown>,
> {
  id: GameId;
  minPlayers: number;
  maxPlayers: number;
  defaultOptions: TOptions;
  createInitialState(
    seats: PlayerSeat[],
    options: TOptions,
  ): { state: TState; voiceClip?: string; sfx?: string };
  applyAction(
    state: TState,
    actorId: string,
    action: TAction,
    seats: PlayerSeat[],
  ): GameStepResult<TState>;
  projectPublic(state: TState): TPublic;
  projectPrivate(state: TState, playerId: string): TPrivate;
  computeBotAction(state: TState, botId: string, seats: PlayerSeat[]): TAction | null;
  onTick?(
    state: TState,
    now: number,
    seats: PlayerSeat[],
  ): { state: TState; voiceClip?: string; sfx?: string; scoreDeltas?: Record<string, number> } | null;
  forceSkipCurrent(
    state: TState,
    seats: PlayerSeat[],
  ): { state: TState; voiceClip?: string; sfx?: string; scoreDeltas?: Record<string, number> };
}
