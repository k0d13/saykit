import { loadConfig } from '@saykit/config';
import { createUnplugin } from 'unplugin';

/**
 * Compile catalogues into the modules the app imports, and rewrite `say` call sites into the
 * descriptors the runtime formats.
 *
 * Catalogues load as plain `.js` modules, so nothing is intercepted: they are compiled when the
 * build starts, and again in watch mode whenever a catalogue changes, which the bundler then sees
 * as an ordinary change to the generated module.
 * One plugin rather than a list, so each bundler entry is typed as a single plugin.
 */
export default createUnplugin<undefined, false>((_options?: never) => {
  const config = loadConfig();

  return {
    name: 'saykit',
    enforce: 'pre',

    buildStart() {
      // Catalogues are not in the module graph, so ask the bundler to watch them for us
      const sources = config.compile().flatMap((module) => module.sources);
      for (const path of sources) this.addWatchFile(path);
    },

    watchChange(id) {
      // A catalogue saved mid-edit can fail to parse. Report it and keep the dev server running,
      // the next save recompiles
      try {
        config.fileChanged(id);
      } catch (error) {
        console.error('[saykit] Failed to compile catalogues', error);
      }
    },

    transform: {
      filter: { id: { exclude: /node_modules/ } },
      handler: (code, id) => config.transform(code, id) ?? code,
    },
  };
});
