'use client';

import { useEffect, useState } from 'react';
import { ORACLE_INTERVAL_MS } from '@/lib/constants';

interface CountdownTimerProps {
  lastUpdateTimestamp?: number; // unix seconds from oracle API
}

export function CountdownTimer({ lastUpdateTimestamp }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState<number>(ORACLE_INTERVAL_MS);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const computeRemaining = () => {
      if (!lastUpdateTimestamp) return ORACLE_INTERVAL_MS;
      const nextUpdate = (lastUpdateTimestamp * 1000) + ORACLE_INTERVAL_MS;
      const diff = nextUpdate - Date.now();
      return Math.max(0, diff);
    };

    const tick = () => {
      const r = computeRemaining();
      setRemaining(r);
      if (r <= 0) {
        setIsUpdating(true);
        setTimeout(() => setIsUpdating(false), 5000);
      } else {
        setIsUpdating(false);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUpdateTimestamp]);

  const totalMs = ORACLE_INTERVAL_MS;
  const progressPct = Math.max(0, Math.min(100, 100 - (remaining / totalMs) * 100));

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const label = isUpdating
    ? 'Updating...'
    : `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2">
      {/* Ring */}
      <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="8" stroke="#222225" strokeWidth="2" />
        <circle
          cx="10"
          cy="10"
          r="8"
          stroke={isUpdating ? '#00FF88' : '#FFB800'}
          strokeWidth="2"
          strokeDasharray={`${2 * Math.PI * 8}`}
          strokeDashoffset={`${2 * Math.PI * 8 * (1 - progressPct / 100)}`}
          strokeLinecap="round"
          transform="rotate(-90 10 10)"
          className="transition-all duration-1000"
        />
      </svg>
      <span className={`text-[11px] font-[family-name:var(--font-mono)] ${isUpdating ? 'text-[#00FF88]' : 'text-[#55555E]'}`}>
        {isUpdating ? 'Updating...' : `Next update ${label}`}
      </span>
    </div>
  );
}
