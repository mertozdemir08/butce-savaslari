import type { GameState, TeamId } from './types';

export interface Standing {
  teamId: TeamId;
  points: number;
  firstPlaceVotes: number;
  budgetLeft: number;
  itemsWon: number;
  /** 1'den baslar. Puan, birincilik ve butce esitse takimlar ayni rank'i paylasir. */
  rank: number;
}

/**
 * Siralama oylamasini puana cevirir.
 * k rakip siralanmissa 1. siraya k, 2. siraya k-1 ... puan gider.
 * Beraberlik: birincilik oyu, sonra kalan butce.
 */
export function tally(state: GameState): Standing[] {
  const points = new Map<TeamId, number>();
  const firsts = new Map<TeamId, number>();
  for (const t of state.teams) {
    points.set(t.id, 0);
    firsts.set(t.id, 0);
  }

  for (const vote of state.votes) {
    const k = vote.rankedTeamIds.length;
    vote.rankedTeamIds.forEach((teamId, i) => {
      if (!points.has(teamId)) return;
      points.set(teamId, points.get(teamId)! + (k - i));
      if (i === 0) firsts.set(teamId, firsts.get(teamId)! + 1);
    });
  }

  const rows: Omit<Standing, 'rank'>[] = state.teams.map((t) => ({
    teamId: t.id,
    points: points.get(t.id)!,
    firstPlaceVotes: firsts.get(t.id)!,
    budgetLeft: t.budgetLeft,
    itemsWon: t.itemsWon,
  }));

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.firstPlaceVotes - a.firstPlaceVotes ||
      b.budgetLeft - a.budgetLeft,
  );

  const same = (a: Omit<Standing, 'rank'>, b: Omit<Standing, 'rank'>) =>
    a.points === b.points &&
    a.firstPlaceVotes === b.firstPlaceVotes &&
    a.budgetLeft === b.budgetLeft;

  const out: Standing[] = [];
  rows.forEach((row, i) => {
    const rank = i > 0 && same(row, rows[i - 1]) ? out[i - 1].rank : i + 1;
    out.push({ ...row, rank });
  });
  return out;
}
