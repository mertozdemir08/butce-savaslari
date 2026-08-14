// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LotTicket } from '@/components/auction/LotTicket';
import { TeamLane } from '@/components/auction/TeamLane';
import { TeamRail } from '@/components/auction/TeamRail';
import { laneStatus } from '@/components/auction/laneStatus';
import type { GameState, Item, Lot, Team } from '@/lib/game/types';

afterEach(cleanup);

function team(id: string, name: string, seat: number, extra: Partial<Team> = {}): Team {
  return { id, name, seat, budgetLeft: 6, itemsWon: 2, connected: true, ...extra };
}

function lotOf(extra: Partial<Lot> = {}): Lot {
  return {
    id: 'lot-1',
    itemId: 'i-1',
    lotNo: 7,
    status: 'open',
    currentBid: 4,
    currentBidderTeamId: 't-b',
    turnTeamId: 't-a',
    turnSeq: 3,
    turnDeadline: new Date().toISOString(),
    openerTeamId: 't-a',
    activeTeamIds: ['t-a', 't-b'],
    log: [],
    winnerTeamId: null,
    finalPrice: null,
    ...extra,
  };
}

function stateOf(teams: Team[], extra: Partial<GameState> = {}): GameState {
  return {
    roomId: 'AB23', code: 'AB23', status: 'auction', budget: 10, itemLimit: 5,
    turnSeconds: 30, hostTeamId: 't-a', teams,
    items: [{ id: 'i-1', name: 'Ev', imageUrl: null }],
    lots: [], currentLotId: 'lot-1', nextItemIndex: 1, openerSeat: 1,
    resultUntil: null, votes: [], ...extra,
  };
}

describe('LotTicket', () => {
  const item: Item = { id: 'i-1', name: 'Ev', imageUrl: null };

  it('lot numarasini ve urun adini gosterir', () => {
    render(<LotTicket lot={lotOf()} item={item} bidderName="TAKIM B" />);
    expect(screen.getByText('LOT NO. 07')).toBeTruthy();
    expect(screen.getByText('Ev')).toBeTruthy();
  });

  it('mevcut teklifi ve sahibini gosterir', () => {
    render(<LotTicket lot={lotOf()} item={item} bidderName="TAKIM B" />);
    expect(screen.getByTestId('current-bid').textContent).toBe('4');
    expect(screen.getByText('TAKIM B')).toBeTruthy();
  });

  it('teklif yoksa tire gosterir', () => {
    const fresh = lotOf({ currentBid: null, currentBidderTeamId: null });
    render(<LotTicket lot={fresh} item={item} bidderName={null} />);
    expect(screen.getByTestId('current-bid').textContent).toBe('-');
  });

  it('gorsel yoksa lot numarasini tipografik yedek olarak koyar', () => {
    render(<LotTicket lot={lotOf()} item={item} bidderName={null} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByTestId('image-fallback').textContent).toBe('07');
  });

  it('gorsel varsa alt metniyle resim gosterir', () => {
    const withImage: Item = { ...item, imageUrl: '/packs/x/ev.jpg' };
    render(<LotTicket lot={lotOf()} item={withImage} bidderName={null} />);
    expect(screen.getByRole('img').getAttribute('alt')).toBe('Ev');
    expect(screen.queryByTestId('image-fallback')).toBeNull();
  });

  it('damga verilmediginde gorunmez, verildiginde gorunur', () => {
    const { rerender } = render(<LotTicket lot={lotOf()} item={item} bidderName={null} />);
    expect(screen.queryByTestId('stamp')).toBeNull();

    rerender(
      <LotTicket lot={lotOf()} item={item} bidderName={null} stamp={{ text: 'SATILDI' }} />,
    );
    expect(screen.getByTestId('stamp').textContent).toBe('SATILDI');
  });
});

