import React, { useEffect, useMemo, useState } from 'react';
import { Filter, MessageSquare, ShieldAlert, Sparkles, Vote, X, Zap } from 'lucide-react';
import type {
  UndercoverClueRecord,
  UndercoverPrivateState,
  UndercoverPublicState,
} from '../../shared/gameTypes.js';
import type { PlayerSeat, RoomPublicState } from '../../shared/types.js';
import { useI18n } from '../i18n/useI18n.js';
import { soundEngine } from '../audio/soundEngine.js';
import { AvatarBadge } from '../components/AvatarBadge.js';
import { CountdownPill } from '../components/CountdownPill.js';
import { PrivacyPeekCard } from '../components/PrivacyPeekCard.js';

interface ClueGroup {
  key: string;
  round: number;
  isPk: boolean;
  items: UndercoverClueRecord[];
}

export const UndercoverView: React.FC<{
  room: RoomPublicState;
  pub: UndercoverPublicState;
  priv: UndercoverPrivateState | null;
  isTvMode: boolean;
  isHost: boolean;
  onAction: (action: Record<string, unknown>) => void;
  onEmit: (event: string) => void;
}> = ({ room, pub, priv, isTvMode, isHost, onAction, onEmit }) => {
  const { lang, pick } = useI18n();
  const seatMap = useMemo(
    () => new Map<string, PlayerSeat>(room.seats.map((s) => [s.id, s])),
    [room.seats],
  );
  const [clueText, setClueText] = useState('');
  const [selectedFilterPlayerId, setSelectedFilterPlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (!priv?.isMyTurnToClue) {
      setClueText('');
    }
  }, [priv?.isMyTurnToClue]);

  useEffect(() => {
    if (pub.phase === 'word_peek' && pub.round === 1 && pub.clues.length === 0) {
      setSelectedFilterPlayerId(null);
    }
  }, [pub.phase, pub.round, pub.clues.length]);

  const roleBadge = (role: string) => {
    if (role === 'civilian') return lang === 'zh' ? '平民' : 'Civilian';
    if (role === 'undercover') return lang === 'zh' ? '卧底 🕵️' : 'Undercover 🕵️';
    return lang === 'zh' ? '白板 🃏' : 'Blank 🃏';
  };

  const activeFilterSeat = selectedFilterPlayerId
    ? seatMap.get(selectedFilterPlayerId) ?? null
    : null;

  const groupedClues = useMemo<ClueGroup[]>(() => {
    const filtered = selectedFilterPlayerId
      ? pub.clues.filter((c) => c.playerId === selectedFilterPlayerId)
      : pub.clues;

    const groups = new Map<string, ClueGroup>();
    for (const item of filtered) {
      const isPk = Boolean(item.isPk);
      const key = `${item.round}-${isPk ? 'pk' : 'main'}`;
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(key, { key, round: item.round, isPk, items: [item] });
      }
    }
    return Array.from(groups.values());
  }, [pub.clues, selectedFilterPlayerId]);

  const submitClue = () => {
    if (!priv?.isMyTurnToClue) return;
    soundEngine.playSfx('buttonTap');
    onAction({
      type: 'submit_clue',
      clue: clueText.trim() || (lang === 'zh' ? '已口头描述' : 'Spoken aloud'),
    });
    setClueText('');
  };

  const toggleSeatFilter = (seatId: string) => {
    soundEngine.playSfx('buttonTap');
    setSelectedFilterPlayerId((prev) => (prev === seatId ? null : seatId));
  };

  const threatBadgeText =
    lang === 'zh'
      ? `🕵️ 场上剩余卧底/白板：${pub.remainingThreatCount} 名`
      : `🕵️ ${pub.remainingThreatCount} Infiltrator${pub.remainingThreatCount === 1 ? '' : 's'} Left`;

  const civilianWordPrimary = pub.civilianWordObj
    ? pick(pub.civilianWordObj)
    : pub.civilianWord ?? '';
  const civilianWordSecondary =
    pub.civilianWordObj && pub.civilianWordObj.zh !== pub.civilianWordObj.en
      ? lang === 'zh'
        ? pub.civilianWordObj.en
        : pub.civilianWordObj.zh
      : null;

  const undercoverWordPrimary = pub.undercoverWordObj
    ? pick(pub.undercoverWordObj)
    : pub.undercoverWord ?? '';
  const undercoverWordSecondary =
    pub.undercoverWordObj && pub.undercoverWordObj.zh !== pub.undercoverWordObj.en
      ? lang === 'zh'
        ? pub.undercoverWordObj.en
        : pub.undercoverWordObj.zh
      : null;

  const privateWordPrimary = priv?.secretWordObj
    ? pick(priv.secretWordObj)
    : priv?.secretWord ?? null;
  const privateWordSecondary =
    priv?.secretWordObj && priv.secretWordObj.zh !== priv.secretWordObj.en
      ? lang === 'zh'
        ? priv.secretWordObj.en
        : priv.secretWordObj.zh
      : null;

  const isPkActive = Boolean(pub.pkIds && pub.pkIds.length > 0);
  const currentSpeakerName = pub.currentSpeakerId
    ? seatMap.get(pub.currentSpeakerId)?.name ?? ''
    : '';

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-4 pb-24 sm:px-6">
      {/* Stage Card */}
      <div className="gold-border rounded-3xl bg-[#161124]/92 p-4 backdrop-blur-md sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold tracking-widest text-purple-300 uppercase">
                {lang === 'zh' ? '假面卧底 · ' : 'Masquerade Undercover · '}
                {pick(pub.category)}
              </span>
              <span className="rounded-full border border-purple-400/40 bg-purple-500/20 px-2.5 py-0.5 text-[11px] font-black text-purple-100">
                R{pub.round}
              </span>
              {isPkActive && (
                <span className="inline-flex animate-pulse items-center gap-1 rounded-full border border-amber-400/60 bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-black text-amber-200">
                  <Zap className="h-3 w-3" />
                  {lang === 'zh' ? 'PK 加时赛' : 'Tiebreak PK'}
                </span>
              )}
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                  pub.remainingThreatCount > 0
                    ? 'border-rose-400/45 bg-rose-500/15 text-rose-200'
                    : 'border-emerald-400/45 bg-emerald-500/15 text-emerald-200'
                }`}
              >
                {threatBadgeText}
              </span>
            </div>

            <h2 className="text-lg font-black text-white sm:text-2xl">
              {pub.phase === 'word_peek'
                ? lang === 'zh'
                  ? '请各位按住查看秘密词语'
                  : 'Hold to Peek at Your Secret Word'
                : pub.phase === 'clue_round'
                  ? isPkActive
                    ? lang === 'zh'
                      ? '平票 PK 加时描述！'
                      : 'Tiebreak PK Clue!'
                    : lang === 'zh'
                      ? '轮流一句话描述你的词语'
                      : 'Take Turns Giving Clues'
                  : pub.phase === 'vote_round'
                    ? isPkActive
                      ? lang === 'zh'
                        ? 'PK 复投！仅投平票嫌疑人'
                        : 'PK Revote! Pick Among Tied Suspects'
                      : lang === 'zh'
                        ? '谁在浑水摸鱼？全员投票指认！'
                        : 'Vote to Unmask the Undercover!'
                    : pub.phase === 'elimination_reveal'
                      ? lang === 'zh'
                        ? '假面揭晓时刻！'
                        : 'Identity Unmasked!'
                      : lang === 'zh'
                        ? '晚宴终局 · 词语揭秘'
                        : 'Game Over · Words Revealed'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {pub.phase === 'word_peek' && (
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-bold text-slate-200 tabular-nums">
                {lang === 'zh'
                  ? `已看词 ${pub.peekedIds.length}/${room.seats.length}`
                  : `Peeked ${pub.peekedIds.length}/${room.seats.length}`}
              </span>
            )}
            {pub.phase === 'vote_round' && (
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-bold text-slate-200 tabular-nums">
                {lang === 'zh'
                  ? `已投票 ${pub.votedIds.length}/${pub.aliveIds.length}`
                  : `Voted ${pub.votedIds.length}/${pub.aliveIds.length}`}
              </span>
            )}
            <CountdownPill deadline={pub.phaseDeadline} paused={room.status === 'paused'} />
          </div>
        </div>

        {/* Speaking Queue Strip during clue_round */}
        {pub.phase === 'clue_round' && pub.currentSpeakerId && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 rounded-2xl border border-purple-400/30 bg-black/35 px-3.5 py-2.5 text-xs">
            <span className="animate-pulse-gold inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/70 bg-[#D4AF37]/20 px-2.5 py-1 font-black text-[#F3E09F]">
              🎙️ {lang === 'zh' ? '当前：' : 'Now: '}
              {currentSpeakerName}
            </span>
            {pub.clueQueue.length > 0 ? (
              pub.clueQueue.map((speakerId, idx) => (
                <React.Fragment key={speakerId}>
                  <span className="text-slate-500">→</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-semibold ${
                      idx === 0
                        ? 'border border-purple-400/50 bg-purple-500/20 text-purple-100'
                        : 'bg-white/5 text-slate-300'
                    }`}
                  >
                    {idx === 0 ? (lang === 'zh' ? '下一位：' : 'Next: ') : ''}
                    {seatMap.get(speakerId)?.name ?? speakerId}
                  </span>
                </React.Fragment>
              ))
            ) : (
              <>
                <span className="text-slate-500">→</span>
                <span className="rounded-full bg-white/5 px-2.5 py-0.5 font-semibold text-amber-200">
                  {lang === 'zh' ? '本轮最后一位 · 即将投票' : 'Final speaker · Voting next'}
                </span>
              </>
            )}
          </div>
        )}

        {/* Elimination Spotlight + Full Vote Matrix */}
        {pub.phase === 'elimination_reveal' && pub.lastEliminated && (
          <div className="animate-flip-in mt-4 rounded-2xl border border-purple-400/50 bg-purple-500/15 p-4 sm:p-5">
            <div className="flex flex-col items-center text-center">
              {seatMap.get(pub.lastEliminated.playerId) && (
                <AvatarBadge
                  seat={seatMap.get(pub.lastEliminated.playerId)!}
                  size="md"
                  highlight
                />
              )}
              <div className="mt-2 text-lg font-black text-white sm:text-xl">
                {seatMap.get(pub.lastEliminated.playerId)?.name} —{' '}
                <span className="text-amber-300">{roleBadge(pub.lastEliminated.role)}</span>
              </div>

              {pub.lastEliminated.role === 'blank' && (
                <div className="mt-2.5 max-w-xl rounded-xl border border-amber-400/45 bg-amber-500/15 px-3.5 py-2 text-xs font-bold text-amber-100">
                  {lang === 'zh'
                    ? '🃏 白板现身！聚会高能时刻：白板可当场口头抢猜一次平民词，看看演技还瞒不瞒得住！'
                    : '🃏 Blank Unmasked! Party drama: let the Blank shout out one final guess at the Civilian Word!'}
                </div>
              )}
            </div>

            {/* Full Vote Breakdown Chips */}
            {Object.keys(pub.lastEliminated.votes).length > 0 && (
              <div className="mt-4 border-t border-white/10 pt-3">
                <div className="mb-2 text-center text-[11px] font-bold tracking-wider text-purple-200 uppercase">
                  {lang === 'zh' ? '本轮投票明细' : 'Vote Breakdown'}
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {Object.entries(pub.lastEliminated.votes).map(([voterId, targetId]) => {
                    const hit = targetId === pub.lastEliminated?.playerId;
                    return (
                      <span
                        key={voterId}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          hit
                            ? 'border-purple-400/50 bg-purple-500/25 text-white'
                            : 'border-white/10 bg-black/30 text-slate-300'
                        }`}
                      >
                        <span className="text-slate-300">{seatMap.get(voterId)?.name ?? voterId}</span>
                        <span className="text-purple-300">→</span>
                        <span className={hit ? 'font-black text-[#F3E09F]' : 'font-bold text-white'}>
                          {seatMap.get(targetId)?.name ?? targetId}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {isHost && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playSfx('cardSlide');
                    onAction({ type: 'next_round' });
                  }}
                  className="rounded-xl bg-[#D4AF37] px-5 py-2 text-xs font-black text-[#0B0D13] shadow hover:brightness-105"
                >
                  {lang === 'zh' ? '继续下一轮' : 'Next Round'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Game Over */}
        {pub.phase === 'game_over' && (
          <div
            className={`animate-card-deal mt-4 rounded-2xl border p-5 text-center ${
              pub.winner === 'civilians'
                ? 'border-sky-400/60 bg-sky-500/15'
                : 'border-purple-500/60 bg-purple-500/15'
            }`}
          >
            <h3 className="text-2xl font-black text-white sm:text-3xl">
              {pub.winner === 'civilians'
                ? lang === 'zh'
                  ? '🎉 平民阵营获胜！'
                  : '🎉 Civilians Win!'
                : lang === 'zh'
                  ? '🕵️ 卧底阵营逆袭获胜！'
                  : '🕵️ Undercover Team Wins!'}
            </h3>

            {/* Giant Civilian vs Undercover Word Cards */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-sky-400/45 bg-sky-950/45 p-4">
                <div className="text-xs font-bold tracking-wider text-sky-300 uppercase">
                  {lang === 'zh' ? '平民词 · Civilian Word' : 'Civilian Word'}
                </div>
                <div className="mt-1.5 text-2xl font-black text-white sm:text-3xl">
                  {civilianWordPrimary}
                </div>
                {civilianWordSecondary && (
                  <div className="mt-1 text-xs font-medium text-sky-200/75">
                    {civilianWordSecondary}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-purple-400/45 bg-purple-950/45 p-4">
                <div className="text-xs font-bold tracking-wider text-purple-300 uppercase">
                  {lang === 'zh' ? '卧底词 · Undercover Word' : 'Undercover Word'}
                </div>
                <div className="mt-1.5 text-2xl font-black text-white sm:text-3xl">
                  {undercoverWordPrimary}
                </div>
                {undercoverWordSecondary && (
                  <div className="mt-1 text-xs font-medium text-purple-200/75">
                    {undercoverWordSecondary}
                  </div>
                )}
              </div>
            </div>

            {/* Compact Vote History Recap */}
            {pub.voteHistory.length > 0 && (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-left">
                <div className="mb-2 text-[11px] font-bold tracking-wider text-[#F3E09F] uppercase">
                  {lang === 'zh' ? '各轮放逐复盘' : 'Elimination Vote Recap'}
                </div>
                <div className="space-y-1.5">
                  {pub.voteHistory.map((rec, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center gap-1.5 text-xs text-slate-200"
                    >
                      <span className="rounded bg-white/10 px-2 py-0.5 font-black text-[#F3E09F]">
                        R{rec.round}
                        {rec.isPk ? ' PK' : ''}
                      </span>
                      <span className="font-bold text-rose-300">
                        {lang === 'zh' ? '出局：' : 'Out: '}
                        {seatMap.get(rec.eliminatedId)?.name ?? rec.eliminatedId}
                      </span>
                      <span className="text-slate-500">·</span>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(rec.votes).map(([voterId, targetId]) => (
                          <span
                            key={voterId}
                            className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-300"
                          >
                            {seatMap.get(voterId)?.name ?? voterId}→
                            {seatMap.get(targetId)?.name ?? targetId}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isHost && (
              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onEmit('room:startGame')}
                  className="rounded-xl bg-[#D4AF37] px-5 py-2 text-xs font-extrabold text-[#0B0D13]"
                >
                  {lang === 'zh' ? '再来一局' : 'Play Again'}
                </button>
                <button
                  type="button"
                  onClick={() => onEmit('room:returnToLobby')}
                  className="rounded-xl border border-white/20 bg-white/10 px-5 py-2 text-xs font-bold text-white"
                >
                  {lang === 'zh' ? '返回大厅' : 'Lobby'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Interactive Table Seats */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {room.seats.map((seat) => {
            const alive = pub.aliveIds.includes(seat.id);
            const speaking = pub.currentSpeakerId === seat.id;
            const rev = pub.revealedIdentities?.[seat.id];
            const isFiltered = selectedFilterPlayerId === seat.id;
            const isPkSeat = Boolean(pub.pkIds?.includes(seat.id));

            const badge = rev
              ? roleBadge(rev.role)
              : !alive
                ? lang === 'zh'
                  ? '已淘汰'
                  : 'Out'
                : speaking
                  ? lang === 'zh'
                    ? '🎙️ 描述中'
                    : '🎙️ Cluing'
                  : isPkSeat
                    ? '⚡ PK'
                    : pub.phase === 'word_peek' && pub.peekedIds.includes(seat.id)
                      ? lang === 'zh'
                        ? '✓ 已看词'
                        : '✓ Ready'
                      : pub.phase === 'vote_round' && pub.votedIds.includes(seat.id)
                        ? lang === 'zh'
                          ? '✓ 已投票'
                          : '✓ Voted'
                        : undefined;

            const revWord = rev
              ? rev.role === 'blank'
                ? lang === 'zh'
                  ? '无词（白板）'
                  : 'No Word'
                : rev.wordObj
                  ? pick(rev.wordObj)
                  : rev.role === 'civilian' && pub.civilianWordObj
                    ? pick(pub.civilianWordObj)
                    : rev.role === 'undercover' && pub.undercoverWordObj
                      ? pick(pub.undercoverWordObj)
                      : rev.word
              : null;

            const roleCardBorder = rev
              ? rev.role === 'civilian'
                ? 'border-sky-400/50 bg-sky-500/10'
                : rev.role === 'undercover'
                  ? 'border-purple-400/60 bg-purple-500/15'
                  : 'border-amber-400/60 bg-amber-500/15'
              : speaking
                ? 'border-purple-400 bg-purple-500/20 ring-2 ring-purple-400/40'
                : isPkSeat
                  ? 'border-amber-400/60 bg-amber-500/10'
                  : !alive
                    ? 'border-white/5 bg-black/40'
                    : 'border-white/10 bg-black/25 hover:border-white/25';

            return (
              <button
                key={seat.id}
                type="button"
                onClick={() => toggleSeatFilter(seat.id)}
                title={
                  lang === 'zh'
                    ? '点击筛选或取消筛选该玩家发言'
                    : 'Tap to filter clues by this player'
                }
                className={`flex flex-col items-center rounded-2xl border p-2.5 text-center transition-all ${roleCardBorder} ${
                  isFiltered ? 'ring-2 ring-[#D4AF37] ring-offset-1 ring-offset-[#161124]' : ''
                }`}
              >
                <AvatarBadge
                  seat={seat}
                  size="sm"
                  isMe={seat.id === priv?.playerId}
                  dimmed={!alive && !rev}
                  highlight={speaking}
                  subLabel={badge}
                />
                {revWord && (
                  <div className="mt-1.5 max-w-full truncate rounded-lg border border-white/10 bg-black/35 px-2 py-0.5 text-[11px] font-bold text-[#F3E09F]">
                    {revWord}
                  </div>
                )}
                {isFiltered && (
                  <div className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-bold text-[#F3E09F]">
                    <Filter className="h-2.5 w-2.5" />
                    {lang === 'zh' ? '线索已筛选' : 'Filtered'}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Interactive Round-Grouped Clue Wall */}
        {(pub.clues.length > 0 || activeFilterSeat) && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-3.5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                <MessageSquare className="h-3.5 w-3.5" />
                {lang === 'zh' ? '本局发言线索墙' : 'Clue Wall'}
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">
                  {pub.clues.length}
                </span>
              </div>

              {activeFilterSeat ? (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playSfx('buttonTap');
                    setSelectedFilterPlayerId(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-2.5 py-1 text-[11px] font-bold text-[#F3E09F] hover:bg-[#D4AF37]/25"
                >
                  <Filter className="h-3 w-3" />
                  {lang === 'zh'
                    ? `只看 ${activeFilterSeat.name}`
                    : `Filter: ${activeFilterSeat.name}`}
                  <X className="h-3 w-3" />
                </button>
              ) : (
                <span className="text-[11px] text-slate-400">
                  {lang === 'zh'
                    ? '💡 点击上方座位可跨轮次筛选单人发言'
                    : '💡 Tap any seat above to filter clues across rounds'}
                </span>
              )}
            </div>

            {groupedClues.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                {lang === 'zh'
                  ? `${activeFilterSeat?.name ?? ''} 暂未留下发言记录`
                  : `No clues recorded yet for ${activeFilterSeat?.name ?? 'this player'}`}
              </div>
            ) : (
              <div className="max-h-60 space-y-3 overflow-y-auto pr-1">
                {groupedClues.map((group) => (
                  <div
                    key={group.key}
                    className={`rounded-xl border p-2.5 ${
                      group.isPk
                        ? 'border-amber-400/35 bg-amber-500/10'
                        : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black tracking-wide">
                      <span
                        className={`rounded-md px-2 py-0.5 ${
                          group.isPk
                            ? 'bg-amber-500/25 text-amber-200'
                            : 'bg-purple-500/25 text-purple-200'
                        }`}
                      >
                        {group.isPk
                          ? lang === 'zh'
                            ? `R${group.round} · PK 加时`
                            : `R${group.round} · PK Tiebreak`
                          : lang === 'zh'
                            ? `第 ${group.round} 轮 (R${group.round})`
                            : `Round ${group.round} (R${group.round})`}
                      </span>
                    </div>

                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {group.items.map((c, idx) => {
                        const isMineOrFiltered = selectedFilterPlayerId === c.playerId;
                        return (
                          <div
                            key={`${group.key}-${c.playerId}-${idx}`}
                            className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-xs ${
                              isMineOrFiltered
                                ? 'border-[#D4AF37]/50 bg-[#D4AF37]/10'
                                : 'border-white/5 bg-black/30'
                            }`}
                          >
                            <span className="shrink-0 font-bold text-[#F3E09F]">
                              {seatMap.get(c.playerId)?.name ?? c.playerId}:
                            </span>
                            <span className="truncate text-right text-slate-200">{c.clue}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Private Word & Actions (Mobile Player Hand) */}
      {!isTvMode && priv && (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <PrivacyPeekCard
              title={lang === 'zh' ? '你的秘密词卡' : 'Your Secret Word'}
              accentColor="#A855F7"
            >
              <div className="py-3 text-center">
                {privateWordPrimary ? (
                  <>
                    <div className="text-xs text-slate-400">
                      {lang === 'zh'
                        ? '（系统不告知你是平民还是卧底哦）'
                        : '(Is yours the odd word out?)'}
                    </div>
                    <div className="mt-2 text-3xl font-black text-[#F3E09F]">
                      {privateWordPrimary}
                    </div>
                    {privateWordSecondary && (
                      <div className="mt-1 text-xs font-medium text-slate-400">
                        {privateWordSecondary}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-3 py-1 text-xs font-bold text-purple-200">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      {lang === 'zh' ? '你是白板！' : 'You are the Blank Slate!'}
                    </div>
                    <p className="text-xs text-slate-300">
                      {lang === 'zh'
                        ? '你的词卡空白，请仔细听他人描述并伪装融入！'
                        : 'Listen closely to other clues and bluff your way through!'}
                    </p>
                  </div>
                )}
              </div>
            </PrivacyPeekCard>
          </div>

          <div className="gold-border flex flex-col justify-center rounded-2xl bg-[#121724]/95 p-4 lg:col-span-7">
            {pub.phase === 'word_peek' && (
              <div className="text-center">
                {priv.hasPeeked ? (
                  <p className="text-sm font-medium text-emerald-300">
                    {lang === 'zh'
                      ? `✓ 已确认词语，等待全员就绪 (${pub.peekedIds.length}/${room.seats.length})...`
                      : `✓ Ready — waiting (${pub.peekedIds.length}/${room.seats.length})...`}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAction({ type: 'peek_ready' })}
                    className="min-h-[48px] w-full rounded-xl bg-purple-500 py-3 text-sm font-black text-white shadow hover:bg-purple-400"
                  >
                    <Sparkles className="mr-1.5 inline h-4 w-4" />
                    {lang === 'zh' ? '我看清词语了，开始描述' : 'Got My Word · Start'}
                  </button>
                )}
              </div>
            )}

            {pub.phase === 'clue_round' && (
              <div>
                {priv.isMyTurnToClue ? (
                  <div className="space-y-3">
                    <div className="text-sm font-bold text-purple-300">
                      {lang === 'zh'
                        ? '轮到你描述！可口头说完直接点“已口头描述”，或输入关键词按回车提交：'
                        : 'Your turn! Say your clue aloud or type a note and press Enter:'}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={36}
                        value={clueText}
                        onChange={(e) => setClueText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            submitClue();
                          }
                        }}
                        placeholder={
                          lang === 'zh'
                            ? '可选输入关键词（回车直发）...'
                            : 'Optional clue note (Enter to send)...'
                        }
                        className="flex-1 rounded-xl border border-white/15 bg-[#0B0D13] px-3 py-2.5 text-sm text-white focus:border-purple-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={submitClue}
                        className="rounded-xl bg-[#D4AF37] px-4 py-2.5 text-xs font-black text-[#0B0D13] shadow hover:brightness-105"
                      >
                        {clueText.trim()
                          ? lang === 'zh'
                            ? '提交线索'
                            : 'Submit'
                          : lang === 'zh'
                            ? '已口头描述 · 下位'
                            : 'Spoken · Next'}
                      </button>
                    </div>
                  </div>
                ) : !priv.alive ? (
                  <p className="py-3 text-center text-sm text-slate-400">
                    {lang === 'zh'
                      ? `你已出局，正在旁观「${currentSpeakerName}」描述...`
                      : `Eliminated — watching ${currentSpeakerName} give clues...`}
                  </p>
                ) : (
                  <div className="space-y-1 py-3 text-center">
                    <p className="text-sm text-slate-300">
                      {lang === 'zh'
                        ? `等待「${currentSpeakerName}」描述词语...`
                        : `Listening to ${currentSpeakerName}...`}
                    </p>
                    {pub.clueQueue[0] === priv.playerId && (
                      <p className="text-xs font-bold text-amber-300">
                        {lang === 'zh'
                          ? '⚡ 下一位就是你发言，请做好准备！'
                          : '⚡ You are up next — get your clue ready!'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {pub.phase === 'vote_round' && (
              <div>
                {!priv.alive ? (
                  <p className="py-3 text-center text-sm text-slate-400">
                    {lang === 'zh' ? '你已出局，旁观指认结果' : 'Eliminated — spectating'}
                  </p>
                ) : priv.hasVoted ? (
                  <p className="py-3 text-center text-sm font-medium text-emerald-300">
                    {lang === 'zh'
                      ? `✓ 已投票，等待他人 (${pub.votedIds.length}/${pub.aliveIds.length})...`
                      : `✓ Vote cast (${pub.votedIds.length}/${pub.aliveIds.length})...`}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-purple-300">
                      <Vote className="h-4 w-4" />
                      {isPkActive
                        ? lang === 'zh'
                          ? 'PK 复投指认（仅限平票候选人）：'
                          : 'PK Revote (Tied Suspects Only):'
                        : lang === 'zh'
                          ? '投票指认卧底：'
                          : 'Vote Out Suspect:'}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {(pub.pkIds ?? pub.aliveIds)
                        .filter((id) => id !== priv.playerId)
                        .map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => onAction({ type: 'cast_vote', targetId: id })}
                            className="min-h-[44px] rounded-xl border border-purple-400/40 bg-purple-500/20 px-3 py-2 text-xs font-bold text-white hover:bg-purple-500/40"
                          >
                            {seatMap.get(id)?.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {pub.phase === 'elimination_reveal' && (
              <p className="py-3 text-center text-sm text-purple-200">
                {lang === 'zh'
                  ? '假面已揭晓，即将进入下一轮描述...'
                  : 'Identity unmasked — next round starting soon...'}
              </p>
            )}

            {pub.phase === 'game_over' && (
              <p className="py-3 text-center text-sm text-slate-300">
                {lang === 'zh'
                  ? '本局已结束，请在上方查看全场身份与词卡揭秘！'
                  : 'Game over — check the stage above for full role & word reveals!'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
