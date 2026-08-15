// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';

// ResultScreen next/navigation kullaniyor; jsdom'da router monte degil.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { BidBar } from '@/components/auction/BidBar';
import { stampText } from '@/components/auction/LotResult';
import { VoteScreen } from '@/components/vote/VoteScreen';
import { ResultScreen } from '@/components/result/ResultScreen';
import { moveItem, wonItems } from '@/components/result/collection';
import { parseItemLines } from '@/components/setup/itemLines';
import { SetupForm } from '@/components/setup/SetupForm';
import { PACKS } from '@/lib/packs';
import type { GameState, Lot, Team } from '@/lib/game/types';

afterEach(cleanup);

function team(id: string, name: string, seat: number, extra: Partial<Team> = {}): Team {
  return { id, name, seat, budgetLeft: 5, itemsWon: 1, connected: true, ...extra };
}

function soldLot(id: string, itemId: string, winner: string, price: number): Lot {
  return {
    id, itemId, lotNo: 1, status: 'sold', currentBid: price || null,
    currentBidderTeamId: price ? winner : null, turnTeamId: null, turnSeq: 2,
    turnDeadline: null, openerTeamId: 't-a', activeTeamIds: [], log: [],
    winnerTeamId: winner, finalPrice: price,
  };
}

/** Kimse teklif vermedi: urun acan takima bedelsiz yazildi. */
function grantedLot(id: string, itemId: string): Lot {
  return { ...soldLot(id, itemId, 't-a', 0), status: 'granted', finalPrice: 0 };
}

function stateOf(teams: Team[], extra: Partial<GameState> = {}): GameState {
  return {
    roomId: 'AB23', code: 'AB23', status: 'finished', budget: 10, itemLimit: 5,
    turnSeconds: 30, hostTeamId: 't-a', teams,
    items: [
      { id: 'i-1', name: 'Ev', imageUrl: null },
      { id: 'i-2', name: 'Araba', imageUrl: null },
    ],
    lots: [soldLot('l-1', 'i-1', 't-a', 4), soldLot('l-2', 'i-2', 't-b', 2)],
    currentLotId: null, nextItemIndex: 2, openerSeat: 0, resultUntil: null,
    votes: [], ...extra,
  };
}

describe('parseItemLines', () => {
  it('her satiri bir urun okur, bos satirlari atar', () => {
    expect(parseItemLines('Ev\n\n  \nAraba')).toEqual([{ name: 'Ev' }, { name: 'Araba' }]);
  });

  it('dikey cizgiden sonra gorsel adresi alir ve kirpar', () => {
    expect(parseItemLines('  Ev  |  /packs/x/ev.jpg  ')).toEqual([
      { name: 'Ev', imageUrl: '/packs/x/ev.jpg' },
    ]);
  });

  it('bos gorsel alanini yok sayar', () => {
    expect(parseItemLines('Ev |')).toEqual([{ name: 'Ev' }]);
  });

  it('bos metin icin bos dizi doner', () => {
    expect(parseItemLines('   ')).toEqual([]);
  });
});

describe('SetupForm kategori secimi', () => {
  const pack = PACKS.find((p) => p.items.some((i) => i.imageUrl))!;

  function renderForm() {
    render(<SetupForm onSubmit={vi.fn()} busy={false} error={null} />);
  }

  it('hazir kategori secilince urun metin alani kapanir', () => {
    renderForm();
    expect(screen.getByLabelText('ÜRÜNLER')).toBeTruthy();
    act(() => {
      screen.getByText(pack.name).click();
    });
    expect(screen.queryByLabelText('ÜRÜNLER')).toBeNull();
  });

  it('hazir kategoride sadece urun adlari gorunur, gorsel yolu gorunmez', () => {
    renderForm();
    act(() => {
      screen.getByText(pack.name).click();
    });
    const rows = screen.getAllByTestId('pack-item').map((el) => el.textContent);
    expect(rows).toEqual(pack.items.map((i) => i.name));
    for (const item of pack.items) {
      if (item.imageUrl) expect(document.body.textContent).not.toContain(item.imageUrl);
    }
  });

  it('kendi kategorin secilince bos metin alani doner', () => {
    renderForm();
    act(() => {
      screen.getByText(pack.name).click();
    });
    act(() => {
      screen.getByText('Kendi kategorin').click();
    });
    const field = screen.getByLabelText('ÜRÜNLER') as HTMLTextAreaElement;
    expect(field.value).toBe('');
  });
});

