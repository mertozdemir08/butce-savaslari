'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { clearSession } from '@/lib/client/session';
import { tally } from '@/lib/game/scoring';
import type { GameState, Team } from '@/lib/game/types';
import { wonItems } from './collection';

/**
 * Sonuc ekrani. 3+ takimda oylama sonucu ve kazanan; 2 takimda
 * kazanan ilan edilmez, iki koleksiyon yan yana sergilenir.
 */
export function ResultScreen({ state, me }: { state: GameState; me: Team | null }) {
  const router = useRouter();
  const standings = tally(state);
  const showWinner = state.teams.length >= 3 && state.votes.length > 0;
  const winner = showWinner ? state.teams.find((t) => t.id === standings[0].teamId) : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-5 py-10">
      <header>
        <p className="font-mono text-[9.5px] tracking-[0.2em] text-mute">
          SONUÇ
        </p>
        {winner ? (
          <h1
            data-testid="winner"
            className="mt-1 font-display text-[48px] font-extrabold uppercase leading-none sm:text-[52px]"
          >
            {`TAKIM ${winner.name} kazandı`}
          </h1>
        ) : (
          <h1 className="mt-1 font-display text-[44px] font-extrabold uppercase leading-none">
            Koleksiyonlar
          </h1>
        )}
      </header>

      <div className="flex flex-col gap-3">
        {standings.map((row) => {
          const team = state.teams.find((t) => t.id === row.teamId);
          if (!team) return null;
          const won = wonItems(state, team.id);

          return (
            <section
              data-testid="standing-row"
              key={row.teamId}
              className="rounded-card border border-line bg-surface p-4"
            >
              <div className="flex flex-wrap items-baseline gap-3">
                {showWinner && (
                  <span className="font-display text-[26px] font-extrabold leading-none text-accent">
                    {row.rank}
                  </span>
                )}
                <span className="flex-1 text-[15px] font-semibold tracking-[0.04em]">
                  {`TAKIM ${team.name}`}
                  {team.id === me?.id && (
                    <span className="ml-2 font-mono text-[9px] tracking-[0.14em] text-mute">
                      SEN
                    </span>
                  )}
                </span>
                {showWinner && (
                  <span className="tnum font-mono text-[11px] text-dim">
                    {`${row.points} PUAN`}
                  </span>
                )}
                <span className="tnum font-mono text-[11px] text-mute">
                  {`KALAN ${row.budgetLeft}`}
                </span>
              </div>

              {won.length === 0 ? (
                <p className="mt-3 font-mono text-[10px] tracking-[0.12em] text-mute">
                  ÜRÜN YOK
                </p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {won.map((w, i) => (
                    <li
                      key={`${w.name}-${i}`}
                      className="flex items-baseline gap-2 rounded-[2px] bg-text px-2 py-1 text-bg"
                    >
                      <span className="text-[12px] font-semibold">{w.name}</span>
                      <span className="tnum font-mono text-[9.5px] opacity-70">
                        {w.price}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {!showWinner && state.teams.length === 2 && (
        <p data-testid="showcase-note" className="text-sm text-dim">
          İki koleksiyon karşınızda. Karar sizin.
        </p>
      )}

      <div className="mt-auto flex flex-col gap-3 border-t border-line pt-6 sm:flex-row">
        <Button
          className="sm:flex-1"
          onClick={() => {
            clearSession(state.code);
            router.push('/kur');
          }}
        >
          YENİ OYUN KUR
        </Button>
        <Button
          variant="ghost"
          className="sm:flex-1"
          onClick={() => {
            clearSession(state.code);
            router.push('/');
          }}
        >
          ANA SAYFA
        </Button>
      </div>
    </main>
  );
}
