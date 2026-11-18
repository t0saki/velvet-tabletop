import crypto from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { AVATARS, BOT_NAMES } from '../shared/catalog.js';
import type {
  ActiveVoiceClip,
  ClientJoinPayload,
  EmojiReaction,
  GameId,
  HostMode,
  Language,
  PlayerSeat,
  RoomPublicState,
  RoomStatus,
} from '../shared/types.js';
import { getGameDefinition } from './games/registry.js';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface InternalSeat extends PlayerSeat {
  playerToken: string;
  socketId: string | null;
}

interface RoomInstance {
  roomCode: string;
  hostMode: HostMode;
  selectedGameId: GameId;
  gameOptions: Record<string, unknown>;
  status: RoomStatus;
  language: Language;
  seats: InternalSeat[];
  tvSocketIds: Set<string>;
  gameState: unknown;
  voiceSeq: number;
  sfxSeq: number;
  activeVoiceClip?: ActiveVoiceClip;
  lastSfx?: { name: string; seq: number };
  recentReactions: EmojiReaction[];
  pausedAt?: number;
  botCooldownUntil: Record<string, number>;
  createdAt: number;
  lastActivityAt: number;
}

export class RoomManager {
  private rooms = new Map<string, RoomInstance>();
  private socketToRoom = new Map<string, { roomCode: string; playerId?: string; isTv: boolean }>();
  private tickTimer: NodeJS.Timeout | null = null;

  constructor(private readonly io: Server) {}

  start(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tickAllRooms(), 250);
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private generateRoomCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = '';
      for (let i = 0; i < 4; i++) {
        code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    return crypto.randomBytes(2).toString('hex').toUpperCase();
  }

  private sanitizeSeat(seat: InternalSeat): PlayerSeat {
    return {
      id: seat.id,
      seatIndex: seat.seatIndex,
      name: seat.name,
      avatarId: seat.avatarId,
      connected: seat.connected,
      isHost: seat.isHost,
      isBot: seat.isBot,
      botTakeover: seat.botTakeover,
      ready: seat.ready,
      score: seat.score,
    };
  }

  private reindexSeats(room: RoomInstance): void {
    room.seats.forEach((s, idx) => {
      s.seatIndex = idx;
    });
    const hasHost = room.seats.some((s) => s.isHost && !s.isBot);
    if (!hasHost) {
      const firstHuman = room.seats.find((s) => !s.isBot);
      if (firstHuman) firstHuman.isHost = true;
    }
  }

  private triggerVoice(room: RoomInstance, clipKey?: string): void {
    if (!clipKey) return;
    room.voiceSeq += 1;
    room.activeVoiceClip = {
      clipKey,
      seq: room.voiceSeq,
      ts: Date.now(),
    };
  }

  private triggerSfx(room: RoomInstance, sfx?: string): void {
    if (!sfx) return;
    room.sfxSeq += 1;
    room.lastSfx = { name: sfx, seq: room.sfxSeq };
  }

  private applyScoreDeltas(room: RoomInstance, deltas?: Record<string, number>): void {
    if (!deltas) return;
    for (const [playerId, delta] of Object.entries(deltas)) {
      if (!Number.isFinite(delta) || delta === 0) continue;
      const seat = room.seats.find((s) => s.id === playerId);
      if (seat) {
        seat.score = Math.max(0, seat.score + Math.round(delta));
      }
    }
  }

  public getPublicState(room: RoomInstance): RoomPublicState {
    const def = getGameDefinition(room.selectedGameId);
    const gamePublic =
      room.gameState !== null && room.gameState !== undefined
        ? def.projectPublic(room.gameState)
        : null;

    return {
      roomCode: room.roomCode,
      hostMode: room.hostMode,
      selectedGameId: room.selectedGameId,
      gameOptions: room.gameOptions,
      status: room.status,
      language: room.language,
      seats: room.seats.map((s) => this.sanitizeSeat(s)),
      hasTvConnected: room.tvSocketIds.size > 0,
      gamePublic,
      activeVoiceClip: room.activeVoiceClip,
      lastSfx: room.lastSfx,
      recentReactions: room.recentReactions.filter((r) => Date.now() - r.ts < 6000),
      serverTime: Date.now(),
    };
  }

