import { describe, it, expect } from 'vitest';
import { createGame, applyAction } from '@/lib/game';
import type { GameState, Ctx } from '@/lib/game/types';

function ctx(nowMs = 1_000_000, start = 0): Ctx {
  let n = start;
  return { now: new Date(nowMs), newId: () => `id-${++n}` };
}

export function game(overrides: Partial<Parameters<typeof createGame>[0]> = {}): GameState {
  return createGame({
    roomId: 'room-1',
    code: 'AB23',
    hostTeamName: 'A',
    hostTeamId: 't-a',
    budget: 10,
    itemLimit: 5,
    turnSeconds: 30,
    ...overrides,
  });
}

describe('createGame', () => {
  it('lobide baslar ve host tek takimdir', () => {
    const s = game();
    expect(s.status).toBe('lobby');
    expect(s.teams).toHaveLength(1);
    expect(s.teams[0]).toMatchObject({ id: 't-a', name: 'A', seat: 0, budgetLeft: 10, itemsWon: 0 });
    expect(s.hostTeamId).toBe('t-a');
    expect(s.currentLotId).toBeNull();
  });
});

describe('START_GAME', () => {
  it('en az 2 takim yoksa reddeder', () => {
    const r = applyAction(game(), { type: 'START_GAME', byTeamId: 't-a' }, ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_ENOUGH_TEAMS');
  });

  it('host olmayan baslatamaz', () => {
    let s = game();
    s = { ...s, teams: [...s.teams, { id: 't-b', name: 'B', seat: 1, budgetLeft: 10, itemsWon: 0, connected: true }] };
    s = { ...s, items: [{ id: 'i-1', name: 'Ev', imageUrl: null }] };
    const r = applyAction(s, { type: 'START_GAME', byTeamId: 't-b' }, ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_HOST');
  });

  it('urun yoksa reddeder', () => {
    let s = game();
    s = { ...s, teams: [...s.teams, { id: 't-b', name: 'B', seat: 1, budgetLeft: 10, itemsWon: 0, connected: true }] };
    const r = applyAction(s, { type: 'START_GAME', byTeamId: 't-a' }, ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_ITEMS');
  });

  it('ilk lotu acar, sirayi acan koltuktan baslatir ve son teslim anini kurar', () => {
    let s = game();
    s = {
      ...s,
      teams: [
        ...s.teams,
        { id: 't-b', name: 'B', seat: 1, budgetLeft: 10, itemsWon: 0, connected: true },
        { id: 't-c', name: 'C', seat: 2, budgetLeft: 10, itemsWon: 0, connected: true },
      ],
      items: [
        { id: 'i-1', name: 'Ev', imageUrl: null },
        { id: 'i-2', name: 'Araba', imageUrl: null },
      ],
    };

    const r = applyAction(s, { type: 'START_GAME', byTeamId: 't-a' }, ctx(1_000_000));
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.state.status).toBe('auction');
    expect(r.state.lots).toHaveLength(1);

    const lot = r.state.lots[0];
    expect(lot.lotNo).toBe(1);
    expect(lot.status).toBe('open');
    expect(lot.itemId).toBe('i-1');
    expect(lot.currentBid).toBeNull();
    expect(lot.activeTeamIds).toEqual(['t-a', 't-b', 't-c']);
    expect(lot.turnTeamId).toBe('t-a');
    expect(lot.openerTeamId).toBe('t-a');
    expect(lot.turnSeq).toBe(1);
    expect(lot.turnDeadline).toBe(new Date(1_000_000 + 30_000).toISOString());

    // Sonraki lotun acilis koltugu bir ilerledi.
    expect(r.state.openerSeat).toBe(1);
    expect(r.state.nextItemIndex).toBe(1);

    expect(r.events.map((e) => e.type)).toEqual(['LOT_OPENED', 'TURN_CHANGED']);
  });

  it('limiti dolu takimi lot acilisinda eler, siraya sokmaz', () => {
    let s = game({ itemLimit: 1 });
    s = {
      ...s,
      teams: [
        { id: 't-a', name: 'A', seat: 0, budgetLeft: 10, itemsWon: 1, connected: true },
        { id: 't-b', name: 'B', seat: 1, budgetLeft: 10, itemsWon: 0, connected: true },
      ],
      items: [{ id: 'i-1', name: 'Ev', imageUrl: null }],
    };

    const r = applyAction(s, { type: 'START_GAME', byTeamId: 't-a' }, ctx());
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const lot = r.state.lots[0];
    expect(lot.activeTeamIds).toEqual(['t-b']);
    expect(lot.turnTeamId).toBe('t-b');
    expect(lot.openerTeamId).toBe('t-b');
  });
});
