import { defineConfig } from '@saykit/config';
import createPoFormatter from '@saykit/format-po';
import createJsTransformer from '@saykit/transform-js';

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'fr'],
  buckets: [
    {
      include: ['src/**/*.ts'],
      output: 'src/locales/{locale}/messages.{extension}',
      formatter: createPoFormatter(),
      transformer: createJsTransformer(),
    },
  ],
});
