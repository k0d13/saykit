import { AsyncLocalStorage } from 'node:async_hooks';

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BRIGHT = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';

export class Logger {
  /** `failuresOnly` is the library default: silent, except `[saykit]`-prefixed errors on stderr. */
  constructor(
    readonly options: { quiet?: boolean; verbose?: boolean; failuresOnly?: boolean } = {},
  ) {}

  log(...args: unknown[]) {
    if (!this.options.quiet && !this.options.failuresOnly) console.log(...args);
  }

  info(...args: unknown[]) {
    this.log(`${BLUE}🛈${RESET}`, ...args);
  }

  error(...args: unknown[]) {
    if (this.options.failuresOnly) console.error('[saykit]', ...args);
    else this.log(`${RED}✖${RESET}`, ...args);
  }

  success(...args: unknown[]) {
    this.log(`${GREEN}✔${RESET}`, ...args);
  }

  header(message: string) {
    this.log(`${BRIGHT}${message}${RESET}`);
  }

  step(message: string) {
    if (this.options.verbose) this.log(` ${DIM}→ ${message}${RESET}`);
  }
}

const storage = new AsyncLocalStorage<Logger>({
  defaultValue: new Logger({ failuresOnly: true }),
});

/** Run `fn` with `logger` as the one every operation inside it reports to. */
export const withLogger = <T>(logger: Logger, fn: () => T) => storage.run(logger, fn);

export const logger = () => storage.getStore()!;
