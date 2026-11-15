#!/usr/bin/env node

import { Command, program } from '@commander-js/extra-typings';
import { toId } from '../config/resolve.js';
import { type CheckResult, loadConfig, type Message, type SayKitConfig } from '../index.js';
import { Logger, logger, withLogger } from '../logger.js';

/** A command that loads the config and runs `run` with every operation logging to the CLI. */
function command(name: string, description: string) {
  return new Command(name)
    .description(description)
    .option('-v, --verbose', 'enable verbose logging', false)
    .option('-q, --quiet', 'suppress all logging', false);
}

function run(options: { verbose: boolean; quiet: boolean }, fn: (config: SayKitConfig) => unknown) {
  return withLogger(new Logger(options), async () => {
    await fn(loadConfig());
  });
}

const label = (m: Message) =>
  (m.id ?? JSON.stringify(m.message)) + (m.context ? ` (context: ${m.context})` : '');

/** Print each out-of-date catalogue with the messages that make it so. */
function report(config: SayKitConfig, results: CheckResult[]) {
  for (const r of results) {
    const file = toId(config.root, r.path);
    const list = (marker: string, messages: Message[]) => {
      for (const m of messages) logger().log(`   ${marker} ${label(m)}`);
    };

    if (r.locale === config.sourceLocale && r.stale) {
      logger().error(`${file} is out of date`);
      list('+', r.added);
      list('-', r.removed);
      list('~', r.updated);
    } else if (r.stale) {
      logger().error(`${file} does not exist yet`);
    }
    if (r.untranslated.length) {
      logger().error(`${file} has ${r.untranslated.length} untranslated message(s)`);
      list('?', r.untranslated);
    }
    if (r.orphaned.length) {
      logger().error(`${file} has ${r.orphaned.length} orphaned entry(s)`);
      list('-', r.orphaned);
    }
  }
}

const extract = command('extract', 'Extract messages from source files')
  .option('-w, --watch', 'watch source files for changes', false)
  .option('-c, --check', 'fail if extraction would change a catalogue, writing nothing', false)
  .option('--untranslated', 'with --check, also fail on untranslated messages', false)
  .option('--orphaned', 'with --check, also fail on entries that clean would remove', false)
  .action((options, cmd) => {
    if (options.check && options.watch) cmd.error('error: --check cannot be used with --watch');
    if (!options.check && (options.untranslated || options.orphaned))
      cmd.error('error: --untranslated and --orphaned need --check');

    return run(options, async (config) => {
      if (!options.check) {
        logger().header('🛠 Extracting Messages');
        return config.extract({ watch: options.watch });
      }

      logger().header('🔍 Checking Catalogues');
      const results = await config.check(options);
      if (!results.length) return logger().success('Catalogues are up to date');
      report(config, results);
      if (results.some((r) => r.stale)) logger().info('Run `saykit extract` to update them');
      process.exitCode = 1;
    });
  });

program
  .name('saykit')
  .helpOption('-h, --help', 'Display help for command')
  .helpCommand('help [command]', 'Display help for command')
  .addCommand(extract)
  .addCommand(
    // For setups without a build plugin: plain `babel`, or CI that type-checks before it builds
    command('compile', 'Compile catalogues into locale modules').action((options) =>
      run(options, (config) => {
        logger().header('⚙ Compiling Catalogues');
        config.compile();
        logger().success('Catalogues compiled');
      }),
    ),
  )
  .addCommand(
    command(
      'clean',
      'Remove orphaned and untranslated entries from non-source locale files',
    ).action((options) =>
      run(options, (config) => {
        logger().header('🧹 Cleaning Locales');
        config.clean();
        logger().success('Locales cleaned');
      }),
    ),
  )
  .parse();
