import { resolve } from 'node:path';
import { messageKey } from './catalogue/index.js';
import { type CheckOptions, type CheckResult, check } from './check.js';
import { type CleanResult, clean } from './clean.js';
import { type CompiledModule, compile, fileChanged } from './compile.js';
import { load } from './config/load.js';
import type { Bucket, Resolved } from './config/resolve.js';
import type {
  ConfigInput,
  DeclaredMessage,
  Formatter,
  Message,
  Transformer,
} from './config/schema.js';
import { extract } from './extract.js';
import { transform } from './transform.js';
import { watchCatalogues } from './watch.js';

export interface SayKitConfig extends Omit<Resolved, 'fallbackChain'> {
  /** Every bucket and locale, skipping writes that would change nothing */
  compile(): CompiledModule[];
  /** A catalogue changed: recompile the buckets that read it. Any other path gives `[]` */
  fileChanged(path: string): CompiledModule[];
  /** Recompile as catalogues change. Never keeps the process alive; returns a function to stop */
  watch(): () => void;
  /** Scan sources, write the source locale, bootstrap missing locales, then compile */
  extract(options?: { watch?: boolean }): Promise<void>;
  /** Extract in memory and report out-of-date catalogues, writing nothing. `[]` means up to date */
  check(options?: CheckOptions): Promise<CheckResult[]>;
  /** Prune non-source locales against the source locale */
  clean(): CleanResult[];
  /** Transform a file's code, or `undefined` when no bucket includes it */
  transform(code: string, file: string): string | undefined;
}

/** A typed identity: validation happens in {@link loadConfig}, so a config needs no wrapper. */
export function defineConfig<const C extends ConfigInput>(config: C): C {
  return config;
}

/** Find `saykit.config.*` in `cwd`, load and validate it, and bind the operations to it. */
export function loadConfig(options: { cwd?: string } = {}): SayKitConfig {
  const config = load(resolve(options.cwd ?? process.cwd()));
  return {
    ...config,
    compile: () => compile(config),
    fileChanged: (path) => fileChanged(config, path),
    watch: () => watchCatalogues(config),
    extract: (extractOptions) => extract(config, extractOptions),
    check: (checkOptions) => check(config, checkOptions),
    clean: () => clean(config),
    transform: (code, file) => transform(config, code, file),
  };
}

export { messageKey };
export type { CheckOptions, CheckResult } from './check.js';
export type { CleanResult } from './clean.js';
export type { CompiledModule } from './compile.js';
export type { Bucket, ConfigInput, DeclaredMessage, Formatter, Message, Transformer };
