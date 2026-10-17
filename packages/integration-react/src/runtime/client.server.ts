import 'server-only';
import { createElement, type ReactNode } from 'react';
import { SayProvider as ClientProvider } from './client.js';
import { getSay } from './server.js';

/**
 * The server build of `@saykit/react/client`.
 *
 * A store is a live object and cannot cross the server/client boundary, and a
 * server component cannot hand its own scope to a client one either. What can
 * cross is the locale, its messages and the view's options, the messages being
 * compiled to data rather than to functions for exactly this reason, so this
 * reads them off the view the enclosing segment established with
 * {@link import('./server.js').setSay} and passes them to the real provider,
 * which is why `<SayProvider>` written on the server takes no props.
 */
export function SayProvider({ children }: { children?: ReactNode }) {
  const say = getSay();
  return createElement(
    ClientProvider,
    { locale: say.locale, messages: say.messages, options: say.options },
    children,
  );
}
