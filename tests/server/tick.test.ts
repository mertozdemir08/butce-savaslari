import { describe, it, expect } from 'vitest';
import { currentLot } from '@/lib/game';
import { createRoomStore } from '@/lib/server/rooms';
import { tickRooms } from '@/lib/server/tick';
import type { Item } from '@/lib/game/types';

const items: Item[] = Array.from({ length: 3 }, (_, i) => ({
  id: `i-${i + 1}`,
  name: `Urun ${i + 1}`,
  imageUrl: null,
}));

const TURN_SECONDS = 30;

/** Iki takimla acik artirmaya baslamis bir oda ve saati elle suren defter. */
function startedRoom() {
  const nowRef = { value: 1_000_000 };
  const store = createRoomStore({ now: () => nowRef.value });
  const { room, teamId } = store.create({ teamName: 'A', items, turnSeconds: TURN_SECONDS });
  const guest = store.join(room.code, 'B');
  if ('code' in guest) throw new Error('join basarisiz');

  const started = store.apply(room.code, teamId, { type: 'START_GAME', byTeamId: teamId });
  if (!started.ok) throw new Error(`START_GAME basarisiz: ${started.error.code}`);

  return { store, code: room.code, nowRef };
}

describe('tickRooms', () => {
  it('sure dolmadan hicbir sey yapmaz', () => {
    const { store, nowRef } = startedRoom();
    expect(tickRooms(store, nowRef.value)).toEqual([]);
    expect(tickRooms(store, nowRef.value + (TURN_SECONDS - 1) * 1000)).toEqual([]);
  });

  it('tur suresi dolunca istemci olmadan sirayi ilerletir', () => {
    const { store, code, nowRef } = startedRoom();
    const before = currentLot(store.get(code)!.state)!;

    nowRef.value += TURN_SECONDS * 1000;
    expect(tickRooms(store, nowRef.value)).toEqual([code]);

    const after = currentLot(store.get(code)!.state)!;
    expect(after.turnSeq).toBeGreaterThan(before.turnSeq);
    expect(after.turnTeamId).not.toBe(before.turnTeamId);
  });

  it('sonuc suresi dolunca sonraki lotu istemci olmadan acar', () => {
    const { store, code, nowRef } = startedRoom();

    // Iki takim da pas gecer: lot bedelsiz kapanir ve sonuc suresi baslar.
    for (let i = 0; i < 2; i++) {
      nowRef.value += TURN_SECONDS * 1000;
      tickRooms(store, nowRef.value);
    }

    const sold = store.get(code)!.state;
    expect(sold.resultUntil).not.toBeNull();
    expect(currentLot(sold)!.status).toBe('sold');

    nowRef.value += 60_000;
    expect(tickRooms(store, nowRef.value)).toEqual([code]);

    const next = store.get(code)!.state;
    expect(next.resultUntil).toBeNull();
    expect(currentLot(next)!.lotNo).toBe(2);
  });

  it('bosta duran lobiye dokunmaz', () => {
    const nowRef = { value: 1_000_000 };
    const store = createRoomStore({ now: () => nowRef.value });
    store.create({ teamName: 'A', items });
    expect(tickRooms(store, nowRef.value + 10 * 60_000)).toEqual([]);
  });
});
