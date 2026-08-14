import { describe, it, expect } from 'vitest';
import { applyAction } from '@/lib/game';
import { auctionGame } from './fixtures';

describe('SET_PRESENCE', () => {
  it('bagli takimlari isaretler, olmayanlari dusurur', () => {
    const { state, ctx } = auctionGame({ teams: 3 });
    const r = applyAction(state, { type: 'SET_PRESENCE', onlineTeamIds: ['t-a', 't-c'] }, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const byId = Object.fromEntries(r.state.teams.map((t) => [t.id, t.connected]));
    expect(byId).toEqual({ 't-a': true, 't-b': false, 't-c': true });
  });

  it('degisiklik oldugunda olay yayinlar', () => {
    // Olay yayinlanmazsa sunucu yayin yapmaz ve degisiklik istemcilere ulasmaz.
    const { state, ctx } = auctionGame({ teams: 3 });
    const r = applyAction(state, { type: 'SET_PRESENCE', onlineTeamIds: ['t-a', 't-c'] }, ctx);
    if (!r.ok) throw new Error('hata');
    expect(r.events).toContainEqual({ type: 'PRESENCE_CHANGED' });
  });

  it('hicbir sey degismediyse durumu ve olaylari bos birakir', () => {
    const { state, ctx } = auctionGame({ teams: 3 });
    const r = applyAction(
      state,
      { type: 'SET_PRESENCE', onlineTeamIds: ['t-a', 't-b', 't-c'] },
      ctx,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toEqual([]);
    expect(r.state).toEqual(state);
  });

  it('host baglantisi kopunca yetkiyi ilk bagli takima devreder', () => {
    const { state, ctx } = auctionGame({ teams: 3 });
    expect(state.hostTeamId).toBe('t-a');

    const r = applyAction(state, { type: 'SET_PRESENCE', onlineTeamIds: ['t-b', 't-c'] }, ctx);
    if (!r.ok) throw new Error('hata');

    expect(r.state.hostTeamId).toBe('t-b');
    expect(r.events).toContainEqual({ type: 'HOST_CHANGED', teamId: 't-b' });
  });

  it('devri koltuk sirasina gore yapar, listedeki siraya gore degil', () => {
    const { state, ctx } = auctionGame({ teams: 3 });
    const r = applyAction(state, { type: 'SET_PRESENCE', onlineTeamIds: ['t-c', 't-b'] }, ctx);
    if (!r.ok) throw new Error('hata');
    expect(r.state.hostTeamId).toBe('t-b');
  });

  it('host bagliysa yetkiyi devretmez', () => {
    const { state, ctx } = auctionGame({ teams: 3 });
    const r = applyAction(state, { type: 'SET_PRESENCE', onlineTeamIds: ['t-a'] }, ctx);
    if (!r.ok) throw new Error('hata');
    expect(r.state.hostTeamId).toBe('t-a');
    expect(r.events.some((e) => e.type === 'HOST_CHANGED')).toBe(false);
  });

  it('kimse bagli degilse host degismez', () => {
    const { state, ctx } = auctionGame({ teams: 3 });
    const r = applyAction(state, { type: 'SET_PRESENCE', onlineTeamIds: [] }, ctx);
    if (!r.ok) throw new Error('hata');
    expect(r.state.hostTeamId).toBe('t-a');
    expect(r.state.teams.every((t) => !t.connected)).toBe(true);
  });

  it('host geri dondugunde yetki geri gitmez', () => {
    const { state, ctx } = auctionGame({ teams: 3 });
    const gone = applyAction(state, { type: 'SET_PRESENCE', onlineTeamIds: ['t-b', 't-c'] }, ctx);
    if (!gone.ok) throw new Error('hata');
    expect(gone.state.hostTeamId).toBe('t-b');

    const back = applyAction(
      gone.state,
      { type: 'SET_PRESENCE', onlineTeamIds: ['t-a', 't-b', 't-c'] },
      ctx,
    );
    if (!back.ok) throw new Error('hata');
    expect(back.state.hostTeamId).toBe('t-b');
  });
});
