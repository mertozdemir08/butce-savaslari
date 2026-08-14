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
  /** Sonuc koreografisi oynuyorsa onun icerigi; yoksa null. */
  result: React.ReactNode | null;
  onBid: (amount: number) => void;
  onPass: () => void;
  onExpire: () => void;
}

/**
 * Masaustunde ekranin tamamini kaplar: ust serit sabit, govde kalan
 * yuksekligi doldurur. Bilet buyur, ray dikeyde yayilir.
 */
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
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--color-bg)]">
      <ConnectionBar connection={connection} />

      <div className="mx-auto flex w-full max-w-[1600px] min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-stretch border-b border-[var(--color-line)]">
          <div className="flex items-center border-r border-[var(--color-line)] px-4 py-3 font-[family-name:var(--font-display)] text-[13px] font-extrabold tracking-[0.06em] text-[var(--color-mute)] md:px-6">
            ÜRÜN
            <b className="mx-1.5 text-[26px] text-[var(--color-text)]">
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

          <div className="hidden flex-col justify-center border-l border-[var(--color-line)] px-6 py-3 text-right md:flex">
            <span className="font-[family-name:var(--font-mono)] text-[8.5px] tracking-[0.2em] text-[var(--color-mute)]">
              ODA
            </span>
            <span className="tnum mt-0.5 font-[family-name:var(--font-mono)] text-[16px] font-bold tracking-[0.14em]">
              {state.code}
            </span>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[1fr_340px] md:overflow-hidden">
          <section className="flex min-h-0 flex-col border-b border-[var(--color-line)] px-4 py-5 md:border-b-0 md:border-r md:px-8 md:py-7">
            {result ? (
              <div className="flex min-h-0 flex-1 items-center">{result}</div>
            ) : (
              <>
                <div className="min-h-0 flex-1">
                  <LotTicket
                    lot={lot}
                    item={item}
                    bidderName={bidder ? `TAKIM ${bidder.name}` : null}
                    fill
                  />
                </div>

                <div className="mt-5 shrink-0">
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

          <aside className="min-h-0 md:overflow-hidden">
            <div className="hidden h-full md:block">
              <TeamRail state={state} lot={lot} meId={me?.id ?? null} fill />
            </div>
            <div className="md:hidden">
              <TeamRail state={state} lot={lot} meId={me?.id ?? null} withLog={false} />
              <BidLog lot={lot} teams={state.teams} />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
