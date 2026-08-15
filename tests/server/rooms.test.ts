import { describe, it, expect } from 'vitest';
import { createRoomStore } from '@/lib/server/rooms';
import type { Item } from '@/lib/game/types';

const items: Item[] = Array.from({ length: 3 }, (_, i) => ({
  id: `i-${i + 1}`,
  name: `Urun ${i + 1}`,
  imageUrl: null,
}));

/** Sabit saatli bir defter; sweep testleri saati elle ilerletir. */
function store(nowRef: { value: number }, opts: Parameters<typeof createRoomStore>[0] = {}) {
  return createRoomStore({ now: () => nowRef.value, ...opts });
}

function freshStore() {
  const nowRef = { value: 1_000_000 };
  return { s: store(nowRef), nowRef };
}

describe('create', () => {
  it('oda kurar, host takimini olusturur ve jeton doner', () => {
    const { s } = freshStore();
    const { room, teamId, token } = s.create({ teamName: 'A', items });

    expect(room.code).toHaveLength(4);
    expect(room.state.status).toBe('lobby');
    expect(room.state.teams).toHaveLength(1);
    expect(room.state.teams[0]).toMatchObject({ id: teamId, name: 'A', seat: 0 });
    expect(room.state.items).toHaveLength(3);
    expect(room.tokens[teamId]).toBe(token);
    expect(token.length).toBeGreaterThanOrEqual(32);
  });

  it('kurulan oda koduyla bulunabilir', () => {
    const { s } = freshStore();
    const { room } = s.create({ teamName: 'A', items });
    expect(s.get(room.code)?.code).toBe(room.code);
    expect(s.size()).toBe(1);
  });

  it('benzersiz kodlar uretir', () => {
    const { s } = freshStore();
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) codes.add(s.create({ teamName: 'A', items }).room.code);
    expect(codes.size).toBe(50);
  });

  it('ayarlari devreder', () => {
    const { s } = freshStore();
    const { room } = s.create({ teamName: 'A', items, budget: 7, itemLimit: 2, turnSeconds: 15 });
    expect(room.state.budget).toBe(7);
    expect(room.state.itemLimit).toBe(2);
    expect(room.state.turnSeconds).toBe(15);
    expect(room.state.teams[0].budgetLeft).toBe(7);
  });
});

describe('join', () => {
  it('takim ekler ve kendi jetonunu verir', () => {
    const { s } = freshStore();
    const { room } = s.create({ teamName: 'A', items });
    const joined = s.join(room.code, 'B');

    expect('code' in joined).toBe(false);
    if ('code' in joined) return;

    const after = s.get(room.code)!;
    expect(after.state.teams).toHaveLength(2);
    expect(after.state.teams[1]).toMatchObject({ id: joined.teamId, name: 'B', seat: 1 });
    expect(after.tokens[joined.teamId]).toBe(joined.token);
  });

  it('olmayan odaya katilmayi reddeder', () => {
    const { s } = freshStore();
    const r = s.join('YOK1', 'B');
    expect('code' in r).toBe(true);
    if ('code' in r) expect(r.code).toBe('ROOM_NOT_FOUND');
  });

  it('dolu odaya bes-inci takimi almaz', () => {
    const { s } = freshStore();
    const { room } = s.create({ teamName: 'A', items });
    for (const n of ['B', 'C', 'D']) s.join(room.code, n);
    const r = s.join(room.code, 'E');
    expect('code' in r).toBe(true);
    if ('code' in r) expect(r.code).toBe('ROOM_FULL');
  });
});

