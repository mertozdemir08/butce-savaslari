import {
  DEFAULT_BUDGET,
  DEFAULT_ITEM_LIMIT,
  DEFAULT_TURN_SECONDS,
  MAX_TEAMS,
  MIN_TEAMS,
} from './constants';
import { err, findTeam, minBid, openLot, withLot } from './helpers';
import { openNextLot, resolveTurn } from './lot';
import type {
  Action,
  ApplyResult,
  CreateGameInput,
  Ctx,
  GameEvent,
  GameState,
  Team,
  Vote,
} from './types';

/**
 * Oylama bitti mi.
 *
 * Kopan takimlar beklenmez, yoksa biri sekmeyi kapattiginda oda sonsuza kadar
 * oylamada asili kalirdi. En az bir oy sarti, herkesin ayni anda dustugu
 * gecici bir kopmanin oyunu bitirmesini engeller.
 */
function votingDone(teams: Team[], votes: Vote[]): boolean {
  if (votes.length === 0) return false;
  const voted = new Set(votes.map((v) => v.voterTeamId));
  return teams.every((t) => !t.connected || voted.has(t.id));
}

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

export function applyAction(state: GameState, action: Action, ctx: Ctx): ApplyResult {
  switch (action.type) {
    case 'JOIN': {
      if (state.status !== 'lobby') return err('WRONG_STATUS', 'Oyun başlamış.');
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
      if (state.status !== 'lobby') return err('WRONG_STATUS', 'Oyun başlamış.');
      if (action.byTeamId !== state.hostTeamId) return err('NOT_HOST', 'Yalnızca oda sahibi.');
      return { ok: true, state: { ...state, items: action.items }, events: [] };
    }

    case 'START_GAME': {
      if (state.status !== 'lobby') return err('WRONG_STATUS', 'Oyun başlamış.');
      if (action.byTeamId !== state.hostTeamId) return err('NOT_HOST', 'Yalnızca oda sahibi.');
      if (state.teams.length < MIN_TEAMS) return err('NOT_ENOUGH_TEAMS', 'En az 2 takım gerekli.');
      if (state.items.length === 0) return err('NO_ITEMS', 'Ürün listesi boş.');
      const started = openNextLot({ ...state, status: 'auction' }, ctx);
      return { ok: true, state: started.state, events: started.events };
    }

    case 'BID': {
      if (state.status !== 'auction') return err('WRONG_STATUS', 'Açık artırma sürmüyor.');
      const lot = openLot(state);
      if (!lot) return err('LOT_NOT_OPEN', 'Açık lot yok.');
      if (lot.turnTeamId !== action.teamId) return err('NOT_YOUR_TURN', 'Sıra sizde değil.');
      if (lot.turnSeq !== action.turnSeq) return err('STALE_TURN', 'Bu tur geçti.');

      const team = findTeam(state, action.teamId);
      if (!team) return err('UNKNOWN_TEAM', 'Takım bulunamadı.');
      if (!Number.isInteger(action.amount) || action.amount < minBid(lot)) {
        return err('BID_TOO_LOW', `En az ${minBid(lot)} verilmeli.`);
      }
      if (action.amount > team.budgetLeft) {
        return err('BID_OVER_BUDGET', `Bütçeniz ${team.budgetLeft}.`);
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
      if (state.status !== 'auction') return err('WRONG_STATUS', 'Açık artırma sürmüyor.');
      const lot = openLot(state);
      if (!lot) return err('LOT_NOT_OPEN', 'Açık lot yok.');
      if (lot.turnTeamId !== action.teamId) return err('NOT_YOUR_TURN', 'Sıra sizde değil.');
      if (lot.turnSeq !== action.turnSeq) return err('STALE_TURN', 'Bu tur geçti.');

      const team = findTeam(state, action.teamId);
      if (!team) return err('UNKNOWN_TEAM', 'Takım bulunamadı.');

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

    case 'ADVANCE': {
      // Idempotent: sonuc koreografisi bitmediyse ya da bekleyen sonuc yoksa bos doner.
      if (!state.resultUntil) return { ok: true, state, events: [] };
      if (ctx.now.getTime() < new Date(state.resultUntil).getTime()) {
        return { ok: true, state, events: [] };
      }
      const next = openNextLot(state, ctx);
      return { ok: true, state: next.state, events: next.events };
    }

    case 'VOTE': {
      if (state.status !== 'voting') return err('WRONG_STATUS', 'Oylama aşaması değil.');
      if (!findTeam(state, action.teamId)) return err('UNKNOWN_TEAM', 'Takım bulunamadı.');
      if (state.votes.some((v) => v.voterTeamId === action.teamId)) {
        return err('ALREADY_VOTED', 'Zaten oy verdiniz.');
      }

      const expected = state.teams
        .filter((t) => t.id !== action.teamId)
        .map((t) => t.id)
        .sort();
      const given = [...action.rankedTeamIds].sort();
      const sameSet =
        expected.length === given.length && expected.every((id, i) => id === given[i]);
      if (!sameSet) {
        return err('INVALID_RANKING', 'Kendiniz dışındaki tüm takımlar bir kez sıralanmalı.');
      }

      const votes = [
        ...state.votes,
        { voterTeamId: action.teamId, rankedTeamIds: action.rankedTeamIds },
      ];
      return {
        ok: true,
        state: {
          ...state,
          votes,
          status: votingDone(state.teams, votes) ? 'finished' : 'voting',
        },
        events: [{ type: 'VOTE_CAST', teamId: action.teamId }],
      };
    }

    case 'SET_PRESENCE': {
      const online = new Set(action.onlineTeamIds);
      const changed = state.teams.some((t) => t.connected !== online.has(t.id));
      if (!changed) return { ok: true, state, events: [] };

      const teams = state.teams.map((t) => ({ ...t, connected: online.has(t.id) }));
      // Bagli bayraklari degisti: bu tek basina yayinlanmasi gereken bir degisiklik.
      // Olay yayinlamazsak durum sessizce degisir ve istemciler gormez.
      const events: GameEvent[] = [{ type: 'PRESENCE_CHANGED' }];

      // Host ayrildiysa yetki koltuk sirasindaki ilk bagli takima gecer.
      // Ayri bir "host talep et" adimi yok: devir kendiliginden olur,
      // boylece kimsenin karar vermesi gerekmez ve yaris durumu olusmaz.
      let hostTeamId = state.hostTeamId;
      const host = teams.find((t) => t.id === hostTeamId);
      if (host && !host.connected) {
        const successor = [...teams].sort((a, b) => a.seat - b.seat).find((t) => t.connected);
        if (successor) {
          hostTeamId = successor.id;
          events.push({ type: 'HOST_CHANGED', teamId: successor.id });
        }
      }

      // Oylamada bir takim sekmeyi kapatirsa kalanlar sonsuza kadar beklemesin:
      // bagli olan herkes oy verdiginde oylama biter.
      const status =
        state.status === 'voting' && votingDone(teams, state.votes)
          ? ('finished' as const)
          : state.status;

      return { ok: true, state: { ...state, teams, hostTeamId, status }, events };
    }

    default:
      return err('WRONG_STATUS', 'Bu işlem desteklenmiyor.');
  }
}
