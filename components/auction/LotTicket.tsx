'use client';

import type { Item, Lot } from '@/lib/game/types';

interface Props {
  lot: Lot;
  item: Item;
  /** Mevcut teklifin sahibi takimin adi; teklif yoksa null. */
  bidderName: string | null;
  /** Lot kapandiginda basilan damga. */
  stamp?: { text: string } | null;
  /** true ise bilet kalan dikey alani doldurur (masaustu acik artirma ekrani). */
  fill?: boolean;
}

/**
 * Biletin perfore kenar deligi. Zemin rengiyle ayni oldugu icin kagidi
 * delmis gibi durur; nesnenin parcasi, ayri bir sus degil.
 */
function Notch({ side }: { side: 'left' | 'right' }) {
  return (
    <span
      aria-hidden
      className={[
        'absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[var(--color-bg)]',
        side === 'left' ? '-left-2' : '-right-2',
      ].join(' ')}
    />
  );
}

/** Oyunun imza ogesi: numarali, perfore, satilinca damgalanan lot bileti. */
export function LotTicket({ lot, item, bidderName, stamp = null, fill = false }: Props) {
  const lotNo = String(lot.lotNo).padStart(2, '0');

  return (
    <div
      className={[
        'relative rounded-[4px] border border-[var(--color-line)] bg-[var(--color-surface)] p-[18px]',
        fill ? 'flex h-full min-h-0 flex-col' : '',
      ].join(' ')}
    >
      <Notch side="left" />
      <Notch side="right" />

      <div className={['flex flex-col gap-5 md:flex-row', fill ? 'min-h-0 flex-1' : ''].join(' ')}>
        <div
          className={[
            'relative w-full shrink-0 overflow-hidden rounded-[3px] bg-[#1d1d1d]',
            fill ? 'h-[160px] md:h-auto md:w-[42%]' : 'h-[150px] md:w-[190px]',
          ].join(' ')}
        >
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            // Gorsel yoksa bosluk degil, lot numarasi oturur: duzen bozulmaz.
            <span
              data-testid="image-fallback"
              aria-hidden
              className={[
                'absolute inset-0 flex items-center justify-center',
                'font-[family-name:var(--font-display)] font-extrabold text-[var(--color-line)]',
                fill ? 'text-[120px]' : 'text-[54px]',
              ].join(' ')}
            >
              {lotNo}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.2em] text-[var(--color-mute)]">
            {`LOT NO. ${lotNo}`}
          </span>

          <h2
            className={[
              'mt-1.5 break-words font-[family-name:var(--font-display)] font-extrabold uppercase leading-[0.88]',
              fill ? 'text-[46px] md:text-[76px] lg:text-[92px]' : 'text-[42px] md:text-[58px]',
            ].join(' ')}
          >
            {item.name}
          </h2>

          <div
            aria-hidden
            className="my-3.5 border-t-[1.5px] border-dashed border-[var(--color-line)]"
          />

          <div className="mt-auto flex items-end gap-6">
            <div>
              <span className="block font-[family-name:var(--font-mono)] text-[9px] tracking-[0.15em] text-[var(--color-mute)]">
                MEVCUT TEKLİF
              </span>
              <span
                data-testid="current-bid"
                className={[
                  'tnum mt-0.5 block font-[family-name:var(--font-display)] font-extrabold leading-none text-[var(--color-accent)]',
                  fill ? 'text-[56px] md:text-[72px]' : 'text-[42px]',
                ].join(' ')}
              >
                {lot.currentBid ?? '-'}
              </span>
            </div>
            {bidderName && (
              <span className="pb-1.5 font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-mute)]">
                {bidderName}
              </span>
            )}
          </div>
        </div>
      </div>

      {stamp && (
        <div
          data-testid="stamp"
          role="status"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="-rotate-[4deg] border-[3px] border-[var(--color-accent)] bg-[var(--color-bg)]/85 px-5 py-2 font-[family-name:var(--font-display)] text-[26px] font-extrabold uppercase tracking-[0.06em] text-[var(--color-accent)] md:text-[34px]">
            {stamp.text}
          </span>
        </div>
      )}
    </div>
  );
}
