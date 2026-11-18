import type { VoiceClipKey } from './voiceClips.js';

export type GameId =
  | 'avalon'
  | 'werewolf'
  | 'texas'
  | 'monopoly'
  | 'sketch'
  | 'undercover';

export type Language = 'zh' | 'en';

export type RoomStatus = 'lobby' | 'playing' | 'paused';

export type HostMode = 'play' | 'tv_only';

export interface PlayerSeat {
  id: string;
  seatIndex: number;
  name: string;
  avatarId: string;
  connected: boolean;
  isHost: boolean;
  isBot: boolean;
  botTakeover?: boolean;
  ready: boolean;
  score: number;
}

export interface EmojiReaction {
  id: string;
  seatIndex: number;
  playerName: string;
  emoji: string;
  ts: number;
}

export interface LanNetworkInfo {
  port: number;
  addresses: Array<{
    name: string;
    ip: string;
    url: string;
  }>;
  primaryUrl: string;
}

export interface ActiveVoiceClip {
  clipKey: VoiceClipKey | string;
  seq: number;
  ts: number;
}

export interface RoomPublicState {
  roomCode: string;
  hostMode: HostMode;
  selectedGameId: GameId;
  gameOptions: Record<string, unknown>;
  status: RoomStatus;
  language: Language;
  seats: PlayerSeat[];
  hasTvConnected: boolean;
  gamePublic: unknown;
  activeVoiceClip?: ActiveVoiceClip;
  lastSfx?: { name: string; seq: number };
  recentReactions: EmojiReaction[];
  serverTime: number;
}

export interface ClientJoinPayload {
  roomCode?: string;
  playerToken: string;
  name?: string;
  avatarId?: string;
  role: 'player' | 'tv';
  language?: Language;
  hostMode?: HostMode;
}