  private broadcastRoom(room: RoomInstance): void {
    room.lastActivityAt = Date.now();
    const publicState = this.getPublicState(room);
    this.io.to(room.roomCode).emit('room:publicState', publicState);

    if (room.gameState) {
      const def = getGameDefinition(room.selectedGameId);
      for (const seat of room.seats) {
        if (seat.socketId && seat.connected) {
          const priv = def.projectPrivate(room.gameState, seat.id);
          this.io.to(seat.socketId).emit('game:privateState', priv);
        }
      }
    }
  }

  private leavePreviousRoom(socket: Socket): void {
    const prev = this.socketToRoom.get(socket.id);
    if (!prev) return;
    const room = this.rooms.get(prev.roomCode);
    socket.leave(prev.roomCode);
    this.socketToRoom.delete(socket.id);

    if (!room) return;
    if (prev.isTv) {
      room.tvSocketIds.delete(socket.id);
    } else if (prev.playerId) {
      const seat = room.seats.find((s) => s.id === prev.playerId);
      if (seat && seat.socketId === socket.id) {
        seat.connected = false;
        seat.socketId = null;
      }
    }
    this.broadcastRoom(room);
  }

  private assertHostOrTv(socket: Socket, room: RoomInstance): InternalSeat | null {
    const meta = this.socketToRoom.get(socket.id);
    if (!meta || meta.roomCode !== room.roomCode) return null;
    if (meta.isTv) {
      // TV console can manage lobby if no human host exists yet or as co-host
      const humanHost = room.seats.find((s) => s.isHost && !s.isBot);
      return humanHost ?? ({ isHost: true } as InternalSeat);
    }
    const seat = room.seats.find((s) => s.id === meta.playerId);
    if (seat?.isHost) return seat;
    return null;
  }

