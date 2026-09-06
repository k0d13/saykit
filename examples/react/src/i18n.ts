import { createCatalogue, createStore } from 'saykit';

export const locales = ['en', 'fr', 'pl', 'ja'] as const;
export type Locale = (typeof locales)[number];

export const catalogue = createCatalogue({
  en: () => import('./locales/en.js'),
  fr: () => import('./locales/fr.js'),
  pl: () => import('./locales/pl.js'),
  ja: () => import('./locales/ja.js'),
});

const initial = catalogue.match(navigator.languages as string[]);
await catalogue.load(initial);

export const store = createStore(catalogue, initial);
