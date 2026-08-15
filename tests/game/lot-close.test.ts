import { describe, it, expect } from 'vitest';
import { applyAction } from '@/lib/game';
import { advanceCtx, auctionGame } from './fixtures';
import type { Action, GameState } from '@/lib/game/types';
import type { Ctx } from '@/lib/game/types';

function run(state: GameState, ctx: Ctx, actions: Action[]): GameState {
  let s = state;
  for (const a of actions) {
    const r = applyAction(s, a, ctx);
    if (!r.ok) throw new Error(`${a.type} basarisiz: ${r.error.code}`);
    s = r.state;
  }
  return s;
}

describe('teklifle satis', () => {
  it('herkes pas gecince en yuksek teklif sahibine satar ve butcesinden duser', () => {
    const { state, ctx } = auctionGame({ teams: 3, budget: 10 });
    // A 4 verir -> B pas -> C pas -> aktifte yalnizca A kalir, A teklif sahibi -> satis
    const s = run(state, ctx, [
      { type: 'BID', teamId: 't-a', amount: 4, turnSeq: 1 },
      { type: 'PASS', teamId: 't-b', turnSeq: 2 },
      { type: 'PASS', teamId: 't-c', turnSeq: 3 },
    ]);

    const lot = s.lots[0];
    expect(lot.status).toBe('sold');
    expect(lot.winnerTeamId).toBe('t-a');
    expect(lot.finalPrice).toBe(4);
    expect(lot.turnTeamId).toBeNull();
    expect(lot.turnDeadline).toBeNull();

    const a = s.teams.find((t) => t.id === 't-a')!;
    expect(a.budgetLeft).toBe(6);
    expect(a.itemsWon).toBe(1);

    // Sonuc koreografisi icin bekleme kuruldu, yeni lot henuz acilmadi.
    expect(s.resultUntil).toBe(new Date(ctx.now.getTime() + 2000).toISOString());
    expect(s.lots).toHaveLength(1);
    expect(s.currentLotId).toBe(lot.id);
  });
});

describe('teklif gelmezse urun yanar', () => {
  it('herkes pas gecince lot kimseye gitmez', () => {
    const { state, ctx } = auctionGame({ teams: 3, budget: 10 });
    const s = run(state, ctx, [
      { type: 'PASS', teamId: 't-a', turnSeq: 1 },
      { type: 'PASS', teamId: 't-b', turnSeq: 2 },
      { type: 'PASS', teamId: 't-c', turnSeq: 3 },
    ]);

    const lot = s.lots[0];
    expect(lot.status).toBe('burned');
    expect(lot.winnerTeamId).toBeNull();
    expect(lot.finalPrice).toBeNull();
    expect(lot.turnTeamId).toBeNull();
    expect(lot.turnDeadline).toBeNull();

    // Hicbir takimin butcesi ya da urun sayisi degismedi.
    for (const t of s.teams) {
      expect(t.budgetLeft, t.name).toBe(10);
      expect(t.itemsWon, t.name).toBe(0);
    }

    // Sonuc koreografisi yanan lot icin de oynar.
    expect(s.resultUntil).toBe(new Date(ctx.now.getTime() + 2000).toISOString());
  });

  it('yanmayi LOT_BURNED olayiyla bildirir', () => {
    const { state, ctx } = auctionGame({ teams: 2, budget: 10 });
    const first = applyAction(state, { type: 'PASS', teamId: 't-a', turnSeq: 1 }, ctx);
    if (!first.ok) throw new Error('hata');
    const r = applyAction(first.state, { type: 'PASS', teamId: 't-b', turnSeq: 2 }, ctx);
    if (!r.ok) throw new Error('hata');

    expect(r.events.map((e) => e.type)).toEqual(['TEAM_PASSED', 'LOT_BURNED']);
    expect(r.events.find((e) => e.type === 'LOT_BURNED')).toMatchObject({ lotId: r.state.lots[0].id });
  });

  it('butcesi yetmeyen takimlar otomatik pas gecince de yanar', () => {
    const { state, ctx } = auctionGame({ teams: 2, budget: 10 });
    const broke = { ...state, teams: state.teams.map((t) => ({ ...t, budgetLeft: 0 })) };

    // Acik lotun turu zaten A'da; A odeyemez ama resolveTurn yeni bir eylem
    // gelmeden ilerlemez. PASS ile ilerlet: sonra B otomatik pas geçer.
    const r = applyAction(broke, { type: 'PASS', teamId: 't-a', turnSeq: 1 }, ctx);
    if (!r.ok) throw new Error(`hata: ${r.error.code}`);

    const lot = r.state.lots[0];
    expect(lot.status).toBe('burned');
    expect(lot.winnerTeamId).toBeNull();
    expect(r.state.teams.every((t) => t.itemsWon === 0)).toBe(true);
  });
});

describe('teklif yokken tek aday', () => {
  it('son takima sira acilir: 1 verip alabilir', () => {
    // Iki takimda A pas gecince B tek aday kalir ama lot kapanmaz;
    // B'nin gercek bir secimi vardir.
    const { state, ctx } = auctionGame({ teams: 2, budget: 10 });
    const passed = applyAction(state, { type: 'PASS', teamId: 't-a', turnSeq: 1 }, ctx);
    if (!passed.ok) throw new Error('hata');

    const open = passed.state.lots[0];
    expect(open.status).toBe('open');
    expect(open.turnTeamId).toBe('t-b');
    expect(passed.events.map((e) => e.type)).toEqual(['TEAM_PASSED', 'TURN_CHANGED']);

    const r = applyAction(passed.state, { type: 'BID', teamId: 't-b', amount: 1, turnSeq: 2 }, ctx);
    if (!r.ok) throw new Error(`hata: ${r.error.code}`);

    const lot = r.state.lots[0];
    expect(lot.status).toBe('sold');
    expect(lot.winnerTeamId).toBe('t-b');
    expect(lot.finalPrice).toBe(1);
    expect(r.state.teams.find((t) => t.id === 't-b')!.budgetLeft).toBe(9);
  });

  it('son takim pas gecerse urun yanar, ona zorla verilmez', () => {
    const { state, ctx } = auctionGame({ teams: 2, budget: 10 });
    const s = run(state, ctx, [
      { type: 'PASS', teamId: 't-a', turnSeq: 1 },
      { type: 'PASS', teamId: 't-b', turnSeq: 2 },
    ]);

    expect(s.lots[0].status).toBe('burned');
    expect(s.teams.find((t) => t.id === 't-b')!.itemsWon).toBe(0);
  });

  it('lot acilisinda tek uygun takim varsa yine sira acilir', () => {
    // 2 takim, limit 1. Ilk lotu B 1 vererek alir; ikinci lotta yalnizca A uygundur.
    const { state, ctx } = auctionGame({ teams: 2, budget: 10, items: 2, itemLimit: 1 });
    const first = run(state, ctx, [
      { type: 'PASS', teamId: 't-a', turnSeq: 1 },
      { type: 'BID', teamId: 't-b', amount: 1, turnSeq: 2 },
    ]);
    expect(first.lots[0].winnerTeamId).toBe('t-b');

    const later = advanceCtx(ctx, 2001);
    const r = applyAction(first, { type: 'ADVANCE' }, later);
    if (!r.ok) throw new Error('hata');

    const lot2 = r.state.lots[1];
    expect(lot2.activeTeamIds).toEqual(['t-a']);
    expect(lot2.status).toBe('open');
    expect(lot2.turnTeamId).toBe('t-a');
    expect(r.events.map((e) => e.type)).toEqual(['LOT_OPENED', 'TURN_CHANGED']);
  });
});
