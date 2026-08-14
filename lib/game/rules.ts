import {
  DEFAULT_BUDGET,
  DEFAULT_ITEM_LIMIT,
  DEFAULT_TURN_SECONDS,
  MAX_TEAMS,
  MIN_TEAMS,
  RESULT_MS,
} from './constants';
import {
  canAfford,
  err,
  findTeam,
  hasRoom,
  minBid,
  openLot,
  teamAtSeat,
  withLot,
  withTeam,
} from './helpers';
import type {
  Action,
  ApplyResult,
  CreateGameInput,
  Ctx,
  GameEvent,
  GameState,
  Lot,
} from './types';

export function createGame(input: CreateGameInput): GameState {
  const budget = input.budget ?? DEFAULT_BUDGET;
  return {
    roomId: input.roomId,
    code: input.code,
    status: 'lobby',
    budget,
    itemLimit: input.itemLimit ?? DEFAULT_ITEM_LIMIT,
    turnSeconds: input.turnSeconds ?? DEFAULT_TURN_SECONDS,
    hostTeamId: input.hostTeamId,
    teams: [
      {
        id: input.hostTeamId,
        name: input.hostTeamName,
        seat: 0,
        budgetLeft: budget,
        itemsWon: 0,
        connected: true,
      },
    ],
    items: [],
    lots: [],
    currentLotId: null,
    nextItemIndex: 0,
    openerSeat: 0,
    resultUntil: null,
    votes: [],
  };
}

