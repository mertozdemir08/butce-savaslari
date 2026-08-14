import { describe, it, expect } from 'vitest';
import { shuffle } from '@/lib/server/shuffle';

describe('shuffle', () => {
  it('kaynak diziyi degistirmez', () => {
    const source = [1, 2, 3, 4];
    shuffle(source, () => 0);
    expect(source).toEqual([1, 2, 3, 4]);
  });

  it('tum elemanlari korur', () => {
    const source = Array.from({ length: 20 }, (_, i) => i);
    const out = shuffle(source);
    expect([...out].sort((a, b) => a - b)).toEqual(source);
  });

  it('verilen rastgelelik kaynagiyla belirlenimli calisir', () => {
    // random() hep 0 doner: her adimda sondaki eleman bastakiyle takas edilir.
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
  });

  it('bos ve tek elemanli diziyi aynen doner', () => {
    expect(shuffle([], () => 0)).toEqual([]);
    expect(shuffle([7], () => 0)).toEqual([7]);
  });
});
