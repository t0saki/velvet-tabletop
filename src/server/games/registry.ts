import type { GameId } from '../../shared/types.js';
import type { GameDefinition } from './engine.js';
import { avalonGame } from './avalon.js';
import { werewolfGame } from './werewolf.js';
import { texasGame } from './texas.js';
import { monopolyGame } from './monopoly.js';
import { sketchGame } from './sketch.js';
import { undercoverGame } from './undercover.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAME_REGISTRY: Record<GameId, GameDefinition<any, any, any, any, any>> = {
  avalon: avalonGame,
  werewolf: werewolfGame,
  texas: texasGame,
  monopoly: monopolyGame,
  sketch: sketchGame,
  undercover: undercoverGame,
};

export function getGameDefinition(gameId: GameId) {
  return GAME_REGISTRY[gameId];
}
