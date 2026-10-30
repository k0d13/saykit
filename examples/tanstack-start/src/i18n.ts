import { createCatalogue } from 'saykit';
import enGB from './locales/en-GB.js';
import enNZ from './locales/en-NZ.js';
import en from './locales/en.js';
import fr from './locales/fr.js';

export const catalogue = createCatalogue({
  en: en,
  'en-GB': enGB,
  'en-NZ': enNZ,
  fr: fr,
});
