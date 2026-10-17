import { BaseCommand, BaseComponent, Modal } from '@buape/carbon';
import type { Catalogue, View } from 'saykit';
import { combineCommandOptions } from '#/utils/combine-command-options.js';

type Keys =
  | 'name'
  | 'description'
  | 'label'
  | 'title'
  | 'placeholder'
  | 'content'
  | 'options'
  | 'components'
  | 'subcommands'
  | 'subcommandGroups';

type AbstractConstructor<
  Args extends any[] = any[],
  Instance extends object = object,
> = abstract new (...args: Args) => Instance;

type SayProps<T> = Pick<T, Extract<keyof T, Keys>>;

interface WithSay {
  /**
   * Enhances a {@link BaseCommand} subclass with support for localisation.
   *
   * @param Base Abstract command constructor to extend.
   * @returns A new constructor that accepts a properties-mapping function and
   * the original constructor arguments.
   */
  <Args extends unknown[], Instance extends BaseCommand>(
    Base: AbstractConstructor<Args, Instance>,
  ): AbstractConstructor<
    [properties: (say: View) => SayProps<Instance>, ...args: Args],
    Instance & Partial<Record<Keys, unknown>>
  >;

  /**
   * Enhances a {@link BaseComponent} or {@link Modal} subclass with
   * support for localisation.
   *
   * @param Base Abstract component or modal constructor to extend.
   * @returns A new constructor that accepts a set of properties.
   */
  <Args extends unknown[], Instance extends BaseComponent | Modal>(
    Base: AbstractConstructor<Args, Instance>,
  ): AbstractConstructor<
    [properties: SayProps<Instance>, ...args: Args],
    Instance & Partial<Record<Keys, unknown>>
  >;
}

/**
 * Bind a `withSay` to a {@link Catalogue}, normally once beside the catalogue
 * itself.
 *
 * `withSay` wraps a Carbon base class so a command's name, description and
 * options are built once per locale in the catalogue and registered with
 * Discord as localisations, without the command having to reach for the
 * catalogue itself.
 *
 * @example
 * ```ts
 * // i18n.ts
 * export const withSay = createWithSay(catalogue);
 *
 * // commands/pick.ts
 * export class PickCommand extends withSay(Command) {
 *   constructor() {
 *     super((say) => ({ name: say`pick`, description: say`What we are reading.` }));
 *   }
 * }
 * ```
 *
 * @param catalogue The catalogue to take views from
 * @returns A `withSay` bound to that catalogue
 * @throws If the base class is neither a {@link BaseCommand} nor a
 * {@link BaseComponent}
 */
export function createWithSay(catalogue: Catalogue): WithSay {
  // Per catalogue, since the derived command class closes over it
  const cache = new WeakMap<AbstractConstructor, AbstractConstructor>();

  return function withSay<Args extends unknown[], Instance extends object>(
    Base: AbstractConstructor<Args, Instance>,
  ) {
    if (cache.has(Base)) return cache.get(Base)!;

    if (Base.prototype instanceof BaseCommand) {
      const Derived = createSayCommand(catalogue, Base as typeof BaseCommand);
      cache.set(Base, Derived);
      return Derived;
    }

    if (Base.prototype instanceof BaseComponent || Base === Modal) {
      const Derived = createSayComponent(Base as typeof BaseComponent);
      cache.set(Base, Derived);
      return Derived;
    }

    throw new Error('Invalid base class');
  } as WithSay;
}

function createSayCommand<Args extends unknown[], Instance extends BaseCommand>(
  catalogue: Catalogue,
  Base: AbstractConstructor<Args, Instance>,
) {
  // @ts-expect-error - abstract
  abstract class SayCommand extends Base {
    constructor(
      properties: (say: View) => Pick<Instance, Extract<keyof Instance, Keys>>,
      ...args: Args
    ) {
      super(...args);

      const records = Array.from(catalogue).reduce<Record<string, any>>((acc, [locale, say]) => {
        acc[locale] = properties(say);
        return acc;
      }, {});

      // Discord takes one set of names and localisations for the rest, so the
      // catalogue's first locale is the one the command is registered under
      const options = combineCommandOptions(records, catalogue.locales[0]);
      Object.assign(this, options);
    }
  }

  return SayCommand;
}

function createSayComponent<Args extends unknown[], Instance extends BaseComponent | Modal>(
  Base: AbstractConstructor<Args, Instance>,
) {
  // @ts-expect-error - abstract, unions
  abstract class SayComponent extends Base {
    constructor(properties?: Pick<Instance, Extract<keyof Instance, Keys>>, ...args: Args) {
      super(...args);
      if (properties) Object.assign(this, properties);
    }
  }

  return SayComponent;
}
