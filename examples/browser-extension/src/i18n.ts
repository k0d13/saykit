import { createCatalogue } from 'saykit';
import de from '../_locales/de/messages.js';
import en from '../_locales/en/messages.js';
import fr from '../_locales/fr/messages.js';

export const locales = ['en', 'fr', 'de'] as const;
export type Locale = (typeof locales)[number];

export const catalogue = createCatalogue({ en, fr, de });
