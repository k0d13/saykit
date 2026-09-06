import { getLocales } from 'expo-localization';
import { createCatalogue, createStore } from 'saykit';
import en from './locales/en.js';
import fr from './locales/fr.js';
import ja from './locales/ja.js';

export const locales = ['en', 'fr', 'ja'] as const;
export type Locale = (typeof locales)[number];

export const catalogue = createCatalogue({ en, fr, ja });

export function deviceLocale() {
  const tags = getLocales()
    .map((locale) => locale.languageTag)
    .filter((tag): tag is string => !!tag);

  return catalogue.match(tags);
}

export const store = createStore(catalogue, deviceLocale());
