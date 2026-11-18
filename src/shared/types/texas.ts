import type { LocalizedText } from './common.js';

// ==========================================
// 3. TEXAS HOLD'EM (Royal Hold'em)
// ==========================================
export type CardSuit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export interface PlayingCard {
  rank: number; // 2..14 (14 = Ace)
  suit: CardSuit;
}

export interface TexasOptions {
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  allowRebuy: boolean;
  turnSeconds: number;
  blindIncreaseEveryHands?: number;
}

export interface TexasPlayerPublic {
  playerId: string;
  chips: number;
  betThisStreet: number;
  committedThisHand: number;
  folded: boolean;
  allIn: boolean;
  busted: boolean;
  rebuyCount: number;
  totalBuyIn: number;
  lastAction?: LocalizedText;
  revealedCards?: PlayingCard[];
  bestHandLabel?: LocalizedText;
  winningFiveCards?: PlayingCard[];
}

export interface TexasSidePot {
  amount: number;
  eligibleIds: string[];
}

export interface TexasPublicState {
  phase: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'game_over';
  handNumber: number;
  dealerId: string;
  smallBlindId: string;
  bigBlindId: string;
  currentSmallBlind: number;
  currentBigBlind: number;
  activePlayerId: string | null;
  communityCards: PlayingCard[];
  pot: number;
  sidePots: TexasSidePot[];
  currentBet: number;
  minRaiseDelta: number;
  players: TexasPlayerPublic[];
  showdownResults?: Array<{
    potIndex: number;
    amount: number;
    winnerIds: string[];
    handLabel: LocalizedText;
    winningFiveCards?: PlayingCard[];
  }>;
  rankings?: Array<{
    playerId: string;
    chips: number;
    rebuyCount: number;
    netProfit: number;
  }>;
  phaseDeadline?: number;
}

export interface TexasPrivateState {
  playerId: string;
  holeCards: PlayingCard[];
  isTurn: boolean;
  canCheck: boolean;
  toCall: number;
  minRaiseTo: number;
  maxRaiseTo: number;
  currentBestHand?: {
    labelZh: string;
    labelEn: string;
    bestFive?: PlayingCard[];
  };
}
