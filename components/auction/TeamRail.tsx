'use client';

import { wonItems } from '@/components/result/collection';
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
  /** true ise seritler kalan dikey alani esit paylasir (masaustu). */
  fill?: boolean;
}

/**
 * Takim seritleri koltuk sirasiyla; altinda bu urunun teklif kutugu.
 *
 * En fazla 4 takim var, o yuzden masaustunde seritler kalan yuksekligi
 * paylasir: ray ustte sikismaz, alan bos kalmaz.
 */
export function TeamRail({ state, lot, meId, withLog = true, fill = false }: Props) {
  const teams = [...state.teams].sort((a, b) => a.seat - b.seat);

  return (
    <div className={['flex flex-col', fill ? 'h-full min-h-0' : ''].join(' ')}>
      <div className="shrink-0 border-b border-line px-4 py-2.5 font-mono text-[9px] tracking-[0.2em] text-mute">
        TAKIMLAR
      </div>

      <div className={['flex flex-col', fill ? 'shrink-0' : ''].join(' ')}>
        {teams.map((team) => (
          <TeamLane
            key={team.id}
            team={team}
            itemLimit={state.itemLimit}
            isMe={team.id === meId}
            isTurn={lot?.turnTeamId === team.id}
            isOut={!!lot && !lot.activeTeamIds.includes(team.id)}
            status={laneStatus(state, lot, team.id)}
            won={wonItems(state, team.id).map((w) => w.name)}
            fill={fill}
          />
        ))}
      </div>

      {withLog && lot && (
        <div className={['overflow-y-auto', fill ? 'min-h-0 flex-1' : ''].join(' ')}>
          <BidLog lot={lot} teams={state.teams} />
        </div>
      )}
    </div>
  );
}
