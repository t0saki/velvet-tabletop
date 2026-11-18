import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  BookOpen,
  Globe,
  LogOut,
  Monitor,
  Music,
  PauseCircle,
  Smartphone,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { getGameCatalogEntry } from '../shared/catalog.js';
import type {
  AvalonPrivateState,
  AvalonPublicState,
  MonopolyPrivateState,
  MonopolyPublicState,
  SketchPrivateState,
  SketchPublicState,
  TexasPrivateState,
  TexasPublicState,
  UndercoverPrivateState,
  UndercoverPublicState,
  WerewolfPrivateState,
  WerewolfPublicState,
} from '../shared/gameTypes.js';
import { soundEngine } from './audio/soundEngine.js';
import {
  EmojiReactionBar,
  FloatingReactionsOverlay,
} from './components/EmojiReactionBar.js';
import { HomeScreen } from './components/HomeScreen.js';
import { HostControlDrawer } from './components/HostControlDrawer.js';
import { LobbyScreen } from './components/LobbyScreen.js';
import { QuickRulesModal } from './components/QuickRulesModal.js';
import { AvalonView } from './games/AvalonView.js';
import { MonopolyView } from './games/MonopolyView.js';
import { SketchView } from './games/SketchView.js';
import { TexasView } from './games/TexasView.js';
import { UndercoverView } from './games/UndercoverView.js';
import { WerewolfView } from './games/WerewolfView.js';
import { useRoomSocket } from './hooks/useRoomSocket.js';
import { useI18n } from './i18n/useI18n.js';

