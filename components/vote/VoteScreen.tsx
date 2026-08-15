'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { moveItem, wonItems } from '@/components/result/collection';
import type { GameState, Team } from '@/lib/game/types';

interface Props {
  state: GameState;
  me: Team | null;
  error: string | null;
  onVote: (rankedTeamIds: string[]) => void;
}

/**
 * Kazanilan urunler, bilet seridi olarak. Oy verirken karar bu listeye
 * dayaniyor, o yuzden hepsi yazilir; kirpilmis liste yanlis oya yol aciyordu.
 */
function TicketStrip({ names }: { names: string[] }) {
  if (names.length === 0) {
    return (
      <span className="mt-1.5 block font-[family-name:var(--font-mono)] text-[8.5px] tracking-[0.1em] text-[var(--color-mute)]">
        ÜRÜN YOK
      </span>
    );
  }

  return (
    <div className="mt-1.5 flex flex-wrap gap-[3px]">
      {names.map((name, i) => (
        <span
          key={`${name}-${i}`}
          className="rounded-[2px] bg-[var(--color-text)] px-1.5 py-[2px] font-[family-name:var(--font-mono)] text-[8.5px] uppercase tracking-[0.04em] text-[var(--color-bg)]"
        >
          {name}
        </span>
      ))}
    </div>
  );
}

/**
 * Siralama oylamasi. Surukle-birak tek yol degil: her satirin yukari/asagi
 * dugmeleri var, boylece klavye ve dokunmatik de calisir.
 */
export function VoteScreen({ state, me, error, onVote }: Props) {
  const others = useMemo(
    () => state.teams.filter((t) => t.id !== me?.id).sort((a, b) => a.seat - b.seat),
    [state.teams, me?.id],
  );
  const [order, setOrder] = useState<string[]>(() => others.map((t) => t.id));

  const alreadyVoted = state.votes.some((v) => v.voterTeamId === me?.id);
  const points = order.length;

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col gap-7 px-5 py-10">
      <header>
        <p className="font-[family-name:var(--font-mono)] text-[9.5px] tracking-[0.2em] text-[var(--color-mute)]">
          SON AŞAMA
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[38px] font-extrabold uppercase leading-none">
          Sıralama oylaması
        </h1>
        <p className="mt-2 text-sm text-[var(--color-dim)]">
          Diğer takımları en iyiden en kötüye sırala. Kendine oy veremezsin.
        </p>
      </header>

      <ol className="flex flex-col gap-2">
        {order.map((teamId, index) => {
          const team = state.teams.find((t) => t.id === teamId);
          if (!team) return null;

          return (
            <li
              key={teamId}
              data-testid="vote-row"
              className="flex items-center gap-3 rounded-[4px] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5"
            >
              <span className="w-5 font-[family-name:var(--font-display)] text-[20px] font-extrabold text-[var(--color-accent)]">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <span className="text-[13px] font-semibold tracking-[0.04em]">
                  {`TAKIM ${team.name}`}
                </span>
                <TicketStrip names={wonItems(state, team.id).map((w) => w.name)} />
              </div>

              <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--color-mute)]">
                {`${points - index} PUAN`}
              </span>

              {!alreadyVoted && (
                <span className="flex flex-col gap-1">
                  <button
                    type="button"
                    aria-label={`TAKIM ${team.name} yukarı taşı`}
                    disabled={index === 0}
                    onClick={() => setOrder((o) => moveItem(o, index, index - 1))}
                    className="h-6 w-8 cursor-pointer rounded-[2px] border border-[var(--color-line)] text-[11px] text-[var(--color-dim)] disabled:pointer-events-none disabled:opacity-25"
                  >
                    &#9650;
                  </button>
                  <button
                    type="button"
                    aria-label={`TAKIM ${team.name} aşağı taşı`}
                    disabled={index === order.length - 1}
                    onClick={() => setOrder((o) => moveItem(o, index, index + 1))}
                    className="h-6 w-8 cursor-pointer rounded-[2px] border border-[var(--color-line)] text-[11px] text-[var(--color-dim)] disabled:pointer-events-none disabled:opacity-25"
                  >
                    &#9660;
                  </button>
                </span>
              )}
            </li>
          );
        })}

        {me && (
          <li
            data-testid="self-row"
            className="flex items-center gap-3 rounded-[4px] border border-dashed border-[var(--color-line)] px-3 py-2.5 opacity-40"
          >
            <span className="w-5 font-[family-name:var(--font-display)] text-[20px] font-extrabold text-[var(--color-mute)]">
              &ndash;
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-[13px] font-semibold tracking-[0.04em]">
                {`TAKIM ${me.name}`}
              </span>
              <TicketStrip names={wonItems(state, me.id).map((w) => w.name)} />
            </div>
            <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--color-mute)]">
              OY VEREMEZ
            </span>
          </li>
        )}
      </ol>

      <p
        data-testid="vote-progress"
        aria-live="polite"
        className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] text-[var(--color-mute)]"
      >
        {`${state.teams.length} TAKIMDAN ${state.votes.length}'İ OYUNU TAMAMLADI`}
      </p>

      {error && (
        <p
          role="alert"
          className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-accent)]"
        >
          {error}
        </p>
      )}

      {!alreadyVoted && <Button onClick={() => onVote(order)}>SIRALAMAYI ONAYLA</Button>}
    </main>
  );
}
