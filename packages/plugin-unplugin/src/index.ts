import { relative } from 'node:path';
import { resolveConfig } from '@saykit/config/features/loader';
import { createUnplugin } from 'unplugin';

// TODO: this does not need to be in this file, can move somewhere shared?
function transformSource(id_: string, content: string) {
  const config = resolveConfig();
  const id = relative(process.cwd(), id_).replaceAll('\\', '/').split('?')[0]!;
  const bucket = config.buckets.find((b) => b.match(id));
  return bucket?.transformer.transform(id, content) ?? content;
}

export default createUnplugin((_options?: never) => {
  return {
    name: 'saykit',
    transform: {
      filter: { id: { exclude: /node_modules/ } },
      handler: (code, id) => transformSource(id.replaceAll('\\', '/'), code),
    },
    enforce: 'pre',
  };
});
