import 'server-only';
import { createElement, type ReactNode } from 'react';
import { SayProvider as ClientProvider } from './client.js';
import { getSay } from './server.js';

/**
 * The server build of `@saykit/react/client`.
 *
 * A store cannot cross the server/client boundary, but the locale, messages and options can.
 * This reads them off the view set by {@link import('./server.js').setSay} and passes them
 * to the real provider, so `<SayProvider>` on the server takes no props.
 */
export function SayProvider({ children }: { children?: ReactNode }) {
  const say = getSay();
  return createElement(
    ClientProvider,
    { locale: say.locale, messages: say.messages, options: say.options },
    children,
  );
}
