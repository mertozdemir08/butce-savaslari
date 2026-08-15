import { MIN_VOTING_TEAMS, RESULT_MS } from './constants';
import { canAfford, findTeam, hasRoom, teamAtSeat, withLot, withTeam } from './helpers';
import type { Ctx, GameEvent, GameState, Lot, Team } from './types';

/**
 * Lot yasam dongusu gecisleri.
 *
 * Bu modul oyunun en ince kurallarini tasir: siranin nasil dondugu,
 * kimin elendigi ve lotun kime kaldigi. applyAction bu fonksiyonlari
 * cagirir; buradan applyAction'a geri bir bagimlilik YOKTUR.
 */

/**
 * Lotu acan takim: acilis koltugundan baslayarak yeri olan ilk takim.
 *
 * Butcesi yetmedigi icin otomatik pas gecilecek takimlar da sayilir. Bedelsiz
 * devir bu takima yazildigi icin onemli: sayilmasaydi parasi biten takim bir
 * daha hic devir alamaz, oyunun disina duserdi.
 *
 * Yalnizca openNextLot cagirir; oradaki "yer kalmadi" denetimi bir takimin
 * mutlaka bulunmasini garanti eder.
 */
function openerOf(state: GameState, startSeat: number): Team {
  const n = state.teams.length;
  return Array.from({ length: n }, (_, i) => teamAtSeat(state, (startSeat + i) % n)!).find((t) =>
    hasRoom(t, state),
  )!;
}

/** Sonraki lotu acar; urun ya da yer kalmadiysa oyunu bitirir. */
export function openNextLot(state: GameState, ctx: Ctx): { state: GameState; events: GameEvent[] } {
  const noItemsLeft = state.nextItemIndex >= state.items.length;
  const noRoomLeft = !state.teams.some((t) => hasRoom(t, state));
  if (noItemsLeft || noRoomLeft) return endGame(state);

  const item = state.items[state.nextItemIndex];
  const startSeat = state.openerSeat;

  const lot: Lot = {
    id: ctx.newId(),
    itemId: item.id,
    lotNo: state.lots.length + 1,
    status: 'open',
    currentBid: null,
    currentBidderTeamId: null,
    turnTeamId: null,
    turnSeq: 0,
    turnDeadline: null,
    openerTeamId: openerOf(state, startSeat).id,
    activeTeamIds: state.teams
      .filter((t) => hasRoom(t, state))
      .sort((a, b) => a.seat - b.seat)
      .map((t) => t.id),
    log: [],
    winnerTeamId: null,
    finalPrice: null,
  };

  const next: GameState = {
    ...state,
    lots: [...state.lots, lot],
    currentLotId: lot.id,
    nextItemIndex: state.nextItemIndex + 1,
    openerSeat: (state.openerSeat + 1) % state.teams.length,
    resultUntil: null,
  };

  const opened: GameEvent = {
    type: 'LOT_OPENED',
    lotId: lot.id,
    lotNo: lot.lotNo,
    itemId: lot.itemId,
  };

  const resolved = resolveTurn(next, lot.id, startSeat, ctx);
  return { state: resolved.state, events: [opened, ...resolved.events] };
}

/**
 * Siradaki uygun takimi bulur ve turu ona verir.
 * Parasi yetmeyen takimlari otomatik pas gecirerek atlar.
 * Uygun takim kalmadiysa lotu kapatir.
 */
