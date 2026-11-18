import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { createAppServer, type CreatedServer } from '../src/server/index.js';
import type { RoomPublicState } from '../src/shared/types.js';
import type { AvalonPrivateState } from '../src/shared/gameTypes.js';

function waitEvent<T>(socket: Socket, event: string, pred?: (data: T) => boolean): Promise<T> {
  return new Promise((resolve) => {
    const handler = (data: T) => {
      if (!pred || pred(data)) {
        socket.off(event, handler);
        resolve(data);
      }
    };
    socket.on(event, handler);
  });
}

describe('LAN Room Socket Integration & Anti-Cheat Privacy', () => {
  let server: CreatedServer;
  let baseUrl: string;
  const openSockets: Socket[] = [];

  beforeAll(async () => {
    server = await createAppServer({ port: 0, disableVite: true });
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(async () => {
    openSockets.forEach((s) => s.disconnect());
    await server.close();
  });

  function connectClient(): Promise<Socket> {
    return new Promise((resolve) => {
      const s = ioClient(baseUrl, { transports: ['websocket'] });
      openSockets.push(s);
      s.on('connect', () => resolve(s));
    });
  }

  it('connects TV Stage + 6 players, preserves secrets per socket, and reconnects seamlessly', async () => {
    const tvSock = await connectClient();
    const createRes = await new Promise<{ ok: boolean; roomCode: string }>((resolve) => {
      tvSock.emit(
        'room:create',
        { playerToken: 'tv-tok-1', role: 'tv', hostMode: 'tv_only', language: 'zh' },
        resolve,
      );
    });
    expect(createRes.ok).toBe(true);
    const roomCode = createRes.roomCode;

    // Join 3 human players and add 3 AI bots => 6 total seats
    const p1 = await connectClient();
    const p2 = await connectClient();
    const p3 = await connectClient();

    const j1 = await new Promise<{ ok: boolean; playerId: string }>((r) =>
      p1.emit('room:join', { roomCode, playerToken: 'tok-1', role: 'player', name: 'Alice' }, r),
    );
    const j2 = await new Promise<{ ok: boolean; playerId: string }>((r) =>
      p2.emit('room:join', { roomCode, playerToken: 'tok-2', role: 'player', name: 'Bob' }, r),
    );
    const j3 = await new Promise<{ ok: boolean; playerId: string }>((r) =>
      p3.emit('room:join', { roomCode, playerToken: 'tok-3', role: 'player', name: 'Carol' }, r),
    );
    expect(j1.ok && j2.ok && j3.ok).toBe(true);

    p1.emit('room:addBot');
    p1.emit('room:addBot');
    p1.emit('room:addBot');

    const lobbySix = await waitEvent<RoomPublicState>(
      tvSock,
      'room:publicState',
      (st) => st.seats.length === 6,
    );
    expect(lobbySix.hasTvConnected).toBe(true);
    expect(lobbySix.seats[0].isHost).toBe(true);

    // Start Avalon and verify public state contains zero secret roles while private states are isolated
    const priv1Promise = waitEvent<AvalonPrivateState>(p1, 'game:privateState');
    const priv2Promise = waitEvent<AvalonPrivateState>(p2, 'game:privateState');
    const tvPublicPromise = waitEvent<RoomPublicState>(
      tvSock,
      'room:publicState',
      (st) => st.status === 'playing',
    );

    const startRes = await new Promise<{ ok: boolean }>((r) =>
      p1.emit('room:startGame', r),
    );
    expect(startRes.ok).toBe(true);

    const [priv1, priv2, tvPublic] = await Promise.all([
      priv1Promise,
      priv2Promise,
      tvPublicPromise,
    ]);

    expect(priv1.playerId).toBe(j1.playerId);
    expect(priv2.playerId).toBe(j2.playerId);
    expect(JSON.stringify(tvPublic.gamePublic)).not.toContain('"roles"');
    expect((tvPublic.gamePublic as { revealedRoles?: unknown }).revealedRoles).toBeUndefined();

    // Seamless disconnect & token reconnect for Bob
    p2.disconnect();
    await waitEvent<RoomPublicState>(
      p1,
      'room:publicState',
      (st) => st.seats.find((s) => s.id === j2.playerId)?.connected === false,
    );

    const p2Reconnected = await connectClient();
    const rejoinPrivPromise = waitEvent<AvalonPrivateState>(p2Reconnected, 'game:privateState');
    const rejoinRes = await new Promise<{ ok: boolean; playerId: string }>((r) =>
      p2Reconnected.emit('room:join', { roomCode, playerToken: 'tok-2', role: 'player' }, r),
    );
    expect(rejoinRes.ok).toBe(true);
    expect(rejoinRes.playerId).toBe(j2.playerId);
    const rejoinPriv = await rejoinPrivPromise;
    expect(rejoinPriv.role).toBe(priv2.role);

    // Host Pause -> Resume -> ForceSkip -> Return to Lobby
    p1.emit('room:pause');
    const pausedSt = await waitEvent<RoomPublicState>(
      tvSock,
      'room:publicState',
      (st) => st.status === 'paused',
    );
    expect(pausedSt.status).toBe('paused');

    p1.emit('room:resume');
    const resumedSt = await waitEvent<RoomPublicState>(
      tvSock,
      'room:publicState',
      (st) => st.status === 'playing',
    );
    expect(resumedSt.status).toBe('playing');

    p1.emit('room:returnToLobby');
    const backLobby = await waitEvent<RoomPublicState>(
      tvSock,
      'room:publicState',
      (st) => st.status === 'lobby',
    );
    expect(backLobby.status).toBe('lobby');
  });
});
