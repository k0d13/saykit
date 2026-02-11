import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { err, ok } from 'neverthrow';
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
  extension: z.templateLiteral(['.', z.string()]).transform((v) => v.slice(1)),
  parse: z.custom<
    (content: string, context: { locale: string }) => Promise<Message[]>
  >((v) => typeof v === 'function'),
  stringify: z.custom<
    (messages: Message[], context: { locale: string }) => Promise<string>
  >((v) => typeof v === 'function'),
});
export type Formatter = z.infer<typeof Formatter>;

async function tryImport(id: string) {
  const require = createRequire(join(process.cwd(), 'noop.js'));
  try {
    const url = pathToFileURL(require.resolve(id));
    return ok(await import(url.toString()));
  } catch {
    return err(`Cannot find package '${id}', required by saykit`);
  }
}

export const Bucket = z
  .object({
    include: z.array(z.string()),
    exclude: z.array(z.string()).optional(),
    output: z.templateLiteral([
      z.string(),
      '{locale}',
      z.string(),
      '.{extension}',
    ]),

    formatter: Formatter.optional().transform(async (formatter, context) => {
      if (formatter) return formatter;

      const module = await tryImport('@saykit/format-po');
      if (module.isErr()) {
        context.addIssue(module.error);
        return z.NEVER;
      }
      formatter = module.value.default();

      const result = Formatter.safeParse(formatter);
      if (result.error) {
        for (const issue of result.error.issues) context.addIssue({ ...issue });
        return z.NEVER;
      }
      return result.data;
    }),
  })
  .transform((v) => ({
    ...v,
    match: picomatch(v.include, { ignore: v.exclude }),
  }));
export type Bucket = z.infer<typeof Bucket>;

export const Configuration = z
  .object({
    sourceLocale: z.string(),
    locales: z.tuple([z.string()], z.string()),
    fallbackLocales: z.record(z.string(), z.array(z.string())).optional(),
    buckets: z.array(Bucket),
  })
  .refine(
    (c) => c.sourceLocale === c.locales[0],
    'sourceLocale must be the same as the first locale',
  );
export type Configuration = z.infer<typeof Configuration>;