describe('moveItem', () => {
  it('yukari ve asagi tasir', () => {
    expect(moveItem(['a', 'b', 'c'], 1, 0)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });

  it('sinir disinda listeyi degistirmez', () => {
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 2)).toEqual(['a', 'b']);
  });
});

describe('wonItems', () => {
  it('takimin kazandigi lotlari fiyatlariyla doner', () => {
    const s = stateOf([team('t-a', 'A', 0), team('t-b', 'B', 1)]);
    expect(wonItems(s, 't-a')).toEqual([{ name: 'Ev', price: 4 }]);
    expect(wonItems(s, 't-b')).toEqual([{ name: 'Araba', price: 2 }]);
  });
});

describe('stampText', () => {
  it('teklifle satista fiyati yazar', () => {
    const w = team('t-b', 'B', 1);
    expect(stampText(soldLot('l', 'i', 't-b', 4), w)).toBe('SATILDI · TAKIM B · 4');
  });

  it('teklif gelmediyse bedelsiz devri yazar', () => {
    expect(stampText(grantedLot('l', 'i'), team('t-a', 'A', 0))).toBe('BEDELSİZ · TAKIM A');
  });

  it('em dash kullanmaz', () => {
    expect(stampText(soldLot('l', 'i', 't-b', 4), team('t-b', 'B', 1))).not.toContain('—');
  });
});

describe('BidBar', () => {
  const press = (key: string) =>
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    });

  it('asgari teklifle acilir ve ipucunu yazar', () => {
    render(<BidBar minBid={5} maxBid={9} disabled={false} onBid={() => {}} onPass={() => {}} />);
    expect(screen.getByTestId('stepper-value').textContent).toBe('5');
    expect(screen.getByTestId('bid-hint').textContent).toContain('EN AZ 5');
    expect(screen.getByTestId('bid-hint').textContent).toContain('BÜTÇEN 9');
  });

  it('klavye: ok tuslari ayarlar, Enter teklif verir, P pas gecer', () => {
    const onBid = vi.fn();
    const onPass = vi.fn();
    render(<BidBar minBid={5} maxBid={9} disabled={false} onBid={onBid} onPass={onPass} />);

    press('ArrowUp');
    expect(screen.getByTestId('stepper-value').textContent).toBe('6');
    press('ArrowDown');
    expect(screen.getByTestId('stepper-value').textContent).toBe('5');

    press('Enter');
    expect(onBid).toHaveBeenCalledWith(5);
    press('p');
    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it('devre disiyken klavye is yapmaz', () => {
    const onBid = vi.fn();
    const onPass = vi.fn();
    render(<BidBar minBid={5} maxBid={9} disabled onBid={onBid} onPass={onPass} />);
    press('Enter');
    press('p');
    expect(onBid).not.toHaveBeenCalled();
    expect(onPass).not.toHaveBeenCalled();
  });

  it('butce yetmiyorsa yalnizca pas birakir', () => {
    render(<BidBar minBid={5} maxBid={3} disabled={false} onBid={() => {}} onPass={() => {}} />);
    const bid = screen.getByRole('button', { name: /TEKLİF VER/i }) as HTMLButtonElement;
    expect(bid.disabled).toBe(true);
    expect(screen.getByTestId('bid-hint').textContent).toContain('BÜTÇEN YETMİYOR');
  });

  it('asgari teklif degisince degeri yeniler', () => {
    const { rerender } = render(
      <BidBar minBid={5} maxBid={9} disabled={false} onBid={() => {}} onPass={() => {}} />,
    );
    rerender(<BidBar minBid={7} maxBid={9} disabled={false} onBid={() => {}} onPass={() => {}} />);
    expect(screen.getByTestId('stepper-value').textContent).toBe('7');
  });
});

