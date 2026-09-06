import { relative } from 'node:path';
import { resolveConfig } from '@saykit/config/features/loader';
import { createUnplugin } from 'unplugin';

/**
 * Rewrite `say` call sites into the descriptors the runtime formats.
 *
 * Transforming source is the whole of the job. A locale is imported as the
 * `.js` module the CLI compiled it into, which every bundler already knows how
 * to load, watch and hot-update, so there is nothing to intercept.
 *
 * One plugin rather than a list, so each bundler entry is typed as a single plugin
 */
export default createUnplugin<undefined, false>((_options?: never) => {
  const config = resolveConfig();

  return {
    name: 'saykit',
    enforce: 'pre',

    transform: {
      filter: { id: { exclude: /node_modules/ } },
      handler: (code, id_) => {
        const id = relative(process.cwd(), id_).replaceAll('\\', '/').split('?')[0]!;
        const bucket = config.buckets.find((b) => b.match(id));
        return bucket?.transformer.transform(code, id) ?? code;
      },
    },
  };
});
