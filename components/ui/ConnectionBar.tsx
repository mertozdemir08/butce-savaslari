'use client';

import type { Connection } from '@/lib/client/useRoom';

const LABELS: Record<Exclude<Connection, 'open'>, string> = {
  connecting: 'BAĞLANIYOR',
  reconnecting: 'BAĞLANTI KOPTU, YENİDEN DENENİYOR',
};

/** Baglanti saglamken hicbir sey gostermez; sessizlik iyi haberdir. */
export function ConnectionBar({ connection }: { connection: Connection }) {
  if (connection === 'open') return null;

  return (
    <div
      role="status"
      data-testid="connection-bar"
      className="border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-1.5 text-center font-[family-name:var(--font-mono)] text-[10px] tracking-[0.14em] text-[var(--color-dim)]"
    >
      {LABELS[connection]}
    </div>
  );
}