describe('VoteScreen', () => {
  const teams = [team('t-a', 'A', 0), team('t-b', 'B', 1), team('t-c', 'C', 2)];
  const voting = () => stateOf(teams, { status: 'voting' });

  it('kendisi disindaki takimlari siralar ve kendi satirini devre disi gosterir', () => {
    render(<VoteScreen state={voting()} me={teams[0]} error={null} onVote={() => {}} />);
    expect(screen.getAllByTestId('vote-row')).toHaveLength(2);
    expect(screen.getByTestId('self-row').textContent).toContain('OY VEREMEZ');
  });

  it('puan dagilimini gosterir', () => {
    render(<VoteScreen state={voting()} me={teams[0]} error={null} onVote={() => {}} />);
    expect(screen.getByText('2 PUAN')).toBeTruthy();
    expect(screen.getByText('1 PUAN')).toBeTruthy();
  });

  it('onaylayinca mevcut sirayi gonderir', () => {
    const onVote = vi.fn();
    render(<VoteScreen state={voting()} me={teams[0]} error={null} onVote={onVote} />);
    screen.getByRole('button', { name: /SIRALAMAYI ONAYLA/i }).click();
    expect(onVote).toHaveBeenCalledWith(['t-b', 't-c']);
  });

  it('yukari tasi dugmesi sirayi degistirir', () => {
    const onVote = vi.fn();
    render(<VoteScreen state={voting()} me={teams[0]} error={null} onVote={onVote} />);
    // setOrder bir React durumu; guncellemenin uygulanmasi icin act gerekir.
    act(() => screen.getByRole('button', { name: 'TAKIM C yukarı taşı' }).click());
    screen.getByRole('button', { name: /SIRALAMAYI ONAYLA/i }).click();
    expect(onVote).toHaveBeenCalledWith(['t-c', 't-b']);
  });

  it('oy verildikten sonra ilerlemeyi gosterir ve onay dugmesini kaldirir', () => {
    const voted = stateOf(teams, {
      status: 'voting',
      votes: [{ voterTeamId: 't-a', rankedTeamIds: ['t-b', 't-c'] }],
    });
    render(<VoteScreen state={voted} me={teams[0]} error={null} onVote={() => {}} />);
    expect(screen.getByTestId('vote-progress').textContent).toContain('3 TAKIMDAN 1');
    expect(screen.queryByRole('button', { name: /SIRALAMAYI ONAYLA/i })).toBeNull();
  });

  it('bir takimin kazandigi urunlerin hepsini yazar, kirpip +N yazmaz', () => {
    // B dort urun almis olsun: karar bu listeye dayaniyor, hepsi gorunmeli.
    const many = stateOf(teams, {
      status: 'voting',
      items: ['Ev', 'Araba', 'Şöhret', 'Zaman'].map((name, i) => ({
        id: `i-${i + 1}`,
        name,
        imageUrl: null,
      })),
      lots: ['i-1', 'i-2', 'i-3', 'i-4'].map((itemId, i) =>
        soldLot(`l-${i + 1}`, itemId, 't-b', 0),
      ),
    });

    render(<VoteScreen state={many} me={teams[0]} error={null} onVote={() => {}} />);
    const row = screen
      .getAllByTestId('vote-row')
      .find((el) => el.textContent?.includes('TAKIM B'))!;

    for (const name of ['Ev', 'Araba', 'Şöhret', 'Zaman']) {
      expect(row.textContent, name).toContain(name);
    }
    expect(row.textContent).not.toContain('+');
  });
});

describe('ResultScreen', () => {
  it('3 takimda oy varsa kazanani ilan eder', () => {
    const teams = [team('t-a', 'A', 0), team('t-b', 'B', 1), team('t-c', 'C', 2)];
    const s = stateOf(teams, {
      votes: [
        { voterTeamId: 't-c', rankedTeamIds: ['t-a', 't-b'] },
        { voterTeamId: 't-b', rankedTeamIds: ['t-a', 't-c'] },
        { voterTeamId: 't-a', rankedTeamIds: ['t-b', 't-c'] },
      ],
    });
    render(<ResultScreen state={s} me={teams[0]} />);
    expect(screen.getByTestId('winner').textContent).toContain('TAKIM A');
    expect(screen.getAllByTestId('standing-row')).toHaveLength(3);
  });

  it('kazanilan urunleri odenen fiyatlariyla listeler', () => {
    const teams = [team('t-a', 'A', 0), team('t-b', 'B', 1)];
    render(<ResultScreen state={stateOf(teams)} me={teams[0]} />);
    expect(screen.getByText('Ev')).toBeTruthy();
    expect(screen.getByText('Araba')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('2 takimda kazanan ilan etmez, vitrin notu gosterir', () => {
    const teams = [team('t-a', 'A', 0), team('t-b', 'B', 1)];
    render(<ResultScreen state={stateOf(teams)} me={teams[0]} />);
    expect(screen.queryByTestId('winner')).toBeNull();
    expect(screen.getByTestId('showcase-note').textContent).toContain('Karar sizin');
  });

  it('urun almayan takim icin bos durum yazar', () => {
    const teams = [team('t-a', 'A', 0), team('t-b', 'B', 1), team('t-c', 'C', 2, { itemsWon: 0 })];
    render(<ResultScreen state={stateOf(teams)} me={teams[0]} />);
    expect(screen.getByText('ÜRÜN YOK')).toBeTruthy();
  });
});
