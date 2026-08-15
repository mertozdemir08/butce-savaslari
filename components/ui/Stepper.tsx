'use client';

interface Props {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}

const arrow =
  'flex min-h-[44px] w-[52px] cursor-pointer items-center justify-center bg-surface ' +
  'font-display text-2xl font-extrabold text-dim ' +
  'transition-transform duration-200 ease-out-soft active:scale-[0.96] ' +
  'disabled:pointer-events-none disabled:opacity-30';

/**
 * Dusuk butcelerde (varsayilan 10) sayi klavyesi yanlis arac:
 * bir adim yukari/asagi ve "en yuksek" yeterli.
 */
export function Stepper({ value, min, max, onChange, disabled = false }: Props) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <div className="flex items-stretch gap-2">
      <div className="flex items-stretch overflow-hidden rounded-card border border-line">
        <button
          type="button"
          aria-label="Bir azalt"
          className={arrow}
          disabled={disabled || value <= min}
          onClick={() => onChange(clamp(value - 1))}
        >
          &minus;
        </button>

        <div
          data-testid="stepper-value"
          aria-live="polite"
          className="tnum flex w-24 items-center justify-center border-x border-line font-display text-[40px] font-extrabold leading-none"
        >
          {value}
        </div>

        <button
          type="button"
          aria-label="Bir arttır"
          className={arrow}
          disabled={disabled || value >= max}
          onClick={() => onChange(clamp(value + 1))}
        >
          +
        </button>
      </div>

      <button
        type="button"
        aria-label={`En yüksek teklif: ${max}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(max)}
        className="flex min-h-[44px] cursor-pointer items-center rounded-card border border-line bg-surface px-4 font-mono text-[10px] tracking-[0.14em] text-dim disabled:pointer-events-none disabled:opacity-30"
      >
        MAKS {max}
      </button>
    </div>
  );
}
