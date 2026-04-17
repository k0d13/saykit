import picomatch from 'picomatch';
import * as z from 'zod';

export const Message = z.object({
  message: z.string(),
  translation: z.string().optional(),
  id: z.string().optional(),
  context: z.string().optional(),
  comments: z.string().array(),
  references: z.string().array(),
});
export type Message = z.infer<typeof Message>;

export const Formatter = z.object({
  extension: z.string(),
  parse: z.custom<(content: string, context: { locale: string }) => Message[]>(
    (v) => typeof v === 'function',
  ),
  stringify: z.custom<(messages: Message[], context: { locale: string }) => string>(
    (v) => typeof v === 'function',
  ),
});
export type Formatter = z.infer<typeof Formatter>;

export const Transformer = z.object({
  match: z.custom<(id: string) => boolean>((v) => typeof v === 'function'),
  extract: z.custom<(id: string, content: string) => Message[]>((v) => typeof v === 'function'),
  transform: z.custom<(id: string, content: string) => string>((v) => typeof v === 'function'),
});
export type Transformer = z.infer<typeof Transformer>;

export const Bucket = z.intersection(
  z
    .object({
      include: z.string().array(),
      exclude: z.string().array().optional(),
    })
    .transform((v) => ({
      ...v,
      match: picomatch(v.include, { ignore: v.exclude }) as (id: string) => boolean,
    })),
  z.object({
    output: z.templateLiteral([z.string(), '{locale}', z.string(), '.{extension}']),
    formatter: Formatter,
    transformer: z.union([
      Transformer,
      Transformer.array()
        .min(1)
        .transform((v) => ({
          match: (id: string) => v.some((t) => t.match(id)),
          extract: (id: string, content: string) =>
            v.flatMap((t) => (t.match(id) ? t.extract(id, content) : [])),
          transform: (id: string, content: string) =>
            v.reduce((p, t) => (t.match(id) ? t.transform(id, p) : p), content),
        })),
    ]),
  }),
);
export type Bucket = z.infer<typeof Bucket>;

export const Configuration = z
  .object({
    sourceLocale: z.string(),
    locales: z.tuple([z.string()], z.string()),
    fallbackLocales: z.record(z.string(), z.string().array()).optional(),
    buckets: Bucket.array(),
  })
  .refine((config) => config.sourceLocale === config.locales[0], {
    error: 'sourceLocale must be the same as locales[0]',
  });
export type Configuration = z.infer<typeof Configuration>;
