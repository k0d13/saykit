#!/usr/bin/env node

import { Command, program } from '@commander-js/extra-typings';
import { loadConfig, type SayKitConfig } from '../index.js';
import { Logger, logger, withLogger } from '../logger.js';

/** A command that loads the config and runs `run` with every operation logging to the CLI. */
function command(
  name: string,
  description: string,
  run: (config: SayKitConfig, options: { watch: boolean }) => unknown,
) {
  const cmd = new Command(name)
    .description(description)
    .option('-v, --verbose', 'enable verbose logging', false)
    .option('-q, --quiet', 'suppress all logging', false);
  if (name === 'extract') cmd.option('-w, --watch', 'watch source files for changes', false);

  return cmd.action((options) =>
    withLogger(new Logger(options), async () => {
      await run(loadConfig(), { watch: Boolean((options as { watch?: boolean }).watch) });
    }),
  );
}

program
  .name('saykit')
  .helpOption('-h, --help', 'Display help for command')
  .helpCommand('help [command]', 'Display help for command')
  .addCommand(
    command('extract', 'Extract messages from source files', (config, { watch }) => {
      logger().header('🛠 Extracting Messages');
      return config.extract({ watch });
    }),
  )
  .addCommand(
    // For setups without a build plugin: plain `babel`, or CI that type-checks before it builds
    command('compile', 'Compile catalogues into locale modules', (config) => {
      logger().header('⚙ Compiling Catalogues');
      config.compile();
      logger().success('Catalogues compiled');
    }),
  )
  .addCommand(
    command(
      'clean',
      'Remove orphaned and untranslated entries from non-source locale files',
      (config) => {
        logger().header('🧹 Cleaning Locales');
        config.clean();
        logger().success('Locales cleaned');
      },
    ),
  )
  .parse();