  public registerSocketHandlers(socket: Socket): void {
    socket.on(
      'room:create',
      (
        payload: Omit<ClientJoinPayload, 'roomCode'>,
        ack?: (res: { ok: boolean; roomCode?: string; playerId?: string; error?: string }) => void,
      ) => {
        this.leavePreviousRoom(socket);
        const roomCode = this.generateRoomCode();
        const selectedGameId: GameId = 'avalon';
        const def = getGameDefinition(selectedGameId);
        const isTv = payload.role === 'tv' || payload.hostMode === 'tv_only';

        const room: RoomInstance = {
          roomCode,
          hostMode: isTv ? 'tv_only' : 'play',
          selectedGameId,
          gameOptions: { ...def.defaultOptions },
          status: 'lobby',
          language: payload.language ?? 'zh',
          seats: [],
          tvSocketIds: new Set(),
          gameState: null,
          voiceSeq: 0,
          sfxSeq: 0,
          recentReactions: [],
          botCooldownUntil: {},
          createdAt: Date.now(),
          lastActivityAt: Date.now(),
        };

        let playerId: string | undefined;
        if (isTv) {
          room.tvSocketIds.add(socket.id);
          this.socketToRoom.set(socket.id, { roomCode, isTv: true });
          this.triggerVoice(room, 'welcome_stage');
        } else {
          playerId = `p_${crypto.randomBytes(4).toString('hex')}`;
          const seat: InternalSeat = {
            id: playerId,
            playerToken: payload.playerToken,
            socketId: socket.id,
            seatIndex: 0,
            name: (payload.name ?? '').trim().slice(0, 16) || '房主 1号',
            avatarId: payload.avatarId || AVATARS[0].id,
            connected: true,
            isHost: true,
            isBot: false,
            ready: true,
            score: 0,
          };
          room.seats.push(seat);
          this.socketToRoom.set(socket.id, { roomCode, playerId, isTv: false });
        }

        this.rooms.set(roomCode, room);
        socket.join(roomCode);
        this.broadcastRoom(room);
        ack?.({ ok: true, roomCode, playerId });
      },
    );

    socket.on(
      'room:join',
      (
        payload: ClientJoinPayload,
        ack?: (res: {
          ok: boolean;
          roomCode?: string;
          playerId?: string;
          isTv?: boolean;
          error?: string;
        }) => void,
      ) => {
        const code = (payload.roomCode ?? '').trim().toUpperCase();
        const room = this.rooms.get(code);
        if (!room) {
          ack?.({ ok: false, error: 'ROOM_NOT_FOUND' });
          return;
        }

        this.leavePreviousRoom(socket);

        if (payload.role === 'tv') {
          room.tvSocketIds.add(socket.id);
          this.socketToRoom.set(socket.id, { roomCode: code, isTv: true });
          socket.join(code);
          this.broadcastRoom(room);
          ack?.({ ok: true, roomCode: code, isTv: true });
          return;
        }

        // Seamless reconnect by playerToken
        const existing = room.seats.find((s) => s.playerToken === payload.playerToken);
        if (existing) {
          existing.socketId = socket.id;
          existing.connected = true;
          existing.botTakeover = false;
          if (payload.name?.trim()) existing.name = payload.name.trim().slice(0, 16);
          if (payload.avatarId) existing.avatarId = payload.avatarId;
          this.socketToRoom.set(socket.id, {
            roomCode: code,
            playerId: existing.id,
            isTv: false,
          });
          socket.join(code);
          this.broadcastRoom(room);
          ack?.({ ok: true, roomCode: code, playerId: existing.id, isTv: false });
          return;
        }

        if (room.status !== 'lobby') {
          ack?.({ ok: false, error: 'GAME_ALREADY_STARTED' });
          return;
        }

        if (room.seats.length >= 10) {
          ack?.({ ok: false, error: 'ROOM_FULL' });
          return;
        }

        const hasHumanHost = room.seats.some((s) => s.isHost && !s.isBot);
        const seatIndex = room.seats.length;
        const usedAvatars = new Set(room.seats.map((s) => s.avatarId));
        const defaultAvatar =
          AVATARS.find((a) => !usedAvatars.has(a.id))?.id ??
          AVATARS[seatIndex % AVATARS.length].id;

        const playerId = `p_${crypto.randomBytes(4).toString('hex')}`;
        const seat: InternalSeat = {
          id: playerId,
          playerToken: payload.playerToken,
          socketId: socket.id,
          seatIndex,
          name:
            (payload.name ?? '').trim().slice(0, 16) ||
            (room.language === 'en' ? `Player ${seatIndex + 1}` : `玩家 ${seatIndex + 1}`),
          avatarId: payload.avatarId || defaultAvatar,
          connected: true,
          isHost: !hasHumanHost,
          isBot: false,
          ready: true,
          score: 0,
        };
        room.seats.push(seat);
        this.reindexSeats(room);
        this.socketToRoom.set(socket.id, { roomCode: code, playerId, isTv: false });
        socket.join(code);
        this.broadcastRoom(room);
        ack?.({ ok: true, roomCode: code, playerId, isTv: false });
      },
    );

    socket.on('room:updateProfile', (data: { name?: string; avatarId?: string }) => {
      const meta = this.socketToRoom.get(socket.id);
      if (!meta || meta.isTv || !meta.playerId) return;
      const room = this.rooms.get(meta.roomCode);
      if (!room) return;
      const seat = room.seats.find((s) => s.id === meta.playerId);
      if (!seat) return;
      if (data.name?.trim()) seat.name = data.name.trim().slice(0, 16);
      if (data.avatarId) seat.avatarId = data.avatarId;
      this.broadcastRoom(room);
    });

    socket.on('room:setLanguage', (data: { language: Language }) => {
      const meta = this.socketToRoom.get(socket.id);
      if (!meta) return;
      const room = this.rooms.get(meta.roomCode);
      if (!room) return;
      if (data.language === 'zh' || data.language === 'en') {
        room.language = data.language;
        this.broadcastRoom(room);
      }
    });

    socket.on('room:selectGame', (data: { gameId: GameId }) => {
      const meta = this.socketToRoom.get(socket.id);
      if (!meta) return;
      const room = this.rooms.get(meta.roomCode);
      if (!room || !this.assertHostOrTv(socket, room)) return;
      const def = getGameDefinition(data.gameId);
      if (!def) return;
      room.selectedGameId = data.gameId;
      room.gameOptions = { ...def.defaultOptions };
      room.status = 'lobby';
      room.gameState = null;
      this.broadcastRoom(room);
    });

    socket.on('room:updateOptions', (options: Record<string, unknown>) => {
      const meta = this.socketToRoom.get(socket.id);
      if (!meta) return;
      const room = this.rooms.get(meta.roomCode);
      if (!room || !this.assertHostOrTv(socket, room)) return;
      room.gameOptions = { ...room.gameOptions, ...options };
      this.broadcastRoom(room);
    });

    socket.on('room:addBot', () => {
      const meta = this.socketToRoom.get(socket.id);
      if (!meta) return;
      const room = this.rooms.get(meta.roomCode);
      if (!room || !this.assertHostOrTv(socket, room)) return;
      if (room.status !== 'lobby' || room.seats.length >= 10) return;

      const botIdx = room.seats.filter((s) => s.isBot).length;
      const usedAvatars = new Set(room.seats.map((s) => s.avatarId));
      const avatar =
        AVATARS.find((a) => !usedAvatars.has(a.id))?.id ??
        AVATARS[(room.seats.length + 3) % AVATARS.length].id;
      const botMeta = BOT_NAMES[botIdx % BOT_NAMES.length];

      room.seats.push({
        id: `bot_${crypto.randomBytes(3).toString('hex')}`,
        playerToken: `bot_${crypto.randomUUID()}`,
        socketId: null,
        seatIndex: room.seats.length,
        name: room.language === 'en' ? botMeta.en : botMeta.zh,
        avatarId: avatar,
        connected: false,
        isHost: false,
        isBot: true,
        ready: true,
        score: 0,
      });
      this.reindexSeats(room);
      this.broadcastRoom(room);
    });

    socket.on('room:removeBot', (data?: { playerId?: string }) => {
      const meta = this.socketToRoom.get(socket.id);
      if (!meta) return;
      const room = this.rooms.get(meta.roomCode);
      if (!room || !this.assertHostOrTv(socket, room) || room.status !== 'lobby') return;

      if (data?.playerId) {
        room.seats = room.seats.filter((s) => !(s.id === data.playerId && s.isBot));
      } else {
        const lastBotIdx = [...room.seats].reverse().findIndex((s) => s.isBot);
        if (lastBotIdx >= 0) {
          const removeIdx = room.seats.length - 1 - lastBotIdx;
          room.seats.splice(removeIdx, 1);
        }
      }
      this.reindexSeats(room);
      this.broadcastRoom(room);
    });

    socket.on('room:kickPlayer', (data: { playerId: string }) => {
      const meta = this.socketToRoom.get(socket.id);
      if (!meta) return;
      const room = this.rooms.get(meta.roomCode);
      if (!room || !this.assertHostOrTv(socket, room)) return;
      const target = room.seats.find((s) => s.id === data.playerId);
      if (!target || target.isHost) return;

      if (room.status === 'lobby') {
        if (target.socketId) {
          this.io.to(target.socketId).emit('room:kicked');
          this.socketToRoom.delete(target.socketId);
          this.io.sockets.sockets.get(target.socketId)?.leave(room.roomCode);
        }
        room.seats = room.seats.filter((s) => s.id !== data.playerId);
        this.reindexSeats(room);
      } else {
        // Mid-game kick converts seat into AI takeover so the game does not break
        target.isBot = true;
        target.botTakeover = true;
        target.connected = false;
        if (target.socketId) {
          this.io.to(target.socketId).emit('room:kicked');
          this.socketToRoom.delete(target.socketId);
          this.io.sockets.sockets.get(target.socketId)?.leave(room.roomCode);
          target.socketId = null;
        }
      }
      this.broadcastRoom(room);
    });

    socket.on('room:transferHost', (data: { playerId: string }) => {
      const meta = this.socketToRoom.get(socket.id);
      if (!meta) return;
      const room = this.rooms.get(meta.roomCode);
      if (!room || !this.assertHostOrTv(socket, room)) return;
      const target = room.seats.find((s) => s.id === data.playerId && !s.isBot);
      if (!target) return;
      room.seats.forEach((s) => {
        s.isHost = s.id === target.id;
      });
      this.broadcastRoom(room);
    });

    socket.on('room:toggleBotTakeover', (data: { playerId: string }) => {
      const meta = this.socketToRoom.get(socket.id);
      if (!meta) return;
      const room = this.rooms.get(meta.roomCode);
      if (!room || !this.assertHostOrTv(socket, room)) return;
      const target = room.seats.find((s) => s.id === data.playerId && !s.isBot);
      if (!target) return;
      target.botTakeover = !target.botTakeover;
      this.broadcastRoom(room);
    });

    socket.on('room:moveSeat', (data: { playerId: string; direction: -1 | 1 }) => {
      const meta = this.socketToRoom.get(socket.id);
      if (!meta) return;
      const room = this.rooms.get(meta.roomCode);
      if (!room || !this.assertHostOrTv(socket, room) || room.status !== 'lobby') return;
      const idx = room.seats.findIndex((s) => s.id === data.playerId);
      const nextIdx = idx + data.direction;
      if (idx < 0 || nextIdx < 0 || nextIdx >= room.seats.length) return;
      [room.seats[idx], room.seats[nextIdx]] = [room.seats[nextIdx], room.seats[idx]];
      this.reindexSeats(room);
      this.broadcastRoom(room);
    });

    socket.on(
      'room:startGame',
      (ack?: (res: { ok: boolean; error?: string }) => void) => {
        const meta = this.socketToRoom.get(socket.id);
        if (!meta) return;
        const room = this.rooms.get(meta.roomCode);
        if (!room || !this.assertHostOrTv(socket, room)) {
          ack?.({ ok: false, error: 'ONLY_HOST_CAN_START' });
          return;
        }
        const def = getGameDefinition(room.selectedGameId);
        if (room.seats.length < def.minPlayers || room.seats.length > def.maxPlayers) {
          ack?.({
            ok: false,
            error: `Requires ${def.minPlayers}-${def.maxPlayers} players (current: ${room.seats.length})`,
          });
          return;
        }
        const sanitizedSeats = room.seats.map((s) => this.sanitizeSeat(s));
        const init = def.createInitialState(sanitizedSeats, room.gameOptions);
        room.gameState = init.state;
        room.status = 'playing';
        room.pausedAt = undefined;
        room.botCooldownUntil = {};
        this.triggerVoice(room, init.voiceClip ?? 'game_starting');
        this.triggerSfx(room, init.sfx ?? 'cardSlide');
        this.broadcastRoom(room);
        ack?.({ ok: true });
      },
    );

    socket.on('room:pause', () => {
      const meta = this.socketToRoom.get(socket.id);
      if (!meta) return;
      const room = this.rooms.get(meta.roomCode);
      if (!room || !this.assertHostOrTv(socket, room) || room.status !== 'playing') return;
      room.status = 'paused';
      room.pausedAt = Date.now();
      this.broadcastRoom(room);
    });

    socket.on('room:resume', () => {
      const meta = this.socketToRoom.get(socket.id);
      if (!meta) return;
      const room = this.rooms.get(meta.roomCode);
      if (!room || !this.assertHostOrTv(socket, room) || room.status !== 'paused') return;
      if (room.pausedAt && room.gameState && typeof room.gameState === 'object') {
        const delta = Date.now() - room.pausedAt;
        const gs = room.gameState as { phaseDeadline?: number };
        if (typeof gs.phaseDeadline === 'number') {
          gs.phaseDeadline += delta;
        }
      }
      room.status = 'playing';
      room.pausedAt = undefined;
      this.broadcastRoom(room);
    });

    socket.on('room:forceSkip', () => {
      const meta = this.socketToRoom.get(socket.id);
      if (!meta) return;
      const room = this.rooms.get(meta.roomCode);
      if (!room || !this.assertHostOrTv(socket, room) || !room.gameState) return;
      const def = getGameDefinition(room.selectedGameId);
      const res = def.forceSkipCurrent(
        room.gameState,
        room.seats.map((s) => this.sanitizeSeat(s)),
      );
      room.gameState = res.state;
      this.applyScoreDeltas(room, res.scoreDeltas);
      this.triggerVoice(room, res.voiceClip);
      this.triggerSfx(room, res.sfx);
      this.broadcastRoom(room);
    });

    socket.on('room:returnToLobby', () => {
      const meta = this.socketToRoom.get(socket.id);
      if (!meta) return;
      const room = this.rooms.get(meta.roomCode);
      if (!room || !this.assertHostOrTv(socket, room)) return;
      room.status = 'lobby';
      room.gameState = null;
      room.pausedAt = undefined;
      this.broadcastRoom(room);
    });

    socket.on('room:resetScores', () => {
      const meta = this.socketToRoom.get(socket.id);
      if (!meta) return;
      const room = this.rooms.get(meta.roomCode);
      if (!room || !this.assertHostOrTv(socket, room)) return;
      room.seats.forEach((s) => {
        s.score = 0;
      });
      this.broadcastRoom(room);
    });

    socket.on('game:action', (action: Record<string, unknown>, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const meta = this.socketToRoom.get(socket.id);
      if (!meta || meta.isTv || !meta.playerId) return;
      const room = this.rooms.get(meta.roomCode);
      if (!room || room.status !== 'playing' || !room.gameState) return;

      const def = getGameDefinition(room.selectedGameId);
      const res = def.applyAction(
        room.gameState,
        meta.playerId,
        action,
        room.seats.map((s) => this.sanitizeSeat(s)),
      );
      if (res.error) {
        ack?.({ ok: false, error: res.error });
        return;
      }
      room.gameState = res.state;
      this.applyScoreDeltas(room, res.scoreDeltas);
      this.triggerVoice(room, res.voiceClip);
      this.triggerSfx(room, res.sfx);
      this.broadcastRoom(room);
      ack?.({ ok: true });
    });

    socket.on('room:reaction', (data: { emoji: string }) => {
      const meta = this.socketToRoom.get(socket.id);
      if (!meta) return;
      const room = this.rooms.get(meta.roomCode);
      if (!room) return;
      const seat = room.seats.find((s) => s.id === meta.playerId);
      const reaction: EmojiReaction = {
        id: crypto.randomBytes(4).toString('hex'),
        seatIndex: seat?.seatIndex ?? -1,
        playerName: seat?.name ?? 'TV',
        emoji: String(data.emoji || '🎉').slice(0, 8),
        ts: Date.now(),
      };
      room.recentReactions = [
        ...room.recentReactions.filter((r) => Date.now() - r.ts < 5500).slice(-10),
        reaction,
      ];
      this.triggerSfx(room, 'emojiPop');
      this.broadcastRoom(room);
    });

    socket.on('disconnect', () => {
      this.leavePreviousRoom(socket);
    });
  }

