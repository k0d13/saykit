import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expandBucketOutputPath } from '~/features/catalogue/path.js';
import { generateHash } from '~/features/messages/hash.js';
import type { Bucket, Configuration, Message } from '~/shapes.js';

function getFallbackLocaleChain(config: Configuration, locale: string) {
  return [...(config.fallbackLocales?.[locale] ?? []), config.sourceLocale];
}

export async function hydrateTranslations(
  cache: Map<string, Record<string, string>>,
  config: Configuration,
  _bucket: Bucket,
  locale: string,
  messages: Message[],
) {
  if (cache.has(locale)) return cache.get(locale)!;

  const translations = await applyFallbackTranslations(cache, config, _bucket, locale, messages);
  cache.set(locale, translations);
  return translations;
}

export async function applyFallbackTranslations(
  cache: Map<string, Record<string, string>>,
  config: Configuration,
  bucket: Bucket,
  locale: string,
  messages: Message[],
) {
  const fallbackLocales = getFallbackLocaleChain(config, locale);
  const translations: Record<string, string> = {};

  for (const message of messages) {
    const key = message.id ?? generateHash(message.message, message.context);

    if (message.translation) {
      translations[key] = message.translation;
      continue;
    }

    for (const fallbackLocale of fallbackLocales) {
      const fallbackTranslations = await hydrateTranslations(
        cache,
        config,
        bucket,
        fallbackLocale,
        messages,
      );

      if (fallbackTranslations[key]) {
        translations[key] = fallbackTranslations[key];
        break;
      }
    }
  }

  return translations;
}

export async function writeRuntimeTranslations(
  bucket: Bucket,
  locale: string,
  translations: Record<string, string>,
  path = expandBucketOutputPath(bucket, locale, '.json'),
) {
  const content = JSON.stringify(translations, null, 2);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}
