import { Say } from 'saykit';

const say = new Say({
  locales: ['en', 'fr'],
  messages: {
    en: await import('./locales/en.json').then((m) => m.default),
    fr: await import('./locales/fr.json').then((m) => m.default),
  },
});

say.load();
say.activate('en');

export default say;
