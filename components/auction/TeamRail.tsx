'use client';

import type { GameState, Lot, TeamId } from '@/lib/game/types';
import { BidLog } from './BidLog';
import { laneStatus } from './laneStatus';
import { TeamLane } from './TeamLane';

interface Props {
  state: GameState;
  lot: Lot | null;
  meId: TeamId | null;
  /** Teklif kutugunu gostersin mi; telefonda ray disinda cizilir. */
  withLog?: boolean;
}

/** Takim seritleri koltuk sirasiyla; altinda bu lotun teklif kutugu. */
export function TeamRail({ state, lot, meId, withLog = true }: Props) {
  const teams = [...state.teams].sort((a, b) => a.seat - b.seat);

  return (
    <div className="flex flex-col">
      <div className="border-b border-[var(--color-line)] px-4 py-2.5 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.2em] text-[var(--color-mute)]">
        TAKIMLAR
      </div>

      {teams.map((team) => (
        <TeamLane
          key={team.id}
          team={team}
          itemLimit={state.itemLimit}
          isMe={team.id === meId}
          isTurn={lot?.turnTeamId === team.id}
          isOut={!!lot && !lot.activeTeamIds.includes(team.id)}
          status={laneStatus(state, lot, team.id)}
        />
      ))}

      {withLog && lot && <BidLog lot={lot} teams={state.teams} />}
    </div>
  );
}
