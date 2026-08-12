import { describe, it, expect } from 'vitest';
import { applyAction } from '@/lib/game';
import { auctionGame, lotOf, mkCtx } from './fixtures';

describe('BID', () => {
  it('teklifi kaydeder ve sirayi bir sonraki takima verir', () => {
    const { state, ctx } = auctionGame({ teams: 3 });
    const r = applyAction(state, { type: 'BID', teamId: 't-a', amount: 3, turnSeq: 1 }, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const lot = lotOf(r.state);
    expect(lot.currentBid).toBe(3);
    expect(lot.currentBidderTeamId).toBe('t-a');
    expect(lot.turnTeamId).toBe('t-b');
    expect(lot.turnSeq).toBe(2);
    expect(lot.log).toEqual([
      { teamId: 't-a', kind: 'bid', amount: 3, at: ctx.now.toISOString() },
    ]);
    expect(r.events.map((e) => e.type)).toEqual(['BID_PLACED', 'TURN_CHANGED']);
  });

  it('butce dusmez, yalnizca lot kapaninca duser', () => {
    const { state, ctx } = auctionGame({ teams: 3, budget: 10 });
    const r = applyAction(state, { type: 'BID', teamId: 't-a', amount: 3, turnSeq: 1 }, ctx);
    if (!r.ok) throw new Error('beklenmeyen hata');
    expect(r.state.teams.find((t) => t.id === 't-a')!.budgetLeft).toBe(10);
  });

  it('asgari teklifin altini reddeder', () => {
    const { state, ctx } = auctionGame({ teams: 3 });
    const first = applyAction(state, { type: 'BID', teamId: 't-a', amount: 3, turnSeq: 1 }, ctx);
    if (!first.ok) throw new Error('beklenmeyen hata');

    const r = applyAction(first.state, { type: 'BID', teamId: 't-b', amount: 3, turnSeq: 2 }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('BID_TOO_LOW');
  });

  it('acilis teklifi olarak 0 kabul etmez, 1 kabul eder', () => {
    const { state, ctx } = auctionGame({ teams: 3 });
    const zero = applyAction(state, { type: 'BID', teamId: 't-a', amount: 0, turnSeq: 1 }, ctx);
    expect(zero.ok).toBe(false);
    if (!zero.ok) expect(zero.error.code).toBe('BID_TOO_LOW');

    const one = applyAction(state, { type: 'BID', teamId: 't-a', amount: 1, turnSeq: 1 }, ctx);
    expect(one.ok).toBe(true);
  });

  it('butce ustu teklifi reddeder', () => {
    const { state, ctx } = auctionGame({ teams: 3, budget: 10 });
    const r = applyAction(state, { type: 'BID', teamId: 't-a', amount: 11, turnSeq: 1 }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('BID_OVER_BUDGET');
  });

  it('sirasi olmayan takimi reddeder', () => {
    const { state, ctx } = auctionGame({ teams: 3 });
    const r = applyAction(state, { type: 'BID', teamId: 't-b', amount: 3, turnSeq: 1 }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_YOUR_TURN');
  });

  it('bayat turnSeq ile geleni reddeder', () => {
    const { state, ctx } = auctionGame({ teams: 3 });
    const r = applyAction(state, { type: 'BID', teamId: 't-a', amount: 3, turnSeq: 99 }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('STALE_TURN');
  });

  it('en yuksek teklif sahibinin sirasini atlar', () => {
    // A 3 verir -> B, B 4 verir -> C, C 5 verir -> siradaki A olur (B ve C degil)
    const { state, ctx } = auctionGame({ teams: 3 });
    let s = state;
    for (const [team, amount, seq] of [
      ['t-a', 3, 1],
      ['t-b', 4, 2],
      ['t-c', 5, 3],
    ] as const) {
      const r = applyAction(s, { type: 'BID', teamId: team, amount, turnSeq: seq }, ctx);
      if (!r.ok) throw new Error(`beklenmeyen hata: ${r.error.code}`);
      s = r.state;
    }
    const lot = lotOf(s);
    expect(lot.currentBidderTeamId).toBe('t-c');
    expect(lot.turnTeamId).toBe('t-a');
  });

  it('sonraki tur yeni bir son teslim ani kurar', () => {
    const { state } = auctionGame({ teams: 3, nowMs: 1_000_000, turnSeconds: 30 });
    const later = mkCtx(1_010_000);
    const r = applyAction(state, { type: 'BID', teamId: 't-a', amount: 3, turnSeq: 1 }, later);
    if (!r.ok) throw new Error('beklenmeyen hata');
    expect(lotOf(r.state).turnDeadline).toBe(new Date(1_010_000 + 30_000).toISOString());
  });
});

describe('PASS', () => {
  it('takimi aktiften cikarir ve geri donemez', () => {
    const { state, ctx } = auctionGame({ teams: 3 });
    const r = applyAction(state, { type: 'PASS', teamId: 't-a', turnSeq: 1 }, ctx);
    if (!r.ok) throw new Error('beklenmeyen hata');

    const lot = lotOf(r.state);
    expect(lot.activeTeamIds).toEqual(['t-b', 't-c']);
    expect(lot.turnTeamId).toBe('t-b');
    expect(lot.log[0]).toMatchObject({ teamId: 't-a', kind: 'pass', amount: null });
    expect(r.events.map((e) => e.type)).toEqual(['TEAM_PASSED', 'TURN_CHANGED']);
  });

  it('pas gecen takim tekrar siraya girmez', () => {
    // A pas -> B 2 verir -> C 3 verir -> siradaki B olmali, A degil
    const { state, ctx } = auctionGame({ teams: 3 });
    let s = state;
    const steps = [
      { type: 'PASS' as const, teamId: 't-a', turnSeq: 1 },
      { type: 'BID' as const, teamId: 't-b', amount: 2, turnSeq: 2 },
      { type: 'BID' as const, teamId: 't-c', amount: 3, turnSeq: 3 },
    ];
    for (const step of steps) {
      const r = applyAction(s, step, ctx);
      if (!r.ok) throw new Error(`beklenmeyen hata: ${r.error.code}`);
      s = r.state;
    }
    expect(lotOf(s).turnTeamId).toBe('t-b');
  });

  it('parasi yetmeyen takimi otomatik pas gecirerek atlar', () => {
    const { state, ctx } = auctionGame({ teams: 3, budget: 10 });
    // B'nin butcesini 2'ye dusur. A 3 verirse asgari 4 olur, B odeyemez.
    const poor = {
      ...state,
      teams: state.teams.map((t) => (t.id === 't-b' ? { ...t, budgetLeft: 2 } : t)),
    };

    const r = applyAction(poor, { type: 'BID', teamId: 't-a', amount: 3, turnSeq: 1 }, ctx);
    if (!r.ok) throw new Error('beklenmeyen hata');

    const lot = lotOf(r.state);
    expect(lot.activeTeamIds).toEqual(['t-a', 't-c']);
    expect(lot.turnTeamId).toBe('t-c');
    expect(lot.log[1]).toMatchObject({ teamId: 't-b', kind: 'auto_pass' });
    expect(r.events.map((e) => e.type)).toEqual([
      'BID_PLACED',
      'TEAM_PASSED',
      'TURN_CHANGED',
    ]);
  });
});
