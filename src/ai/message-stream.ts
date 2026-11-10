/**
 * Extracts the "message" string of the assistant's JSON answer while it is
 * still being generated, so its text can be streamed to the user token by
 * token. Feed it raw JSON chunks; it returns the decoded text of "message"
 * contained in each chunk. Escape sequences split across chunks are handled.
 */
export class MessageFieldStream {
  private state: 'seek' | 'inside' | 'done' = 'seek';
  private pending = '';

  push(chunk: string): string {
    if (this.state === 'done') return '';
    this.pending += chunk;

    if (this.state === 'seek') {
      const match = /"message"\s*:\s*"/.exec(this.pending);
      if (!match) {
        // Keep only a tail long enough to hold a split key.
        this.pending = this.pending.slice(-32);
        return '';
      }
      this.pending = this.pending.slice(match.index + match[0].length);
      this.state = 'inside';
    }

    let out = '';
    let i = 0;
    const s = this.pending;
    while (i < s.length) {
      const c = s[i];
      if (c === '"') {
        this.state = 'done';
        this.pending = '';
        return out;
      }
      if (c !== '\\') {
        out += c;
        i++;
        continue;
      }
      // Escape sequence: wait for the rest if it was cut.
      if (i + 1 >= s.length) break;
      const e = s[i + 1];
      if (e === 'u') {
        if (i + 6 > s.length) break;
        const code = parseInt(s.slice(i + 2, i + 6), 16);
        // Surrogate pair: wait for the low half before emitting.
        if (code >= 0xd800 && code <= 0xdbff) {
          if (i + 12 > s.length) break;
          if (s.slice(i + 6, i + 8) === '\\u') {
            out += String.fromCharCode(code, parseInt(s.slice(i + 8, i + 12), 16));
            i += 12;
            continue;
          }
        }
        out += String.fromCharCode(code);
        i += 6;
        continue;
      }
      const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' };
      out += map[e] ?? e;
      i += 2;
    }
    this.pending = s.slice(i);
    return out;
  }
}