export const App: React.FC = () => {
  const { lang, setLang, t, pick } = useI18n();
  const sock = useRoomSocket();
  const [showRules, setShowRules] = useState(false);
  const [audioSnap, setAudioSnap] = useState(() => soundEngine.getSettings());

  useEffect(() => {
    return soundEngine.subscribe(() => setAudioSnap(soundEngine.getSettings()));
  }, []);

  const room = sock.roomState;
  const activeGameMeta = room ? getGameCatalogEntry(room.selectedGameId) : null;

  // Sync language automatically when room updates
  useEffect(() => {
    if (room && room.language !== lang) {
      setLang(room.language);
    }
  }, [room?.language]);

  // Sync BGM track based on active game and device role
  useEffect(() => {
    if (!room || !activeGameMeta) {
      soundEngine.stopBgm();
      return;
    }
    const track =
      room.status === 'lobby' ? '/audio/bgm/lobby.mp3' : activeGameMeta.bgmTrack;
    soundEngine.syncBgm(track, sock.shouldAnnounceOnThisDevice);
  }, [room?.status, activeGameMeta?.bgmTrack, sock.shouldAnnounceOnThisDevice]);

  // Confetti burst on game_over
  const gamePhase =
    room?.gamePublic && typeof room.gamePublic === 'object'
      ? (room.gamePublic as { phase?: string }).phase
      : undefined;

  useEffect(() => {
    if (!sock.errorMsg) return;
    const timer = setTimeout(() => sock.setErrorMsg(null), 3500);
    return () => clearTimeout(timer);
  }, [sock.errorMsg]);

  useEffect(() => {
    if (gamePhase === 'game_over') {
      soundEngine.playSfx('victoryFanfare');
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
      });
    }
  }, [gamePhase]);

  if (!room) {
    return (
      <HomeScreen
        initialRoomCode={sock.initialRoomParam}
        initialTvMode={sock.initialTvParam}
        connected={sock.connected}
        errorMsg={sock.errorMsg}
        onCreatePlay={(name, avatarId) => {
          sock.createRoom({ role: 'player', name, avatarId, language: lang });
        }}
        onCreateTv={() => {
          sock.createRoom({ role: 'tv', language: lang });
        }}
        onJoin={(roomCode, name, avatarId, asTv) => {
          sock.joinRoom({
            roomCode,
            role: asTv ? 'tv' : 'player',
            name,
            avatarId,
          });
        }}
      />
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0B0D13] text-[#F5F2EB]">
      {/* Active Game Seedance Atmospheric Loop */}
      {activeGameMeta && (
        <video
          key={activeGameMeta.backdropVideo}
          autoPlay
          loop
          muted
          playsInline
          src={activeGameMeta.backdropVideo}
          className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-30"
        />
      )}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#0B0D13]/80 via-[#0B0D13]/75 to-[#0B0D13]" />

      {/* Top Glass Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0B0D13]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img
              src="/images/brand-crest.webp"
              alt="Logo"
              className="h-8 w-8 rounded-lg border border-[#D4AF37]/50 object-cover"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-black tracking-widest text-[#F3E09F]">
                  {room.roomCode}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-200">
                  {sock.isTvMode ? (
                    <>
                      <Monitor className="h-3 w-3 text-[#D4AF37]" />
                      {t('tvBadge')}
                    </>
                  ) : (
                    <>
                      <Smartphone className="h-3 w-3 text-emerald-400" />
                      {sock.mySeat?.name || t('playerBadge')}
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {!audioSnap.unlocked && (
              <button
                type="button"
                onClick={() => soundEngine.unlock()}
                className="animate-pulse rounded-full bg-[#D4AF37] px-3 py-1 text-[11px] font-black text-[#0B0D13]"
              >
                🔊 {t('unlockAudio')}
              </button>
            )}

            <button
              type="button"
              title={
                sock.shouldAnnounceOnThisDevice
                  ? t('soundStageOn')
                  : room.hasTvConnected
                    ? t('tvDetectedMuteHint')
                    : t('soundMuted')
              }
              onClick={() => {
                soundEngine.unlock();
                const next = !sock.shouldAnnounceOnThisDevice;
                sock.setForceAudioOnDevice(next);
                soundEngine.setVoiceEnabled(next);
              }}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                sock.shouldAnnounceOnThisDevice
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                  : 'border-white/10 bg-white/5 text-slate-400'
              }`}
            >
              {sock.shouldAnnounceOnThisDevice ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {sock.shouldAnnounceOnThisDevice ? 'Voice' : 'Mute'}
              </span>
            </button>

            <button
              type="button"
              title="BGM"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.setBgmEnabled(!audioSnap.bgmEnabled);
              }}
              className={`rounded-full border p-1.5 text-xs ${
                audioSnap.bgmEnabled
                  ? 'border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#F3E09F]'
                  : 'border-white/10 bg-white/5 text-slate-500'
              }`}
            >
              <Music className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setShowRules(true)}
              className="rounded-full border border-white/15 bg-white/5 p-1.5 text-slate-200 hover:bg-white/10"
              title={t('quickRules')}
            >
              <BookOpen className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                const next = lang === 'zh' ? 'en' : 'zh';
                setLang(next);
                if (sock.isHost) sock.setLanguage(next);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-[#F3E09F]"
            >
              <Globe className="h-3 w-3" />
              {lang === 'zh' ? 'EN' : '中文'}
            </button>

            {sock.isHost && (
              <HostControlDrawer
                room={room}
                myPlayerId={sock.myPlayerId}
                onEmit={sock.emit}
              />
            )}

            <button
              type="button"
              onClick={sock.leaveRoomLocally}
              title={t('leaveHome')}
              className="rounded-full border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/25"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Live Error / Notice Toast */}
      {sock.errorMsg && (
        <div className="fixed inset-x-0 top-16 z-50 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-rose-500/60 bg-[#1B1218]/95 px-4 py-2.5 text-xs font-bold text-rose-100 shadow-2xl backdrop-blur-md">
            <span>⚠️ {sock.errorMsg}</span>
            <button
              type="button"
              onClick={() => sock.setErrorMsg(null)}
              className="rounded px-1.5 py-0.5 text-rose-300 hover:bg-white/10"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Paused Overlay Banner */}
      {room.status === 'paused' && (
        <div className="relative z-30 mx-auto mt-3 max-w-2xl px-4">
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-amber-400/60 bg-amber-500/20 px-4 py-2.5 text-xs font-bold text-amber-100">
            <PauseCircle className="h-4 w-4" />
            {t('pausedBanner')}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="relative z-10">
        {room.status === 'lobby' && (
          <LobbyScreen
            room={room}
            myPlayerId={sock.myPlayerId}
            isHost={sock.isHost}
            isTvMode={sock.isTvMode}
            onEmit={sock.emit}
            onSelectGame={sock.selectGame}
            onUpdateOptions={sock.updateOptions}
          />
        )}

        {room.status !== 'lobby' && room.gamePublic != null && (
          <>
            {room.selectedGameId === 'avalon' && (
              <AvalonView
                room={room}
                pub={room.gamePublic as AvalonPublicState}
                priv={(sock.privateState as AvalonPrivateState) ?? null}
                isTvMode={sock.isTvMode}
                isHost={sock.isHost}
                onAction={sock.sendAction}
                onEmit={sock.emit}
              />
            )}
            {room.selectedGameId === 'werewolf' && (
              <WerewolfView
                room={room}
                pub={room.gamePublic as WerewolfPublicState}
                priv={(sock.privateState as WerewolfPrivateState) ?? null}
                isTvMode={sock.isTvMode}
                isHost={sock.isHost}
                onAction={sock.sendAction}
                onEmit={sock.emit}
              />
            )}
            {room.selectedGameId === 'texas' && (
              <TexasView
                room={room}
                pub={room.gamePublic as TexasPublicState}
                priv={(sock.privateState as TexasPrivateState) ?? null}
                isTvMode={sock.isTvMode}
                isHost={sock.isHost}
                onAction={sock.sendAction}
                onEmit={sock.emit}
              />
            )}
            {room.selectedGameId === 'monopoly' && (
              <MonopolyView
                room={room}
                pub={room.gamePublic as MonopolyPublicState}
                priv={(sock.privateState as MonopolyPrivateState) ?? null}
                isTvMode={sock.isTvMode}
                isHost={sock.isHost}
                onAction={sock.sendAction}
                onEmit={sock.emit}
              />
            )}
            {room.selectedGameId === 'sketch' && (
              <SketchView
                room={room}
                pub={room.gamePublic as SketchPublicState}
                priv={(sock.privateState as SketchPrivateState) ?? null}
                isTvMode={sock.isTvMode}
                isHost={sock.isHost}
                canSpeakStage={sock.shouldAnnounceOnThisDevice}
                onAction={sock.sendAction}
                onEmit={sock.emit}
              />
            )}
            {room.selectedGameId === 'undercover' && (
              <UndercoverView
                room={room}
                pub={room.gamePublic as UndercoverPublicState}
                priv={(sock.privateState as UndercoverPrivateState) ?? null}
                isTvMode={sock.isTvMode}
                isHost={sock.isHost}
                onAction={sock.sendAction}
                onEmit={sock.emit}
              />
            )}
          </>
        )}
      </main>

      {/* Live Reaction Bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-30 flex justify-center px-3 sm:right-auto sm:left-4 sm:justify-start">
        <EmojiReactionBar onSend={(emoji) => sock.emit('room:reaction', { emoji })} />
      </div>

      <FloatingReactionsOverlay reactions={room.recentReactions} />

      {activeGameMeta && (
        <QuickRulesModal
          game={activeGameMeta}
          open={showRules}
          onClose={() => setShowRules(false)}
        />
      )}
    </div>
  );
};
