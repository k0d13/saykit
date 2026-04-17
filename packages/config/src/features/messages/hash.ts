import { sha256 } from 'js-sha256';

export function generateHash(input: string, context?: string) {
  const hasher = sha256.create();
  hasher.update(`${input}\u{001F}${context || ''}`);
  const result = hasher.toString();

  const elements = result.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || [];
  const bytes = Uint8Array.from(elements);
  return btoa(String.fromCharCode(...bytes)).slice(0, 6);
}
