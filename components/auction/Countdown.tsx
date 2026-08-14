'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  /** ISO metni. Sunucunun belirledigi son teslim ani. */
  deadline: string;
  /** sunucuSaati - tarayiciSaati. */
  clockOffsetMs: number;
  totalSeconds: number;
  onExpire: () => void;
}

function remainingMs(deadline: string, offset: number): number {
  return new Date(deadline).getTime() - (Date.now() + offset);
}

/**
 * Geri sayim. Sayac sunucuda otoriterdir; burasi yalnizca gosterir
 * ve sure dolunca bir kez haber verir.
 */
export function Countdown({ deadline, clockOffsetMs, totalSeconds, onExpire }: Props) {
  const [left, setLeft] = useState(() => Math.max(0, remainingMs(deadline, clockOffsetMs)));
  const fired = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    fired.current = false;
    setLeft(Math.max(0, remainingMs(deadline, clockOffsetMs)));

    const id = setInterval(() => {
      const ms = Math.max(0, remainingMs(deadline, clockOffsetMs));
      setLeft(ms);
      if (ms === 0 && !fired.current) {
        fired.current = true;
        onExpireRef.current();
      }
    }, 250);

    return () => clearInterval(id);
  }, [deadline, clockOffsetMs]);

  const seconds = Math.ceil(left / 1000);
  const urgent = seconds <= 5 && seconds > 0;
  const pct = Math.max(0, Math.min(100, (left / (totalSeconds * 1000)) * 100));

  return (
    <div className="flex w-full max-w-[220px] flex-col items-center gap-1">
      <span
        data-testid="countdown"
        data-urgent={urgent ? 'true' : 'false'}
        aria-label={`Kalan süre ${seconds} saniye`}
        className={[
          'tnum font-[family-name:var(--font-display)] text-[44px] font-extrabold leading-none',
          'text-[var(--color-accent)]',
          urgent ? 'motion-safe:animate-pulse' : '',
        ].join(' ')}
      >
        {`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}
      </span>

      <span aria-hidden className="block h-[3px] w-full bg-[var(--color-line)]">
        <span
          data-testid="countdown-bar"
          className="block h-full bg-[var(--color-accent)] transition-transform duration-200 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </span>
    </div>
  );
}
