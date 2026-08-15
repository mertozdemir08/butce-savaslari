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

describe('bedelsiz devir', () => {
  it('teklif yokken son takim kalinca lot ona bedelsiz kalir', () => {
    const { state, ctx } = auctionGame({ teams: 3, budget: 10 });
    // A pas -> B pas -> aktifte yalnizca C kalir, teklif yok: lot C'ye kapanir.
    const s = run(state, ctx, [
      { type: 'PASS', teamId: 't-a', turnSeq: 1 },
      { type: 'PASS', teamId: 't-b', turnSeq: 2 },
    ]);

    const lot = s.lots[0];
    expect(lot.status).toBe('sold');
    expect(lot.winnerTeamId).toBe('t-c');
    expect(lot.finalPrice).toBe(0);

    const c = s.teams.find((t) => t.id === 't-c')!;
    expect(c.budgetLeft).toBe(10);
    expect(c.itemsWon).toBe(1);
  });

  it('bedelsiz devri LOT_SOLD olayinda free: true olarak bildirir', () => {
    const { state, ctx } = auctionGame({ teams: 2, budget: 10 });
    const r = applyAction(state, { type: 'PASS', teamId: 't-a', turnSeq: 1 }, ctx);
    if (!r.ok) throw new Error('hata');

    const sold = r.events.find((e) => e.type === 'LOT_SOLD');
    expect(sold).toMatchObject({ winnerTeamId: 't-b', price: 0, free: true });
  });

  it('butcesi 0 olan takim bedelsiz lot alabilir', () => {
    const { state, ctx } = auctionGame({ teams: 2, budget: 10 });
    // Iki takimin da butcesini 0 yap.
    const broke = { ...state, teams: state.teams.map((t) => ({ ...t, budgetLeft: 0 })) };

    // Acik lotun turu zaten A'da; A odeyemez, dolayisiyla resolveTurn yeni bir
    // eylem gelmeden ilerlemez. TIMEOUT yerine dogrudan PASS ile ilerlet.
    const r = applyAction(broke, { type: 'PASS', teamId: 't-a', turnSeq: 1 }, ctx);
    if (!r.ok) throw new Error(`hata: ${r.error.code}`);

    const lot = r.state.lots[0];
    expect(lot.status).toBe('sold');
    // A pas gectikten sonra aktifte yalnizca B kaldi: lot B'ye kalir.
    expect(lot.winnerTeamId).toBe('t-b');
    expect(lot.finalPrice).toBe(0);
    expect(r.state.teams.find((t) => t.id === 't-b')!.itemsWon).toBe(1);
  });
});

describe('teklif yokken tek aday', () => {
  it('son takima sira acilmaz: teklif verip bosa para harcayamaz', () => {
    const { state, ctx } = auctionGame({ teams: 2, budget: 10 });
    const r = applyAction(state, { type: 'PASS', teamId: 't-a', turnSeq: 1 }, ctx);
    if (!r.ok) throw new Error('hata');

    const lot = r.state.lots[0];
    expect(lot.turnTeamId).toBeNull();
    expect(lot.turnDeadline).toBeNull();
    expect(r.events.map((e) => e.type)).toEqual(['TEAM_PASSED', 'LOT_SOLD']);

    // Lot kapandi: B artik teklif veremez.
    const late = applyAction(r.state, { type: 'BID', teamId: 't-b', amount: 5, turnSeq: 1 }, ctx);
    expect(late.ok).toBe(false);
    if (!late.ok) expect(late.error.code).toBe('LOT_NOT_OPEN');
    expect(r.state.teams.find((t) => t.id === 't-b')!.budgetLeft).toBe(10);
  });

  it('lot acilisinda tek uygun takim varsa urun ona bedelsiz verilir', () => {
    // 2 takim, limit 1. Ilk lot B'ye kalir, ikinci lotta yalnizca A uygundur.
    const { state, ctx } = auctionGame({ teams: 2, budget: 10, items: 2, itemLimit: 1 });
    const first = applyAction(state, { type: 'PASS', teamId: 't-a', turnSeq: 1 }, ctx);
    if (!first.ok) throw new Error('hata');
    expect(first.state.lots[0].winnerTeamId).toBe('t-b');

    const later = advanceCtx(ctx, 2001);
    const r = applyAction(first.state, { type: 'ADVANCE' }, later);
    if (!r.ok) throw new Error('hata');

    const lot2 = r.state.lots[1];
    expect(lot2.activeTeamIds).toEqual(['t-a']);
    expect(lot2.status).toBe('sold');
    expect(lot2.winnerTeamId).toBe('t-a');
    expect(lot2.finalPrice).toBe(0);
    expect(lot2.turnTeamId).toBeNull();
    expect(r.state.teams.find((t) => t.id === 't-a')!.budgetLeft).toBe(10);
    expect(r.events.map((e) => e.type)).toEqual(['LOT_OPENED', 'LOT_SOLD']);
  });
});
