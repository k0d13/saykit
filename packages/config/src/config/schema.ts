import * as z from 'zod';

const fn = <T>() => z.custom<T>((v) => typeof v === 'function');

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
  parse: fn<(content: string) => Message[]>(),
  stringify:
    fn<(messages: Message[], context: { locale: string; existingContent?: string }) => string>(),
});
export type Formatter = z.infer<typeof Formatter>;

export const Transformer = z.object({
  match: fn<(id: string) => boolean>(),
  extract: fn<(code: string, id: string) => Message[]>(),
  transform: fn<(code: string, id: string) => string>(),
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

const Bucket = z.object({
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
  transformer: Transformer.or(Transformer.array()),
});

export const Config = z.object({
  locales: z.tuple([z.string()], z.string()),
  /**
   * Per-locale fallback chains, most specific first, e.g.
   * `{ 'en-NZ': ['en-GB'], 'es-MX': 'es' }`. The source locale (the first entry
   * in `locales`) is always appended as the final fallback, so an
   * untranslated key ultimately resolves to the source string.
   */
  fallbackLocales: z.record(z.string(), z.string().or(z.string().array())).optional(),
  buckets: Bucket.array(),
});
export type ConfigInput = z.input<typeof Config>;
export type ParsedConfig = z.output<typeof Config>;
