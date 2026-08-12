import type { GameState, Lot, Team, TeamId } from './types';

export function minBid(lot: Lot): number {
  return (lot.currentBid ?? 0) + 1;
}

/** Takimin urun limitinde yeri var mi. */
export function hasRoom(team: Team, state: GameState): boolean {
  return team.itemsWon < state.itemLimit;
}

/** Takim asgari teklifi verebilir mi. */
export function canAfford(team: Team, lot: Lot): boolean {
  return team.budgetLeft >= minBid(lot);
}

export function findTeam(state: GameState, id: TeamId): Team | undefined {
  return state.teams.find((t) => t.id === id);
}

export function teamAtSeat(state: GameState, seat: number): Team | undefined {
  return state.teams.find((t) => t.seat === seat);
}

/** currentLotId'nin gosterdigi lot, acik olsun ya da olmasin. */
export function currentLot(state: GameState): Lot | null {
  if (!state.currentLotId) return null;
  return state.lots.find((l) => l.id === state.currentLotId) ?? null;
}

export function openLot(state: GameState): Lot | null {
  const lot = currentLot(state);
  return lot && lot.status === 'open' ? lot : null;
}

/** Lot listesindeki bir lotu degistirip yeni state dondurur. */
export function withLot(state: GameState, lot: Lot): GameState {
  return { ...state, lots: state.lots.map((l) => (l.id === lot.id ? lot : l)) };
}

export function withTeam(state: GameState, team: Team): GameState {
  return { ...state, teams: state.teams.map((t) => (t.id === team.id ? team : t)) };
}

export function err(code: import('./types').RuleErrorCode, message: string) {
  return { ok: false as const, error: { code, message } };
}
