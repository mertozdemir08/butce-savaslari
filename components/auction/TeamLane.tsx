'use client';

import type { Team } from '@/lib/game/types';
import type { LaneStatus } from './laneStatus';

interface Props {
  team: Team;
  itemLimit: number;
  isMe: boolean;
  isTurn: boolean;
  isOut: boolean;
  status: LaneStatus;
}

/** Urun limiti gostergesi: limit kadar kutucuk, dolular kazanilan urunler. */
function Pips({ won, limit, onLight }: { won: number; limit: number; onLight: boolean }) {
  return (
    <div
      data-testid="lane-pips"
      aria-label={`${won} / ${limit} ürün`}
      className="mt-1.5 flex gap-[3px]"
    >
      {Array.from({ length: limit }, (_, i) => (
        <span
          key={i}
          aria-hidden
          data-filled={i < won ? 'true' : 'false'}
          className={[
            'h-[9px] w-[9px] rounded-[1px] border',
            i < won
              ? onLight
                ? 'border-[var(--color-bg)] bg-[var(--color-bg)]'
                : 'border-[#5a5a5a] bg-[#5a5a5a]'
              : onLight
                ? 'border-[var(--color-bg)]/30'
                : 'border-[#3a3a3a]',
          ].join(' ')}
        />
      ))}
    </div>
  );
}

/**
 * Bir takimin seridi. Sirasi gelen serit beyaza doner: beyaz
 * "simdi sen oyna" demektir, kirmizi yalnizca baskiyi anlatir.
 */
export function TeamLane({ team, itemLimit, isMe, isTurn, isOut, status }: Props) {
  return (
    <div
      data-testid="lane"
      data-me={isMe ? 'true' : 'false'}
      data-turn={isTurn ? 'true' : 'false'}
      data-out={isOut ? 'true' : 'false'}
      className={[
        'flex items-center gap-3 border-b border-[var(--color-line-soft)] px-4 py-3',
        'transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
        isTurn ? 'bg-[var(--color-text)] text-[var(--color-bg)]' : '',
        isOut ? 'opacity-30' : '',
      ].join(' ')}
    >
      <span className="w-3 font-[family-name:var(--font-display)] text-xs font-extrabold opacity-60">
        {team.seat + 1}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className={[
              'truncate text-[13px] font-semibold tracking-[0.04em]',
              isOut ? 'line-through' : '',
            ].join(' ')}
          >
            {`TAKIM ${team.name}`}
          </span>
          {isMe && (
            <span className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.14em] opacity-60">
              SEN
            </span>
          )}
        </div>

        <div className="mt-0.5 font-[family-name:var(--font-mono)] text-[9.5px] tracking-[0.1em] opacity-70">
          {team.connected ? status.label : 'BAĞLANTI YOK'}
        </div>

        <Pips won={team.itemsWon} limit={itemLimit} onLight={isTurn} />
      </div>

      <div className="text-right">
        <span
          data-testid="lane-budget"
          className="tnum block font-[family-name:var(--font-display)] text-[22px] font-extrabold leading-none"
        >
          {team.budgetLeft}
        </span>
        <span className="mt-0.5 block font-[family-name:var(--font-mono)] text-[8.5px] tracking-[0.12em] opacity-60">
          BÜTÇE
        </span>
      </div>
    </div>
  );
}
