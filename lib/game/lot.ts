import { MIN_VOTING_TEAMS, RESULT_MS } from './constants';
import { canAfford, findTeam, hasRoom, teamAtSeat, withLot, withTeam } from './helpers';
import type { Ctx, GameEvent, GameState, Lot } from './types';

/**
 * Lot yasam dongusu gecisleri.
 *
 * Bu modul oyunun en ince kurallarini tasir: siranin nasil dondugu,
 * kimin elendigi ve lotun kime kaldigi. applyAction bu fonksiyonlari
 * cagirir; buradan applyAction'a geri bir bagimlilik YOKTUR.
 */

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
    openerTeamId: null,
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

    // Teklif yokken tek aday kaldiysa lot zaten ona kalacak: teklif verse de
    // pas gecse de urun onun, tek fark bosa harcanan para. Tur acmak yerine
    // lotu burada kapatip bedelsiz devrediyoruz.
    if (lot.currentBid === null && lot.activeTeamIds.length === 1) {
      const closed = closeLot(s, lotId, ctx);
      return { state: closed.state, events: [...events, ...closed.events] };
    }

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
      openerTeamId: lot.openerTeamId ?? team.id,
    };
    s = withLot(s, turned);
    events.push({ type: 'TURN_CHANGED', lotId, teamId: team.id, deadline });
    return { state: s, events };
  }

  const closed = closeLot(s, lotId, ctx);
  return { state: closed.state, events: [...events, ...closed.events] };
}

/**
 * Lotu kapatir. Teklif varsa teklif sahibine satar,
 * yoksa en son pas gecen takima bedelsiz devreder.
 */
function closeLot(
  state: GameState,
  lotId: string,
  ctx: Ctx,
): { state: GameState; events: GameEvent[] } {
  const lot = state.lots.find((l) => l.id === lotId)!;

  let winnerId: string;
  let price: number;
  let free: boolean;

  if (lot.currentBid !== null && lot.currentBidderTeamId !== null) {
    winnerId = lot.currentBidderTeamId;
    price = lot.currentBid;
    free = false;
  } else {
    // Teklif yok. Hala aktif takim varsa lot erken kapanmistir (tek aday
    // kalmisti): urun onundur. Herkes pas gectiyse en son pas gecen devralir.
    const stillActive = lot.activeTeamIds
      .map((id) => findTeam(state, id)!)
      .sort((a, b) => a.seat - b.seat)[0];

    if (stillActive) {
      winnerId = stillActive.id;
    } else {
      const lastPass = [...lot.log].reverse().find((r) => r.kind !== 'bid');
      const startSeat = lastPass ? findTeam(state, lastPass.teamId)!.seat : state.openerSeat;
      const n = state.teams.length;
      let recipient = null as null | string;
      for (let i = 0; i < n; i++) {
        const t = teamAtSeat(state, (startSeat + i) % n)!;
        if (hasRoom(t, state)) {
          recipient = t.id;
          break;
        }
      }
      // openNextLot en az bir takimin yeri oldugunu garanti eder.
      winnerId = recipient!;
    }
    price = 0;
    free = true;
  }

  const winner = findTeam(state, winnerId)!;
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
    winnerTeamId: winnerId,
    finalPrice: price,
  });

  s = { ...s, resultUntil: new Date(ctx.now.getTime() + RESULT_MS).toISOString() };

  return {
    state: s,
    events: [{ type: 'LOT_SOLD', lotId, winnerTeamId: winnerId, price, free }],
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
