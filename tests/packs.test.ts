import { describe, it, expect } from 'vitest';
import { PACKS, getPack } from '@/lib/packs';
import { MIN_ITEMS } from '@/lib/game/constants';

describe('PACKS', () => {
  it('en az uc paket sunar', () => {
    expect(PACKS.length).toBeGreaterThanOrEqual(3);
  });

  it('her paketin benzersiz id si var', () => {
    const ids = PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('her paket asgari urun sayisini gecer', () => {
    for (const pack of PACKS) {
      expect(pack.items.length, pack.id).toBeGreaterThanOrEqual(MIN_ITEMS);
    }
  });

  it('paket icinde tekrar eden urun adi yok', () => {
    for (const pack of PACKS) {
      const names = pack.items.map((i) => i.name);
      expect(new Set(names).size, pack.id).toBe(names.length);
    }
  });

  it('her urun adi bos degil ve kirpilmis', () => {
    for (const pack of PACKS) {
      for (const item of pack.items) {
        expect(item.name.length).toBeGreaterThan(0);
        expect(item.name).toBe(item.name.trim());
      }
    }
  });

  it('paket ve urun adlari kullaniciya gorunur: em dash icermez', () => {
    for (const pack of PACKS) {
      expect(pack.name).not.toContain('—');
      for (const item of pack.items) expect(item.name).not.toContain('—');
    }
  });

  it('gorsel verilmisse koke gore yol ya da http adresidir', () => {
    for (const pack of PACKS) {
      for (const item of pack.items) {
        if (!item.imageUrl) continue;
        expect(
          item.imageUrl.startsWith('/') || /^https?:\/\//.test(item.imageUrl),
          `${pack.id}/${item.name}`,
        ).toBe(true);
      }
    }
  });
});

describe('getPack', () => {
  it('id ile paketi bulur', () => {
    expect(getPack(PACKS[0].id)?.name).toBe(PACKS[0].name);
  });

  it('bilinmeyen id icin undefined doner', () => {
    expect(getPack('yok')).toBeUndefined();
  });
});
