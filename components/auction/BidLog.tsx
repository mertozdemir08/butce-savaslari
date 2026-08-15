'use client';

import type { Lot, Team } from '@/lib/game/types';

const KIND_LABEL: Record<string, string> = {
  bid: 'teklif',
  pass: 'pas',
  auto_pass: 'süre doldu',
};

/** Bu lotta ne olduysa son alti hamlesi. Turun hikayesini gec gelen de anlar. */
export function BidLog({ lot, teams }: { lot: Lot; teams: Team[] }) {
  const nameOf = (id: string) => teams.find((t) => t.id === id)?.name ?? '?';
  const rows = lot.log.slice(-6);

  return (
    <div className="border-t border-line px-4 py-3">
      <div className="mb-1.5 font-mono text-[9px] tracking-[0.2em] text-mute">
        BU ÜRÜNDE
      </div>

      {rows.length === 0 ? (
        <p className="font-mono text-[11px] text-mute">
          Henüz teklif yok.
        </p>
      ) : (
        <ul className="font-mono text-[11px] leading-[1.9]">
          {rows.map((r, i) => (
            <li
              key={`${r.teamId}-${r.at}-${i}`}
              data-testid="log-row"
              className={`flex gap-2 ${r.kind === 'bid' ? 'text-dim' : 'text-[#4e4e4e]'}`}
            >
              <span className="min-w-0 truncate text-text opacity-80">
                {nameOf(r.teamId)}
              </span>
              <span className="shrink-0">{KIND_LABEL[r.kind] ?? r.kind}</span>
              <span className="tnum ml-auto shrink-0">{r.amount ?? '-'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
