import { describe, it, expect } from 'vitest';
import { dispatch, type Conn } from '@/lib/server/dispatch';
import { createRoomStore, MAX_ROOMS, type RoomStore } from '@/lib/server/rooms';
import type { ServerMessage } from '@/lib/server/protocol';

const items = [{ name: 'Ev' }, { name: 'Araba' }];

function errorOf(reply: ServerMessage[]): string | undefined {
  const e = reply.find((m) => m.t === 'error');
  return e && e.t === 'error' ? e.code : undefined;
}

/** Iki takimli, oyunu baslamis bir oda kurar. */
function startedRoom() {
  const store: RoomStore = createRoomStore();
  const hostConn: Conn = { code: null, teamId: null };

  const created = dispatch(store, hostConn, {
    t: 'create',
    teamName: 'A',
    budget: 10,
    itemLimit: 5,
    turnSeconds: 30,
    items,
  });
  const host = created.attach!;

  const guestConn: Conn = { code: null, teamId: null };
  const joined = dispatch(store, guestConn, { t: 'join', code: host.code!, teamName: 'B' });
  const guest = joined.attach!;

  dispatch(store, host, { t: 'start' });
  return { store, host, guest, code: host.code! };
}

describe('dispatch - odaya baglanma', () => {
  it('create odayi kurar, welcome doner ve baglantiyi baglar', () => {
    const store = createRoomStore();
    const r = dispatch(store, { code: null, teamId: null }, {
      t: 'create',
      teamName: 'A',
      budget: 10,
      itemLimit: 5,
      turnSeconds: 30,
      items,
    });

    const welcome = r.reply[0];
    expect(welcome.t).toBe('welcome');
    if (welcome.t !== 'welcome') return;
    expect(welcome.code).toHaveLength(4);
    expect(r.broadcast).toBe(welcome.code);
    expect(r.attach).toEqual({ code: welcome.code, teamId: welcome.teamId });
    expect(store.size()).toBe(1);
  });

  it('create urun sirasini karistirir', () => {
    const store = createRoomStore();
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `Urun ${i + 1}` }));
    const orders: string[] = [];

    for (let run = 0; run < 10; run++) {
      const r = dispatch(store, { code: null, teamId: null }, {
        t: 'create',
        teamName: 'A',
        budget: 10,
        itemLimit: 5,
        turnSeconds: 30,
        items: many,
      });
      const welcome = r.reply[0];
      if (welcome.t !== 'welcome') throw new Error('welcome bekleniyordu');
      const stored = store.get(welcome.code)!.state.items;
      expect(stored.map((i) => i.name).sort()).toEqual(many.map((i) => i.name).sort());
      orders.push(stored.map((i) => i.name).join('|'));
    }

    // 20 urunun 10 denemede de girdi sirasinda kalmasi pratikte imkansiz.
    const inputOrder = many.map((i) => i.name).join('|');
    expect(orders.every((o) => o === inputOrder)).toBe(false);
  });

  it('urunsuz create reddedilir', () => {
    const store = createRoomStore();
    const r = dispatch(store, { code: null, teamId: null }, {
      t: 'create',
      teamName: 'A',
      budget: 10,
      itemLimit: 5,
      turnSeconds: 30,
      items: [{ name: '   ' }],
    });
    expect(errorOf(r.reply)).toBe('NO_ITEMS');
    expect(r.broadcast).toBeNull();
    expect(store.size()).toBe(0);
  });

  it('olmayan odaya join reddedilir', () => {
    const store = createRoomStore();
    const r = dispatch(store, { code: null, teamId: null }, {
      t: 'join',
      code: 'YOK1',
      teamName: 'B',
    });
    expect(errorOf(r.reply)).toBe('ROOM_NOT_FOUND');
    expect(r.attach).toBeNull();
  });

  it('resume dogru jetonla durumu geri verir ve baglar', () => {
    const store = createRoomStore();
    const created = dispatch(store, { code: null, teamId: null }, {
      t: 'create',
      teamName: 'A',
      budget: 10,
      itemLimit: 5,
      turnSeconds: 30,
      items,
    });
    const w = created.reply[0];
    if (w.t !== 'welcome') throw new Error('welcome bekleniyordu');

    const r = dispatch(store, { code: null, teamId: null }, {
      t: 'resume',
      code: w.code,
      teamId: w.teamId,
      token: w.token,
    });
    expect(r.reply[0].t).toBe('state');
    expect(r.attach).toEqual({ code: w.code, teamId: w.teamId });
    // resume yalnizca gonderene doner, odaya yayin yapmaz.
    expect(r.broadcast).toBeNull();
  });

  it('yanlis jetonla resume reddedilir ve baglamaz', () => {
    const { store, code, host } = startedRoom();
    const r = dispatch(store, { code: null, teamId: null }, {
      t: 'resume',
      code,
      teamId: host.teamId!,
      token: 'yanlis',
    });
    expect(errorOf(r.reply)).toBe('NOT_AUTHORIZED');
    expect(r.attach).toBeNull();
  });

  it('oda ust sinirina ulasilinca yeni oda kurulmaz', () => {
    const store = createRoomStore();
    const create = () =>
      dispatch(store, { code: null, teamId: null }, {
        t: 'create',
        teamName: 'A',
        budget: 10,
        itemLimit: 5,
        turnSeconds: 30,
        items,
      });

    for (let i = 0; i < MAX_ROOMS; i++) create();
    expect(store.size()).toBe(MAX_ROOMS);

    const overflow = create();
    expect(errorOf(overflow.reply)).toBe('SERVER_BUSY');
    expect(overflow.attach).toBeNull();
    expect(store.size()).toBe(MAX_ROOMS);
  });
});

