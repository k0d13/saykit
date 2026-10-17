import { createCatalogue } from 'saykit';
import en from './locales/en.js';
import fr from './locales/fr.js';
import ja from './locales/ja.js';
import pl from './locales/pl.js';

export const locales = ['en', 'fr', 'pl', 'ja'] as const;
export type Locale = (typeof locales)[number];

export const catalogue = createCatalogue({ en, fr, pl, ja });
