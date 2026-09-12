import {
  cloneElement,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import type {
  DateTimeOptions,
  Disallow,
  Named,
  NumberOptions,
  NumeralOptions,
  SelectOptions,
} from 'saykit';
import { Renderer } from '~/components/renderer.js';
import {
  type PropsWithJSXSafeKeys,
  type PropsWithSayChildren,
  resolveValuePropKeys,
} from '~/types.js';

declare function GET_SAY(): import('saykit').View;

/**
 * Render the translation for a descriptor.
 *
 * @param descriptor Descriptor to render the translation for
 * @returns The translation node for the descriptor
 * @remark This is a macro and must be used with the relevant saykit plugin
 */
export function Say(
  props: PropsWithSayChildren<{ id?: string; context?: string; whitespace?: boolean }>,
): ReactElement;
export function Say(props: {
  id?: string;
  message?: string;
  whitespace?: boolean;
  [match: string]: unknown;
}) {
  if (!('id' in props) && !('message' in props))
    throw new Error("'Say' is a macro and must be used with the relevant saykit plugin", {
      cause: new Error("The 'id' property is required for a descriptor"),
    });

  const say = GET_SAY();
  const { id, message, whitespace, ...rest } = props;
  const values = resolveValuePropKeys(rest);

  return createElement(Renderer, {
    // The props go through still prefixed, since `View#call` does the single
    // strip for every caller. The id is merged in last, so a message free to
    // name a value `id` cannot displace the message being looked up
    html: say.call(message === undefined ? { ...rest, id: id! } : { ...rest, message }),
    whitespace,
    components(tag?: string) {
      if (tag && tag in values && isValidElement(values[tag])) {
        const element = values[tag]! as ReactElement;
        return (props) => cloneElement(element, { ...(element.props as object), ...props });
      } else {
        return tag;
      }
    },
  });
}

export namespace Say {
  // ===== Macros ===== //

  /**
   * Define a pluralised message.
   *
   * @example
   * ```tsx
   * <Say.Plural
   *   _={count}
   *   one="You have 1 item"
   *   other={<>You have {count} items</>}
   * />
   * ```
   *
   * @param props._ Number to determine the plural form of
   * @param props Options pluralisation rules keyed by CLDR categories or specific numbers
   * @returns The plural form of the number, as a React node
   * @remark This is a macro and must be used with the relevant saykit plugin
   */
  export function Plural(
    props: { _: number | Named<number> } & PropsWithJSXSafeKeys<
      Disallow<NumeralOptions<ReactNode>, 'id' | 'context'>
    >,
  ): ReactNode {
    void props;
    throw new Error("'Say.Plural' is a macro and must be used with the relevant saykit plugin");
  }

  /**
   * Define an ordinal message ("1st", "2nd", "3rd").
   *
   * @example
   * ```tsx
   * <Say.Ordinal
   *   _={position}
   *   1={<>{position}st</>}
   *   2={<>{position}nd</>}
   *   3={<>{position}rd</>}
   *   other={<>{position}th</>}
   * />
   * ```
   *
   * @param props._ Number to determine the ordinal form of
   * @param props Options ordinal rules keyed by CLDR categories or specific numbers
   * @returns The ordinal form of the number, as a React node
   * @remark This is a macro and must be used with the relevant saykit plugin
   */
  export function Ordinal(
    props: { _: number | Named<number> } & PropsWithJSXSafeKeys<
      Disallow<NumeralOptions<ReactNode>, 'id' | 'context'>
    >,
  ): ReactNode {
    void props;
    throw new Error("'Say.Ordinal' is a macro and must be used with the relevant saykit plugin");
  }

  /**
   * Define a select message, for gender, status, or other categories.
   *
   * @example
   * ```tsx
   * <Say.Select
   *   _={gender}
   *   male="He"
   *   female="She"
   *   other="They"
   * />
   * ```
   *
   * @param props._ Selector value to determine which option is chosen
   * @param props Options a mapping of possible selector values to message strings
   * @returns The select form of the value, as a React node
   * @remark This is a macro and must be used with the relevant saykit plugin
   */
  export function Select(
    props: { _: string | number | Named<string | number> } & PropsWithJSXSafeKeys<
      Disallow<SelectOptions<ReactNode>, 'id' | 'context'>
    >,
  ): ReactNode {
    void props;
    throw new Error("'Say.Select' is a macro and must be used with the relevant saykit plugin");
  }

  /**
   * Format a number the way the active locale writes one.
   *
   * Unlike `Say.Plural`, `Say.Ordinal` and `Say.Select`, this is a fragment
   * rather than a whole message, and is normally written inside one.
   *
   * @example
   * ```tsx
   * <Say>You have <Say.Number _={items.length} /> items</Say>
   * <Say>Battery at <Say.Number _={level} style="percent" /></Say>
   * <Say>Total <Say.Number _={total} style="::currency/EUR" /></Say>
   * ```
   *
   * @param props._ Number to format
   * @param props.style A named style, an ICU skeleton such as
   *   `::currency/EUR`, or a pattern such as `#,##0.00`
   * @returns The formatted number, as a React node
   * @remark This is a macro and must be used with the relevant saykit plugin
   */
  export function Number(
    props: { _: number | Named<number> } & Disallow<NumberOptions, 'id' | 'context'>,
  ): ReactNode {
    void props;
    throw new Error("'Say.Number' is a macro and must be used with the relevant saykit plugin");
  }

  /**
   * Format the date portion of a value the way the active locale writes one.
   *
   * @example
   * ```tsx
   * <Say>Published <Say.Date _={post.publishedAt} style="medium" /></Say>
   * <Say>Published <Say.Date _={post.publishedAt} style="::yMMMM" /></Say>
   * ```
   *
   * @param props._ Date to format
   * @param props.style A named style or an ICU skeleton such as `::yyyyMMdd`
   * @returns The formatted date, as a React node
   * @remark This is a macro and must be used with the relevant saykit plugin
   */
  export function Date(
    props: { _: globalThis.Date | number | Named<globalThis.Date | number> } & Disallow<
      DateTimeOptions,
      'id' | 'context'
    >,
  ): ReactNode {
    void props;
    throw new Error("'Say.Date' is a macro and must be used with the relevant saykit plugin");
  }

  /**
   * Format the time portion of a value the way the active locale writes one.
   *
   * @example
   * ```tsx
   * <Say>Doors open at <Say.Time _={opensAt} style="short" /></Say>
   * <Say>Doors open at <Say.Time _={opensAt} style="::Hm" /></Say>
   * ```
   *
   * @param props._ Date to format
   * @param props.style A named style or an ICU skeleton such as `::Hm`
   * @returns The formatted time, as a React node
   * @remark This is a macro and must be used with the relevant saykit plugin
   */
  export function Time(
    props: { _: globalThis.Date | number | Named<globalThis.Date | number> } & Disallow<
      DateTimeOptions,
      'id' | 'context'
    >,
  ): ReactNode {
    void props;
    throw new Error("'Say.Time' is a macro and must be used with the relevant saykit plugin");
  }
}
