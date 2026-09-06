import { createCatalogue } from 'saykit';
import de from './locales/de.js';
import en from './locales/en.js';
import fr from './locales/fr.js';

export const locales = ['en', 'fr', 'de'] as const;
export type Locale = (typeof locales)[number];

export const catalogue = createCatalogue({ en, fr, de });

export function environmentLocale() {
  const raw = process.env.LC_ALL ?? process.env.LC_MESSAGES ?? process.env.LANG ?? '';
  const tag = raw.split('.')[0]?.replace('_', '-');

  return catalogue.match(tag ? [tag] : []);
}
