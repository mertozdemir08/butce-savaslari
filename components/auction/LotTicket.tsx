'use client';

import type { Item, Lot } from '@/lib/game/types';

interface Props {
  lot: Lot;
  item: Item;
  /** Mevcut teklifin sahibi takimin adi; teklif yoksa null. */
  bidderName: string | null;
  /** Lot kapandiginda basilan damga. */
  stamp?: { text: string } | null;
  /**
   * true ise bilet masaustunde kalan dikey alani doldurur. Telefonda dolgu
   * yok: orada govde kayar, sabit yukseklik verilirse bilet kendi icerigine
   * sigmayip altindaki teklif cubugunun uzerine tasiyordu.
   */
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

/**
 * Oyunun imza ogesi: numarali, perfore, satilinca damgalanan urun bileti.
 *
 * Dikey uc bant: gorsel, urun adi, mevcut teklif. Gorsel kalan alani
 * doldurur; boylece bilet ne kadar yer bulursa o kadar buyur.
 */
export function LotTicket({ lot, item, bidderName, stamp = null, fill = false }: Props) {
  const lotNo = String(lot.lotNo).padStart(2, '0');

  return (
    <div
      className={[
        'relative flex flex-col rounded-[4px] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 md:p-[18px]',
        fill ? 'md:h-full md:min-h-0' : '',
      ].join(' ')}
    >
      <Notch side="left" />
      <Notch side="right" />

      <span className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.2em] text-[var(--color-mute)]">
        {`ÜRÜN ${lotNo}`}
      </span>

      {/* 1. bant: gorsel, kalan alani doldurur */}
      <div
        className={[
          'relative mt-2 flex w-full shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-[#1d1d1d]',
          fill ? 'h-[30vh] min-h-[140px] md:h-auto md:min-h-[120px] md:flex-1' : 'h-[150px]',
        ].join(' ')}
      >
        {item.imageUrl ? (
          // Kaynak gorseller 300x171..300x265; net kopya en fazla 2x buyur,
          // otesinde bulaniklasiyor. Kalan yeri ayni gorselin bulanik ve
          // koyultulmus kopyasi doldurur: bant bos kalmaz, bulaniklik zemin
          // gibi okunur. Buyutme blur kenarinin gorunmesini engeller.
          <>
            <img
              aria-hidden
              src={item.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-[0.45]"
            />
            <img
              src={item.imageUrl}
              alt={item.name}
              className="relative h-full max-h-[342px] w-full max-w-[600px] object-cover"
            />
          </>
        ) : (
          // Gorsel yoksa bosluk degil, urun numarasi oturur: duzen bozulmaz.
          <span
            data-testid="image-fallback"
            aria-hidden
            className={[
              'absolute inset-0 flex items-center justify-center',
              'font-[family-name:var(--font-display)] font-extrabold text-[var(--color-line)]',
              fill ? 'text-[16vh] md:text-[26vh]' : 'text-[54px]',
            ].join(' ')}
          >
            {lotNo}
          </span>
        )}
      </div>

      {/* 2. bant: urun adi */}
      <h2
        className={[
          'mt-3 shrink-0 break-words text-center font-[family-name:var(--font-display)] font-extrabold uppercase leading-[0.9]',
          fill ? 'text-[40px] md:text-[clamp(2.5rem,6.5vh,5.5rem)]' : 'text-[42px] md:text-[52px]',
        ].join(' ')}
      >
        {item.name}
      </h2>

      <div
        aria-hidden
        className="my-3 shrink-0 border-t-[1.5px] border-dashed border-[var(--color-line)]"
      />

      {/* 3. bant: mevcut teklif ve sahibi. Dikey yigin, hepsi ortada:
          yan yana dizilince teklif sahibinin genisligi rakami yana kaydiriyordu. */}
      <div className="flex shrink-0 flex-col items-center text-center">
        <span className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.15em] text-[var(--color-mute)]">
          MEVCUT TEKLİF
        </span>
        <span
          data-testid="current-bid"
          className={[
            'tnum mt-0.5 block font-[family-name:var(--font-display)] font-extrabold leading-none text-[var(--color-accent)]',
            fill ? 'text-[44px] md:text-[clamp(2.5rem,5vh,4rem)]' : 'text-[42px]',
          ].join(' ')}
        >
          {lot.currentBid ?? '-'}
        </span>
        {bidderName && (
          <span className="mt-1 font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-mute)]">
            {bidderName}
          </span>
        )}
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
