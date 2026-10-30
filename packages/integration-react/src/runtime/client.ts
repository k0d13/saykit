'use client';

import {
  createContext,
  createElement,
  type PropsWithChildren,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { createCatalogue, createStore, type Store, type View } from 'saykit';

const SayContext = createContext<Store | null>(null);
SayContext.displayName = 'SayContext';

/**
 * Where a provider takes its view from.
 *
 * A store is reactive and can switch locale, but cannot cross the server/client boundary.
 * A locale and its messages can, though the provider built from them has nothing to switch to.
 */
export type SayProviderProps =
  | { store: Store; locale?: never; messages?: never; options?: never }
  | { store?: never; locale: string; messages: View.Messages; options?: View.Options }
  // No props: the server build fills them in from the established view
  | { store?: never; locale?: never; messages?: never; options?: never };

/**
 * Provide a {@link View} to descendant **client** components via context.
 * Must wrap any component tree using {@link useSay} or {@link Say}.
 *
 * @param props.store The store to follow, for an application that switches
 *   locale on the client
 * @param props.locale The current locale, for one that was given a single
 *   locale by the server
 * @param props.messages The messages for that locale, which should be
 *   referentially stable rather than a fresh object literal per render
 * @param props.options How that locale's view formats its messages, as the
 *   server's view was built with
 */
export function SayProvider({
  store,
  locale,
  messages,
  options,
  children,
}: PropsWithChildren<SayProviderProps>) {
  // Read out, so a fresh options literal per render does not rebuild the store
  const bidiIsolation = options?.bidiIsolation;

  // One locale and no catalogue, so this store holds the only view there is.
  // Consumers then read a store either way, and `useSay` has one shape
  const held = useMemo(() => {
    if (store) return store;
    if (locale === undefined || !messages)
      throw new Error("'SayProvider' must be given a store, or a locale and its messages");
    return createStore(createCatalogue({ [locale]: messages }, { bidiIsolation }), locale);
  }, [store, locale, messages, bidiIsolation]);

  return createElement(SayContext.Provider, { value: held }, children);
}

/**
 * Get the current {@link View}, on the client.
 * Must be called within a {@link SayProvider}.
 *
 * The component re-renders when the store switches locale, so the view this
 * returns is the current one rather than the one the tree first mounted with.
 *
 * There is no hook for the store behind it: a store is a module-scope value,
 * so a locale picker imports the one it built and calls {@link Store.set} on
 * it. A provider given a locale and its messages has no catalogue to switch
 * through anyway.
 *
 * @returns The current {@link View}
 * @throws If no provider is in the component tree
 */
export function useSay(): View {
  const store = useContext(SayContext);
  if (!store) throw new Error("'useSay' must be used within a 'SayProvider'");
  // Called on the store rather than passed as a bare reference, so a `Store`
  // written as a class, whose `subscribe` reads `this`, works too. Memoised,
  // since a new function each render would resubscribe on each one
  const subscribe = useMemo(() => (listener: () => void) => store.subscribe(listener), [store]);

  // A view's identity changes only when the locale does, and a catalogue hands
  // the same view back for a locale returned to, so this is a stable snapshot.
  // The server snapshot is the same read: either store holds one view at the
  // point the tree was rendered
  return useSyncExternalStore(
    subscribe,
    () => store.say,
    () => store.say,
  );
}
