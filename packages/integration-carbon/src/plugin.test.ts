import { BaseInteraction, Guild } from '@buape/carbon';
import { createCatalogue } from 'saykit';
import { afterEach, describe, expect, it } from 'vitest';
import { kSay } from '#/constants.js';
import { SayPlugin } from '#/plugin.js';

const makeCatalogue = () => createCatalogue({ en: {}, fr: {} });

// Constructing the plugin installs the `say` getters on the Carbon prototypes
const catalogue = makeCatalogue();
const plugin = new SayPlugin(catalogue);

// Keep the global registered by default; individual tests may clear it
afterEach(() => Reflect.set(globalThis, kSay, catalogue));

/** Minimal object backed by a Carbon prototype, carrying the raw data the getter reads. */
const proto = <T>(prototype: object, rawData: unknown) => {
  const object = Object.create(prototype);
  // `rawData` is a getter on some Carbon prototypes; define an own data property
  // to shadow it
  Object.defineProperty(object, 'rawData', { value: rawData, configurable: true });
  return object as T;
};

describe('SayPlugin', () => {
  it('has the saykit id and registers the catalogue globally', () => {
    expect(plugin.id).toBe('saykit');
    expect(Reflect.get(globalThis, kSay)).toBe(catalogue);
  });
});

describe('guild `say` extension', () => {
  it('matches the guild preferred locale and returns its view', () => {
    const guild = proto<Guild>(Guild.prototype, { preferred_locale: 'fr' });
    const view = guild.say;
    expect(view.locale).toBe('fr');
    // Second access reuses the catalogue's memoised view
    expect(guild.say).toBe(view);
  });

  it('throws when no say instance is registered', () => {
    Reflect.deleteProperty(globalThis, kSay);
    const guild = proto<Guild>(Guild.prototype, { preferred_locale: 'fr' });
    expect(() => guild.say).toThrow('No catalogue registered');
  });
});

describe('interaction `say` extension', () => {
  it('matches the interaction locale and returns its view', () => {
    const interaction = proto<BaseInteraction<never>>(BaseInteraction.prototype, { locale: 'fr' });
    expect(interaction.say.locale).toBe('fr');
  });

  it('throws when no say instance is registered', () => {
    Reflect.deleteProperty(globalThis, kSay);
    const interaction = proto<BaseInteraction<never>>(BaseInteraction.prototype, { locale: 'fr' });
    expect(() => interaction.say).toThrow('No catalogue registered');
  });
});
