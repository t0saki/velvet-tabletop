import React from 'react';
import { BookOpen, Users, Clock, X } from 'lucide-react';
import type { GameCatalogEntry } from '../../shared/catalog.js';
import { useI18n } from '../i18n/useI18n.js';

export const QuickRulesModal: React.FC<{
  game: GameCatalogEntry;
  open: boolean;
  onClose: () => void;
}> = ({ game, open, onClose }) => {
  const { lang, pick, t } = useI18n();
  if (!open) return null;

  const bullets = lang === 'zh' ? game.quickRules.zh : game.quickRules.en;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#D4AF37]/40 bg-[#121724] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-40 w-full overflow-hidden">
          <img
            src={game.coverImage}
            alt={pick(game.title)}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121724] via-[#121724]/50 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="absolute right-4 bottom-3 left-4">
            <div className="text-xs font-bold tracking-wider text-[#F3E09F] uppercase">
              {pick(game.classicTag)}
            </div>
            <h3 className="text-xl font-extrabold text-white">{pick(game.title)}</h3>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-center gap-4 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">
              <Users className="h-3.5 w-3.5 text-[#D4AF37]" />
              {game.minPlayers}–{game.maxPlayers} {lang === 'zh' ? '人' : 'Players'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">
              <Clock className="h-3.5 w-3.5 text-[#D4AF37]" />
              {game.durationMins}
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-bold text-[#F3E09F]">
              <BookOpen className="h-4 w-4" />
              {t('quickRules')}
            </div>
            <ol className="space-y-2">
              {bullets.map((line, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 rounded-xl border border-white/5 bg-white/5 px-3 py-2.5 text-sm text-slate-200"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/20 text-xs font-bold text-[#F3E09F]">
                    {i + 1}
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[#D4AF37] py-2.5 text-sm font-bold text-[#0B0D13] hover:bg-[#E5C14A]"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};