describe('dispatch - yetki', () => {
  it('odaya bagli olmayan baglantinin aksiyonu reddedilir', () => {
    const { store } = startedRoom();
    const r = dispatch(store, { code: null, teamId: null }, { t: 'pass', turnSeq: 1 });
    expect(errorOf(r.reply)).toBe('ROOM_NOT_FOUND');
  });

  it('takim kimligi olmayan baglantinin teklifi reddedilir', () => {
    const { store, code } = startedRoom();
    const r = dispatch(store, { code, teamId: null }, { t: 'bid', amount: 2, turnSeq: 1 });
    expect(errorOf(r.reply)).toBe('NOT_AUTHORIZED');
  });

  it('host olmayan baslatamaz', () => {
    const store = createRoomStore();
    const hostConn: Conn = { code: null, teamId: null };
    const created = dispatch(store, hostConn, {
      t: 'create', teamName: 'A', budget: 10, itemLimit: 5, turnSeconds: 30, items,
    });
    const host = created.attach!;
    const guest = dispatch(store, { code: null, teamId: null }, {
      t: 'join', code: host.code!, teamName: 'B',
    }).attach!;

    const r = dispatch(store, guest, { t: 'start' });
    expect(errorOf(r.reply)).toBe('NOT_HOST');
  });
});

describe('dispatch - oyun aksiyonlari', () => {
  it('gecerli teklif odaya yayin tetikler, gonderene mesaj gitmez', () => {
    const { store, host, code } = startedRoom();
    const lot = store.get(code)!.state.lots[0];
    const r = dispatch(store, host, { t: 'bid', amount: 3, turnSeq: lot.turnSeq });

    expect(r.reply).toEqual([]);
    expect(r.broadcast).toBe(code);
    expect(store.get(code)!.state.lots[0].currentBid).toBe(3);
  });

  it('sirasi olmayanin teklifi reddedilir ve yayin yapilmaz', () => {
    const { store, guest, code } = startedRoom();
    const lot = store.get(code)!.state.lots[0];
    const r = dispatch(store, guest, { t: 'bid', amount: 3, turnSeq: lot.turnSeq });

    expect(errorOf(r.reply)).toBe('NOT_YOUR_TURN');
    expect(r.broadcast).toBeNull();
  });

  it('bayat turnSeq reddedilir', () => {
    const { store, host } = startedRoom();
    const r = dispatch(store, host, { t: 'bid', amount: 3, turnSeq: 999 });
    expect(errorOf(r.reply)).toBe('STALE_TURN');
  });

  it('timeout kimliksiz baglantidan da kabul edilir', () => {
    const { store, code } = startedRoom();
    const lot = store.get(code)!.state.lots[0];
    const r = dispatch(store, { code, teamId: null }, {
      t: 'timeout',
      lotId: lot.id,
      turnSeq: lot.turnSeq,
    });
    expect(errorOf(r.reply)).toBeUndefined();
    expect(r.broadcast).toBe(code);
  });

  it('advance kimliksiz baglantidan da kabul edilir', () => {
    const { store, code } = startedRoom();
    const r = dispatch(store, { code, teamId: null }, { t: 'advance' });
    expect(errorOf(r.reply)).toBeUndefined();
    expect(r.broadcast).toBe(code);
  });
});
