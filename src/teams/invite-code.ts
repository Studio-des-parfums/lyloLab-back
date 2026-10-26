import { randomInt } from 'node:crypto';

// No 0/O/1/I so codes can be read out loud or copied by hand.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LENGTH = 8;

export function generateInviteCode(): string {
  return Array.from({ length: LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

export function normalizeInviteCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}
