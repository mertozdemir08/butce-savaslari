import { describe, it, expect } from 'vitest';
import { applyAction } from '@/lib/game';
import { auctionGame } from './fixtures';
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
  it('kimse teklif vermezse en son pas gecen takima bedelsiz kalir', () => {
    const { state, ctx } = auctionGame({ teams: 3, budget: 10 });
    const s = run(state, ctx, [
      { type: 'PASS', teamId: 't-a', turnSeq: 1 },
      { type: 'PASS', teamId: 't-b', turnSeq: 2 },
      { type: 'PASS', teamId: 't-c', turnSeq: 3 },
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
    let s = state;
    const r1 = applyAction(s, { type: 'PASS', teamId: 't-a', turnSeq: 1 }, ctx);
    if (!r1.ok) throw new Error('hata');
    s = r1.state;
    const r2 = applyAction(s, { type: 'PASS', teamId: 't-b', turnSeq: 2 }, ctx);
    if (!r2.ok) throw new Error('hata');

    const sold = r2.events.find((e) => e.type === 'LOT_SOLD');
    expect(sold).toMatchObject({ winnerTeamId: 't-b', price: 0, free: true });
  });

  it('butcesi 0 olan takim bedelsiz lot alabilir', () => {
    const { state, ctx } = auctionGame({ teams: 2, budget: 10 });
    // Iki takimin da butcesini 0 yap: ikisi de otomatik pas geçer.
    const broke = { ...state, teams: state.teams.map((t) => ({ ...t, budgetLeft: 0 })) };

    // Acik lotun turu zaten A'da; A odeyemez, dolayisiyla resolveTurn yeni bir
    // eylem gelmeden ilerlemez. TIMEOUT yerine dogrudan PASS ile ilerlet.
    const r = applyAction(broke, { type: 'PASS', teamId: 't-a', turnSeq: 1 }, ctx);
    if (!r.ok) throw new Error(`hata: ${r.error.code}`);

    const lot = r.state.lots[0];
    expect(lot.status).toBe('sold');
    // A pas gecti, sonra B parasi yetmedigi icin otomatik pas gecti.
    // En son pas gecen B oldugu icin lot B'ye kalir.
    expect(lot.winnerTeamId).toBe('t-b');
    expect(lot.finalPrice).toBe(0);
    expect(r.state.teams.find((t) => t.id === 't-b')!.itemsWon).toBe(1);
  });

  it('tek uygun takim kalirsa pas gecerek lotu bedelsiz alir', () => {
    // A ve B limitini doldurmus, yalnizca C uygun.
    const { state, ctx } = auctionGame({ teams: 3, budget: 10, itemLimit: 1 });
    // Fixture ilk lotu acti; simdi A ve B'yi doldurup lotu yeniden acmak yerine
    // dogrudan aktif listesi tek takim olan bir durumu dogrula.
    const lot0 = state.lots[0];
    const soloState = {
      ...state,
      itemLimit: 1,
      teams: state.teams.map((t) =>
        t.id === 't-c' ? t : { ...t, itemsWon: 1 },
      ),
      lots: [{ ...lot0, activeTeamIds: ['t-c'], turnTeamId: 't-c', turnSeq: 1 }],
    };

    const r = applyAction(soloState, { type: 'PASS', teamId: 't-c', turnSeq: 1 }, ctx);
    if (!r.ok) throw new Error(`hata: ${r.error.code}`);

    const lot = r.state.lots[0];
    expect(lot.winnerTeamId).toBe('t-c');
    expect(lot.finalPrice).toBe(0);
    expect(r.state.teams.find((t) => t.id === 't-c')!.budgetLeft).toBe(10);
  });
});
