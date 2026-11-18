import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { GameId, Language, RoomPublicState } from '../../shared/types.js';
import { soundEngine } from '../audio/soundEngine.js';

function getOrCreatePlayerToken(clientTag: string): string {
  const key = `vt_player_token_${clientTag}`;
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(key, created);
  return created;
}

export function useRoomSocket() {
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const clientTag = urlParams.get('client') || 'default';
  const initialRoomParam = (urlParams.get('room') || '').toUpperCase();
  const initialTvParam = urlParams.get('mode') === 'tv';

  const playerToken = useMemo(() => getOrCreatePlayerToken(clientTag), [clientTag]);

  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomPublicState | null>(null);
  const [privateState, setPrivateState] = useState<unknown>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isTvMode, setIsTvMode] = useState<boolean>(initialTvParam);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [forceAudioOnDevice, setForceAudioOnDevice] = useState<boolean | null>(null);

  // Track active room for auto-reconnection on socket drop
  const activeSessionRef = useRef<{ roomCode: string; isTv: boolean; name?: string } | null>(
    null,
  );

  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      const active = activeSessionRef.current;
      if (active) {
        socket.emit(
          'room:join',
          {
            roomCode: active.roomCode,
            playerToken,
            role: active.isTv ? 'tv' : 'player',
            name: active.name,
          },
          (res: { ok: boolean; playerId?: string; isTv?: boolean }) => {
            if (res.ok && res.playerId) setMyPlayerId(res.playerId);
          },
        );
      } else {
        // Restore last session from sessionStorage if refreshed in same tab
        const savedRoom = sessionStorage.getItem(`vt_last_room_${clientTag}`);
        const savedIsTv = sessionStorage.getItem(`vt_last_tv_${clientTag}`) === '1';
        if (savedRoom && (!initialRoomParam || initialRoomParam === savedRoom)) {
          socket.emit(
            'room:join',
            {
              roomCode: savedRoom,
              playerToken,
              role: savedIsTv || initialTvParam ? 'tv' : 'player',
            },
            (res: { ok: boolean; roomCode?: string; playerId?: string; isTv?: boolean }) => {
              if (res.ok && res.roomCode) {
                activeSessionRef.current = {
                  roomCode: res.roomCode,
                  isTv: Boolean(res.isTv),
                };
                if (res.playerId) setMyPlayerId(res.playerId);
                setIsTvMode(Boolean(res.isTv));
              } else {
                sessionStorage.removeItem(`vt_last_room_${clientTag}`);
              }
            },
          );
        }
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('room:publicState', (state: RoomPublicState) => {
      setRoomState(state);
    });

    socket.on('game:privateState', (priv: unknown) => {
      setPrivateState(priv);
    });

    socket.on('room:kicked', () => {
      activeSessionRef.current = null;
      sessionStorage.removeItem(`vt_last_room_${clientTag}`);
      setRoomState(null);
      setPrivateState(null);
      setMyPlayerId(null);
      setErrorMsg('你已被移出房间 / Removed from room');
    });

    return () => {
      socket.disconnect();
    };
  }, [clientTag, initialRoomParam, initialTvParam, playerToken]);

  const mySeat = useMemo(
    () => roomState?.seats.find((s) => s.id === myPlayerId) ?? null,
    [roomState, myPlayerId],
  );
  const isHost = Boolean(mySeat?.isHost) || (isTvMode && !roomState?.seats.some((s) => s.isHost && !s.isBot));

  const shouldAnnounceOnThisDevice = useMemo(() => {
    if (forceAudioOnDevice !== null) return forceAudioOnDevice;
    if (isTvMode) return true;
    if (roomState?.hasTvConnected) return false;
    return Boolean(mySeat?.isHost);
  }, [forceAudioOnDevice, isTvMode, roomState?.hasTvConnected, mySeat?.isHost]);

  // Sync voice & sfx whenever roomState updates
  useEffect(() => {
    if (!roomState) return;
    soundEngine.playVoiceIfNew(
      roomState.activeVoiceClip?.clipKey,
      roomState.activeVoiceClip?.seq,
      roomState.language,
      shouldAnnounceOnThisDevice,
    );
    soundEngine.playServerSfxIfNew(roomState.lastSfx?.name, roomState.lastSfx?.seq);
  }, [roomState, shouldAnnounceOnThisDevice]);

  const createRoom = useCallback(
    (opts: { role: 'player' | 'tv'; name?: string; avatarId?: string; language: Language }) =>
      new Promise<{ ok: boolean; error?: string }>((resolve) => {
        soundEngine.unlock();
        socketRef.current?.emit(
          'room:create',
          {
            playerToken,
            role: opts.role,
            hostMode: opts.role === 'tv' ? 'tv_only' : 'play',
            name: opts.name,
            avatarId: opts.avatarId,
            language: opts.language,
          },
          (res: { ok: boolean; roomCode?: string; playerId?: string; error?: string }) => {
            if (res.ok && res.roomCode) {
              const tv = opts.role === 'tv';
              activeSessionRef.current = { roomCode: res.roomCode, isTv: tv, name: opts.name };
              sessionStorage.setItem(`vt_last_room_${clientTag}`, res.roomCode);
              sessionStorage.setItem(`vt_last_tv_${clientTag}`, tv ? '1' : '0');
              setMyPlayerId(res.playerId ?? null);
              setIsTvMode(tv);
              setPrivateState(null);
              setErrorMsg(null);
            } else {
              setErrorMsg(res.error || 'Failed to create room');
            }
            resolve(res);
          },
        );
      }),
    [clientTag, playerToken],
  );

  const joinRoom = useCallback(
    (opts: { roomCode: string; role: 'player' | 'tv'; name?: string; avatarId?: string }) =>
      new Promise<{ ok: boolean; error?: string }>((resolve) => {
        soundEngine.unlock();
        const code = opts.roomCode.trim().toUpperCase();
        socketRef.current?.emit(
          'room:join',
          {
            roomCode: code,
            playerToken,
            role: opts.role,
            name: opts.name,
            avatarId: opts.avatarId,
          },
          (res: {
            ok: boolean;
            roomCode?: string;
            playerId?: string;
            isTv?: boolean;
            error?: string;
          }) => {
            if (res.ok && res.roomCode) {
              const tv = Boolean(res.isTv);
              activeSessionRef.current = { roomCode: res.roomCode, isTv: tv, name: opts.name };
              sessionStorage.setItem(`vt_last_room_${clientTag}`, res.roomCode);
              sessionStorage.setItem(`vt_last_tv_${clientTag}`, tv ? '1' : '0');
              setMyPlayerId(res.playerId ?? null);
              setIsTvMode(tv);
              setErrorMsg(null);
            } else {
              setErrorMsg(res.error || 'Failed to join room');
            }
            resolve(res);
          },
        );
      }),
    [clientTag, playerToken],
  );

  const leaveRoomLocally = useCallback(() => {
    activeSessionRef.current = null;
    sessionStorage.removeItem(`vt_last_room_${clientTag}`);
    sessionStorage.removeItem(`vt_last_tv_${clientTag}`);
    setRoomState(null);
    setPrivateState(null);
    setMyPlayerId(null);
    soundEngine.stopBgm();
  }, [clientTag]);

  const emit = useCallback((event: string, payload?: unknown, ack?: (res: unknown) => void) => {
    soundEngine.unlock();
    if (ack) {
      socketRef.current?.emit(event, payload, ack);
    } else if (payload !== undefined) {
      socketRef.current?.emit(event, payload);
    } else {
      socketRef.current?.emit(event);
    }
  }, []);

  const sendAction = useCallback(
    (action: Record<string, unknown>) =>
      new Promise<{ ok: boolean; error?: string }>((resolve) => {
        soundEngine.unlock();
        socketRef.current?.emit('game:action', action, (res: { ok: boolean; error?: string }) => {
          if (!res?.ok && res?.error) {
            setErrorMsg(res.error);
          }
          resolve(res ?? { ok: true });
        });
      }),
    [],
  );

  return {
    connected,
    roomState,
    privateState,
    myPlayerId,
    mySeat,
    isHost,
    isTvMode,
    initialRoomParam,
    initialTvParam,
    errorMsg,
    setErrorMsg,
    shouldAnnounceOnThisDevice,
    forceAudioOnDevice,
    setForceAudioOnDevice,
    createRoom,
    joinRoom,
    leaveRoomLocally,
    emit,
    sendAction,
    selectGame: (gameId: GameId) => emit('room:selectGame', { gameId }),
    updateOptions: (opts: Record<string, unknown>) => emit('room:updateOptions', opts),
    setLanguage: (language: Language) => emit('room:setLanguage', { language }),
  };
}
