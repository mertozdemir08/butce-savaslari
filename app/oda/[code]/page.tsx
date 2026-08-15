'use client';

import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect } from 'react';
import { AuctionScreen } from '@/components/auction/AuctionScreen';
import { LotResult, useResultPhase } from '@/components/auction/LotResult';
import { LobbyScreen } from '@/components/lobby/LobbyScreen';
import { ResultScreen } from '@/components/result/ResultScreen';
import { VoteScreen } from '@/components/vote/VoteScreen';
import { useRoom } from '@/lib/client/useRoom';
import { currentLot } from '@/lib/game';

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 text-center">
      <div>
        <h1 className="font-display text-3xl font-extrabold uppercase">
          {title}
        </h1>
        <p className="mt-2 text-sm text-dim">{body}</p>
      </div>
    </main>
  );
}

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const upper = code.toLocaleUpperCase('tr-TR');
  const router = useRouter();

  const { state, me, connection, clockOffsetMs, notFound, hasSession, error, call } =
    useRoom(upper);

  const lot = state ? currentLot(state) : null;
  // Bedelsiz devralinan lot da sonuc koreografisini oynar.
  const showingResult =
    !!state?.resultUntil && (lot?.status === 'sold' || lot?.status === 'granted');
  const resultPhase = useResultPhase(showingResult ? state!.resultUntil : null, clockOffsetMs);

  // Sonuc koreografisi bitince siradaki lotu ac. Odadaki herkes gonderir;
  // motor idempotent oldugu icin cakisma sorun degil.
  useEffect(() => {
    if (!state?.resultUntil) return;
    const wait = new Date(state.resultUntil).getTime() - (Date.now() + clockOffsetMs);
    const id = setTimeout(() => call({ t: 'advance' }), Math.max(0, wait) + 150);
    return () => clearTimeout(id);
  }, [state?.resultUntil, clockOffsetMs, call]);

  const onBid = useCallback(
    (amount: number) => {
      if (lot) call({ t: 'bid', amount, turnSeq: lot.turnSeq });
    },
    [call, lot],
  );

  const onPass = useCallback(() => {
    if (lot) call({ t: 'pass', turnSeq: lot.turnSeq });
  }, [call, lot]);

  const onExpire = useCallback(() => {
    if (lot) call({ t: 'timeout', lotId: lot.id, turnSeq: lot.turnSeq });
  }, [call, lot]);

  if (!hasSession) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <div>
          <h1 className="font-display text-3xl font-extrabold uppercase">
            Bu odaya katılmadın
          </h1>
          <p className="mt-2 text-sm text-dim">
            Ana sayfadan oda kodunu girerek katılabilirsin.
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="mt-5 cursor-pointer font-mono text-[11px] tracking-[0.14em] underline"
          >
            ANA SAYFA
          </button>
        </div>
      </main>
    );
  }

  if (notFound) {
    return <Notice title="Oda bulunamadı" body="Oda kapanmış olabilir. Yeni bir oda kurun." />;
  }

  if (!state) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <p className="font-mono text-[11px] tracking-[0.2em] text-mute">
          YÜKLENİYOR
        </p>
      </main>
    );
  }

  if (state.status === 'lobby') {
    return (
      <LobbyScreen
        state={state}
        me={me}
        connection={connection}
        error={error}
        onStart={() => call({ t: 'start' })}
      />
    );
  }

  if (lot && (state.status === 'auction' || showingResult)) {
    const item = state.items.find((i) => i.id === lot.itemId);
    const winner = state.teams.find((t) => t.id === lot.winnerTeamId);

    return (
      <AuctionScreen
        state={state}
        me={me}
        lot={lot}
        connection={connection}
        clockOffsetMs={clockOffsetMs}
        errorMessage={error}
        result={
          showingResult && item && winner ? (
            <LotResult lot={lot} item={item} winner={winner} phase={resultPhase} fill />
          ) : null
        }
        onBid={onBid}
        onPass={onPass}
        onExpire={onExpire}
      />
    );
  }

  if (state.status === 'voting') {
    return (
      <VoteScreen
        state={state}
        me={me}
        error={error}
        onVote={(rankedTeamIds) => call({ t: 'vote', rankedTeamIds })}
      />
    );
  }

  return <ResultScreen state={state} me={me} />;
}
