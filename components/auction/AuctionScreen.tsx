'use client';

import { minBid as minBidOf } from '@/lib/game';
import type { GameState, Lot, Team } from '@/lib/game/types';
import type { Connection } from '@/lib/client/useRoom';
import { ConnectionBar } from '@/components/ui/ConnectionBar';
import { BidBar } from './BidBar';
import { BidLog } from './BidLog';
import { Countdown } from './Countdown';
import { LotTicket } from './LotTicket';
import { TeamRail } from './TeamRail';

interface Props {
  state: GameState;
  me: Team | null;
  lot: Lot;
  connection: Connection;
  clockOffsetMs: number;
  errorMessage: string | null;
  /** Sonuc koreografisi oynuyorsa faz numarasi; yoksa null. */
  result: React.ReactNode | null;
  onBid: (amount: number) => void;
  onPass: () => void;
  onExpire: () => void;
}

export function AuctionScreen({
  state,
  me,
  lot,
  connection,
  clockOffsetMs,
  errorMessage,
  result,
  onBid,
  onPass,
  onExpire,
}: Props) {
  const item = state.items.find((i) => i.id === lot.itemId);
  const bidder = state.teams.find((t) => t.id === lot.currentBidderTeamId);
  const turnTeam = state.teams.find((t) => t.id === lot.turnTeamId);
  const isMyTurn = !!me && lot.turnTeamId === me.id && !result;

  if (!item) return null;

  return (
    <main className="min-h-[100dvh] bg-[var(--color-bg)]">
      <ConnectionBar connection={connection} />

      <div className="mx-auto max-w-[1400px]">
        <header className="flex items-stretch border-b border-[var(--color-line)]">
          <div className="flex items-center border-r border-[var(--color-line)] px-4 py-3 font-[family-name:var(--font-display)] text-[13px] font-extrabold tracking-[0.06em] text-[var(--color-mute)] md:px-5">
            LOT
            <b className="mx-1.5 text-[22px] text-[var(--color-text)]">
              {String(lot.lotNo).padStart(2, '0')}
            </b>
            {`/${state.items.length}`}
          </div>

          <div className="flex flex-1 items-center justify-center px-4">
            {lot.turnDeadline && !result && (
              <Countdown
                deadline={lot.turnDeadline}
                clockOffsetMs={clockOffsetMs}
                totalSeconds={state.turnSeconds}
                onExpire={onExpire}
              />
            )}
          </div>

          <div className="hidden flex-col justify-center border-l border-[var(--color-line)] px-5 py-3 text-right md:flex">
            <span className="font-[family-name:var(--font-mono)] text-[8.5px] tracking-[0.2em] text-[var(--color-mute)]">
              ODA
            </span>
            <span className="tnum mt-0.5 font-[family-name:var(--font-mono)] text-[15px] font-bold tracking-[0.12em]">
              {state.code}
            </span>
          </div>
        </header>

        <div className="grid md:grid-cols-[1fr_300px]">
          <section className="border-b border-[var(--color-line)] px-4 py-5 md:border-b-0 md:border-r md:px-8 md:py-7">
            {result ?? (
              <>
                <LotTicket
                  lot={lot}
                  item={item}
                  bidderName={bidder ? `TAKIM ${bidder.name}` : null}
                />

                <div className="mt-6">
                  <BidBar
                    minBid={minBidOf(lot)}
                    maxBid={me?.budgetLeft ?? 0}
                    disabled={!isMyTurn}
                    onBid={onBid}
                    onPass={onPass}
                  />

                  {errorMessage && (
                    <p
                      role="alert"
                      className="mt-2 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.1em] text-[var(--color-accent)]"
                    >
                      {errorMessage.toLocaleUpperCase('tr-TR')}
                    </p>
                  )}

                  {!isMyTurn && (
                    <p className="mt-2 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.1em] text-[var(--color-mute)]">
                      {`SIRA: TAKIM ${turnTeam?.name ?? '-'}`}
                    </p>
                  )}
                </div>
              </>
            )}
          </section>

          <aside>
            <TeamRail state={state} lot={lot} meId={me?.id ?? null} withLog={false} />
            <div className="hidden md:block">
              <BidLog lot={lot} teams={state.teams} />
            </div>
          </aside>
        </div>

        <div className="md:hidden">
          <BidLog lot={lot} teams={state.teams} />
        </div>
      </div>
    </main>
  );
}
