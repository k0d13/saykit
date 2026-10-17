import 'server-only';
import { cache, createElement, type FunctionComponent, type ReactNode } from 'react';
import type { Catalogue, View } from 'saykit';

/**
 * Where the view for the request being rendered lives.
 *
 * `React.cache` is per request, which is the isolation a server needs.
 * `AsyncLocalStorage` cannot do this job here: a server component's children
 * are rendered after it returns rather than inside the call it makes, so there
 * is no callback to wrap them in, which is why {@link setSay} writes the cell
 * instead.
 *
 * It is also why the cell holds one view for the whole request: a second view
 * replaces the first for everything rendered after it rather than for its own
 * subtree. `warned` keeps that warning to one per request.
 */
const cell = cache<() => { view: View | undefined; warned: boolean }>(() => ({
  view: undefined,
  warned: false,
}));

/** What a read says when nothing established a view. */
const NO_VIEW =
  "'getSay' must be called below a 'withSay'. Wrap the component in " +
  "'withSay(Component, (props) => props.params.then((params) => params.locale))'.";

/** What a second locale in one request is warned about, in development. */
const SECOND_VIEW = (established: string, next: string) =>
  `A view for '${next}' was established while '${established}' was already established for this ` +
  "request. A view is per request rather than per subtree: React renders a server component's " +
  'children after it returns, so there is nowhere to put the previous view back, and everything ' +
  `rendered after this point reads '${next}' - including components outside the one that ` +
  "established it, and the messages 'SayProvider' hands to the client. Render the other " +
  'locale in its own request, or resolve its view yourself and pass it to the components that ' +
  'need it.';

/**
 * Get the current {@link View}, on the server.
 * Must be called below a {@link setSay}, which {@link createWithSay} does for
 * you.
 *
 * The server counterpart of `useSay`. Reach for it when you need the locale as
 * *data*, to build an `Intl.NumberFormat` say, rather than as a rendered
 * message, which is what `<Say>` is for.
 *
 * @example
 * ```tsx
 * const say = getSay();
 * const price = new Intl.NumberFormat(say.locale, { style: 'currency', currency }).format(total);
 * ```
 *
 * @returns The current {@link View}
 * @throws If no view has been established for this request
 */
export function getSay(): View {
  const view = cell().view;
  if (!view) throw new Error(NO_VIEW);
  return view;
}

/**
 * Establish the {@link View} for everything rendered after this point, on the
 * server. Reach for it when you already have a view; {@link createWithSay}
 * negotiates and loads one for you.
 *
 * Per request is the limit. React renders a server component's children after
 * it returns, so a view does not end where a subtree does: a second view takes
 * over for everything rendered after it, including the messages
 * `<SayProvider>` hands to the client. Development warns when that happens.
 *
 * @param view The view to establish
 */
export function setSay(view: View): void {
  const request = cell();

  if (
    process.env.NODE_ENV !== 'production' &&
    !request.warned &&
    request.view &&
    request.view.locale !== view.locale
  ) {
    request.warned = true;
    console.warn(SECOND_VIEW(request.view.locale, view.locale));
  }

  // The cell is the request's, so this is reachable for the rest of the render
  // and by nothing outside it
  request.view = view;
}

/**
 * Bind a `withSay` to a {@link Catalogue}, normally once beside the catalogue
 * itself.
 *
 * `withSay` wraps a server component so its view is negotiated, loaded and
 * established before the component renders, which `<Say>` and {@link getSay}
 * then read at any depth below.
 *
 * Every route segment that renders messages wraps itself, rather than
 * inheriting from a parent. A framework is free to render a page before the
 * layout above it - Next.js does - and a parent that has not run yet has
 * established nothing.
 *
 * A `<SayProvider>` written inside a wrapped component takes no props of its
 * own: the server build of `@saykit/react/client` reads the established view
 * and hands the locale and its messages across the boundary, which compiling
 * messages to data rather than to functions is what allows.
 *
 * @example
 * ```tsx
 * // i18n.ts
 * export const withSay = createWithSay(catalogue);
 *
 * // app/[locale]/page.tsx
 * export default withSay(Page, (props) => props.params.then((params) => params.locale));
 * ```
 *
 * @param catalogue The catalogue to take views from
 * @returns A `withSay` bound to that catalogue
 */
export function createWithSay<Locale extends string>(catalogue: Catalogue<Locale>) {
  return function withSay<P>(
    Component: (props: P) => ReactNode,
    locale: (props: P) => Catalogue.Guess | Promise<Catalogue.Guess>,
  ) {
    return async function WithSay(props: P): Promise<ReactNode> {
      setSay(await catalogue.load(catalogue.match(await locale(props))));
      return createElement(Component as FunctionComponent<P & object>, props as P & object);
    };
  };
}
