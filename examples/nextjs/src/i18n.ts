import { createWithSay } from '@saykit/react/server';
import { createCatalogue } from 'saykit';
import en from './locales/en.js';
import fr from './locales/fr.js';
import pl from './locales/pl.js';

export const catalogue = createCatalogue({ en, fr, pl });

export const withSay = createWithSay(catalogue);
