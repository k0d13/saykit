import { createCatalogue } from 'saykit';
import en from './locales/en.js';
import fr from './locales/fr.js';

const catalogue = createCatalogue({ en, fr });

const books = 3;

for (const [locale, say] of catalogue) {
  console.log(`[${locale}]`);
  console.log(say`Welcome to the library`);
  console.log(say.plural(books, { one: `${books} book on loan`, other: `${books} books on loan` }));
  console.log(say`Your card expires soon`);
  console.log();
}