describe('laneStatus', () => {
  const teams = [team('t-a', 'A', 0), team('t-b', 'B', 1), team('t-c', 'C', 2)];

  it('sirasi gelen takimi isaretler', () => {
    expect(laneStatus(stateOf(teams), lotOf(), 't-a')).toMatchObject({ kind: 'turn' });
  });

  it('onde olan takimin teklifini yazar', () => {
    expect(laneStatus(stateOf(teams), lotOf(), 't-b')).toMatchObject({
      kind: 'leading',
      label: '4 VERDİ',
    });
  });

  it('pas gecen takimi PAS olarak isaretler', () => {
    const lot = lotOf({
      activeTeamIds: ['t-a', 't-b'],
      log: [{ teamId: 't-c', kind: 'pass', amount: null, at: 'x' }],
    });
    expect(laneStatus(stateOf(teams), lot, 't-c')).toMatchObject({ label: 'PAS' });
  });

  it('suresi dolan takimi ayirt eder', () => {
    const lot = lotOf({
      activeTeamIds: ['t-a', 't-b'],
      log: [{ teamId: 't-c', kind: 'auto_pass', amount: null, at: 'x' }],
    });
    expect(laneStatus(stateOf(teams), lot, 't-c')).toMatchObject({ label: 'SÜRE DOLDU' });
  });

  it('limiti dolu oldugu icin hic siraya girmemis takimi ayirt eder', () => {
    const full = [team('t-a', 'A', 0), team('t-b', 'B', 1), team('t-c', 'C', 2, { itemsWon: 5 })];
    const lot = lotOf({ activeTeamIds: ['t-a', 't-b'], log: [] });
    expect(laneStatus(stateOf(full), lot, 't-c')).toMatchObject({ label: 'LİMİT DOLU' });
  });

  it('lot yokken bos etiket doner', () => {
    expect(laneStatus(stateOf(teams), null, 't-a')).toMatchObject({ kind: 'idle', label: '' });
  });
});

describe('TeamLane', () => {
  it('adi, butceyi ve limit gostergesini cizer', () => {
    render(
      <TeamLane
        team={team('t-a', 'A', 0)}
        itemLimit={5}
        isMe
        isTurn={false}
        isOut={false}
        status={{ kind: 'waiting', label: 'BEKLİYOR' }}
      won={[]}
      />,
    );
    expect(screen.getByText('TAKIM A')).toBeTruthy();
    expect(screen.getByTestId('lane-budget').textContent).toBe('6');
    expect(screen.getByTestId('lane-pips').children).toHaveLength(5);
    expect(screen.getByTestId('lane-pips').querySelectorAll('[data-filled="true"]')).toHaveLength(2);
    expect(screen.getByTestId('lane').dataset.me).toBe('true');
  });

  it('elenen takimin adinin ustunu cizer ve sebebini yazar', () => {
    render(
      <TeamLane
        team={team('t-a', 'A', 0)}
        itemLimit={5}
        isMe={false}
        isTurn={false}
        isOut
        status={{ kind: 'passed', label: 'PAS' }}
      won={[]}
      />,
    );
    // Renk tek basina bilgi tasimaz: hem ustu cizili hem PAS yazili.
    expect(screen.getByText('TAKIM A').className).toContain('line-through');
    expect(screen.getByText('PAS')).toBeTruthy();
    expect(screen.getByTestId('lane').dataset.out).toBe('true');
  });

  it('baglantisi kopan takimda durum yerine uyari yazar', () => {
    render(
      <TeamLane
        team={team('t-a', 'A', 0, { connected: false })}
        itemLimit={5}
        isMe={false}
        isTurn={false}
        isOut={false}
        status={{ kind: 'waiting', label: 'BEKLİYOR' }}
      won={[]}
      />,
    );
    expect(screen.getByText('BAĞLANTI YOK')).toBeTruthy();
    expect(screen.queryByText('BEKLİYOR')).toBeNull();
  });
});

describe('TeamRail', () => {
  it('takimlari koltuk sirasiyla dizer ve kutugu ekler', () => {
    const teams = [team('t-b', 'B', 1), team('t-a', 'A', 0)];
    const lot = lotOf({ log: [{ teamId: 't-b', kind: 'bid', amount: 4, at: 'x' }] });
    render(<TeamRail state={stateOf(teams)} lot={lot} meId="t-a" />);

    const lanes = screen.getAllByTestId('lane');
    expect(lanes[0].textContent).toContain('TAKIM A');
    expect(lanes[1].textContent).toContain('TAKIM B');
    expect(screen.getAllByTestId('log-row')).toHaveLength(1);
  });

  it('withLog kapaliyken kutugu cizmez', () => {
    render(<TeamRail state={stateOf([team('t-a', 'A', 0)])} lot={lotOf()} meId="t-a" withLog={false} />);
    expect(screen.queryByText('BU LOTTA')).toBeNull();
  });

  it('kutuk bos oldugunda bos durum yazar', () => {
    render(<TeamRail state={stateOf([team('t-a', 'A', 0)])} lot={lotOf()} meId="t-a" />);
    expect(screen.getByText('Henüz hamle yok.')).toBeTruthy();
  });
});
