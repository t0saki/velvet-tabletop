import type { LocalizedText } from './common.js';

// ==========================================
// 4. MONOPOLY (Metropolis Tycoon)
// ==========================================
export type MonopolyTileKind =
  | 'start'
  | 'property'
  | 'transit'
  | 'utility'
  | 'chance'
  | 'chest'
  | 'tax'
  | 'jail'
  | 'park'
  | 'go_jail';

export interface MonopolyTile {
  index: number;
  kind: MonopolyTileKind;
  name: LocalizedText;
  colorGroup?: string;
  price?: number;
  baseRent?: number;
  upgradeCost?: number;
  taxAmount?: number;
}

export interface MonopolyOptions {
  startingCash: number;
  maxRounds: number;
  partyTurboRent: boolean;
}

export interface MonopolyPlayerPublic {
  playerId: string;
  position: number;
  cash: number;
  inJail: boolean;
  jailTurns: number;
  jailFreeCards: number;
  bankrupt: boolean;
  netWorth: number;
  colorHex: string;
}

export interface MonopolyPropertyState {
  ownerId: string | null;
  level: number; // 0..4
}

export interface MonopolyAuctionState {
  tileIndex: number;
  highestBid: number;
  highestBidderId: string | null;
  passedIds: string[];
  endsAt: number;
}

export interface MonopolyEventEntry {
  round: number;
  text: LocalizedText;
}

export const MONOPOLY_RENT_MULTIPLIERS = [1, 2.2, 4, 6.5, 9] as const;

export function ownsColorGroup(
  playerId: string,
  colorGroup: string | undefined,
  tiles: readonly MonopolyTile[],
  properties: Record<number, MonopolyPropertyState>,
): boolean {
  if (!colorGroup) return false;
  const groupTiles = tiles.filter((t) => t.colorGroup === colorGroup);
  return groupTiles.length > 0 && groupTiles.every((t) => properties[t.index]?.ownerId === playerId);
}

export function computePropertyRent(
  baseRent: number,
  level: number,
  ownsFullGroup: boolean,
  partyTurbo: boolean,
): number {
  let rent = Math.round(baseRent * (MONOPOLY_RENT_MULTIPLIERS[level] ?? 1));
  if (level === 0 && ownsFullGroup) {
    rent *= 2;
  }
  if (partyTurbo) {
    rent = Math.round(rent * 1.25);
  }
  return rent;
}

export interface MonopolyPublicState {
  phase: 'roll' | 'buy_decision' | 'auction' | 'turn_end' | 'game_over';
  round: number;
  maxRounds: number;
  activePlayerId: string;
  lastDice: [number, number] | null;
  doublesStreak: number;
  tiles: MonopolyTile[];
  properties: Record<number, MonopolyPropertyState>;
  players: MonopolyPlayerPublic[];
  auction: MonopolyAuctionState | null;
  lastEvent: LocalizedText | null;
  jackpotPool: number;
  eventLog: MonopolyEventEntry[];
  partyTurboRent?: boolean;
  winnerId?: string;
  rankings?: Array<{ playerId: string; netWorth: number }>;
  phaseDeadline?: number;
}

export interface MonopolyPrivateState {
  playerId: string;
  isActiveTurn: boolean;
  canRoll: boolean;
  canBuyCurrentTile: boolean;
  canUpgradeTiles: number[];
  canBidInAuction: boolean;
}
