import { relative } from 'node:path';
import { resolveConfig } from '@saykit/config/features/loader';
import { createUnplugin } from 'unplugin';

export default createUnplugin((_options?: never) => {
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