describe('apply - kimlik dogrulama', () => {
  function started() {
    const { s, nowRef } = freshStore();
    const { room, teamId: hostId } = s.create({ teamName: 'A', items });
    const b = s.join(room.code, 'B');
    if ('code' in b) throw new Error('join basarisiz');
    const r = s.apply(room.code, hostId, { type: 'START_GAME', byTeamId: hostId });
    if (!r.ok) throw new Error(`start basarisiz: ${r.error.code}`);
    return { s, nowRef, code: room.code, hostId, bId: b.teamId };
  }

  it('sirasi gelen takimin teklifini kabul eder', () => {
    const { s, code, hostId } = started();
    const lot = s.get(code)!.state.lots[0];
    const r = s.apply(code, hostId, { type: 'BID', teamId: hostId, amount: 2, turnSeq: lot.turnSeq });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.room.state.lots[0].currentBid).toBe(2);
  });

  it('baskasinin adina aksiyonu reddeder', () => {
    const { s, code, hostId, bId } = started();
    const lot = s.get(code)!.state.lots[0];
    // Cagiran B, ama aksiyon A adina.
    const r = s.apply(code, bId, { type: 'BID', teamId: hostId, amount: 2, turnSeq: lot.turnSeq });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_AUTHORIZED');
  });

  it('kimliksiz cagiranin kimlik gerektiren aksiyonunu reddeder', () => {
    const { s, code, hostId } = started();
    const lot = s.get(code)!.state.lots[0];
    const r = s.apply(code, null, { type: 'BID', teamId: hostId, amount: 2, turnSeq: lot.turnSeq });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_AUTHORIZED');
  });

  it('timeout kimlik istemez', () => {
    const { s, code } = started();
    const lot = s.get(code)!.state.lots[0];
    const r = s.apply(code, null, { type: 'TIMEOUT', lotId: lot.id, turnSeq: lot.turnSeq });
    expect(r.ok).toBe(true);
  });

  it('advance kimlik istemez', () => {
    const { s, code } = started();
    const r = s.apply(code, null, { type: 'ADVANCE' });
    expect(r.ok).toBe(true);
  });

  it('olmayan odaya aksiyonu reddeder', () => {
    const { s } = freshStore();
    const r = s.apply('YOK1', null, { type: 'ADVANCE' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('ROOM_NOT_FOUND');
  });

  it('motorun kural hatasini oldugu gibi gecirir', () => {
    const { s, code, bId } = started();
    const lot = s.get(code)!.state.lots[0];
    // Sira A'da, B teklif veremez.
    const r = s.apply(code, bId, { type: 'BID', teamId: bId, amount: 2, turnSeq: lot.turnSeq });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_YOUR_TURN');
  });
});

describe('sweep', () => {
  it('sessiz odayi siler', () => {
    const nowRef = { value: 1_000_000 };
    const s = store(nowRef, { idleMs: 1000 });
    const { room } = s.create({ teamName: 'A', items });

    nowRef.value += 1001;
    const removed = s.sweep(nowRef.value);
    expect(removed).toEqual([room.code]);
    expect(s.get(room.code)).toBeUndefined();
    expect(s.size()).toBe(0);
  });

  it('aktif odayi silmez', () => {
    const nowRef = { value: 1_000_000 };
    const s = store(nowRef, { idleMs: 1000 });
    const { room } = s.create({ teamName: 'A', items });

    nowRef.value += 500;
    expect(s.sweep(nowRef.value)).toEqual([]);
    expect(s.get(room.code)).toBeDefined();
  });

  it('aksiyon sonrasi sessizlik sayaci sifirlanir', () => {
    const nowRef = { value: 1_000_000 };
    const s = store(nowRef, { idleMs: 1000 });
    const { room, teamId } = s.create({ teamName: 'A', items });

    nowRef.value += 900;
    s.join(room.code, 'B');
    s.apply(room.code, teamId, { type: 'START_GAME', byTeamId: teamId });

    nowRef.value += 900; // ilk kurulustan 1800ms gecti ama son aksiyondan 900ms
    expect(s.sweep(nowRef.value)).toEqual([]);
    expect(s.get(room.code)).toBeDefined();
  });

  it('bitmis odayi daha kisa esikle siler', () => {
    const nowRef = { value: 1_000_000 };
    const s = store(nowRef, { idleMs: 100_000, finishedMs: 1000 });
    const { room, teamId } = s.create({ teamName: 'A', items: [items[0]] });
    const b = s.join(room.code, 'B');
    if ('code' in b) throw new Error('join basarisiz');

    s.apply(room.code, teamId, { type: 'START_GAME', byTeamId: teamId });
    // Iki takim da pas gecer -> lot yanarak kapanir; sonra ADVANCE oyunu bitirir.
    for (let i = 0; i < 4; i++) {
      const st = s.get(room.code)!.state;
      const lot = st.lots.find((l) => l.id === st.currentLotId);
      if (!lot || lot.status !== 'open') break;
      s.apply(room.code, lot.turnTeamId, {
        type: 'PASS',
        teamId: lot.turnTeamId!,
        turnSeq: lot.turnSeq,
      });
    }
    nowRef.value += 2001;
    s.apply(room.code, null, { type: 'ADVANCE' });
    expect(s.get(room.code)!.state.status).toBe('finished');

    // Sessizlik esigi 100s ama bitmis esigi 1s.
    nowRef.value += 1001;
    expect(s.sweep(nowRef.value)).toEqual([room.code]);
  });
});
