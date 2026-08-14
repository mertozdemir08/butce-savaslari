'use client';

import { useEffect, useState } from 'react';
import { RESULT_MS } from '@/lib/game/constants';
import type { Item, Lot, Team } from '@/lib/game/types';
import { LotTicket } from './LotTicket';

/**
 * Koreografi adimlarinin baslangic anlari (ms), spec'teki sirayla:
 * 0 kilit, 1 damga, 2 kazananin anilmasi, 3 devir.
 */
export const PHASE_AT = [0, 120, 500, 800] as const;

export function stampText(lot: Lot, winner: Team): string {
  return lot.finalPrice === 0
    ? `BEDELSİZ · TAKIM ${winner.name}`
    : `SATILDI · TAKIM ${winner.name} · ${lot.finalPrice}`;
}

/**
 * resultUntil'a bakarak hangi fazda oldugumuzu soyler.
 * Sekme arkada kalip zamanlayicilar gecikirse dogrudan son faza atlanir.
 */
export function useResultPhase(resultUntil: string | null, clockOffsetMs: number): number {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!resultUntil) {
      setPhase(0);
      return;
    }

    const closedAt = new Date(resultUntil).getTime() - RESULT_MS;
    const timers: ReturnType<typeof setTimeout>[] = [];

    PHASE_AT.forEach((at, index) => {
      const delay = closedAt + at - (Date.now() + clockOffsetMs);
      if (delay <= 0) {
        setPhase((p) => Math.max(p, index));
      } else {
        timers.push(setTimeout(() => setPhase((p) => Math.max(p, index)), delay));
      }
    });

    return () => timers.forEach(clearTimeout);
  }, [resultUntil, clockOffsetMs]);

  return phase;
}

interface Props {
  lot: Lot;
  item: Item;
  winner: Team;
  phase: number;
}

/**
 * Turun tek koreografi ani. Yalnizca transform ve opacity animasyonlanir;
 * prefers-reduced-motion altinda gecisler duser, sure korunur ki
 * herkes sonucu okuyabilsin.
 */
export function LotResult({ lot, item, winner, phase }: Props) {
  return (
    <div>
      {/* Bilet sonuna kadar okunabilir kalir. Once kaybolduruyorduk; sekme
          arkadaysa ya da faz gec baglanirsa hangi urunun satildigi
          anlasilmiyordu. Simdi yalnizca hafifce geri cekilir. */}
      <div
        data-testid="result-ticket"
        data-phase={String(phase)}
        className={[
          'origin-center transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
          phase >= 1 && phase < 3 ? 'motion-safe:scale-[1.02]' : '',
          phase >= 3 ? 'motion-safe:scale-[0.97]' : '',
        ].join(' ')}
      >
        <LotTicket
          lot={lot}
          item={item}
          bidderName={`TAKIM ${winner.name}`}
          stamp={phase >= 1 ? { text: stampText(lot, winner) } : null}
        />
      </div>

      {phase >= 2 && (
        <p
          data-testid="winner-callout"
          role="status"
          className="mt-5 font-[family-name:var(--font-display)] text-[28px] font-extrabold uppercase leading-none motion-safe:animate-[fadeUp_300ms_cubic-bezier(0.16,1,0.3,1)]"
        >
          {`TAKIM ${winner.name} aldı`}
        </p>
      )}
    </div>
  );
}
