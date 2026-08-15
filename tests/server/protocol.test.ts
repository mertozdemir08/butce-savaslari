import { describe, it, expect } from 'vitest';
import {
  MAX_BUDGET,
  MAX_ITEMS,
  MAX_ITEM_LIMIT,
  MAX_ITEM_NAME,
  MAX_TURN_SECONDS,
  MIN_BUDGET,
  MIN_ITEM_LIMIT,
  MIN_TURN_SECONDS,
} from '@/lib/game/constants';
import { parseClientMessage, toItems } from '@/lib/server/protocol';

describe('parseClientMessage - kabul', () => {
  it('create mesajini kabul eder', () => {
    const m = parseClientMessage({
      t: 'create',
      teamName: 'A',
      budget: 10,
      itemLimit: 5,
      turnSeconds: 30,
      items: [{ name: 'Ev' }],
    });
    expect(m?.t).toBe('create');
  });

  it('join, resume, start, bid, pass, timeout, advance, vote kabul eder', () => {
    const cases: unknown[] = [
      { t: 'join', code: 'AB23', teamName: 'B' },
      { t: 'resume', code: 'AB23', teamId: 't-a', token: 'x'.repeat(32) },
      { t: 'start' },
      { t: 'bid', amount: 3, turnSeq: 1 },
      { t: 'pass', turnSeq: 1 },
      { t: 'timeout', lotId: 'lot-1', turnSeq: 1 },
      { t: 'advance' },
      { t: 'vote', rankedTeamIds: ['t-b', 't-c'] },
    ];
    for (const c of cases) {
      expect(parseClientMessage(c), JSON.stringify(c)).not.toBeNull();
    }
  });

  it('oda kodunu buyuk harfe cevirir', () => {
    const m = parseClientMessage({ t: 'join', code: 'ab23', teamName: 'B' });
    expect(m).toMatchObject({ t: 'join', code: 'AB23' });
  });

  it('takim adini kirpar', () => {
    const m = parseClientMessage({ t: 'join', code: 'AB23', teamName: '  B  ' });
    expect(m).toMatchObject({ teamName: 'B' });
  });
});

describe('parseClientMessage - ret', () => {
  it('dizi, null ve ilkel degerleri reddeder', () => {
    for (const bad of [null, undefined, 42, 'merhaba', [], true]) {
      expect(parseClientMessage(bad)).toBeNull();
    }
  });

  it('bilinmeyen mesaj tipini reddeder', () => {
    expect(parseClientMessage({ t: 'diskoya-git' })).toBeNull();
    expect(parseClientMessage({})).toBeNull();
  });

  it('eksik alanli mesaji reddeder', () => {
    expect(parseClientMessage({ t: 'join', code: 'AB23' })).toBeNull();
    expect(parseClientMessage({ t: 'bid', amount: 3 })).toBeNull();
    expect(parseClientMessage({ t: 'timeout', turnSeq: 1 })).toBeNull();
  });

  it('yanlis tipteki alani reddeder', () => {
    expect(parseClientMessage({ t: 'bid', amount: '3', turnSeq: 1 })).toBeNull();
    expect(parseClientMessage({ t: 'pass', turnSeq: 'bir' })).toBeNull();
    expect(parseClientMessage({ t: 'join', code: 'AB23', teamName: 7 })).toBeNull();
  });

  it('tam sayi olmayan teklifi reddeder', () => {
    expect(parseClientMessage({ t: 'bid', amount: 2.5, turnSeq: 1 })).toBeNull();
    expect(parseClientMessage({ t: 'bid', amount: Number.NaN, turnSeq: 1 })).toBeNull();
  });

  it('bos takim adini reddeder', () => {
    expect(parseClientMessage({ t: 'join', code: 'AB23', teamName: '   ' })).toBeNull();
  });

  it('yanlis uzunlukta oda kodunu reddeder', () => {
    expect(parseClientMessage({ t: 'join', code: 'AB2', teamName: 'B' })).toBeNull();
    expect(parseClientMessage({ t: 'join', code: 'AB234', teamName: 'B' })).toBeNull();
  });

  it('metin olmayan siralamayi reddeder', () => {
    expect(parseClientMessage({ t: 'vote', rankedTeamIds: [1, 2] })).toBeNull();
    expect(parseClientMessage({ t: 'vote', rankedTeamIds: 't-b' })).toBeNull();
  });

  it('cok uzun takim adini reddeder', () => {
    expect(parseClientMessage({ t: 'join', code: 'AB23', teamName: 'x'.repeat(40) })).toBeNull();
  });
});

