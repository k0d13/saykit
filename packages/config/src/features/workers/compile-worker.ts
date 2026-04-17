import { readCatalogueMessages } from '~/features/catalogue/storage.js';
import { hydrateTranslations, writeRuntimeTranslations } from '~/features/runtime/translations.js';
import { BucketWorker } from './shared.js';

export class BucketCompileWorker extends BucketWorker {
  #translationsByLocale = new Map<string, Record<string, string>>();

  async compileAll() {
    this.logger.info(`Compiling bucket: ${this.bucket.include}`);

    for (const locale of this.config.locales) {
      await this.compileLocale(locale);
    }

    this.logger.success(`Compilation complete for bucket: ${this.bucket.include}`);
  }

  async compileLocale(locale: string) {
    this.logger.step(`Compiling locale: ${locale}`);

    const messages = await readCatalogueMessages(this.bucket, locale);
    const translations = await hydrateTranslations(
      this.#translationsByLocale,
      this.config,
      this.bucket,
      locale,
      messages,
    );

    this.logger.step(`Writing runtime file for ${locale}`);
    await writeRuntimeTranslations(this.bucket, locale, translations);
  }
}
