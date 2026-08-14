import { describe, it, expect } from 'vitest';
import { applyAction } from '@/lib/game';
import { auctionGame, lotOf, mkCtx } from './fixtures';

describe('TIMEOUT', () => {
  it('sure dolduysa otomatik pas uygular ve sirayi ilerletir', () => {
    const { state } = auctionGame({ teams: 3, nowMs: 1_000_000, turnSeconds: 30 });
    const lot = lotOf(state);
    const late = mkCtx(1_000_000 + 30_001);

    const r = applyAction(state, { type: 'TIMEOUT', lotId: lot.id, turnSeq: 1 }, late);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const after = lotOf(r.state);
    expect(after.activeTeamIds).toEqual(['t-b', 't-c']);
    expect(after.turnTeamId).toBe('t-b');
    expect(after.log[0]).toMatchObject({ teamId: 't-a', kind: 'auto_pass' });
    expect(r.events.map((e) => e.type)).toEqual(['TEAM_PASSED', 'TURN_CHANGED']);
  });

  it('sure dolmadiysa hicbir sey yapmaz ve hata dondurmez', () => {
    const { state } = auctionGame({ teams: 3, nowMs: 1_000_000, turnSeconds: 30 });
    const lot = lotOf(state);
    const early = mkCtx(1_000_000 + 10_000);

    const r = applyAction(state, { type: 'TIMEOUT', lotId: lot.id, turnSeq: 1 }, early);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toEqual([]);
    expect(r.state).toEqual(state);
  });

  it('ayni zaman asimi iki kez uygulanmaz', () => {
    const { state } = auctionGame({ teams: 3, nowMs: 1_000_000, turnSeconds: 30 });
    const lot = lotOf(state);
    const late = mkCtx(1_000_000 + 30_001);

    const first = applyAction(state, { type: 'TIMEOUT', lotId: lot.id, turnSeq: 1 }, late);
    if (!first.ok) throw new Error('hata');
    // Ikinci cagri ayni turnSeq ile gelir ama sira artik 2, dolayisiyla bayat.
    const second = applyAction(first.state, { type: 'TIMEOUT', lotId: lot.id, turnSeq: 1 }, late);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.events).toEqual([]);
    expect(second.state).toEqual(first.state);
  });

  it('bayat turnSeq ile geleni sessizce yok sayar', () => {
    const { state } = auctionGame({ teams: 3, nowMs: 1_000_000 });
    const lot = lotOf(state);
    const late = mkCtx(1_000_000 + 30_001);

    const r = applyAction(state, { type: 'TIMEOUT', lotId: lot.id, turnSeq: 99 }, late);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toEqual([]);
  });

  it('yanlis lotId ile geleni sessizce yok sayar', () => {
    const { state } = auctionGame({ teams: 3, nowMs: 1_000_000 });
    const late = mkCtx(1_000_000 + 30_001);

    const r = applyAction(state, { type: 'TIMEOUT', lotId: 'yok', turnSeq: 1 }, late);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toEqual([]);
  });

  it('zaman asimi lotu kapatabilir', () => {
    // A 4 verir, B ve C pas gecer -> A'ya satilir. Burada B pas, C zaman asimi.
    const { state } = auctionGame({ teams: 3, nowMs: 1_000_000, turnSeconds: 30 });
    const ctx0 = mkCtx(1_000_000);
    let s = state;

    const bid = applyAction(s, { type: 'BID', teamId: 't-a', amount: 4, turnSeq: 1 }, ctx0);
    if (!bid.ok) throw new Error('hata');
    s = bid.state;

    const pass = applyAction(s, { type: 'PASS', teamId: 't-b', turnSeq: 2 }, ctx0);
    if (!pass.ok) throw new Error('hata');
    s = pass.state;

    const lot = lotOf(s);
    const late = mkCtx(1_000_000 + 30_001);
    const r = applyAction(s, { type: 'TIMEOUT', lotId: lot.id, turnSeq: lot.turnSeq }, late);
    if (!r.ok) throw new Error('hata');

    expect(r.state.lots[0].status).toBe('sold');
    expect(r.state.lots[0].winnerTeamId).toBe('t-a');
    expect(r.state.lots[0].finalPrice).toBe(4);
    expect(r.events.map((e) => e.type)).toEqual(['TEAM_PASSED', 'LOT_SOLD']);
  });
});
