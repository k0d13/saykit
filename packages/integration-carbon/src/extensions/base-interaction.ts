import { type APIInteraction, BaseInteraction } from '@buape/carbon';
import type { Catalogue, View } from 'saykit';
import { kSay } from '#/constants.js';

declare module '@buape/carbon' {
  // oxlint-disable-next-line no-unused-vars
  interface BaseInteraction<T extends APIInteraction> {
    get say(): View;
  }
}

export function applyBaseInteractionExtension() {
  Object.defineProperty(BaseInteraction.prototype, 'say', {
    get<T extends Extract<APIInteraction, { locale: string }>>(this: BaseInteraction<T>) {
      const catalogue = Reflect.get(globalThis, kSay) as Catalogue | undefined;
      if (!catalogue)
        throw new Error('No catalogue registered, add SayPlugin to your Carbon client');

      // Views are immutable and memoised, so an interaction reads one rather
      // than cloning the catalogue to keep its locale to itself
      return catalogue.locale(catalogue.match([this.rawData.locale]));
    },
  });

  return () => {
    Object.defineProperty(BaseInteraction.prototype, 'say', {
      value: undefined,
    });
  };
}
