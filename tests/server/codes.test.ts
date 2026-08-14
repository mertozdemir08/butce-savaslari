import { describe, it, expect } from 'vitest';
import { generateCode, newToken } from '@/lib/server/codes';
import { CODE_ALPHABET, CODE_LENGTH } from '@/lib/game/constants';

describe('generateCode', () => {
  it('dogru uzunlukta ve yalnizca alfabeden karakter uretir', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toHaveLength(CODE_LENGTH);
      for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    }
  });

  it('karisabilen karakterleri hic uretmez', () => {
    const codes = Array.from({ length: 500 }, generateCode).join('');
    for (const banned of ['0', 'O', '1', 'I']) {
      expect(codes).not.toContain(banned);
    }
  });
});

describe('newToken', () => {
  it('yeterince uzun ve her cagride farkli uretir', () => {
    const a = newToken();
    const b = newToken();
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).not.toBe(b);
  });
});
