import { Guild } from '@buape/carbon';
import type { Catalogue, View } from 'saykit';
import { kSay } from '#/constants.js';

declare module '@buape/carbon' {
  interface Guild {
    get say(): View;
  }
}

export function applyGuildExtension() {
  Object.defineProperty(Guild.prototype, 'say', {
    get(this: Guild) {
      const catalogue = Reflect.get(globalThis, kSay) as Catalogue | undefined;
      if (!catalogue)
        throw new Error('No catalogue registered, add SayPlugin to your Carbon client');

      // Views are immutable and memoised, so a guild reads one rather than
      // cloning the catalogue to keep its locale to itself
      return catalogue.locale(catalogue.match([this.rawData.preferred_locale]));
    },
  });

  return () => {
    Object.defineProperty(Guild.prototype, 'say', {
      value: undefined,
    });
  };
}
