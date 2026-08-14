'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Stepper';

interface Props {
  minBid: number;
  /** Takimin kalan butcesi. */
  maxBid: number;
  disabled: boolean;
  onBid: (amount: number) => void;
  onPass: () => void;
}

/** Masaustunde asil giris klavyedir; dokunmatikte adimlayici ve dugmeler. */
export function BidBar({ minBid, maxBid, disabled, onBid, onPass }: Props) {
  const canBid = maxBid >= minBid;
  const [value, setValue] = useState(minBid);

  // Asgari teklif degistiginde deger yeniden asgariye cekilir.
  useEffect(() => setValue(minBid), [minBid]);

  useEffect(() => {
    if (disabled) return;

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (e.key === 'ArrowUp' && canBid) {
        e.preventDefault();
        setValue((v) => Math.min(maxBid, v + 1));
      } else if (e.key === 'ArrowDown' && canBid) {
        e.preventDefault();
        setValue((v) => Math.max(minBid, v - 1));
      } else if (e.key === 'Enter' && canBid) {
        e.preventDefault();
        onBid(value);
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        onPass();
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled, canBid, value, minBid, maxBid, onBid, onPass]);

  return (
    <div>
      <div className="flex flex-wrap items-stretch gap-2">
        <Stepper
          value={canBid ? value : minBid}
          min={minBid}
          max={canBid ? maxBid : minBid}
          onChange={setValue}
          disabled={disabled || !canBid}
        />
        <div className="flex flex-1 gap-2">
          <Button
            variant="ghost"
            className="flex-1 md:flex-none"
            disabled={disabled}
            onClick={onPass}
          >
            PAS
          </Button>
          <Button
            className="flex-1 md:flex-none"
            disabled={disabled || !canBid}
            onClick={() => onBid(value)}
          >
            TEKLİF VER
          </Button>
        </div>
      </div>

      <p
        data-testid="bid-hint"
        className="mt-3 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.1em] text-[var(--color-mute)]"
      >
        {canBid ? `EN AZ ${minBid} · BÜTÇEN ${maxBid}` : `BÜTÇEN YETMİYOR · EN AZ ${minBid} GEREKLİ`}
        <span className="hidden md:inline"> · KLAVYE: ↑↓ AYARLA, ENTER TEKLİF, P PAS</span>
      </p>
    </div>
  );
}