  private tickAllRooms(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      // Garbage collect inactive empty rooms older than 6 hours
      const anyConnected =
        room.tvSocketIds.size > 0 || room.seats.some((s) => s.connected);
      if (!anyConnected && now - room.lastActivityAt > 6 * 3600_000) {
        this.rooms.delete(code);
        continue;
      }

      if (room.status !== 'playing' || !room.gameState) continue;

      const def = getGameDefinition(room.selectedGameId);
      const sanitized = room.seats.map((s) => this.sanitizeSeat(s));
      let changed = false;

      if (def.onTick) {
        const tickRes = def.onTick(room.gameState, now, sanitized);
        if (tickRes) {
          room.gameState = tickRes.state;
          this.applyScoreDeltas(room, tickRes.scoreDeltas);
          this.triggerVoice(room, tickRes.voiceClip);
          this.triggerSfx(room, tickRes.sfx);
          changed = true;
        }
      }

      // Evaluate AI bot / takeover actions
      for (const seat of room.seats) {
        const actAsBot = seat.isBot || (!seat.connected && seat.botTakeover);
        if (!actAsBot) continue;

        const readyAt = room.botCooldownUntil[seat.id] ?? 0;
        if (now < readyAt) continue;

        const botAction = def.computeBotAction(room.gameState, seat.id, sanitized);
        if (botAction) {
          const actionRes = def.applyAction(room.gameState, seat.id, botAction, sanitized);
          if (!actionRes.error) {
            room.gameState = actionRes.state;
            this.applyScoreDeltas(room, actionRes.scoreDeltas);
            this.triggerVoice(room, actionRes.voiceClip);
            this.triggerSfx(room, actionRes.sfx);
            room.botCooldownUntil[seat.id] = now + 700 + Math.floor(Math.random() * 650);
            changed = true;
            // Let one bot act per tick so actions animate smoothly on stage
            break;
          }
        }
      }

      if (changed) {
        this.broadcastRoom(room);
      }
    }
  }
}