/** Sonraki lotu acar; urun ya da yer kalmadiysa oyunu bitirir. */
function openNextLot(state: GameState, ctx: Ctx): { state: GameState; events: GameEvent[] } {
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
function resolveTurn(
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
    // Teklif yok: en son pas gecen takim devralir.
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
  const status = state.teams.length >= 3 ? 'voting' : 'finished';
  const events: GameEvent[] = [{ type: 'GAME_ENDED' }];
  if (status === 'voting') events.push({ type: 'VOTING_STARTED' });
  return {
    state: { ...state, status, currentLotId: null, resultUntil: null },
    events,
  };
}

export function applyAction(state: GameState, action: Action, ctx: Ctx): ApplyResult {
  switch (action.type) {
    case 'JOIN': {
      if (state.status !== 'lobby') return err('WRONG_STATUS', 'Oyun baslamis.');
      if (state.teams.length >= MAX_TEAMS) return err('ROOM_FULL', 'Oda dolu.');
      const seat = state.teams.length;
      return {
        ok: true,
        state: {
          ...state,
          teams: [
            ...state.teams,
            {
              id: action.teamId,
              name: action.name,
              seat,
              budgetLeft: state.budget,
              itemsWon: 0,
              connected: true,
            },
          ],
        },
        events: [{ type: 'TEAM_JOINED', teamId: action.teamId }],
      };
    }

    case 'SET_ITEMS': {
      if (state.status !== 'lobby') return err('WRONG_STATUS', 'Oyun baslamis.');
      if (action.byTeamId !== state.hostTeamId) return err('NOT_HOST', 'Yalnizca oda sahibi.');
      return { ok: true, state: { ...state, items: action.items }, events: [] };
    }

    case 'START_GAME': {
      if (state.status !== 'lobby') return err('WRONG_STATUS', 'Oyun baslamis.');
      if (action.byTeamId !== state.hostTeamId) return err('NOT_HOST', 'Yalnizca oda sahibi.');
      if (state.teams.length < MIN_TEAMS) return err('NOT_ENOUGH_TEAMS', 'En az 2 takim gerekli.');
      if (state.items.length === 0) return err('NO_ITEMS', 'Urun listesi bos.');
      const started = openNextLot({ ...state, status: 'auction' }, ctx);
      return { ok: true, state: started.state, events: started.events };
    }

    case 'BID': {
      if (state.status !== 'auction') return err('WRONG_STATUS', 'Acik artirma surmuyor.');
      const lot = openLot(state);
      if (!lot) return err('LOT_NOT_OPEN', 'Acik lot yok.');
      if (lot.turnTeamId !== action.teamId) return err('NOT_YOUR_TURN', 'Sira sizde degil.');
      if (lot.turnSeq !== action.turnSeq) return err('STALE_TURN', 'Bu tur gecti.');

      const team = findTeam(state, action.teamId);
      if (!team) return err('UNKNOWN_TEAM', 'Takim bulunamadi.');
      if (!Number.isInteger(action.amount) || action.amount < minBid(lot)) {
        return err('BID_TOO_LOW', `En az ${minBid(lot)} verilmeli.`);
      }
      if (action.amount > team.budgetLeft) {
        return err('BID_OVER_BUDGET', `Butceniz ${team.budgetLeft}.`);
      }

      const bidded = withLot(state, {
        ...lot,
        currentBid: action.amount,
        currentBidderTeamId: team.id,
        log: [
          ...lot.log,
          { teamId: team.id, kind: 'bid', amount: action.amount, at: ctx.now.toISOString() },
        ],
      });

      const placed: GameEvent = {
        type: 'BID_PLACED',
        lotId: lot.id,
        teamId: team.id,
        amount: action.amount,
      };
      const resolved = resolveTurn(bidded, lot.id, team.seat + 1, ctx);
      return { ok: true, state: resolved.state, events: [placed, ...resolved.events] };
    }

    case 'PASS': {
      if (state.status !== 'auction') return err('WRONG_STATUS', 'Acik artirma surmuyor.');
      const lot = openLot(state);
      if (!lot) return err('LOT_NOT_OPEN', 'Acik lot yok.');
      if (lot.turnTeamId !== action.teamId) return err('NOT_YOUR_TURN', 'Sira sizde degil.');
      if (lot.turnSeq !== action.turnSeq) return err('STALE_TURN', 'Bu tur gecti.');

      const team = findTeam(state, action.teamId);
      if (!team) return err('UNKNOWN_TEAM', 'Takim bulunamadi.');

      const passed = withLot(state, {
        ...lot,
        activeTeamIds: lot.activeTeamIds.filter((id) => id !== team.id),
        log: [
          ...lot.log,
          { teamId: team.id, kind: 'pass', amount: null, at: ctx.now.toISOString() },
        ],
      });

      const ev: GameEvent = { type: 'TEAM_PASSED', lotId: lot.id, teamId: team.id, auto: false };
      const resolved = resolveTurn(passed, lot.id, team.seat + 1, ctx);
      return { ok: true, state: resolved.state, events: [ev, ...resolved.events] };
    }

    case 'TIMEOUT': {
      // Bu aksiyon idempotenttir: uygulanabilir degilse hata degil, bos sonuc doner.
      // Odadaki her istemci ayni anda cagirabilir.
      const noop = { ok: true as const, state, events: [] as GameEvent[] };

      if (state.status !== 'auction') return noop;
      const lot = openLot(state);
      if (!lot || lot.id !== action.lotId) return noop;
      if (lot.turnSeq !== action.turnSeq) return noop;
      if (!lot.turnDeadline) return noop;
      if (ctx.now.getTime() < new Date(lot.turnDeadline).getTime()) return noop;
      if (!lot.turnTeamId) return noop;

      const team = findTeam(state, lot.turnTeamId);
      if (!team) return noop;

      const passed = withLot(state, {
        ...lot,
        activeTeamIds: lot.activeTeamIds.filter((id) => id !== team.id),
        log: [
          ...lot.log,
          { teamId: team.id, kind: 'auto_pass', amount: null, at: ctx.now.toISOString() },
        ],
      });

      const ev: GameEvent = { type: 'TEAM_PASSED', lotId: lot.id, teamId: team.id, auto: true };
      const resolved = resolveTurn(passed, lot.id, team.seat + 1, ctx);
      return { ok: true, state: resolved.state, events: [ev, ...resolved.events] };
    }

    default:
      return err('WRONG_STATUS', 'Bu aksiyon henuz desteklenmiyor.');
  }
}
