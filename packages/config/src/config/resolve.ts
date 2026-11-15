import { dirname, relative, resolve } from 'node:path';
import picomatch from 'picomatch';
import type { Formatter, Message, ParsedConfig, Transformer } from './schema.js';

/** A path as a forward-slash id relative to `root`, the form every glob is matched against. */
export const toId = (root: string, path: string) =>
  relative(root, resolve(root, path.replace(/\?.*$/, ''))).replaceAll('\\', '/');

export interface Bucket {
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  /** The output template, relative to the config folder, e.g. `src/locales/{locale}.{extension}` */
  readonly output: string;
  readonly formatter: Formatter;
  /** Every transformer of the bucket merged into one */
  readonly transformer: Transformer;
  /** Messages declared in the config, with no call site to extract them from */
  readonly messages: Message[];
  includes(file: string): boolean;
  /** Absolute path of a locale's catalogue */
  cataloguePath(locale: string): string;
  isCatalogue(path: string): boolean;
}

/** What the operations work from: the config's data, resolved against its folder. */
export interface Resolved {
  readonly root: string;
  readonly file: string;
  readonly locales: readonly [string, ...string[]];
  readonly sourceLocale: string;
  readonly buckets: readonly Bucket[];
  /** The locale, its configured fallbacks, then the source locale, most specific first */
  fallbackChain(locale: string): string[];
}

function resolveBucket(root: string, input: ParsedConfig['buckets'][number]): Bucket {
  const { include, output, formatter } = input;
  const exclude = input.exclude ?? [];
  const transformers = Array.isArray(input.transformer) ? input.transformer : [input.transformer];
  const expand = (locale: string) =>
    output.replaceAll('{locale}', locale).replaceAll('{extension}', formatter.extension.slice(1));
  const matchInclude = picomatch(include, { ignore: exclude });
  const matchCatalogue = picomatch(toId(root, expand('*')));

  return {
    include,
    exclude,
    output,
    formatter,
    transformer: {
      match: (id) => transformers.some((t) => t.match(id)),
      extract: (code, id) => transformers.flatMap((t) => (t.match(id) ? t.extract(code, id) : [])),
      transform: (code, id) =>
        transformers.reduce((acc, t) => (t.match(id) ? t.transform(acc, id) : acc), code),
    },
    messages: Object.entries(input.messages ?? {}).map(([id, declared]): Message => {
      const entry = typeof declared === 'string' ? { message: declared } : declared;
      return {
        id,
        message: entry.message,
        // Declaring a message declares the source string, so it is its own
        // translation in the source locale, exactly as an extracted one is
        translation: entry.message,
        context: 'context' in entry ? entry.context : undefined,
        comments: ('comments' in entry ? entry.comments : undefined) ?? [],
        // There is no call site to point a translator at, which is the whole
        // reason the message is declared here
        references: [],
      };
    }),
    includes: (file) => matchInclude(toId(root, file)),
    cataloguePath: (locale) => resolve(root, expand(locale)),
    isCatalogue: (path) => matchCatalogue(toId(root, path)),
  };
}

export function resolveConfig(input: ParsedConfig, file: string): Resolved {
  const root = dirname(file);
  const [sourceLocale] = input.locales;
  return {
    root,
    file,
    locales: input.locales,
    sourceLocale,
    buckets: input.buckets.map((bucket) => resolveBucket(root, bucket)),
    fallbackChain(locale) {
      const configured = input.fallbackLocales?.[locale] ?? [];
      return [...new Set([locale, ...[configured].flat(), sourceLocale])];
    },
  };
}
