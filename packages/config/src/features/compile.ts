import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { generateHash } from '@saykit/babel-plugin/core';
import type { Bucket, Configuration, Message } from '~/shapes.js';
import { expandOutputPath } from './extract.js';

//

export async function hydrateTranslations(
  cache: Map<string, Record<string, string>>,
  config: Configuration,
  bucket: Bucket,
  locale: string,
  messages: Message[],
) {
  if (cache.has(locale)) return cache.get(locale)!;

  const translations = //
    await applyFallbackTranslations(cache, config, bucket, locale, messages);
  cache.set(locale, translations);
  return translations;
}

function getFallbackChain(config: Configuration, locale: string) {
  return [...(config.fallbackLocales?.[locale] ?? []), config.sourceLocale];
}

export async function applyFallbackTranslations(
  cache: Map<string, Record<string, string>>,
  config: Configuration,
  bucket: Bucket,
  locale: string,
  messages: Message[],
) {
  const fallbacks = getFallbackChain(config, locale);

  const translations: Record<string, string> = {};

  for (const message of messages) {
    const key = message.id ?? generateHash(message.message, message.context);

    if (message.translation) {
      translations[key] = message.translation;
      continue;
    }

    for (const fallback of fallbacks) {
      const fallbackMessages = //
        await hydrateTranslations(cache, config, bucket, fallback, messages);
      if (fallbackMessages[key]) {
        translations[key] = fallbackMessages[key];
        break;
      }
    }
  }

  return translations;
}

//

export async function writeTranslationsToDisk(
  bucket: Bucket,
  locale: string,
  translations: Record<string, string>,
  path = expandOutputPath(bucket, locale, '.json'),
) {
  const content = JSON.stringify(translations, null, 2);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}
