'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConnectionBar } from '@/components/ui/ConnectionBar';
import type { Connection } from '@/lib/client/useRoom';
import { MAX_TEAMS, MIN_TEAMS } from '@/lib/game/constants';
import type { GameState, Team } from '@/lib/game/types';

interface Props {
  state: GameState;
  me: Team | null;
  connection: Connection;
  error: string | null;
  onStart: () => void;
}

export function LobbyScreen({ state, me, connection, error, onStart }: Props) {
  const [copied, setCopied] = useState(false);
  const isHost = me?.id === state.hostTeamId;
  const enough = state.teams.length >= MIN_TEAMS;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(state.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Pano izni yoksa kod zaten ekranda; sessizce gec.
    }
  }

  return (
    <>
      <ConnectionBar connection={connection} />
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-9 px-5 py-12">
        <div>
          <p className="font-mono text-[9.5px] tracking-[0.2em] text-mute">
            ODA KODU
          </p>
          <button
            type="button"
            onClick={copyCode}
            className="tnum mt-1 block cursor-pointer font-display text-[76px] font-extrabold leading-none tracking-[0.08em] transition-transform duration-200 ease-out-soft active:scale-[0.98] sm:text-[88px]"
          >
            {state.code}
          </button>
          <p
            aria-live="polite"
            className="mt-2 font-mono text-[10px] tracking-[0.14em] text-mute"
          >
            {copied ? 'KOPYALANDI' : 'KODA DOKUNARAK KOPYALA'}
          </p>
        </div>

        <div className="border-y border-line">
          {[...state.teams]
            .sort((a, b) => a.seat - b.seat)
            .map((team) => (
              <div
                key={team.id}
                data-testid="lobby-team"
                className="flex items-center gap-3 border-b border-line-soft px-1 py-3 last:border-b-0"
              >
                <span className="w-4 font-display text-xs font-extrabold text-mute">
                  {team.seat + 1}
                </span>
                <span className="flex-1 text-[15px] font-semibold">{`TAKIM ${team.name}`}</span>
                {team.id === state.hostTeamId && (
                  <span className="font-mono text-[9px] tracking-[0.14em] text-mute">
                    ODA SAHİBİ
                  </span>
                )}
                {team.id === me?.id && (
                  <span className="font-mono text-[9px] tracking-[0.14em] text-mute">
                    SEN
                  </span>
                )}
              </div>
            ))}
        </div>

        <div>
          <p className="font-mono text-[10px] tracking-[0.12em] text-mute">
            {`${state.teams.length} / ${MAX_TEAMS} TAKIM · BÜTÇE ${state.budget} · LİMİT ${state.itemLimit} · ${state.items.length} ÜRÜN`}
          </p>
          {!enough && (
            <p className="mt-2 text-sm text-dim">
              Kodu paylaş, katılmalarını bekle.
            </p>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="font-mono text-[11px] text-accent"
          >
            {error}
          </p>
        )}

        {isHost ? (
          <Button disabled={!enough} onClick={onStart}>
            OYUNU BAŞLAT
          </Button>
        ) : (
          <p className="font-mono text-[10px] tracking-[0.14em] text-mute">
            ODA SAHİBİNİN BAŞLATMASI BEKLENİYOR
          </p>
        )}
      </main>
    </>
  );
}
