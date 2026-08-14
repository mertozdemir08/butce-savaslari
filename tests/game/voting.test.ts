import { describe, it, expect } from 'vitest';
import { applyAction } from '@/lib/game';
import { tally } from '@/lib/game/scoring';
import { auctionGame, mkCtx } from './fixtures';
import type { GameState } from '@/lib/game/types';

/** Oylama durumunda, verilen butce ve urun sayilariyla bir oyun uretir. */
function votingState(teams: number, budgets: number[], itemsWon: number[]): GameState {
  const { state } = auctionGame({ teams, items: 1 });
  return {
    ...state,
    status: 'voting',
    currentLotId: null,
    resultUntil: null,
    lots: [],
    teams: state.teams.map((t, i) => ({ ...t, budgetLeft: budgets[i], itemsWon: itemsWon[i] })),
    votes: [],
  };
}

describe('VOTE', () => {
  it('kendini siralamaya koyan oyu reddeder', () => {
    const s = votingState(3, [1, 2, 3], [2, 2, 1]);
    const r = applyAction(
      s,
      { type: 'VOTE', teamId: 't-a', rankedTeamIds: ['t-a', 't-b'] },
      mkCtx(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_RANKING');
  });

  it('eksik siralamayi reddeder', () => {
    const s = votingState(3, [1, 2, 3], [2, 2, 1]);
    const r = applyAction(s, { type: 'VOTE', teamId: 't-a', rankedTeamIds: ['t-b'] }, mkCtx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_RANKING');
  });

  it('ayni takimi iki kez iceren siralamayi reddeder', () => {
    const s = votingState(3, [1, 2, 3], [2, 2, 1]);
    const r = applyAction(
      s,
      { type: 'VOTE', teamId: 't-a', rankedTeamIds: ['t-b', 't-b'] },
      mkCtx(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_RANKING');
  });

  it('ikinci oyu reddeder', () => {
    const s = votingState(3, [1, 2, 3], [2, 2, 1]);
    const first = applyAction(
      s,
      { type: 'VOTE', teamId: 't-a', rankedTeamIds: ['t-b', 't-c'] },
      mkCtx(),
    );
    if (!first.ok) throw new Error('hata');
    const second = applyAction(
      first.state,
      { type: 'VOTE', teamId: 't-a', rankedTeamIds: ['t-c', 't-b'] },
      mkCtx(),
    );
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('ALREADY_VOTED');
  });

  it('son oy geldiginde oyunu bitirir', () => {
    let s = votingState(3, [1, 2, 3], [2, 2, 1]);
    const votes: { teamId: string; rankedTeamIds: string[] }[] = [
      { teamId: 't-a', rankedTeamIds: ['t-b', 't-c'] },
      { teamId: 't-b', rankedTeamIds: ['t-c', 't-a'] },
      { teamId: 't-c', rankedTeamIds: ['t-a', 't-b'] },
    ];

    for (const v of votes) {
      const r = applyAction(s, { type: 'VOTE', ...v }, mkCtx());
      if (!r.ok) throw new Error(`hata: ${r.error.code}`);
      s = r.state;
    }
    expect(s.status).toBe('finished');
    expect(s.votes).toHaveLength(3);
  });
});

describe('tally', () => {
  it('3 takimda 2-1 puan verir', () => {
    let s = votingState(3, [1, 2, 3], [2, 2, 1]);
    s = {
      ...s,
      votes: [
        { voterTeamId: 't-a', rankedTeamIds: ['t-b', 't-c'] }, // B:2 C:1
        { voterTeamId: 't-b', rankedTeamIds: ['t-c', 't-a'] }, // C:2 A:1
        { voterTeamId: 't-c', rankedTeamIds: ['t-b', 't-a'] }, // B:2 A:1
      ],
    };

    const rows = tally(s);
    const byId = Object.fromEntries(rows.map((r) => [r.teamId, r]));
    expect(byId['t-b'].points).toBe(4);
    expect(byId['t-c'].points).toBe(3);
    expect(byId['t-a'].points).toBe(2);
    expect(rows.map((r) => r.teamId)).toEqual(['t-b', 't-c', 't-a']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('4 takimda 3-2-1 puan verir', () => {
    let s = votingState(4, [1, 1, 1, 1], [1, 1, 1, 1]);
    s = {
      ...s,
      votes: [
        { voterTeamId: 't-a', rankedTeamIds: ['t-b', 't-c', 't-d'] }, // B:3 C:2 D:1
        { voterTeamId: 't-b', rankedTeamIds: ['t-a', 't-c', 't-d'] }, // A:3 C:2 D:1
        { voterTeamId: 't-c', rankedTeamIds: ['t-b', 't-a', 't-d'] }, // B:3 A:2 D:1
        { voterTeamId: 't-d', rankedTeamIds: ['t-b', 't-a', 't-c'] }, // B:3 A:2 C:1
      ],
    };

    const byId = Object.fromEntries(tally(s).map((r) => [r.teamId, r]));
    expect(byId['t-b'].points).toBe(9);
    expect(byId['t-a'].points).toBe(7);
    expect(byId['t-c'].points).toBe(5);
    expect(byId['t-d'].points).toBe(3);
    expect(byId['t-b'].firstPlaceVotes).toBe(3);
  });

  it('puan esitliginde birincilik oyu belirler', () => {
    let s = votingState(3, [5, 5, 5], [1, 1, 1]);
    s = {
      ...s,
      votes: [
        { voterTeamId: 't-c', rankedTeamIds: ['t-a', 't-b'] }, // A:2 B:1
        { voterTeamId: 't-b', rankedTeamIds: ['t-c', 't-a'] }, // C:2 A:1
      ],
    };
    // A: 3 puan, 1 birincilik. C: 2 puan. B: 1 puan.
    const rows = tally(s);
    expect(rows[0].teamId).toBe('t-a');
    expect(rows[0].firstPlaceVotes).toBe(1);
  });

  it('puan ve birincilik esitse kalan butce belirler', () => {
    let s = votingState(3, [9, 2, 0], [1, 1, 1]);
    s = {
      ...s,
      votes: [
        // A ve B'ye birer ikincilik: ikisi de 1 puan, 0 birincilik.
        { voterTeamId: 't-c', rankedTeamIds: ['t-a', 't-b'] }, // A:2 B:1
      ],
    };
    // A:2 puan. B:1 puan, butce 2. C:0 puan, butce 0.
    const rows = tally(s);
    expect(rows.map((r) => r.teamId)).toEqual(['t-a', 't-b', 't-c']);
  });

  it('her sey esitse ayni rank verir', () => {
    const s = votingState(3, [5, 5, 5], [1, 1, 1]);
    const rows = tally(s); // oy yok, hepsi 0
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 1]);
  });

  it('2 takimda oy olmadan da calisir, kimseye puan yazmaz', () => {
    // 2 takimli oyunda oylama yapilmaz. tally yine de calisir ama puan uretmez;
    // "kazanan yok" karari burada degil, sonuc ekraninda verilir.
    const s = { ...votingState(2, [3, 7], [2, 3]), status: 'finished' as const };
    const rows = tally(s);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.points === 0)).toBe(true);
    expect(rows.every((r) => r.firstPlaceVotes === 0)).toBe(true);
    // Puan esit oldugu icin siralama kalan butceye duser: t-b (7) once gelir.
    expect(rows.map((r) => r.teamId)).toEqual(['t-b', 't-a']);
  });
});
