import type { GameState, TeamId } from '@/lib/game/types';

export interface WonItem {
  name: string;
  price: number;
}

/** Bir takimin kazandigi lotlar, satis sirasiyla. */
export function wonItems(state: GameState, teamId: TeamId): WonItem[] {
  return state.lots
    .filter((lot) => lot.winnerTeamId === teamId)
    .map((lot) => ({
      name: state.items.find((i) => i.id === lot.itemId)?.name ?? '?',
      price: lot.finalPrice ?? 0,
    }));
}

/** Listeyi tasima yardimcisi; siniri asan hareketlerde listeyi degistirmez. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
