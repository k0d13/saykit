import { defineConfig } from '@saykit/config';
import createFormatter from '@saykit/format-po';

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'fr'],
  buckets: [
    {
      include: ['src/**/*.{ts,tsx}'],
      output: 'src/locales/{locale}.{extension}',
      formatter: createFormatter(),
    },
  ],
});
