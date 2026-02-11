import { AsyncLocalStorage } from 'node:async_hooks';

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BRIGHT = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';

export default class Logger {
  #quiet: boolean;
  #verbose: boolean;

  constructor(options: { quiet?: boolean; verbose?: boolean } = {}) {
    this.#quiet = options.quiet ?? false;
    this.#verbose = options.verbose ?? false;
  }

  log(...args: unknown[]) {
    if (!this.#quiet) console.log(...args);
  }

  info(...args: unknown[]) {
    this.log(`${BLUE}🛈${RESET}`, ...args);
  }

  warn(...args: unknown[]) {
    this.log(`${YELLOW}⚠${RESET}`, ...args);
  }

  error(...args: unknown[]) {
    this.log(`${RED}✖${RESET}`, ...args);
  }

  success(...args: unknown[]) {
    this.log(`${GREEN}✔${RESET}`, ...args);
  }

  header(message: string) {
    this.log(`${BRIGHT}${message}${RESET}`);
  }

  step(message: string) {
    if (this.#verbose) this.log(` ${DIM}→ ${message}${RESET}`);
  }
}

const loggerStorage = new AsyncLocalStorage<Logger>({
  defaultValue: new Logger(),
});

export function useLogger(...parameters: ConstructorParameters<typeof Logger>) {
  if (parameters.length > 0) {
    const logger = new Logger(...parameters);
    loggerStorage.enterWith(logger);
    return logger;
  } else {
    return loggerStorage.getStore()!;
  }
}
