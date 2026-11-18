import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

export const CountdownPill: React.FC<{
  deadline?: number;
  paused?: boolean;
}> = ({ deadline, paused }) => {
  const [secsLeft, setSecsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) {
      setSecsLeft(null);
      return;
    }
    const update = () => {
      setSecsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    };
    update();
    if (paused) return;
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [deadline, paused]);

  if (secsLeft === null) return null;

  const urgent = secsLeft <= 5;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tabular-nums transition-colors ${
        paused
          ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
          : urgent
            ? 'animate-pulse border-rose-500/70 bg-rose-500/20 text-rose-200'
            : 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#F3E09F]'
      }`}
    >
      <Clock className="h-3.5 w-3.5" />
      {secsLeft}s
    </span>
  );
};
