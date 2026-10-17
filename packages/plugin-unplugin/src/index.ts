import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import {
  assembleCatalogueRecord,
  resolveCatalogueSources,
} from '@saykit/config/features/catalogue';
import { resolveConfig } from '@saykit/config/features/loader';
import { createUnplugin, type UnpluginBuildContext } from 'unplugin';

// One plugin rather than a list, so each bundler entry is typed as a single plugin
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

    load: {
      // TODO: Can bucket output be used in this filter?
      filter: { id: { exclude: /node_modules/ } },
      handler: async function (this: UnpluginBuildContext, id_: string) {
        const id = relative(process.cwd(), id_).replaceAll('\\', '/').split('?')[0]!;
        const bucket = config.buckets.find((b) => b.output.match(id));
        if (!bucket) return;

        // The fallback chain (configured fallbacks + the source locale) is
        // merged in here at load time so an untranslated key resolves to a
        // fallback string while the runtime still loads a single locale module
        const { sources } = resolveCatalogueSources(config, bucket, id);
        const contents = await Promise.all(
          sources.map((source) => readFile(source, 'utf8').catch(() => '')),
        );

        // Fallback files feed this module, so editing them should invalidate it
        for (const source of sources) this.addWatchFile?.(source);

        const record = assembleCatalogueRecord(bucket, contents);

        // A `.json` id is interpreted as JSON by whatever runs next (Rollup's
        // json plugin, webpack's `json` module type, esbuild's extension-picked
        // loader), so the ESM wrapper would be a syntax error there
        if (id.endsWith('.json')) return JSON.stringify(record);
        return `export default ${JSON.stringify(record)}`;
      },
    },
  };
});
