import type { ReactNode } from 'react';
import type { Named } from 'saykit';

/**
 * What a message is allowed to contain. On top of everything React renders, a
 * named placeholder, `{{ name: value }}`, reaches the type checker as a plain
 * object child, so the object form has to be part of the contract even though
 * nothing ever renders it: the transform reads the name off it and compiles the
 * child away before React sees the tree.
 */
export type SayNode = ReactNode | Named<unknown> | Iterable<SayNode>;

export type PropsWithSayChildren<P = unknown> = P & { children?: SayNode };

export type PropsWithJSXSafeKeys<T> = {
  [
    K in keyof T as K extends number | `${number}${string}`
      ? `_${K}`
      : K extends `_${number}${string}`
        ? never
        : K
  ]: T[K];
};

/**
 * Map the props the transform compiled a message's values into back to the
 * identifiers they carry. Every value is emitted with one underscore in front,
 * which is what keeps a numbered identifier a valid prop name and what keeps
 * any name a message chooses out of `Say`'s own namespace, so stripping exactly
 * one is the whole inverse: `_0` is `0`, and `__link` is a tag named `_link`.
 *
 * The result is deliberately not typed as the props that went in: renaming the
 * keys is the point, so claiming they survived would be a lie the only caller
 * cannot use anyway, it looks tags up by a name that comes from a translation.
 */
export function resolveValuePropKeys(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key in props) {
    if (key.startsWith('_')) result[key.slice(1)] = props[key];
    else result[key] = props[key];
  }
  return result;
}
