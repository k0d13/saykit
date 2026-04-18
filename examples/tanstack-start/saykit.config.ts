import { defineConfig } from '@saykit/config';
import createPoFormatter from '@saykit/format-po';
import createJsTransformer from '@saykit/transform-js';
import createJsxTransformer from '@saykit/transform-jsx';

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'fr'],
  buckets: [
    {
      include: ['src/**/*.{ts,tsx}'],
      output: 'src/locales/{locale}/messages.{extension}',
      formatter: createPoFormatter(),
      transformer: [createJsTransformer(), createJsxTransformer()],
    },
  ],
});
