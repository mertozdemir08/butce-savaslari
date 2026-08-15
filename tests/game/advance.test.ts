import { describe, it, expect } from 'vitest';
import { applyAction } from '@/lib/game';
// advanceCtx, mkCtx yerine kullanilir: mkCtx id sayacini sifirlar ve
// ikinci lot ilk lotla ayni id'yi alir. advanceCtx sayaci korur.
import { advanceCtx, auctionGame } from './fixtures';
import type { Action, Ctx, GameState } from '@/lib/game/types';

function run(state: GameState, ctx: Ctx, actions: Action[]): GameState {
  let s = state;
  for (const a of actions) {
    const r = applyAction(s, a, ctx);
    if (!r.ok) throw new Error(`${a.type} basarisiz: ${r.error.code}`);
    s = r.state;
  }
  return s;
}

/**
 * Acik lotu, siradaki takimin pas gecmesiyle sonuna kadar tuketip kapatir.
 * Kimse teklif vermedigi icin lot yanarak kapanir.
 */
function passUntilClosed(state: GameState, ctx: Ctx): GameState {
  let s = state;
  for (let i = 0; i < 10; i++) {
    const lot = s.lots.find((l) => l.id === s.currentLotId);
    if (!lot || lot.status !== 'open') return s;
    const r = applyAction(s, { type: 'PASS', teamId: lot.turnTeamId!, turnSeq: lot.turnSeq }, ctx);
    if (!r.ok) throw new Error(`PASS basarisiz: ${r.error.code}`);
    s = r.state;
  }
  throw new Error('lot kapanmadi');
}

describe('ADVANCE', () => {
  it('sonuc suresi gecmediyse hicbir sey yapmaz', () => {
    const { state, ctx } = auctionGame({ teams: 3, items: 3 });
    const closed = passUntilClosed(state, ctx);
    expect(closed.resultUntil).not.toBeNull();

    const tooEarly = advanceCtx(ctx, 500);
    const r = applyAction(closed, { type: 'ADVANCE' }, tooEarly);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toEqual([]);
    expect(r.state.lots).toHaveLength(1);
  });

  it('sonuc suresi gectiginde sonraki lotu acar', () => {
    const { state, ctx } = auctionGame({ teams: 3, items: 3 });
    const closed = passUntilClosed(state, ctx);

    const after = advanceCtx(ctx, 2001);
    const r = applyAction(closed, { type: 'ADVANCE' }, after);
    if (!r.ok) throw new Error('hata');

    expect(r.state.lots).toHaveLength(2);
    expect(r.state.lots[1].lotNo).toBe(2);
    expect(r.state.lots[1].itemId).toBe('i-2');
    expect(r.state.resultUntil).toBeNull();
    expect(r.events.map((e) => e.type)).toEqual(['LOT_OPENED', 'TURN_CHANGED']);
  });

  it('resultUntil bos oldugunda hicbir sey yapmaz', () => {
    const { state, ctx } = auctionGame({ teams: 3 });
    const r = applyAction(state, { type: 'ADVANCE' }, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toEqual([]);
  });
});

describe('tur rotasyonu', () => {
  it('her lotta acilis koltugu bir ilerler', () => {
    const { state, ctx } = auctionGame({ teams: 3, items: 3 });
    expect(state.lots[0].openerTeamId).toBe('t-a');

    let s = passUntilClosed(state, ctx);
    let c = advanceCtx(ctx, 2001);
    s = run(s, c, [{ type: 'ADVANCE' }]);
    expect(s.lots[1].openerTeamId).toBe('t-b');

    s = passUntilClosed(s, c);
    c = advanceCtx(c, 2001);
    s = run(s, c, [{ type: 'ADVANCE' }]);
    expect(s.lots[2].openerTeamId).toBe('t-c');
  });

  it('acilis koltugundaki takim uygun degilse tur ilk uygun takimdan baslar ama rotasyon bozulmaz', () => {
    // 3 takim, limit 1. Ilk lotu A alir, ikinci lotun acilis koltugu B'dir.
    const { state, ctx } = auctionGame({ teams: 3, items: 3, itemLimit: 1 });

    // A 1 verir, B ve C pas gecer -> lot A'ya satilir, A limiti dolar.
    let s = run(state, ctx, [
      { type: 'BID', teamId: 't-a', amount: 1, turnSeq: 1 },
      { type: 'PASS', teamId: 't-b', turnSeq: 2 },
      { type: 'PASS', teamId: 't-c', turnSeq: 3 },
    ]);
    expect(s.teams.find((t) => t.id === 't-a')!.itemsWon).toBe(1);

    const c = advanceCtx(ctx, 2001);
    s = run(s, c, [{ type: 'ADVANCE' }]);

    const lot2 = s.lots[1];
    // A limiti dolu oldugu icin aktifte yok.
    expect(lot2.activeTeamIds).toEqual(['t-b', 't-c']);
    expect(lot2.openerTeamId).toBe('t-b');
    // Isaretci yine tam bir koltuk ilerledi: sonraki acilis koltugu 2 (C).
    expect(s.openerSeat).toBe(2);
  });
});

describe('oyun sonu', () => {
  it('urunler bittiginde 3 takimla oylamaya gecer', () => {
    const { state, ctx } = auctionGame({ teams: 3, items: 1 });
    const closed = passUntilClosed(state, ctx);
    const after = advanceCtx(ctx, 2001);

    const r = applyAction(closed, { type: 'ADVANCE' }, after);
    if (!r.ok) throw new Error('hata');

    expect(r.state.status).toBe('voting');
    expect(r.state.currentLotId).toBeNull();
    expect(r.events.map((e) => e.type)).toEqual(['GAME_ENDED', 'VOTING_STARTED']);
  });

  it('2 takimla oylama atlanir ve dogrudan biter', () => {
    const { state, ctx } = auctionGame({ teams: 2, items: 1 });
    const closed = passUntilClosed(state, ctx);
    const after = advanceCtx(ctx, 2001);

    const r = applyAction(closed, { type: 'ADVANCE' }, after);
    if (!r.ok) throw new Error('hata');

    expect(r.state.status).toBe('finished');
    expect(r.events.map((e) => e.type)).toEqual(['GAME_ENDED']);
  });

  it('herkes limitini doldurdugunda urun kalsa bile biter', () => {
    // 2 takim, limit 1, 5 urun. Pas gecmek artik limit doldurmuyor (urun
    // yaniyor), o yuzden her lotu bir takim teklif vererek alir.
    const { state, ctx } = auctionGame({ teams: 2, items: 5, itemLimit: 1 });

    // 1. lot: A 1 verir, B pas gecer -> A'ya satilir, A dolar.
    let s = run(state, ctx, [
      { type: 'BID', teamId: 't-a', amount: 1, turnSeq: 1 },
      { type: 'PASS', teamId: 't-b', turnSeq: 2 },
    ]);

    let c = advanceCtx(ctx, 2001);
    s = run(s, c, [{ type: 'ADVANCE' }]);

    // 2. lot: yalnizca B uygun; 1 verip alir ve o da dolar.
    expect(s.lots[1].activeTeamIds).toEqual(['t-b']);
    s = run(s, c, [{ type: 'BID', teamId: 't-b', amount: 1, turnSeq: 1 }]);

    c = advanceCtx(c, 2001);
    const r = applyAction(s, { type: 'ADVANCE' }, c);
    if (!r.ok) throw new Error('hata');

    expect(r.state.status).toBe('finished');
    expect(r.state.lots).toHaveLength(2);
    expect(r.state.teams.every((t) => t.itemsWon === 1)).toBe(true);
  });
});
