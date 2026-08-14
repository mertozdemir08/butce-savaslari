import { randomInt, randomUUID } from 'node:crypto';
import { CODE_ALPHABET, CODE_LENGTH } from '@/lib/game/constants';

export function generateCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

/** Cihazi takima baglayan gizli jeton. */
export function newToken(): string {
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
}
