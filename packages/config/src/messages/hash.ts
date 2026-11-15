import { sha256 } from 'js-sha256';

/**
 * Hashed in userland rather than with `node:crypto`, because this runs wherever
 * a bundler runs it. `createHash` is one of the entry points `unenv` leaves
 * unimplemented, "[unenv] crypto.createHash is not implemented yet!", so a
 * plugin reaching for it throws in a Nitro or workerd build. The Web Crypto
 * equivalent, `subtle.digest`, is async, and an id is resolved from a
 * synchronous extraction pass.
 */
export function generateHash(input: string, context?: string) {
  const hasher = sha256.create();
  hasher.update(`${input}\u{001F}${context || ''}`);
  const result = hasher.toString();

  const elements = result.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || [];
  const bytes = Uint8Array.from(elements);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
    .slice(0, 6);
}
