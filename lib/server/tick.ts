import { currentLot } from '@/lib/game';
import type { RoomStore } from './rooms';

/**
 * Sunucunun kendi saati.
 *
 * Tur suresinin dolmasi ve sonuc koreografisinin bitmesi eskiden yalnizca
 * tarayicilardan gelen TIMEOUT/ADVANCE mesajlariyla isliyordu. Telefonlar arka
 * plandaki sekmelerin zamanlayicilarini kisar; butun sekmeler arka plandaysa
 * oyun oldugu yerde donuyordu. Artik zamani sunucu yurutuyor, istemcilerinki
 * yalnizca yedek.
 *
 * Her iki aksiyon da idempotent oldugu icin istemciyle carpismasi sorun degil.
 *
 * Durumu degisen oda kodlarini doner; cagiran onlara yayin yapar.
 */
export function tickRooms(store: RoomStore, nowMs: number): string[] {
  const changed: string[] = [];

  for (const code of store.codes()) {
    const room = store.get(code);
    if (!room) continue;
    let touched = false;

    const lot = currentLot(room.state);
    const expired =
      room.state.status === 'auction' &&
      lot?.status === 'open' &&
      lot.turnDeadline !== null &&
      new Date(lot.turnDeadline).getTime() <= nowMs;

    if (expired && lot) {
      const outcome = store.apply(code, null, {
        type: 'TIMEOUT',
        lotId: lot.id,
        turnSeq: lot.turnSeq,
      });
      if (outcome.ok && outcome.events.length > 0) touched = true;
    }

    // Tur dolmasi lotu kapatmis olabilir; sonuc suresini guncel durumda okuruz.
    const after = store.get(code);
    if (after?.state.resultUntil && new Date(after.state.resultUntil).getTime() <= nowMs) {
      const outcome = store.apply(code, null, { type: 'ADVANCE' });
      if (outcome.ok && outcome.events.length > 0) touched = true;
    }

    if (touched) changed.push(code);
  }

  return changed;
}