export function resolveTurn(
  state: GameState,
  lotId: string,
  cursorSeat: number,
  ctx: Ctx,
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let s = state;
  let cursor = cursorSeat;
  const n = s.teams.length;

  // Her dongude en az bir takim aktiften cikar, bu yuzden n tur ust sinir.
  for (let guard = 0; guard <= n; guard++) {
    const lot = s.lots.find((l) => l.id === lotId)!;

    let candidate = null as null | { id: string; seat: number };
    for (let offset = 0; offset < n; offset++) {
      const seat = (cursor + offset) % n;
      const t = teamAtSeat(s, seat)!;
      if (!lot.activeTeamIds.includes(t.id)) continue;
      if (t.id === lot.currentBidderTeamId) continue;
      candidate = { id: t.id, seat: t.seat };
      break;
    }

    if (!candidate) {
      const closed = closeLot(s, lotId, ctx);
      return { state: closed.state, events: [...events, ...closed.events] };
    }

    const team = findTeam(s, candidate.id)!;

    if (!canAfford(team, lot)) {
      const passed: Lot = {
        ...lot,
        activeTeamIds: lot.activeTeamIds.filter((id) => id !== team.id),
        log: [
          ...lot.log,
          { teamId: team.id, kind: 'auto_pass', amount: null, at: ctx.now.toISOString() },
        ],
      };
      s = withLot(s, passed);
      events.push({ type: 'TEAM_PASSED', lotId, teamId: team.id, auto: true });
      cursor = candidate.seat + 1;
      continue;
    }

    const deadline = new Date(ctx.now.getTime() + s.turnSeconds * 1000).toISOString();
    const turned: Lot = {
      ...lot,
      turnTeamId: team.id,
      turnSeq: lot.turnSeq + 1,
      turnDeadline: deadline,
    };
    s = withLot(s, turned);
    events.push({ type: 'TURN_CHANGED', lotId, teamId: team.id, deadline });
    return { state: s, events };
  }

  const closed = closeLot(s, lotId, ctx);
  return { state: closed.state, events: [...events, ...closed.events] };
}

/**
 * Lotu kapatir. Teklif varsa teklif sahibine satar; hic teklif gelmediyse
 * urun acan takima bedelsiz yazilir.
 *
 * Bedelsiz devir bir sure "urun yanar, kimseye gitmez" kuralina birakmisti;
 * o kural pas gecmeyi bedelsiz hale getiriyordu. Simdi pas gecmek bir kumar:
 * rakip de pas gecerse urun istemesen de senin olur ve bir yuvani yer. Ayrica
 * her lot birine bir urun yazdigi icin oyun mutlaka biter — herkesin butcesi
 * bittiginde ard arda yanan lotlar zinciri artik olusamaz.
 *
 * Devir alan takimin butcesi degismez: fiyat 0'dir, parasi bitmis takim da
 * alabilir.
 */
function closeLot(
  state: GameState,
  lotId: string,
  ctx: Ctx,
): { state: GameState; events: GameEvent[] } {
  const lot = state.lots.find((l) => l.id === lotId)!;
  const resultUntil = new Date(ctx.now.getTime() + RESULT_MS).toISOString();

  if (lot.currentBid === null || lot.currentBidderTeamId === null) {
    const receiver = findTeam(state, lot.openerTeamId)!;
    let s = withTeam(state, { ...receiver, itemsWon: receiver.itemsWon + 1 });
    s = withLot(s, {
      ...lot,
      status: 'granted',
      turnTeamId: null,
      turnDeadline: null,
      winnerTeamId: receiver.id,
      finalPrice: 0,
    });
    return {
      state: { ...s, resultUntil },
      events: [{ type: 'LOT_GRANTED', lotId, teamId: receiver.id }],
    };
  }

  const winner = findTeam(state, lot.currentBidderTeamId)!;
  const price = lot.currentBid;

  let s = withTeam(state, {
    ...winner,
    itemsWon: winner.itemsWon + 1,
    budgetLeft: winner.budgetLeft - price,
  });

  s = withLot(s, {
    ...lot,
    status: 'sold',
    turnTeamId: null,
    turnDeadline: null,
    winnerTeamId: winner.id,
    finalPrice: price,
  });

  return {
    state: { ...s, resultUntil },
    events: [{ type: 'LOT_SOLD', lotId, winnerTeamId: winner.id, price }],
  };
}

function endGame(state: GameState): { state: GameState; events: GameEvent[] } {
  const status = state.teams.length >= MIN_VOTING_TEAMS ? 'voting' : 'finished';
  const events: GameEvent[] = [{ type: 'GAME_ENDED' }];
  if (status === 'voting') events.push({ type: 'VOTING_STARTED' });
  return {
    state: { ...state, status, currentLotId: null, resultUntil: null },
    events,
  };
}
