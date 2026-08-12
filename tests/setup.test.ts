import { describe, it, expect } from 'vitest';
import { RESULT_MS } from '@/lib/game/constants';

describe('proje altyapisi', () => {
  it('alias ile lib/game icinden import edebilir', () => {
    expect(RESULT_MS).toBe(2000);
  });
});
