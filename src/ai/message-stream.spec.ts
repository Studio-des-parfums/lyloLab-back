import { describe, expect, it } from 'vitest';
import { MessageFieldStream } from './message-stream.js';

function run(json: string, size: number): string {
  const s = new MessageFieldStream();
  let out = '';
  for (let i = 0; i < json.length; i += size) out += s.push(json.slice(i, i + size));
  return out;
}

describe('MessageFieldStream', () => {
  const message = 'Bonjour "Paul"\\ ligne\nsuite — été 🌸 é';
  const json = JSON.stringify({ message, proposal: { summary: 'x "y"', changes: [] } });
  const ascii = JSON.stringify({ message: '🌸 é "q"\n' }).replace(
    /[^\x20-\x7e]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );

  it.each([1, 2, 3, 5, 7, 1000])('decodes the message with chunks of %i', (size) => {
    expect(run(json, size)).toBe(message);
  });

  it.each([1, 3, 5, 11])('decodes \\u escapes split across chunks (%i)', (size) => {
    expect(run(ascii, size)).toBe('🌸 é "q"\n');
  });

  it('ignores everything after the message', () => {
    expect(run('{"message":"a","proposal":{"summary":"message"}}', 4)).toBe('a');
  });
});
