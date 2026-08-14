import type { GameState, Lot, TeamId } from '@/lib/game/types';

export type LaneStatus =
  | { kind: 'turn'; label: 'SIRA' }
  | { kind: 'leading'; label: string }
  | { kind: 'passed'; label: 'PAS' | 'SÜRE DOLDU' }
  | { kind: 'full'; label: 'LİMİT DOLU' }
  | { kind: 'waiting'; label: 'BEKLİYOR' }
  | { kind: 'idle'; label: '' };

/**
 * Bir takimin bu lottaki durumunu tek bir etikete indirger.
 *
 * Renk tek basina bilgi tasimaz: elenen takim hem soluklasir, hem adinin
 * ustu cizilir, hem de burada neden elendigini yazar.
 */
export function laneStatus(state: GameState, lot: Lot | null, teamId: TeamId): LaneStatus {
  if (!lot) return { kind: 'idle', label: '' };

  if (lot.turnTeamId === teamId) return { kind: 'turn', label: 'SIRA' };

  if (lot.currentBidderTeamId === teamId && lot.currentBid !== null) {
    return { kind: 'leading', label: `${lot.currentBid} VERDİ` };
  }

  if (!lot.activeTeamIds.includes(teamId)) {
    const team = state.teams.find((t) => t.id === teamId);
    // Lot acilisinda limiti dolu oldugu icin hic siraya girmemis olabilir.
    if (team && team.itemsWon >= state.itemLimit && !lot.log.some((r) => r.teamId === teamId)) {
      return { kind: 'full', label: 'LİMİT DOLU' };
    }
    const last = [...lot.log].reverse().find((r) => r.teamId === teamId);
    return last?.kind === 'auto_pass'
      ? { kind: 'passed', label: 'SÜRE DOLDU' }
      : { kind: 'passed', label: 'PAS' };
  }

  return { kind: 'waiting', label: 'BEKLİYOR' };
}
