import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';
import { soundEngine } from '../audio/soundEngine.js';

interface PrivacyPeekCardProps {
  title: string;
  subtitle?: string;
  accentColor?: string;
  children: React.ReactNode;
}

/**
 * 3D Tactile Hold-to-Peek card: prevents neighboring players at a party table
 * from glancing at secret roles, hole cards, or Undercover words.
 */
export const PrivacyPeekCard: React.FC<PrivacyPeekCardProps> = ({
  title,
  subtitle,
  accentColor = '#D4AF37',
  children,
}) => {
  const { t } = useI18n();
  const [holding, setHolding] = useState(false);
  const [lockedOpen, setLockedOpen] = useState(false);
  const revealed = holding || lockedOpen;

  const startHold = () => {
    if (!holding) soundEngine.playSfx('cardFlip');
    setHolding(true);
  };
  const endHold = () => setHolding(false);

  return (
    <div className="w-full space-y-2">
      <div
        role="button"
        tabIndex={0}
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') startHold();
        }}
        onKeyUp={(e) => {
          if (e.key === ' ' || e.key === 'Enter') endHold();
        }}
        className="perspective-1000 relative w-full cursor-pointer select-none touch-none"
      >
        <div
          className={`preserve-3d grid w-full transition-transform duration-300 ${
            revealed ? 'rotate-y-180' : ''
          }`}
        >
          {/* Front Cover (Locked Shield) */}
          <div
            className={`backface-hidden col-start-1 row-start-1 flex min-h-[176px] flex-col items-center justify-center rounded-2xl border bg-[#141824]/95 p-5 text-center shadow-xl ${
              revealed ? 'pointer-events-none' : ''
            }`}
            style={{ borderColor: `${accentColor}66` }}
          >
            <div
              className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-full border bg-black/40"
              style={{ borderColor: accentColor, color: accentColor }}
            >
              <Lock className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-[#F5F2EB]">{t('holdToPeek')}</p>
            <p className="mt-1 text-xs text-slate-400">{subtitle || t('releaseToHide')}</p>
          </div>

          {/* Back Side (Revealed Secret Content) */}
          <div
            className="backface-hidden rotate-y-180 col-start-1 row-start-1 flex min-h-[176px] flex-col justify-between rounded-2xl border bg-gradient-to-br from-[#191F30] to-[#0E111A] p-4 shadow-2xl"
            style={{ borderColor: accentColor }}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-bold tracking-wider uppercase" style={{ color: accentColor }}>
                {title}
              </span>
              <Eye className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="my-auto py-2">{children}</div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            soundEngine.playSfx('cardFlip');
            setLockedOpen((v) => !v);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/10"
        >
          {lockedOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {t('quickTogglePeek')}
        </button>
      </div>
    </div>
  );
};