describe('parseClientMessage - create ayar sinirlari', () => {
  const base = { t: 'create', teamName: 'A', budget: 10, itemLimit: 5, turnSeconds: 30, items: [] };

  it('araligin disindaki butceyi reddeder', () => {
    for (const budget of [0, -1, MAX_BUDGET + 1]) {
      expect(parseClientMessage({ ...base, budget }), String(budget)).toBeNull();
    }
  });

  it('araligin disindaki urun limitini reddeder', () => {
    for (const itemLimit of [0, -3, MAX_ITEM_LIMIT + 1]) {
      expect(parseClientMessage({ ...base, itemLimit }), String(itemLimit)).toBeNull();
    }
  });

  it('araligin disindaki tur suresini reddeder', () => {
    for (const turnSeconds of [0, MIN_TURN_SECONDS - 1, MAX_TURN_SECONDS + 1, 2 ** 31]) {
      expect(parseClientMessage({ ...base, turnSeconds }), String(turnSeconds)).toBeNull();
    }
  });

  it('sinir degerleri kabul eder', () => {
    const edges = [
      { budget: MIN_BUDGET, itemLimit: MIN_ITEM_LIMIT, turnSeconds: MIN_TURN_SECONDS },
      { budget: MAX_BUDGET, itemLimit: MAX_ITEM_LIMIT, turnSeconds: MAX_TURN_SECONDS },
    ];
    for (const edge of edges) {
      expect(parseClientMessage({ ...base, ...edge }), JSON.stringify(edge)).not.toBeNull();
    }
  });

  it('cok uzun urun listesini reddeder', () => {
    const items = Array.from({ length: MAX_ITEMS + 1 }, (_, i) => ({ name: `U${i}` }));
    expect(parseClientMessage({ ...base, items })).toBeNull();
    expect(parseClientMessage({ ...base, items: items.slice(0, MAX_ITEMS) })).not.toBeNull();
  });
});

describe('toItems', () => {
  it('ad ve gorsel cifti olan girdiyi cevirir', () => {
    const items = toItems([
      { name: 'Ev', imageUrl: 'https://ornek.test/ev.jpg' },
      { name: 'Araba' },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ name: 'Ev', imageUrl: 'https://ornek.test/ev.jpg' });
    expect(items[1].imageUrl).toBeNull();
    expect(items[0].id).not.toBe(items[1].id);
  });

  it('bos adlari atar ve adlari kirpar', () => {
    const items = toItems([{ name: '  ' }, { name: '  Ev  ' }]);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Ev');
  });

  it('http olmayan gorsel adresini yok sayar', () => {
    const items = toItems([
      { name: 'A', imageUrl: 'javascript:alert(1)' },
      { name: 'B', imageUrl: 'data:image/png;base64,xxx' },
      { name: 'C', imageUrl: 'bozuk' },
    ]);
    expect(items.every((i) => i.imageUrl === null)).toBe(true);
  });

  it('koke gore yolu kabul eder (repo icindeki paket gorselleri)', () => {
    const items = toItems([{ name: 'Ev', imageUrl: '/packs/hayat/ev.jpg' }]);
    expect(items[0].imageUrl).toBe('/packs/hayat/ev.jpg');
  });

  it('dizi olmayan girdide bos dizi doner', () => {
    expect(toItems('Ev' as unknown as unknown[])).toEqual([]);
  });

  it('cok uzun urun adini kirpar', () => {
    const items = toItems([{ name: 'A'.repeat(MAX_ITEM_NAME + 50) }]);
    expect(items[0].name).toHaveLength(MAX_ITEM_NAME);
  });

  it('protokole gore goreli gorsel adresini reddeder', () => {
    // "//baska.test/x.png" tek egik cizgiyle basliyor gibi gorunur ama
    // tarayici bunu dis siteden yukler.
    const items = toItems([{ name: 'A', imageUrl: '//baska.test/x.png' }]);
    expect(items[0].imageUrl).toBeNull();
  });

  it('cok uzun gorsel adresini yok sayar', () => {
    const items = toItems([{ name: 'A', imageUrl: `https://ornek.test/${'x'.repeat(400)}.jpg` }]);
    expect(items[0].imageUrl).toBeNull();
  });
});
