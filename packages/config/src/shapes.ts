import picomatch from 'picomatch';
import * as z from 'zod';

export const Message = z.object({
  message: z.string(),
  translation: z.string().optional(),
  id: z.string().optional(),
  context: z.string().optional(),
  comments: z.string().array(),
  references: z.string().array(),
  /** Format-level flags, such as PO's `fuzzy`, kept so a formatter can write them back */
  flags: z.string().array().optional(),
});
export type Message = z.infer<typeof Message>;

export const Formatter = z.object({
  extension: z.templateLiteral(['.', z.string()]),
  parse: z.custom<(content: string) => Message[]>((v) => typeof v === 'function'),
  stringify: z.custom<
    (messages: Message[], context: { locale: string; existingContent?: string }) => string
  >((v) => typeof v === 'function'),
});
export type Formatter = z.infer<typeof Formatter>;

export const Transformer = z.object({
  match: z.custom<(id: string) => boolean>((v) => typeof v === 'function'),
  extract: z.custom<(code: string, id: string) => Message[]>((v) => typeof v === 'function'),
  transform: z.custom<(code: string, id: string) => string>((v) => typeof v === 'function'),
});
export type Transformer = z.infer<typeof Transformer>;

/**
 * A message declared in the config rather than found in source. The shorthand
 * is the source string; the object form adds the metadata a descriptor would
 * otherwise carry.
 */
export const DeclaredMessage = z.string().or(
  z.object({
    message: z.string(),
    context: z.string().optional(),
    comments: z.string().array().optional(),
  }),
);
export type DeclaredMessage = z.infer<typeof DeclaredMessage>;

export const Bucket = z
  .object({
    include: z.string().array(),
    exclude: z.string().array().optional(),
    output: z.templateLiteral([z.string(), '{locale}', z.string(), '.{extension}']),
    /**
     * Messages that belong in the catalogue but have no call site to extract
     * them from, strings owned by a non-JavaScript artefact such as a manifest,
     * a store listing, or an email subject. Keyed by id, so the id is stable and
     * hand-written by definition, and merged into every extraction alongside
     * whatever the transformers find.
     */
    messages: z.record(z.string(), DeclaredMessage).optional(),
    formatter: Formatter,
    transformer: Transformer.transform((t) => [t])
      .or(Transformer.array())
      .transform(
        (t) =>
          ({
            match: (id: string) => t.some((t) => t.match(id)),
            extract: (code: string, id: string) =>
              t.flatMap((t) => (t.match(id) ? t.extract(code, id) : [])),
            transform: (code: string, id: string) =>
              t.reduce((p, t) => (t.match(id) ? t.transform(p, id) : p), code),
          }) satisfies Transformer,
      ),
  })
  .transform((v) => ({
    ...v,
    messages: Object.entries(v.messages ?? {}).map(([id, declared]): Message => {
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
    match: picomatch(v.include, { ignore: v.exclude }) as (id: string) => boolean,
    output: Object.assign(v.output, {
      match: picomatch(
        v.output.replace('{locale}', '*').replace('{extension}', v.formatter.extension.slice(1)),
      ),
    }),
  }));
export type Bucket = z.infer<typeof Bucket>;

export const Config = z.object({
  locales: z.tuple([z.string()], z.string()),
  /**
   * Per-locale fallback chains, most specific first, e.g.
   * `{ 'en-NZ': ['en-GB'], 'es-MX': 'es' }`. The source locale (the first entry
   * in {@link Config.locales}) is always appended as the final fallback, so an
   * untranslated key ultimately resolves to the source string.
   */
  fallbackLocales: z.record(z.string(), z.string().or(z.string().array())).optional(),
  buckets: Bucket.array(),
});
export type Config = z.infer<typeof Config>;
